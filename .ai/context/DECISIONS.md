# Architectural Decision Records (ADR)

## ADR-001: Component Separation
**Status**: Accepted
**Decision**: Split into `vectara`, `tools-iadata`, and `tools-iam`.

## ADR-002: Bridge Network Binding
**Status**: Accepted
**Decision**: Bind Bridge server to `0.0.0.0` for Docker access via `host.docker.internal`.

## ADR-003: Base64 Encoding for Binary Ingestion
**Status**: Accepted
**Decision**: Base64-encode binary files (Excel, Images) in Bridge API.

## ADR-004: OCR Fallback Strategy
**Status**: Accepted (2026-01-26)
**Decision**: LightOnOCR-2 primary, Tesseract fallback when unavailable.

## ADR-005: Diverse Search Results
**Status**: Accepted (2026-01-26)
**Decision**: Fetch 100 results, group by document, take up to 2 chunks per doc, max 12 total.

## ADR-006: Metadata Chunks for Discovery
**Status**: Accepted (2026-01-26)
**Context**: Semantic search doesn't find documents that don't match the query text.
**Decision**: During ingestion, create a special metadata chunk per document:
```
Document: filename.pdf. Title: X. Author: Y. Type: Z.
This is an available book/document in the collection.
```
This chunk matches queries like "list available books" ensuring all documents are discoverable.

## ADR-007: LLM Parameter Tuning
**Status**: Accepted (2026-01-26)
**Decision**: Configure Ollama with:
- `temperature: 0.3` - More deterministic
- `top_p: 0.7` - Focused token selection
- `repeat_penalty: 1.2` - Avoid repetitions
- `num_ctx: 8192` - Larger context window for RAG
