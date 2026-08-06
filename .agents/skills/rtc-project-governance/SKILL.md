---
name: rtc-project-governance
description: "Single engineering governance entry point for all AI agents working on the RTC repository. Enforces startup discovery, context management, tool selection, skill selection strategy, architecture protection, verification matrix, rollback policy, self-review, and quality gates."
category: governance
risk: safe
source: local
tags: "[governance, engineering-standards, quality-gates, verification-matrix, rollback-policy, context-management, rtc]"
date_added: "2026-08-06"
---

# RTC Project Governance & Engineering Standard

## Purpose & Core Identity

This skill establishes the **single engineering governance entry point** and quality assurance standard for all AI agents working on the **RTC (Rowad Al-Tamayuz Center)** repository. It provides strict guidelines for repository adaptation, context management, tool selection, skill selection, architecture protection, verification, rollback safety, and self-review.

Every AI agent operating in this repository **MUST** execute this skill as their mandatory entry point before making any code modifications or structural changes.

---

## Instruction Hierarchy (Priority Rules)

When resolving conflicting instructions or guidelines, agents must enforce the following strict priority hierarchy (higher priority rules **ALWAYS** override lower priority rules):

```
1. Repository Rules (AGENTS.md)
       │
       ▼
2. Governance Skill (rtc-project-governance)
       │
       ▼
3. Task-Specific Skills (e.g. Bug Fix, Security, Refactor)
       │
       ▼
4. Framework Skills (e.g. React, Vite, Supabase)
       │
       ▼
5. Language Skills (e.g. TypeScript, SQL)
       │
       ▼
6. Utility Skills (e.g. Formatters, Helpers)
```

---

## Mandatory Startup Workflow

Before writing or modifying any code in this repository, every AI agent **MUST** perform the following 8 steps in sequence:

```
[ 1. Read AGENTS.md ] ➔ [ 2. Read Governance ] ➔ [ 3. Repo Adaptation ] ➔ [ 4. Stack Detection ]
                                                                                   │
                                                                                   ▼
[ 8. Implementation ] ◄─ [ 7. Produce Plan ] ◄─ [ 6. Skill Selection ] ◄─ [ 5. Skill Discovery ]
```

1. **Read `AGENTS.md` Completely**: Inspect repository directives and priority rules.
2. **Read `rtc-project-governance` Completely**: Align on governance standards, decision matrix, tool selection, and quality gates.
3. **Inspect & Adapt to Repository**: Detect repository conventions, folder structure, coding patterns, testing strategy, and release workflows. Adapt to established patterns.
4. **Detect Technical Stack**: Identify architecture (Vite + React + Supabase), frameworks, languages (TypeScript), package manager (`npm`), testing framework (Vitest), CI/CD (GitHub Actions), deployment target (Cloudflare Pages/Vercel), and security tooling.
5. **Discover Available Skills**: Dynamically search available skills directories (`.agents/skills/`, global plugins, system prompt) for capabilities matching task topics.
6. **Select Relevant Skills**: Apply the Skill Selection Strategy to pick only necessary skills; avoid context bloat.
7. **Produce a Concise Implementation Plan**: Outline findings, target files, proposed changes, verification matrix, and rollback plan.
8. **Begin Implementation**: Execute changes following the 12-phase engineering workflow and iterative validation loop.

---

## Repository Adaptation Protocol

Agents must adapt to the target repository rather than forcing a generic workflow:
- **Project Conventions**: Follow existing naming rules, component directory structure (`src/components/`, `src/pages/`, `src/hooks/`), and state management patterns (TanStack Query + React Context).
- **Architecture Style**: Respect SPA component design and Supabase Edge Function / RLS data authorization boundaries.
- **Testing Strategy**: Align with existing Vitest unit/integration tests (`src/utils/*.test.ts`).
- **Dependency Management**: Use existing `npm` packages before introducing new dependencies.

---

## Context Management Protocol

