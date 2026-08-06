---
name: rtc-project-governance
description: "Mandatory project governance and engineering standard skill for all AI agents working on the RTC repository. Enforces startup discovery, skill composition, 12-phase execution workflow, code review criteria, and strict quality gates."
category: governance
risk: safe
source: local
tags: "[governance, engineering-standards, workflow, quality-gates, rtc]"
date_added: "2026-08-06"
---

# RTC Project Governance & Engineering Standard

## Purpose

This skill establishes the mandatory project governance framework and engineering standard for all AI agents working on the **RTC (Rowad Al-Tamayuz Center)** repository. It ensures consistent architecture, security hardening, high-performance rendering, robust error handling, clean code, and zero regressions.

Every AI agent operating in this repository **MUST** execute this skill as their mandatory entry point before making any code modifications or structural changes.

---

## Mandatory Startup Workflow

Before modifying any code or files in this repository, every AI agent must execute these 7 steps in sequence:

```
[ Step 1: Read Skill ] ➔ [ Step 2: Repo Discovery ] ➔ [ Step 3: Skill Detection ]
           │
           ▼
[ Step 4: Skill Selection ] ➔ [ Step 5: Produce Plan ] ➔ [ Step 6: Execution ]
```

1. **Read Governance Skill**: Read `rtc-project-governance` completely to align on quality standards and rules.
2. **Inspect Repository**:
   - **Framework**: Vite + React 18 + TypeScript.
   - **Architecture**: Component-based frontend, Supabase backend (Auth, Database, Edge Functions, Storage), TanStack Query data caching, Tailwind CSS styling, Shadcn UI component primitives.
   - **Tech Stack**: TypeScript, React Router, Radix UI, Recharts, Vitest, Lucide icons, `@e965/xlsx`.
   - **Coding Conventions**: Clean functional components, explicit TypeScript types, safe input sanitization (`spreadsheetSecurity.ts`, `safeUrls.ts`, `safeImages.ts`), RTL support (`isRTL`), centralized error boundaries.
3. **Detect Available Agent Skills**: Scan workspace (`.agents/skills/`) and global configuration (`~/.gemini/config/plugins` or system prompt) to list all active skills.
4. **Select Relevant Skills (Progressive Disclosure)**:
   - Apply progressive disclosure: **Load ONLY the specialized skills relevant to the current task.**
   - Do NOT load unrelated skills to prevent context bloat and hallucinated rules.
5. **Produce an Implementation Plan**: Outline findings, proposed file changes, potential risks, and verification plan.
6. **Obtain Approval / Finalize Plan**: Ensure technical approach adheres to project architecture and user preferences.
7. **Begin Execution**: Implement changes following the 12-Phase Engineering Workflow.

---

## Skill Selection & Composition Guide

