# AI Session Handoff
**Last Session**: 2026-01-25 12:25

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
└────────────────────────────┬────────────────────────────────────┘
                             │ host.docker.internal:3737
┌────────────────────────────▼────────────────────────────────────┐
│ DOCKER STACK (tools-iadata/)                                    │
│  back-dl   - FastAPI backend (port 18080)                       │
│  front-dl  - Next.js dashboard (port 13737)                     │
│  qdrant    - Vector database (port 16333)                       │
│  postgres  - Metadata/config DB                                 │
│  ollama    - Local LLM (bge-m3, qwen2.5:3b)                     │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow: Ingestion
1. User adds **Data Source** (local folder) via UI → folder picker → Bridge authorizes path
2. User clicks **Sync** → Backend calls Bridge `/api/file/list` and `/api/file/read`
3. Files extracted via `ExtractorRegistry` (PDF, Excel, images, text)
4. Chunks embedded via Ollama `bge-m3` → stored in Qdrant

### Data Flow: Chat/RAG
1. User asks question → embedded via `bge-m3`
2. Qdrant similarity search → retrieves relevant chunks
3. LLM (`qwen2.5:3b`) generates response with sources

---

## ✅ Session Summary (2026-01-25)

### Critical Bugs Fixed

| Issue | Fix | File |
|-------|-----|------|
| Bridge unreachable from Docker | Changed bind `127.0.0.1` → `0.0.0.0` | `vectara/src-tauri/src/server/mod.rs` |
| Binary files (Excel) failed | Added base64 encoding for non-UTF8 files | `vectara/...handlers.rs` + `back-dl/.../bridge.py` |
| **Ingestion silently failing** | Fixed swapped `extract(Path, bytes)` → `extract(bytes, filename)` | `back-dl/.../ingestion_service.py:123` |

### Result
- ✅ Excel files now ingested and searchable
- ✅ LLM retrieves data with source citations
- ✅ Full pipeline verified working

---

## 📂 Key Files Reference

| Area | Path | Purpose |
|------|------|---------|
| Bridge Server | `vectara/src-tauri/src/server/` | HTTP API for file access from Docker |
| Bridge Client | `tools-iadata/back-dl/app/services/bridge.py` | Python client calling Bridge |
| Ingestion | `tools-iadata/back-dl/app/services/ingestion_service.py` | Orchestrates file → chunks → vectors |
| Extractors | `tools-iadata/back-dl/app/services/extraction/` | PDF, Office, Image, Text extractors |
| Embedding | `tools-iadata/back-dl/app/services/embedding_service.py` | Ollama bge-m3 embeddings |
| Chat/RAG | `tools-iadata/back-dl/app/routers/chat.py` | Query → search → LLM response |
| Docker Compose | `tools-iadata/docker-compose.dev.yml` | Service definitions |

---

## 🚀 Quick Start

```bash
# Terminal 1: Start Tauri app (includes Bridge + Docker management)
cd vectara && pnpm tauri dev

# The app will:
# 1. Start Bridge server on 0.0.0.0:3737
# 2. Start Docker stack (back-dl, front-dl, qdrant, postgres, ollama)
# 3. Open desktop window
```

---

## ⚠️ Known Issues / Gotchas

1. **Path Authorization Lost on Restart**: Bridge authorized paths are in-memory only. After restarting app, must delete and re-add data sources.
2. **OCR Model Load Time**: Backend takes ~1-2 min to load LightOnOCR model on startup.
3. **Health Check Timing**: Frontend may fail to connect if backend not yet healthy.

---

## ➡️ Suggested Next Steps

1. **Persist Bridge Paths**: Store authorized paths in SQLite/JSON so they survive app restarts
2. **Add Error Logging**: Ingestion errors (line 153) should log for debugging
3. **Progress Feedback**: Show file-by-file progress during sync, not just "SYNCING"
4. **Additional Testing**: Verify PDF, DOCX, image extraction workflows

---

## 📝 Notes for AI

- Feature specs: `.ai/features/0511-api-bridge-client-260123-260123.md`
- Skills: `.ai/skills/tauri-development.md`, `.ai/skills/docker-ai-stack.md`
- Start dev: `cd vectara && pnpm tauri dev`
- Check logs: `docker logs iadata_back_dl_dev 2>&1 | tail -50`