To ensure maximum correctness with minimum token usage:
1. **Estimate Need First**: Before reading documentation or large files, verify whether they are strictly required for the immediate step.
2. **Targeted Reading**: Use bounded file views (`StartLine`/`EndLine`) or `grep_search` instead of reading entire large directories or files.
3. **Incremental References**: Read reference guides (`references/skill-mapping-matrix.md`) only when specific clarification is needed.
4. **Avoid Duplicate Context**: Do not re-read or re-dump files already present in context.
5. **Context Budgeting**: Keep prompt and tool inputs concise and focused on the target change.

---

## Tool Selection Workflow

Before executing actions, determine the **minimum set of tools** required for the step:

```
[ Step Goal ] ──► [ Evaluate Needed Capabilities ] ──► [ Select Minimum Tool Set ]
```

- **File Inspection**: Use `view_file` with precise line bounds or `grep_search` for pattern matching.
- **Directory Operations**: Use `list_dir` to inspect folder contents.
- **Code Editing**: Use `replace_file_content` (for single contiguous edits) or `multi_replace_file_content` (for multiple non-contiguous edits in one file).
- **Command Execution**: Use `run_command` for linting, typechecking, running tests, or building. Avoid unnecessary shell invocations.
- **Rule**: Never run redundant tool calls. Always justify tool selection.

---

## Skill Selection Strategy & Specificity Precedence

When selecting skills for a task, enforce the following **Specificity Precedence**:

```
1. Repository-Specific Skills (.agents/skills/rtc-project-governance)
       │
       ▼
2. Project-Specific Skills (e.g. RTC domain skills)
       │
       ▼
3. Framework-Specific Skills (e.g. React, Vite, Supabase)
       │
       ▼
4. Language-Specific Skills (e.g. TypeScript)
       │
       ▼
5. Generic Utility Skills (e.g. Clean Code, SOLID)
```

### Overlap Resolution Rules
- **Prefer More Specialized Skill**: If a generic skill and a framework-specific skill overlap, select the framework-specific skill.
- **Avoid Redundant Loading**: Do not load multiple skills that cover the exact same guidance.
- **Explain Selection**: Briefly justify why each selected skill is necessary for the task in the implementation plan.

---

## Architecture Protection Rules

- **Preserve Existing Architecture**: Align with established Vite + React + Supabase patterns.
- **Avoid Unnecessary Large Refactors**: Keep changes localized to the requested scope.
- **Avoid Breaking Public APIs**: Maintain existing component props, function signatures, and exported contracts.
- **Extend Before Creating**: Extend existing helper abstractions (`src/utils/`) or hooks (`src/hooks/`) before introducing new ones.
- **Justify Architectural Changes**: If an architectural change is strictly required, justify it explicitly in the plan.
- **Preserve Backward Compatibility**: Ensure existing database schemas and client states remain fully compatible.

---

## Verification Matrix

Select verification steps based on the type of modification:

| Change Category | Required Verification Steps |
| :--- | :--- |
| **UI Components** | `npm run build` ➔ UI render & state verification |
| **API / Data Services** | Integration tests (`npx vitest run`) ➔ Security review (AuthZ/RLS) |
| **Database / Migrations** | Schema validation ➔ Migration test ➔ RLS query verification |
| **Configuration** | `npm run build` ➔ `npm run lint` ➔ `npm run typecheck` |
| **Refactor** | Full unit test suite (`npx vitest run`) ➔ Code quality & performance review |
| **Security Fix** | Static analysis ➔ Input sanitization test ➔ Security vulnerability scan |
| **Performance Fix** | Render/Bundle benchmark check ➔ `npm run build` ➔ Regression review |
| **Documentation** | Link validation ➔ Technical consistency review |

---

## Explicit Rollback Policy

If repeated validation failures occur during implementation:
1. **Stop Implementation Immediately**: Do not push forward or layer fix upon fix on a broken build.
2. **Identify Root Cause**: Analyze compiler logs, linter messages, or failing test traces.
3. **Rollback Last Logical Change**: Revert the failing edit back to the last known good state using clean file content replacement or git revert.
4. **Update Implementation Plan**: Re-evaluate the approach based on root cause analysis.
5. **Resume Execution**: Re-implement cleanly from the known good state.

