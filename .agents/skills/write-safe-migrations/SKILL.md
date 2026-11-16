---
name: write-safe-migrations
description: Plans and executes safe database migrations with low-downtime patterns, verification, and rollback. Use when changing schema, backfilling data, adding constraints, or creating indexes in production.
---

# Write Safe Migrations

## Quick Start

Default approach: **expand → migrate → contract**.

Goal: reduce lock time, keep rollback easy, and prove correctness with checks.

## When to use this skill

- any production schema change (especially large tables)
- adding columns/indexes/constraints, renames, backfills, or data moves
- when rollback must be possible without restoring from backup

## Before you start (inputs)

- database engine + version
- migration goal (what changes, why)
- table size + write rate + peak hours
- lock tolerance (seconds) and downtime tolerance
- app deploy constraints (can you do multiple deploys?)

## Common safe patterns

### add column (nullable) + backfill + enforce

1. add new nullable column
2. deploy app writing both old + new (or only new with fallback)
3. backfill in batches
4. add constraint / set not null (engine-specific)
5. remove old column in a later deploy

### add index safely

- postgres: `create index concurrently`
- mysql: use online ddl when supported; validate it is online for your engine/version

### add foreign key / check constraint safely

- validate data first (no orphans, no invalid values)
- add constraint in a way that avoids long blocking where possible
- validate separately if engine supports it

## Workflow (default)

1. **design**
   - write the migration plan and rollback plan
2. **prechecks**
   - confirm table sizes, existing indexes, constraint violations
3. **dry run**
   - run on staging with production-like data volume if possible
4. **execute**
   - apply schema change, then data movement in batches
5. **verify**
   - run correctness queries and app-level smoke checks
6. **monitor**
   - lock waits, replication lag, error rates
7. **contract**
   - remove old paths only after adoption is complete

## PostgreSQL templates

**add column:**

```sql
ALTER TABLE public.your_table
ADD COLUMN new_col text;
```

**backfill in batches (example using id ranges):**

```sql
UPDATE public.your_table
SET new_col = <expression>
WHERE id >= :min_id AND id < :max_id
  AND new_col IS NULL;
```

**add index safely:**

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_your_table_new_col
ON public.your_table (new_col);
```

**set not null (do this only after backfill + verification):**

```sql
ALTER TABLE public.your_table
ALTER COLUMN new_col SET NOT NULL;
```

## MySQL templates

**add column:**

```sql
ALTER TABLE your_table
ADD COLUMN new_col VARCHAR(255) NULL;
```

**backfill in batches (example):**

```sql
UPDATE your_table
SET new_col = <expression>
WHERE id BETWEEN ? AND ?
  AND new_col IS NULL;
```

**add index:**

```sql
CREATE INDEX idx_your_table_new_col ON your_table (new_col);
```

## Verification queries (examples)

**null rate after backfill:**

```sql
SELECT COUNT(*) AS null_count
FROM your_table
WHERE new_col IS NULL;
```

**row count consistency (when moving data):**

```sql
SELECT COUNT(*) FROM old_table;
SELECT COUNT(*) FROM new_table;
```

**fk integrity (orphan check):**

```sql
SELECT COUNT(*) AS orphan_count
FROM child c
LEFT JOIN parent p ON p.id = c.parent_id
WHERE c.parent_id IS NOT NULL AND p.id IS NULL;
```

## Rollback rules of thumb

- prefer additive changes first (new columns/tables/indexes) to keep rollback easy
- avoid destructive changes in the same deploy (drop/rename) unless you can restore quickly
- keep old read path working until you prove new path is correct

## Output format (runbook)

```markdown
## migration: [name]

### objective

- what changes:
- why:

### risks

- locks:
- long running work:
- replication lag:

### plan

- [ ] step 1:
- [ ] step 2:
- [ ] step 3:

### verification

- query checks:
- app checks:

### rollback

- exact rollback steps:
```
