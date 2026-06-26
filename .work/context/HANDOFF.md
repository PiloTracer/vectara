# HANDOFF — Agent OS Session State

**Last session:** Bootstrap state (historical context migrated from `.ai.original/`)
**Framework:** Agent OS (`.ai`) → `/mnt/work/Projects/.ai/`

## Historical Context (migrated from .ai.original)

This project is a **local-first AI document assistant** (datalake) with 3 components:
- **vectara/** — Tauri desktop app (Rust backend + React UI)
- **tools-iadata/** — Docker stack (FastAPI backend + Next.js frontend)
- **tools-iam/** — Keycloak auth (separate project)

### Key Architectural Decisions (ADRs)

| ADR | Decision |
|-----|----------|
| ADR-001 | Split into vectara, tools-iadata, tools-iam |
| ADR-002 | Bridge server on 0.0.0.0 for Docker access |
| ADR-003 | Base64-encode binary files in Bridge API |
| ADR-004 | LightOnOCR-2 primary, Tesseract fallback |
| ADR-005 | Search: fetch 100 results, group by doc, max 2 chunks/doc |
| ADR-006 | Metadata chunks per document for discoverability |
| ADR-007 | LLM: temperature 0.1, top_p 0.5, repeat_penalty 1.2, num_ctx 8192 |

### Implemented Features
- Enterprise RAG pipeline: Infinity + Reranker, hybrid search (dense+sparse), RRF fusion, cross-encoder re-ranking
- OCR: LightOnOCR-2-1B (CPU ~5-15 sec/page)
- Document extraction: PDF, DOCX, XLSX, PPTX, RTF, HTML, TXT, CSV, JSON, YAML, images
- Bridge API file serving, startup progress feedback
- Dynamic model selector in chat
- Google Drive + SharePoint OAuth integration

### Pending Features
| ID | Feature | Priority |
|----|---------|----------|
| 0600 | EXE Deployment (git2, Docker guide) | High |
| 0601 | Extended File Types (50+ formats) | Medium |
| 0611 | External API data gatherer (Gemini, Anthropic, OpenAI) | High |
| 0612 | Anti-hallucination prompt engineering | High |
| 0022 | Knowledge Base UI | Medium |
| 0021 | Session History | Medium |
| 0023 | Settings UI | Low |
| 0024 | Documentation | Low |

### Architecture
```
DESKTOP (Tauri/vectara) → Docker Stack (tools-iadata/)
  vectara/ - React UI + Rust Bridge Server (port 3737)
  back-dl  - FastAPI backend (port 18080)
  front-dl - Next.js dashboard (port 13000)
  qdrant   - Vector database (port 16333)
  postgres - Metadata/config DB
  ollama   - Local LLM (qwen2.5:7b)
  infinity - Embedding server (bge-m3)
  reranker - Cross-encoder (bge-reranker-v2-m3)
```

### Current State
| Gate | Status |
|------|--------|
| scaffold | ✅ Historical data available |
| foundation-complete | ⏳ Not formally certified in new framework |
| plan-master-ready | ⏳ |
| implementation-ready | ⏳ |

## Next recommended

`@x-director - "Assess the current project state and plan the next milestone"` or route directly via `@ai-director - "<goal>"`.

## Framework locations

| Framework | Path | Director |
|-----------|------|----------|
| Agent OS (engineering) | `/mnt/work/Projects/.ai/` | `@ai-director` |
| UI Design OS | `/mnt/work/Projects/.ai.ui/` | `@ui-director` |
| Business OS | `/mnt/work/Projects/.ai.biz/` | `@biz-director` |
| Cross-framework | — | `@x-director` |

## Fallback paths

| Framework | Fallback |
|-----------|----------|
| Agent OS | `/Data/Projects/.ai/` |
| UI Design OS | `/Data/Projects/.ai.ui/` |
| Business OS | `/Data/Projects/.ai.biz/` |