> **Rule**: NEVER continue building on top of a broken project state.

---

## Required 12-Phase Engineering Workflow

1. **Phase 1: Repository Discovery** — Inspect affected paths, types, and existing tests.
2. **Phase 2: Architecture Analysis** — Evaluate component hierarchy, data flow, and backend boundaries.
3. **Phase 3: Risk Assessment** — Identify breaking changes, security vulnerabilities, or performance risks.
4. **Phase 4: Skill Selection** — Activate relevant skills following Specificity Precedence.
5. **Phase 5: Planning** — Document step-by-step changes, verification matrix, and rollback plan.
6. **Phase 6: Implementation** — Execute changes following clean code guidelines.
7. **Phase 7: Verification** — Run typecheck (`npm run typecheck`) and linting (`npm run lint`).
8. **Phase 8: Performance Validation** — Verify component efficiency and bundle size.
9. **Phase 9: Security Validation** — Verify input sanitization, formula injection safety, and URL protocol safety.
10. **Phase 10: Testing** — Run Vitest suite (`npx vitest run`) and add tests for modified logic.
11. **Phase 11: Documentation** — Update `README.md` or code comments if interfaces changed.
12. **Phase 12: Final Report** — Summarize changes, quality gate results, and recommendations.

---

## Iterative Validation Loop

```
┌─────────────────────────────────────────────────────────┐
│                     [ Implement ]                       │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
                     [ Typecheck (tsc) ]
                             │
                             ▼
                     [ Lint (eslint) ]
                             │
                             ▼
                     [ Tests (vitest) ]
                             │
                             ▼
                    [ Build (vite build) ]
                             │
                             ▼
                    [ Security Scan ]
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
       [ Any Failures? ]             [ All Pass ]
              │                             │
              ├─► Yes ➔ [ Rollback/Fix ] ───┤
              │                             ▼
              └─────────────────────► [ Complete ]
```

---

## Mandatory Engineering Self-Review

Before completing any task, agents **MUST** review their work against this checklist:

- [ ] **Duplicated Logic**: Are there any repeated code blocks or redundant utility functions?
- [ ] **Unnecessary Complexity**: Is the code simple, self-documenting, and readable?
- [ ] **Edge Cases**: Are null, undefined, offline, and empty states handled properly?
- [ ] **Security Regressions**: Are inputs sanitized and URLs protocol-checked?
- [ ] **Performance Regressions**: Are heavy calculations memoized and re-renders minimized?
- [ ] **Maintainability**: Are functions small, cohesive, and easy to test?
- [ ] **Missing Tests**: Are new or modified code paths covered by unit/integration tests?
- [ ] **Missing Documentation**: Are setup steps or modified contracts documented?

---

## Strict Quality Gates & Exit Criteria

A task is **NOT COMPLETE** unless all criteria are satisfied:

| Quality Gate | Verification Command / Metric | Required Outcome |
| :--- | :--- | :--- |
| **✓ Work Finished** | Task requirements | `100% completed` |
| **✓ Typecheck** | `npm run typecheck` | `0 errors` |
| **✓ Lint** | `npm run lint` | `0 errors, 0 warnings` |
| **✓ Tests** | `npx vitest run` | `All test suites passing` |
| **✓ Build** | `npm run build` | `Clean build output in dist/` |
| **✓ Security Scan** | Audit scan | `0 critical/high vulnerabilities` |
| **✓ Clean Workspace** | Workspace check | `No temporary files or unused code remaining` |
| **✓ Zero TODOs** | Code search | `No temporary TODOs or placeholder comments added` |
| **✓ Documentation** | README / Comments | `Updated when behavior or setup changes` |

---

## Continuous Improvement Protocol

After task completion:
1. **Mandatory vs. Optional**: Distinguish between mandatory task completion fixes and optional future enhancements.
2. **Avoid Scope Creep**: Do not implement non-essential refactors outside the task scope.
3. **Document Recommendations**: Record technical debt observations and suggested future improvements in the final engineering report.
