# AI Session Handoff
**Last Session**: 2026-01-26 10:10

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

## ✅ Session Summary (2026-01-26)

### Morning Session - Enterprise RAG + Fixes

| Item | Description | Status |
|------|-------------|--------|
| **Enterprise RAG** | Infinity + Reranker containers, hybrid search, RRF fusion | ✅ |
| **docker-compose.gpu.yml** | Fixed to proper override-only format (was full copy) | ✅ |
| **Tauri emit API** | Fixed `emit_all` → `emit` + `use tauri::Emitter` | ✅ |
| **Infinity Port Fix** | Changed from external (17997) to internal Docker port (7997) | ✅ |
| **Progress Feedback** | Real-time Docker log streaming during startup | ✅ |
| **LightOnOCR Fix** | Installed transformers from GitHub source | ✅ |
| **Document Inventory** | Added `get_all_unique_documents()` for listing queries | ✅ |

### Key Files Changed

| File | Change |
|------|--------|
| `docker-compose.dev.yml` | Added infinity (7997), reranker (7997) containers |
| `docker-compose.gpu.yml` | Restored to override-only format |
| `.env.dev` | Fixed INFINITY_PORT=7997, RERANKER_PORT=7997 |
| `back-dl/Dockerfile` | Added `git` to apt-get for pip source installs |
| `back-dl/requirements.txt` | Changed `transformers>=4.40.0` → `git+https://github.com/huggingface/transformers` |
| `embedding_service.py` | Infinity client, batch processing, HybridEmbedding |
| `reranker_service.py` | NEW: cross-encoder service |
| `vector_service.py` | Hybrid search, RRF, `get_all_unique_documents()` |
| `chat.py` | Hybrid search + rerank + document inventory |
| `docker.rs` | Streaming stdout/stderr via `emit("docker-event-log")` |
| `Gatekeeper.tsx` | Tauri event listener for real-time logs |

---

## 📂 Key Files Reference

| Area | Path | Purpose |
|------|------|---------|
| Bridge Server | `vectara/src-tauri/src/server/` | HTTP API for file access from Docker |
| **Embedding** | `back-dl/app/services/embedding_service.py` | Infinity client, HybridEmbedding |
| **Reranker** | `back-dl/app/services/reranker_service.py` | Cross-encoder re-ranking |
| **Vector DB** | `back-dl/app/services/vector_service.py` | Hybrid search + document inventory |
| **Chat/RAG** | `back-dl/app/routers/chat.py` | Hybrid search + rerank pipeline |
| Docker Compose | `docker-compose.dev.yml` | CPU mode (base) |
| GPU Override | `docker-compose.gpu.yml` | GPU overlay (adds CUDA) |

---

## 🚀 Quick Start

```bash
cd vectara && pnpm tauri dev
```

Or for Docker stack only:
```bash
cd tools-iadata
docker compose -f docker-compose.dev.yml --profile local-llm up -d
```

For GPU mode:
```bash
docker compose -f docker-compose.dev.yml -f docker-compose.gpu.yml --profile local-llm up -d
```

---

## ✅ Verified Working

- ✅ Infinity embedding server at `http://infinity:7997`
- ✅ Reranker at `http://reranker:7997`
- ✅ LightOnOCR model loading (transformers 5.0.1.dev0)
- ✅ Real-time Docker log streaming to UI
- ✅ 5 books in Qdrant with hybrid vectors (3578 chunks)
- ✅ Document inventory queries return all documents

---

## 📝 Notes for AI

Read these files for full context:
- Current Focus: `.ai/context/CURRENT_FOCUS.md`
- Decisions: `.ai/context/DECISIONS.md`
- Enterprise RAG Plan: `.ai/features/0525-rag-enterprise-260126.md`

**Key commands:**
- Start dev: `cd vectara && pnpm tauri dev`
- Check logs: `docker logs iadata_back_dl_dev 2>&1 | tail -50`
- Test chat: `curl -X POST "http://localhost:18080/chat/" -H "Content-Type: application/json" -d '{"message": "what books do you have?", "use_rag": true}'`
- Verify Infinity: `curl http://localhost:17997/health`
