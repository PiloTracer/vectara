# Architectural Decision Records (ADR)

## ADR-001: Component Separation
**Status**: Accepted
**Context**: We need separate update cycles for desktop, AI engine, and auth.
**Decision**: Split into `vectara`, `tools-iadata`, and `tools-iam`.

## ADR-002: Bridge Network Binding
**Status**: Accepted
**Context**: The Docker container (`tools-iadata`) could not access the host desktop app's Bridge API when it was bound to `127.0.0.1`.
**Decision**: Bind the Bridge server to `0.0.0.0` (all interfaces) to allow access from the `host.docker.internal` network alias.
**Security Implication**: The Bridge is now exposed on the local network. We must rely on the randomized port (or future auth token) and local firewall rules for security.

## ADR-003: Base64 Encoding for Binary Ingestion
**Status**: Accepted
**Context**: Sending binary files (Excel, Images) as raw bytes over the JSON-based Bridge API caused encoding errors.
**Decision**: Adopt a standard where the Bridge Base64-encodes file content before returning it to the Python backend. The backend decodes it before processing.

## ADR-004: OCR Fallback Strategy
**Status**: Accepted (2026-01-26)
**Context**: LightOnOCR-2-1B provides superior OCR quality but requires transformers from source.
**Decision**: 
- Primary: LightOnOCR-2 via `LightOnOcrForConditionalGeneration`
- Fallback: Tesseract (pytesseract) when LightOnOCR unavailable
**Note**: PDF page extraction uses PyMuPDF for text-based pages, OCR only triggered when page has <100 chars.

## ADR-005: Diverse Search Results
**Status**: Accepted (2026-01-26)
**Context**: Vector search returns top-N most similar chunks, which may all be from the same 1-2 documents, causing LLM to miss content from other documents.
**Decision**: 
1. Fetch 30 raw results from Qdrant
2. Group by document path
3. Take up to 2 best chunks per document
4. Interleave results to ensure all documents represented (max 12 total)
**Result**: All ingested documents now appear in context for queries like "what books do you have?"