Agents must dynamically compose skills according to the nature of their assigned task. Reference [.agents/skills/rtc-project-governance/references/skill-mapping-matrix.md](file:///.agents/skills/rtc-project-governance/references/skill-mapping-matrix.md) for full breakdown.

| Work Category | Primary Skills to Combine |
| :--- | :--- |
| **Feature Development** | Clean Architecture, React Performance, TypeScript Best Practices, Supabase, Tailwind, Testing |
| **Bug Investigation & Fixes** | Bug Investigation, Code Review, Vitest Testing, Static Analysis |
| **Performance Optimization** | Performance Optimization, React Performance, Vite Chunking, Code Review |
| **Security Hardening** | Security Review, OWASP Guidelines, Input Sanitization, Static Analysis |
| **Refactoring & Tech Debt** | Clean Code, SOLID Principles, Refactoring, Vitest Testing |
| **Infrastructure & CI/CD** | CI/CD, GitHub Actions, Security Scanning, Dependency Audit |
| **Documentation** | Technical Documentation, Architecture Mapping |

---

## Required 12-Phase Engineering Workflow

All complex engineering tasks must systematically navigate through these 12 phases:

1. **Phase 1: Repository Discovery** — Scan affected code paths, imports, types, and existing tests.
2. **Phase 2: Architecture Analysis** — Determine component hierarchy, state flow, database queries, and Edge Function boundaries.
3. **Phase 4: Skill Selection** — Activate relevant skills for the task domain using progressive disclosure.
4. **Phase 3: Risk Assessment** — Identify breaking API changes, security risks, database migration impacts, or performance regressions.
5. **Phase 5: Planning** — Document step-by-step changes, required unit test additions, and verification plan.
6. **Phase 6: Implementation** — Execute code changes using established clean code conventions.
7. **Phase 7: Verification** — Run typechecks (`npm run typecheck`) and linters (`npm run lint`).
8. **Phase 8: Performance Validation** — Verify component render efficiency, network fetch counts, and bundle size footprint.
9. **Phase 9: Security Validation** — Verify input sanitization, formula injection escaping, URL/image whitelist safety, and auth scoping.
10. **Phase 10: Testing** — Execute test suites (`npx vitest run`) and add unit/integration coverage for modified logic.
11. **Phase 11: Documentation** — Update `README.md`, inline JSDoc comments, or architecture notes if contracts changed.
12. **Phase 12: Final Report** — Present clean summary of fixes, test results, build outputs, and updated quality metrics.

---

## Mandatory Engineering & Code Review Criteria

Every pull request or code change must satisfy all 11 evaluation criteria:

- [ ] **Security Review**: Input escaping (CSV/formula injection), sanitized URLs/images, no hardcoded secrets, scoped Supabase queries.
- [ ] **Performance Review**: No unnecessary re-renders, memoized expensive computations (`useMemo`/`useCallback`), lazy loading for heavy routes/libraries.
- [ ] **Clean Code Review**: Expressive variable naming, no duplicated code blocks, single-responsibility functions.
- [ ] **Error Handling Review**: Graceful fallback UI (`ErrorBoundary.tsx`), typed catch blocks, offline connectivity alerts (`NetworkStatus.tsx`).
- [ ] **Accessibility Review**: Semantic HTML tags, ARIA attributes where needed, keyboard navigation, high contrast text support.
- [ ] **Maintainability Review**: Decoupled component design, clean folder structure, clear module boundaries.
- [ ] **Test Impact Review**: Updated or added unit/integration tests covering happy paths and edge cases.
- [ ] **Build Verification**: `npm run build` completes with zero errors.
- [ ] **Type Checking**: `npm run typecheck` produces 0 errors.
- [ ] **Linting**: `npm run lint` produces 0 errors and 0 warnings.
- [ ] **Production Build Verification**: Generated assets in `dist/` verified.

---

## Core Coding Principles

- **Zero Duplication**: Never copy-paste logic across components; extract shared utilities or custom hooks (`src/hooks/`, `src/utils/`).
- **Preserve Existing Architecture**: Align with Vite + Supabase + TanStack Query patterns already in place.
- **Prefer Reusable Abstractions**: Build reusable Shadcn/Tailwind UI primitives rather than custom ad-hoc inline styles.
- **Readability over Cleverness**: Write clear, self-documenting code with descriptive names in English.
- **No Unnecessary Dependencies**: Leverage native Web APIs and existing packages (`date-fns`, `lucide-react`) before adding external libraries.
- **Avoid Premature Optimization**: Optimize based on verified bottlenecks or expensive data rendering paths.
- **Keep Functions Cohesive**: Small, focused functions that perform one operation cleanly.
- **Follow SOLID Principles**: Single responsibility, open-closed UI extension, interface segregation.
- **Write Production-Grade Code**: Include error handling, fallback defaults, types, and logging.

---

## Mandatory Quality Gates

A task is **NOT COMPLETE** unless all required checks pass without exception:

| Quality Gate | Verification Command | Required Outcome |
| :--- | :--- | :--- |
| **Typecheck** | `npm run typecheck` | `0 errors` |
| **Linter** | `npm run lint` | `0 errors, 0 warnings` |
| **Unit Tests** | `npx vitest run` | `All tests passing` |
| **Production Build** | `npm run build` | `Clean build output in dist/` |
| **Security Scan** | Dependency & Code Audit | `No critical/high vulnerabilities` |
| **Documentation** | Documentation review | `Updated README or inline JSDoc` |

---

## Extending This Skill

Future AI agents or maintainers can extend this skill by:
1. Adding new specialized domain mappings in [references/skill-mapping-matrix.md](file:///.agents/skills/rtc-project-governance/references/skill-mapping-matrix.md).
2. Adding custom automated verification scripts to `scripts/`.
3. Updating quality gates as new testing frameworks (e.g., Playwright E2E) are integrated.
