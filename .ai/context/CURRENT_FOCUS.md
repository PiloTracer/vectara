# Current Development Focus

## 📅 Recent Session: 2026-01-26
**Summary**: Fixed PDF extraction, implemented diverse search, added metadata chunks for document discovery, and tuned LLM parameters.

### Git Commits Today
- Fix: PDF "document closed" bug, OCR service rewrite
- Feat: Diverse search algorithm (100 results, grouped by doc)
- Feat: Metadata chunks per document for discovery queries
- Feat: LLM parameter tuning (temperature=0.3, num_ctx=8192)
- Upgrade: qwen2.5:3b → qwen2.5:7b

### Key Changes
- **`pdf_extractor.py`**: Fixed bug where `len(doc)` was called after `doc.close()`
- **`chat.py`**: Diverse search + improved system prompt with explicit rules
- **`ingestion_service.py`**: Adds metadata chunk per document
- **`llm_service.py`**: Added temperature, top_p, repeat_penalty, num_ctx options
- **`docker-compose.dev.yml`**: OLLAMA_CONTEXT_LENGTH=8192

## Immediate Next Steps
1. **Re-sync documents** to generate new metadata chunks
2. **Fix LightOnOCR** - Update Dockerfile to install transformers from source
3. **Test with qwen2.5:14b** if responses still need improvement
4. **Hybrid Search** - Add BM25 keyword search

## Context for AI Assistant
- Read `.ai/context/HANDOFF.md` for complete session summary
- Focus on immediate next steps above

Last updated: 2026-01-26 01:35
