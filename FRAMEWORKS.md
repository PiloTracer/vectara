# Framework Discovery — Three OS Framework Integration

This project integrates three portable OS frameworks for AI-assisted work. Read this file first to understand where everything lives.

---

## The Three Frameworks

| # | Framework | Path | Director | Domain |
|---|-----------|------|----------|--------|
| 1 | **Agent OS** | `/mnt/work/Projects/.ai/` | `@ai-director` | Engineering: planning, coding, DB, sessions, dev stack |
| 2 | **UI Design OS** | `/mnt/work/Projects/.ai.ui/` | `@ui-director` | UI: tokens, screens, components, design system, a11y |
| 3 | **Business OS** | `/mnt/work/Projects/.ai.biz/` | `@biz-director` | Business: strategy, brand, content, sales, pricing |

**Cross-framework orchestrator:** `@x-director` — routes across all three.

---

## How to Use

**Don't know which framework?** Use `@x-director - <describe what you want>` and it routes automatically.

**Single domain:**
- Engineering: `@ai-director - "<request>"`
- UI: `@ui-director - "<request>"`
- Business: `@biz-director - "<request>"`

---

## Working Documentation

| Framework | Documentation path |
|-----------|-------------------|
| All frameworks | `.work/context/HANDOFF.md` |
| Engineering (Agent OS) | `.work/` |
| UI Design OS | `.work.ui/` |
| Business OS | `.work.biz/` |
| AI-specific work | `.work.ai/` |

---

## Skill Discovery

Each framework has a `skills/README.md` with the full skill registry:

- Agent OS skills: `/mnt/work/Projects/.ai/skills/README.md`
- UI Design OS skills: `/mnt/work/Projects/.ai.ui/skills/README.md`
- Business OS skills: `/mnt/work/Projects/.ai.biz/skills/README.md`

---

## Process Routers

Stuck on process? Use the router for each framework:

- Agent OS: `@process-router - <question>` — `/mnt/work/Projects/.ai/PROCESS_ROUTER.md`
- UI Design OS: `@ui-process-router - <question>` — `/mnt/work/Projects/.ai.ui/PROCESS_ROUTER.md`
- Business OS: `@process-router - <question>` — `/mnt/work/Projects/.ai.biz/PROCESS_ROUTER.md`

---

## Fallback Paths

If primary paths are unavailable:

| Framework | Primary | Fallback |
|-----------|---------|----------|
| Agent OS | `/mnt/work/Projects/.ai/` | `/Data/Projects/.ai/` |
| UI Design OS | `/mnt/work/Projects/.ai.ui/` | `/Data/Projects/.ai.ui/` |
| Business OS | `/mnt/work/Projects/.ai.biz/` | `/Data/Projects/.ai.biz/` |

---

## Migration Note — `.ai.original/`

The legacy `.ai.original/` directory contains **historical context** from before the three-framework OS was adopted:
- **Session history** (`.ai.original/context/HANDOFF.md`) — last session Jan 26, 2026
- **24 feature specs** (`.ai.original/features/`) — implemented, pending, and planning
- **Architectural decisions** (`.ai.original/context/DECISIONS.md`) — 7 ADRs
- **AI workflow docs** (`.ai.original/context/`) — system architecture, MCP integration

**Use `.work/` for active work.** The historical data in `.ai.original/` is preserved for reference. If you need context about past sessions, decisions, or feature status, read from `.ai.original/`. New work should be tracked in `.work/`.

---

## Quick Start

```text
@x-director - "I want to understand this project"
@x-director - status
@x-director - help
```

Or route directly:
```text
@ai-director - "<engineering task>"
@ui-director - "<UI/design task>"
@biz-director - "<business task>"
```
