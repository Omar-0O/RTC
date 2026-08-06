# RTC Project Agent Instructions

## Mandatory Entry Point

EVERY AI agent working on this repository MUST read, trigger, and execute the **`rtc-project-governance`** skill BEFORE modifying any source code or project files.

- **Skill Path**: [.agents/skills/rtc-project-governance/SKILL.md](file:///.agents/skills/rtc-project-governance/SKILL.md)
- **Primary Trigger**: `rtc-project-governance`

---

## Mandatory Startup Checklist for AI Agents

1. **Read Governance**: Inspect [.agents/skills/rtc-project-governance/SKILL.md](file:///.agents/skills/rtc-project-governance/SKILL.md).
2. **Perform Discovery**: Analyze codebase tech stack (Vite + React 18 + TypeScript + Supabase), architecture, and coding patterns.
3. **Skill Selection**: Load ONLY relevant specialized skills for the task domain (progressive disclosure).
4. **Implementation Plan**: Formulate and verify an implementation plan before writing code.
5. **12-Phase Execution**: Follow the 12-phase engineering workflow.
6. **Pass Quality Gates**:
   - `npm run typecheck`
   - `npm run lint`
   - `npx vitest run`
   - `npm run build`
