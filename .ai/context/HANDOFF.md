# AI Session Handoff
**Last Session**: 2026-01-26 01:35

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
│  ollama    - Local LLM (bge-m3, qwen2.5:7b)                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ Session Summary (2026-01-26)

### Critical Bugs Fixed

| Issue | Fix | File |
|-------|-----|------|
| **PDF "document closed" error** | Store `page_count` before `doc.close()` | `pdf_extractor.py` |
| **Wrong OCR API** | Rewrite to use `LightOnOcrForConditionalGeneration` | `ocr_service.py` |
| **LLM ignoring context** | Improved system prompt with explicit rules | `chat.py` |
| **Limited search results** | Diverse search: fetch 100, group by doc | `chat.py` |
| **Chat filter not working** | Added source_id filter to ChatInterface | `ChatInterface.tsx` |

### New Features Implemented

| Feature | Description | File |
|---------|-------------|------|
| **Diverse Search** | Fetch 100 results, group by doc, max 2 chunks each | `chat.py` |
| **Metadata Chunks** | Add doc title/author chunk for discovery queries | `ingestion_service.py` |
| **LLM Parameter Tuning** | temperature=0.3, top_p=0.7, num_ctx=8192 | `llm_service.py` |
| **Context Window 8192** | Increased Ollama context window | `docker-compose.dev.yml` |

### Model Upgrade
- Upgraded from `qwen2.5:3b` to `qwen2.5:7b` for better responses

### Test Status
- ✅ PDF extraction working (5 Mark Twain books: 7,146 chunks)
- ✅ Chat retrieves and cites sources correctly
- ✅ Diverse search covers all documents
- ⚠️ LightOnOCR requires transformers from source (falls back to Tesseract)

---

## 📂 Key Files Reference

| Area | Path | Purpose |
|------|------|---------|
| Bridge Server | `vectara/src-tauri/src/server/` | HTTP API for file access from Docker |
| Bridge Client | `back-dl/app/services/bridge.py` | Python client calling Bridge |
| **PDF Extractor** | `back-dl/app/services/extraction/pdf_extractor.py` | PDF text + OCR fallback |
| **OCR Service** | `back-dl/app/services/ocr_service.py` | LightOnOCR wrapper |
| **Chat/RAG** | `back-dl/app/routers/chat.py` | Diverse search + LLM response |
| **LLM Service** | `back-dl/app/services/llm_service.py` | Ollama client with tuned params |
| **Ingestion** | `back-dl/app/services/ingestion_service.py` | Now adds metadata chunks |
| Docker Compose | `docker-compose.dev.yml` | Updated with context window |

---

## 🚀 Quick Start

```bash
cd vectara && pnpm tauri dev
```

---

## ⚠️ Known Issues / Gaps

1. **LightOnOCR Not Loading**: Requires `pip install git+https://github.com/huggingface/transformers`
2. **Need Re-sync**: After metadata chunks feature, re-sync documents to generate discovery chunks
3. **Path Authorization Lost on Restart**: Bridge paths are in-memory only

---

## ➡️ Suggested Next Steps

1. **Re-sync Mark Twain books** to generate metadata chunks
2. **Fix LightOnOCR** in Dockerfile for proper OCR
3. **Hybrid Search** - Add BM25 keyword search alongside vector search
4. **Try qwen2.5:14b** if 7b responses are still not good enough

---

## 📝 Notes for AI

Read these files for full context:
- Current Focus: `.ai/context/CURRENT_FOCUS.md`
- Decisions: `.ai/context/DECISIONS.md`

**Key commands:**
- Start dev: `cd vectara && pnpm tauri dev`
- Check logs: `docker logs iadata_back_dl_dev 2>&1 | tail -50`
- Test chat API: `curl -s -X POST "http://localhost:18080/chat/" -H "Content-Type: application/json" -d '{"message": "...", "use_rag": true, "filter": {"source_ids": ["..."]}}' | jq`
