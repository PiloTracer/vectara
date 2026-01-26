# AI Session Handoff
**Last Session**: 2026-01-26 08:28

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
│  front-dl  - Next.js dashboard (port 13000)                     │
│  qdrant    - Vector database (port 16333) [HYBRID VECTORS]      │
│  postgres  - Metadata/config DB                                 │
│  ollama    - Local LLM (qwen2.5:7b) - Chat only                 │
│  infinity  - Embedding server (bge-m3) [NEW]                    │
│  reranker  - Cross-encoder (bge-reranker-v2-m3) [NEW]           │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ Session Summary (2026-01-26)

### Enterprise RAG Implementation (COMPLETE)

| Phase | Description | Status |
|-------|-------------|--------|
| **Infrastructure** | Added `infinity` + `reranker` containers to docker-compose | ✅ |
| **Embedding Service** | Rewritten for Infinity API, batch processing, HybridEmbedding | ✅ |
| **Reranker Service** | NEW service for cross-encoder scoring | ✅ |
| **Vector Storage** | Hybrid collection (dense+sparse), RRF fusion search | ✅ |
| **Ingestion Pipeline** | All 4 source types updated for hybrid vectors | ✅ |
| **Chat Endpoint** | Hybrid search + re-ranking pipeline | ✅ |

### Key Files Changed

| File | Change |
|------|--------|
| `docker-compose.dev.yml` | Added infinity (17997), reranker (17998) containers |
| `.env.dev` | Added INFINITY_*, RERANKER_* vars |
| `config.py` | Added INFINITY_URL, RERANKER_URL |
| `embedding_service.py` | Complete rewrite: batch, HybridEmbedding |
| `reranker_service.py` | NEW: cross-encoder service |
| `vector_service.py` | Complete rewrite: hybrid search, RRF |
| `ingestion_service.py` | Updated 4 source types |
| `chat.py` | Complete rewrite: hybrid + rerank |

---

## 📂 Key Files Reference

| Area | Path | Purpose |
|------|------|---------|
| Bridge Server | `vectara/src-tauri/src/server/` | HTTP API for file access from Docker |
| Bridge Client | `back-dl/app/services/bridge.py` | Python client calling Bridge |
| **Embedding** | `back-dl/app/services/embedding_service.py` | Infinity client, HybridEmbedding |
| **Reranker** | `back-dl/app/services/reranker_service.py` | Cross-encoder re-ranking |
| **Vector DB** | `back-dl/app/services/vector_service.py` | Hybrid search with RRF |
| **Chat/RAG** | `back-dl/app/routers/chat.py` | Hybrid search + rerank pipeline |
| **Ingestion** | `back-dl/app/services/ingestion_service.py` | Hybrid vector storage |
| Docker Compose | `docker-compose.dev.yml` | Infinity + Reranker containers |

---

## 🚀 Quick Start

```bash
cd vectara && pnpm tauri dev
```

Or for Docker stack only:
```bash
cd tools-iadata
docker compose --profile local-llm up -d
```

---

## ⚠️ Known Issues / Gaps

1. **Collection Recreation Needed**: Existing Qdrant collection uses legacy format. Delete and re-ingest for full hybrid search.
2. **LightOnOCR Not Loading**: Requires `pip install git+https://github.com/huggingface/transformers`
3. **Path Authorization Lost on Restart**: Bridge paths are in-memory only

---

## ➡️ Suggested Next Steps

1. **Recreate Qdrant collection** and re-ingest documents for hybrid vectors
2. **Verify container health**: `curl http://localhost:17997/health`
3. **Test keyword search**: Query for specific terms/IDs to validate sparse search
4. **GPU memory tuning**: Adjust batch sizes if OOM errors occur

---

## 📝 Notes for AI

Read these files for full context:
- Current Focus: `.ai/context/CURRENT_FOCUS.md`
- Decisions: `.ai/context/DECISIONS.md`
- Enterprise RAG Plan: `.ai/features/0525-rag-enterprise-260126.md`

**Key commands:**
- Start dev: `cd vectara && pnpm tauri dev`
- Check logs: `docker logs iadata_back_dl_dev 2>&1 | tail -50`
- Test chat API: `curl -s -X POST "http://localhost:18080/chat/" -H "Content-Type: application/json" -d '{"message": "...", "use_rag": true}' | jq`
