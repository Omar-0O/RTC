# RTC Project Agent Instructions

## Mandatory Entry Point

EVERY AI agent working on this repository MUST read, trigger, and execute the **`rtc-project-governance`** skill BEFORE modifying any source code or project files.

- **Skill Path**: [.agents/skills/rtc-project-governance/SKILL.md](file:///.agents/skills/rtc-project-governance/SKILL.md)
- **Primary Trigger**: `rtc-project-governance`

---

## Instruction Hierarchy (Priority Rules)

Higher-priority instructions ALWAYS override lower-priority instructions:

1. **Repository Rules (`AGENTS.md`)** *(Highest)*
2. **Governance Skill (`rtc-project-governance`)**
3. **Task-Specific Skills**
4. **Framework Skills**
5. **Language Skills**
6. **Utility Skills** *(Lowest)*

---

## Mandatory Startup Checklist for AI Agents

Before writing or modifying any code, every AI agent MUST execute these 8 steps in sequence:

1. **Read `AGENTS.md` Completely**: Inspect repository directives and priority rules.
2. **Read `rtc-project-governance` Completely**: Align on startup requirements, decision matrix, tool selection, and quality gates.
3. **Inspect & Adapt to Repository**: Detect architecture, modules, folder conventions, and established patterns.
4. **Detect Technical Stack**: Detect architecture, frameworks, languages, package managers, testing frameworks, CI/CD, deployment, and security tooling.
5. **Discover Available Skills**: Dynamically search available skills directories for capabilities matching task topics (`Clean Code`, `SOLID`, `Vitest`, `OWASP`, `Supabase`, `React Performance`, etc.).
6. **Select Relevant Skills**: Apply Specificity Precedence and load ONLY the skills required for the current task (progressive disclosure).
7. **Produce a Concise Implementation Plan**: Outline findings, target files, proposed changes, verification matrix, and rollback plan.
8. **Begin Implementation**: Execute changes following the 12-phase workflow, iterative validation loop, self-review checklist, and exit criteria.

---

## Mandatory Quality Gates

No task is complete until all pass:

✓ **Typecheck**: `npm run typecheck` (0 errors)  
✓ **Lint**: `npm run lint` (0 errors, 0 warnings)  
✓ **Tests**: `npx vitest run` (All test suites pass)  
✓ **Build**: `npm run build` (Clean production bundle in `dist/`)  
✓ **Security Scan**: 0 critical vulnerabilities  
✓ **No New Warnings**: 0 new compiler or lint warnings  
✓ **Documentation**: Updated when APIs, setup, or setup steps change  
