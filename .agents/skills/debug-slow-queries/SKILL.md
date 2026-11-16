---
name: debug-slow-queries
description: Diagnoses and fixes slow database queries using explain plans, statistics, and targeted indexes or rewrites. Use when an endpoint is slow, a query regresses, cpu spikes, or timeouts appear.
---

# Debug Slow Queries

## Quick Start

Goal: go from "slow" to a verified fix with minimal risk.

## When to use this skill

- p95 latency spikes, timeouts, or sudden cpu growth tied to database load
- a deploy introduces query regression
- tables grow and plans flip (index → seq scan, join strategy changes)

### inputs to collect (before changing anything)

- database engine + version
- query text + typical parameters (not placeholders only)
- runtime evidence: p50/p95, rows returned, timeouts, error logs
- table sizes / row counts (approx)
- relevant indexes + constraints
- environment: prod vs staging, read replica vs primary

## Workflow (default)

1. **reproduce or capture**
   - reproduce in staging with production-like data, or capture the exact query + params from logs
2. **baseline**
   - record current p50/p95 and the explain plan
3. **read the plan**
   - identify where time is spent (scan, join, sort, aggregate)
4. **pick the cheapest safe fix**
   - rewrite query → add/adjust index → update stats → change schema
5. **verify**
   - re-run explain, compare timing, validate correctness
6. **roll out safely**
   - ship behind a flag if needed, monitor, keep rollback path

## Explain plan patterns (what to look for)

### scans

- **sequential scan on large table**
  - likely missing selective predicate index, or predicate is not sargable
- **index scan returning many rows**
  - index exists but selectivity is poor; may need different leading columns or a partial index

### joins

- **nested loop with huge inner iterations**
  - inner side needs an index on join key, or join order needs improvement
- **hash join spilling**
  - work_mem/memory pressure or too many rows; reduce join input with earlier filters

### sorts / aggregates

- **sort on large result**
  - add index to match order by, or paginate differently
- **group by on many rows**
  - pre-filter, pre-aggregate, or add covering index for grouping columns

## Engine-specific commands

### PostgreSQL

**get plan + timing:**

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE) <query>;
```

**check table stats freshness:**

```sql
SELECT relname, n_live_tup, last_analyze, last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

**see indexes:**

```sql
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'your_table';
```

**safe index creation:**

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_name ON your_table (col1, col2);
```

### MySQL

**get plan:**

```sql
EXPLAIN <query>;
```

**get runtime plan details (mysql 8):**

```sql
EXPLAIN ANALYZE <query>;
```

**see indexes:**

```sql
SHOW INDEX FROM your_table;
```

### SQLite

**get plan:**

```sql
EXPLAIN QUERY PLAN <query>;
```

## Fix toolbox (ordered by typical safety)

### 1) query rewrites (often best first)

- **limit early**
  - move filters into subqueries/ctes only if they reduce rows before joins
- **avoid non-sargable predicates**
  - avoid wrapping indexed columns in functions in where clauses
- **replace `select *`**
  - reduce io and sort payload
- **avoid `offset` pagination at scale**
  - use keyset pagination when possible

### 2) index changes

Use this checklist:

- does the where clause filter on a selective column?
- does the join predicate have an index on the inner side?
- does order by match an index prefix?
- is a composite index needed (leading columns matter)?
- can a partial index reduce size (postgres)?

### 3) statistics / maintenance

- analyze / vacuum (postgres) or optimize/analyze table (mysql) can fix bad estimates
- confirm cardinality estimates vs actual rows in explain analyze

### 4) schema-level changes (highest cost)

- denormalize only after proving query/index fixes are insufficient
- consider materialized views / summary tables for heavy aggregates

## Output format (copy/paste)

```markdown
## slow query report

### symptom

- endpoint/job:
- p50/p95:
- query:

### evidence

- explain plan notes:
- row counts:
- indexes involved:

### root cause

- primary bottleneck:
- why it happens:

### fix

- change:
- risk:
- rollback:

### verification

- before:
- after:
- correctness checks:
```
