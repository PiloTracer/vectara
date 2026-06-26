# AI Session Handoff
**Last Session**: 2026-01-26 19:12

---

## 🏗️ Project Overview

**datalake** is a local-first AI document assistant that enables RAG (Retrieval-Augmented Generation) over user's local files via a secure Bridge architecture.

### Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│ DESKTOP (Tauri)                                                 │
│  vectara/ - React UI + Rust Bridge Server (port 3737)          │
│  • Authorizes local folders via native dialog                   │
│  • Serves files to Docker via HTTP API                          │
│  • Manages Docker lifecycle (start/stop)                        │
│  • Real-time Docker log streaming via Tauri events              │
└────────────────────────────┬────────────────────────────────────┘
                             │ host.docker.internal:3737
┌────────────────────────────▼────────────────────────────────────┐
│ DOCKER STACK (tools-iadata/)                                    │
│  back-dl   - FastAPI backend (port 18080)                       │
│  front-dl  - Next.js dashboard (port 13000)                     │
│  qdrant    - Vector database (port 16333) [HYBRID VECTORS]      │
│  postgres  - Metadata/config DB                                 │
│  ollama    - Local LLM (qwen2.5:7b) - Chat + fallback embed     │
│  infinity  - Embedding server (bge-m3) - GPU/CPU auto           │
│  reranker  - Cross-encoder (bge-reranker-v2-m3) - GPU/CPU auto  │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ Latest Session Summary (2026-01-26 Evening)

### Implemented Features

| Item | Description | Status |
|------|-------------|--------|
| **RTF Extractor** | New `rtf_extractor.py` for .rtf files using striprtf | ✅ |
| **ImageExtractor Fix** | Fixed property→method bug in `supported_extensions()` | ✅ |
| **Dynamic Model Selector** | Chat header shows current LLM + dropdown to switch | ✅ |
| **Backend Model Endpoint** | `/models/env/{env_id}/default` to get default model | ✅ |

### Planning Documents Created

| Document | Description |
|----------|-------------|
| `PENDING-0600-exe-deployment-260126.md` | Standalone .exe deployment strategy |
| `PENDING-0601-more-file-types-260126.md` | Extended file type support (50+ formats) |

### Key Decisions Made

1. **Git in EXE**: Use `git2` crate (no system git required)
2. **Docker**: Guided installation (cannot be bundled)
3. **Incremental Sync**: Defer to "add folder" approach for now, implement later

---

## 📂 Key Files Reference

| Area | Path | Purpose |
|------|------|---------|
| **Extraction** | `back-dl/app/services/extraction/` | Document extractors |
| **RTF** | `extraction/rtf_extractor.py` | NEW: Rich Text Format |
| **Chat UI** | `front-dl/src/components/chat/ChatInterface.tsx` | Model selector dropdown |
| **Models API** | `back-dl/app/routers/models.py` | Default model endpoint |
| Bridge Server | `vectara/src-tauri/src/server/` | HTTP API for file access |

---

## 📋 Pending Features

| ID | Feature | Priority |
|----|---------|----------|
| 0600 | EXE Deployment (git2, Docker guide) | 🔴 High |
| 0601 | Extended File Types (50+ formats) | 🟡 Medium |
| 0022 | Knowledge Base UI | 🟡 Medium |
| 0021 | Session History | 🟡 Medium |
| 0023 | Settings UI | 🟢 Low |
| 0024 | Documentation | 🟢 Low |

---

## 🚀 Quick Start

```bash
cd vectara && pnpm tauri dev
```

Or Docker stack only:
```bash
cd tools-iadata
docker compose -f docker-compose.dev.yml --profile local-llm up -d
```

---

## ✅ Document Extraction Support

| Format | Extension | Status |
|--------|-----------|--------|
| PDF | `.pdf` | ✅ |
| Word | `.docx` | ✅ |
| Excel | `.xlsx` | ✅ |
| PowerPoint | `.pptx` | ✅ |
| RTF | `.rtf` | ✅ NEW |
| HTML | `.htm`, `.html` | ✅ |
| Text | `.txt`, `.md`, `.csv`, `.json`, `.yaml` | ✅ |
| Images | `.png`, `.jpg`, `.tiff`, etc. | ✅ OCR |
| Legacy Office | `.doc`, `.xls`, `.ppt` | 📋 Pending |
| Email | `.eml`, `.msg` | 📋 Pending |

---

## 📝 Notes for AI

Read these for full context:
- Deployment Strategy: `.ai/features/PENDING-0600-exe-deployment-260126.md`
- File Type Plan: `.ai/features/PENDING-0601-more-file-types-260126.md`
- Enterprise RAG: `.ai/features/0525-rag-enterprise-260126.md`

**Key commands:**
- Start dev: `cd vectara && pnpm tauri dev`
- Check logs: `docker logs iadata_back_dl_dev 2>&1 | tail -50`
- Test extraction: `python3 -c "from app.services.extraction import ExtractorRegistry; print(ExtractorRegistry.supported_extensions())"`
