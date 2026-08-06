# RTC Project Governance Skill (`rtc-project-governance`)

## Overview

`rtc-project-governance` is the mandatory project governance framework and single engineering entry point for the **RTC (Rowad Al-Tamayuz Center)** repository. It outlines the 8-step startup workflow, repository adaptation, context management protocol, tool selection workflow, skill specificity precedence, 12-phase engineering workflow, decision matrix, verification matrix, rollback policy, self-review checklist, and exit criteria.

## Governance Features

1. **Instruction Hierarchy & Priority Rules**:
   - `AGENTS.md` ➔ `rtc-project-governance` ➔ Task Skills ➔ Framework Skills ➔ Language Skills ➔ Utility Skills.
2. **Context Management Protocol**:
   - Targeted reading, token budgeting, incremental reference loading, avoiding context duplication.
3. **Tool Selection Workflow**:
   - Minimum tool principle; explicit evaluation of necessary tools per step.
4. **Skill Specificity Precedence**:
   - Repository-specific ➔ Project-specific ➔ Framework-specific ➔ Language-specific ➔ Generic utility skills.
5. **Verification Matrix**:
   - Change-category specific validation steps (UI, API, Database, Config, Refactor, Security, Performance, Docs).
6. **Rollback Policy**:
   - Immediate halt and revert to last known good state upon repeated validation failures.
7. **Mandatory Self-Review & Exit Criteria**:
   - Pre-completion checklist covering complexity, edge cases, security, performance, maintainability, tests, and documentation.

## Usage & Integration

When an AI agent initializes in this workspace, it reads `.agents/AGENTS.md` and triggers `rtc-project-governance` automatically before taking action.

## Folder Structure

```
.agents/skills/rtc-project-governance/
├── SKILL.md                          # Main governance rules & engineering standards
├── README.md                         # Overview documentation
├── references/
│   └── skill-mapping-matrix.md       # Decision matrix, verification matrix & reference protocols
├── examples/                         # Reference workflow examples
└── scripts/                          # Governance verification utilities
```

## Quality Gate Verification Commands

- **Typecheck**: `npm run typecheck`
- **Linter**: `npm run lint`
- **Unit Tests**: `npx vitest run`
- **Build**: `npm run build`
