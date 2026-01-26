# AI Session Handoff
**Last Session**: 2026-01-26 00:30

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

### Data Flow: Chat/RAG (Updated)
1. User asks question → embedded via `bge-m3`
2. Qdrant similarity search → retrieves 30 raw results
3. **Diversity algorithm** ensures representation from ALL documents (up to 2 chunks each)
4. LLM (`qwen2.5:3b`) generates response with context from diverse sources

---

## ✅ Session Summary (2026-01-26)

### Critical Bugs Fixed

| Issue | Fix | File |
|-------|-----|------|
| **PDF "document closed" error** | Store `page_count` before `doc.close()` | `pdf_extractor.py:72-75` |
| **Wrong OCR API** | Rewrite to use `LightOnOcrForConditionalGeneration` | `ocr_service.py` (full rewrite) |
| **LLM ignoring context** | Improved system prompt + context structure | `chat.py:75-85` |
| **Limited search results** | Diverse search: fetch 30, group by doc, interleave | `chat.py:48-72` |

### OCR Configuration
```
USE_LOCAL_OCR=true
LOCAL_OCR_MODEL_NAME=lightonai/LightOnOCR-2-1B
```
**Note**: Requires `pip install git+https://github.com/huggingface/transformers` for LightOnOCR-2 classes. Currently falls back to Tesseract.

### Result
- ✅ PDF extraction working (5 Mark Twain books: 7,146 chunks)
- ✅ LLM retrieves and cites data correctly
- ✅ Diverse search covers ALL documents, not just top-scoring ones

---

## 📂 Key Files Reference

| Area | Path | Purpose |
|------|------|---------|
| Bridge Server | `vectara/src-tauri/src/server/` | HTTP API for file access from Docker |
| Bridge Client | `tools-iadata/back-dl/app/services/bridge.py` | Python client calling Bridge |
| Ingestion | `tools-iadata/back-dl/app/services/ingestion_service.py` | Orchestrates file → chunks → vectors |
| **PDF Extractor** | `tools-iadata/back-dl/app/services/extraction/pdf_extractor.py` | PDF text + OCR fallback |
| **OCR Service** | `tools-iadata/back-dl/app/services/ocr_service.py` | LightOnOCR wrapper |
| Embedding | `tools-iadata/back-dl/app/services/embedding_service.py` | Ollama bge-m3 embeddings |
| **Chat/RAG** | `tools-iadata/back-dl/app/routers/chat.py` | Diverse search → LLM response |
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

1. **LightOnOCR Not Loading**: Requires transformers from source. Currently falling back to Tesseract.
2. **Path Authorization Lost on Restart**: Bridge authorized paths are in-memory only. After restarting app, must delete and re-add data sources.
3. **OCR Model Load Time**: Backend takes ~1-2 min to load OCR model on startup (if enabled).

---

## ➡️ Suggested Next Steps

1. **Fix LightOnOCR**: Install transformers from source in Dockerfile or pin compatible version
2. **Hybrid Search**: Add BM25 keyword search alongside vector search for better recall
3. **Persist Bridge Paths**: Store authorized paths so they survive app restarts
4. **Query Expansion**: Use LLM to generate multiple related queries for better coverage

---

## 📝 Notes for AI

Read these files for full context:
- Architecture: `.ai/context/ARCHITECTURE.md`
- Decisions: `.ai/context/DECISIONS.md`
- Current Focus: `.ai/context/CURRENT_FOCUS.md`
- AI Workflow: `.ai/context/AI_WORKFLOW.md`

**Key commands:**
- Start dev: `cd vectara && pnpm tauri dev`
- Check logs: `docker logs iadata_back_dl_dev 2>&1 | tail -50`
- Test API: `curl -s -X POST "http://localhost:18080/chat/" -H "Content-Type: application/json" -d '{"message": "...", "use_rag": true, "filter": {"source_ids": ["..."]}}' | jq`
