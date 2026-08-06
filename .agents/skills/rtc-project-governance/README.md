# RTC Project Governance Skill (`rtc-project-governance`)

## Overview

`rtc-project-governance` is the standard project governance and quality control skill for the **RTC (Rowad Al-Tamayuz Center)** repository. It instructs AI coding assistants (and human developers) on the mandatory startup workflow, 12-phase engineering process, specialized skill composition matrix, code review checklist, and quality gates.

## Purpose

To enforce a unified, production-grade engineering standard across all AI agent interactions in the RTC codebase. It guarantees that no code change breaks existing functionality, introduces security vulnerabilities, degrades performance, or bypasses lint/type checks.

## Usage

When an AI agent initializes in this repository, it triggers `rtc-project-governance` automatically via `.agents/AGENTS.md` instructions.

### Trigger Keywords / Conditions
- Any task involving code modification, bug fixes, refactoring, or feature development.
- Keywords: `rtc project governance`, `engineering standard`, `quality gates`, `project workflow`, `code review`.

## Folder Structure

```
.agents/skills/rtc-project-governance/
├── SKILL.md                          # Main skill instructions & rules
├── README.md                         # User-facing documentation
├── references/
│   └── skill-mapping-matrix.md       # Detailed skill composition matrix & guides
├── examples/                         # Reference workflow examples
└── scripts/                          # Verification and governance scripts
```

## Mandatory Quality Gates

Before declaring any task resolved, agents must execute and verify:
1. `npm run typecheck` (0 errors)
2. `npm run lint` (0 errors, 0 warnings)
3. `npx vitest run` (All test suites pass)
4. `npm run build` (Clean production bundle in `dist/`)

## License

GPL v3. Open-source governance standard for RTC.
