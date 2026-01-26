# Current Development Focus

## 📅 Recent Session: 2026-01-26
**Summary**: Fixed critical PDF extraction bugs, rewrote OCR service for LightOnOCR-2, and implemented **diverse search results** for better RAG coverage.

### Git Activity
- 2026-01-26: Fix: PDF "document closed" bug, OCR service rewrite
- 2026-01-26: Feat: Diverse search algorithm for RAG (all documents represented)
- 2026-01-26: Feat: Improved system prompt and context structure for LLM

### Key Changes
- **`pdf_extractor.py`**: Fixed bug where `len(doc)` was called after `doc.close()`
- **`ocr_service.py`**: Complete rewrite to use correct LightOnOCR-2 API
- **`chat.py`**: Diverse search fetches 30 results, groups by document, takes up to 2 per doc

## Immediate Next Steps
1. **Fix LightOnOCR in Docker**: Update Dockerfile to install transformers from source
2. **Hybrid Search**: Add BM25 keyword search alongside vector search
3. **Persist Bridge Paths**: Implement persistence for data sources
4. **Query Expansion**: Generate multiple queries per user question

## Context for AI Assistant
- Read `.ai/context/HANDOFF.md` for complete working memory
- Focus on the active feature and immediate next steps

Last updated: 2026-01-26
