# Skill Selection & Engineering Strategy Reference

This document provides detailed reference guides for skill selection precedence, context management, tool selection workflows, verification matrices, rollback protocols, and self-review guidelines.

---

## 1. Skill Selection Specificity Precedence & Overlap Resolution

When multiple skills match a task, agents must select skills according to this **Specificity Hierarchy**:

1. **Repository-Specific Skills** (e.g. `.agents/skills/rtc-project-governance`)
2. **Project-Specific Skills** (e.g. RTC domain skills)
3. **Framework-Specific Skills** (e.g. React, Vite, Supabase)
4. **Language-Specific Skills** (e.g. TypeScript, SQL)
5. **Generic Utility Skills** (e.g. Clean Code, SOLID)

### Overlap Resolution Strategy
- **Rule**: If a general skill (e.g. Clean Code) and a framework skill (e.g. React Performance) both provide guidance on a react component, select the framework skill (`React Performance`) and omit the general skill to prevent context duplication.
- **Context Minimization**: Load only the 2-4 skills directly required for the current task category.

---

## 2. Comprehensive Decision Matrix

| Task Category | Automatic Skill Topic Selection Chain | Primary Focus Area |
| :--- | :--- | :--- |
| **Bug Fix** | `Debugging` ➔ `Testing` ➔ `Clean Code` | Stack trace isolation, regression test creation, root-cause repair |
| **Feature** | `Architecture` ➔ `Clean Code` ➔ `Testing` | Component flow, modular design, complete test coverage |
| **Performance** | `Profiling` ➔ `React Performance` ➔ `Benchmarking` | Re-render minimization, memory leak checks, bundle chunking |
| **Security** | `Security Review` ➔ `OWASP` ➔ `Static Analysis` | Input escaping (CSV/formula injection), protocol safety, RLS auditing |
| **Refactor** | `SOLID` ➔ `Clean Architecture` ➔ `Testing` | Single responsibility, abstraction extraction, zero regressions |
| **Supabase / Backend** | `Supabase` ➔ `RLS` ➔ `Security` | Postgres Row Level Security, Edge function AuthZ, client query scoping |
| **Infrastructure** | `CI/CD` ➔ `GitHub Actions` | `.github/workflows/` automation, build & test job optimization |
| **Documentation** | `Documentation` | Architecture guides, README updates, inline API JSDoc |

---

## 3. Verification Matrix

Different categories of software changes require specific validation steps:

```
[ Change Type ] ──► [ Select Category Verification Steps ] ──► [ Execute Quality Gates ]
```

| Change Category | Mandatory Verification Steps |
| :--- | :--- |
| **UI Components** | `npm run build` ➔ UI render state check ➔ Responsive & RTL layout validation |
| **API / Data Services** | Unit & integration tests (`npx vitest run`) ➔ Edge function AuthZ check |
| **Database / Migrations** | Schema migration check ➔ RLS policy validation ➔ Query test |
| **Configuration** | `npm run build` ➔ `npm run lint` ➔ `npm run typecheck` |
| **Refactor** | Full Vitest test suite (`npx vitest run`) ➔ Code quality & performance check |
| **Security Fix** | Static analysis ➔ Formula/URL sanitization test ➔ Security audit |
| **Performance Fix** | Render timing check ➔ `npm run build` bundle chunk review |
| **Documentation** | Link validation ➔ Technical consistency review |

---

## 4. Context Management Protocol

To minimize token usage and maximize correctness:
- **Estimate Need**: Evaluate if a file or document is strictly required before reading it.
- **Targeted Line Ranges**: Use `view_file` with explicit `StartLine` and `EndLine` parameters.
- **Search First**: Use `grep_search` to pinpoint relevant code symbols before loading entire files.
- **No Duplicate Reads**: Do not re-read files that are already present in context.
- **Incremental Loading**: Read references only when clarifying specific rules.

---

## 5. Tool Selection Matrix

| Execution Step | Primary Tool Choice | Guidance |
| :--- | :--- | :--- |
| **File Reading** | `view_file` | Specify `StartLine`/`EndLine` for large files. |
| **Pattern Search** | `grep_search` | Search for exact symbols or function names across the workspace. |
| **File Creation** | `write_to_file` | Used for new files or complete file overwrites. |
| **Single Edit** | `replace_file_content` | Preferred for contiguous line edits. |
| **Multiple Edits** | `multi_replace_file_content` | Preferred for multiple non-contiguous edits in the same file. |
| **Command Runner** | `run_command` | Execute build, lint, typecheck, or test commands. |

---

## 6. Rollback Policy & Protocol

If repeated validation failures occur during implementation:
1. **Halt Work**: Stop making additional edits on top of a failing state.
2. **Root Cause Analysis**: Inspect exact compiler logs, linter messages, or test failure output.
3. **Rollback**: Revert the failing changes back to the last known good state.
4. **Re-plan**: Update the implementation plan to address the root cause cleanly.
5. **Resume Execution**: Re-implement from the clean baseline.

---

## 7. Mandatory Self-Review Checklist

Before finalizing any task, review the code against these questions:
1. Is there any duplicated logic or redundant helper code?
2. Is the code simple, self-documenting, and easy to maintain?
3. Are edge cases (null, empty, offline, error) properly handled?
4. Are inputs properly escaped and sanitized?
5. Are heavy computations memoized and re-renders minimized?
6. Are unit tests present for all new or modified functions?
7. Is documentation updated to reflect any behavioral or API changes?
