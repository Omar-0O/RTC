# Skill Selection & Composition Reference Matrix

This reference guide details how AI agents working on the RTC repository should select, combine, and apply specialized engineering skills following progressive disclosure principles.

---

## 1. Skill Selection Strategy (Progressive Disclosure)

- **Rule**: Do not load all available skills into context at once.
- **Goal**: Minimize prompt overhead, prevent rule collision, and focus execution strictly on the task domain.
- **Process**:
  1. Identify the task category (e.g., Feature Development, Bug Fix, Performance Optimization).
  2. Select the 2-4 core skills directly required for that category.
  3. Deactivate or omit unrelated skills.

---

## 2. Work Category to Skill Mapping

### A. Feature Development (UI, Components, API Endpoints)
- **Primary Skills**:
  - `React & Vite`: Component structure, lazy loading, route chunking.
  - `TypeScript Best Practices`: Strict type safety, interface definitions, no `any`.
  - `Supabase & Data Fetching`: Row Level Security compliance, query optimization, cached queries via TanStack Query.
  - `Testing (Vitest)`: Unit & integration test creation for new services/components.

### B. Bug Investigation & Fixes
- **Primary Skills**:
  - `Bug Investigation`: Reproduce issue, read stack traces, isolate root cause without swallowing errors.
  - `Code Review`: Ensure fix addresses root cause rather than patching symptoms.
  - `Testing (Vitest)`: Add regression test covering the bug fix.

### C. Performance & Asset Optimization
- **Primary Skills**:
  - `Performance Optimization`: Identify slow render loops, unneeded re-renders, and memory leaks.
  - `React Performance`: `useMemo`, `useCallback`, dynamic component imports (`React.lazy`).
  - `Vite Configuration`: Rollup chunking, asset compression, caching strategies.

### D. Security Hardening & Audit
- **Primary Skills**:
  - `Security Review`: Audit OWASP Top 10 risks (XSS, SQLi, CSRF, Formula Injection, SSRF).
  - `Input Sanitization`: Spreadsheet export protection (`spreadsheetSecurity.ts`), URL protocol validation (`safeUrls.ts`).
  - `AuthZ & RLS`: Scoped edge function token validation and Supabase Row Level Security policy checks.

### E. Refactoring & Code Quality
- **Primary Skills**:
  - `Clean Code & SOLID`: Single responsibility, high cohesion, low coupling, readable names.
  - `Refactoring`: Extract shared helper logic, eliminate duplication.
  - `Testing (Vitest)`: Ensure tests pass continuously before and after refactoring.

### F. Infrastructure & CI/CD
- **Primary Skills**:
  - `CI/CD & GitHub Actions`: Automated build, test, lint, and security workflows (`ci.yml`, `security.yml`).
  - `Static Analysis`: ESLint rules, TypeScript strict flags.

---

## 3. Extending Category Mappings

When new skills or tools are introduced (e.g. Playwright E2E tests, Tailwind v4, GraphQL), update this matrix to define:
- Which work categories require the new skill.
- The trigger criteria for progressive loading.
