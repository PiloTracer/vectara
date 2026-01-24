# Cloud Data Sources Integration - Implementation Plan

**Date**: 2026-01-23 (Iteration 6)  
**Status**: Active Implementation

---

## Overview

This plan documents the implementation of **Google Drive** and **SharePoint** as new Data Source types for the AI Data Lake system, including a comprehensive document extraction pipeline with OCR support.

---

## Architecture Decision

### Why Data Sources, Not MCP Servers

| Aspect | Data Sources | MCP Servers |
|--------|--------------|-------------|
| **Purpose** | Content ingestion for RAG | Tool execution for AI agents |
| **Data Flow** | Pull → Parse → Embed → Vector DB | Real-time request/response |
| **Integration** | Indexed into Qdrant | Results go to LLM context |

**Decision**: Cloud storage (Google Drive, SharePoint) implemented as **Data Sources**, MCP tab hidden from UI.

---

## Completed Work ✓

### 1. Document Extraction Pipeline

Created `back-dl/app/services/extraction/`:

| File | Formats Supported |
|------|-------------------|
| [base.py](file:///mnt/work/Projects/tauri/datalake/tools-iadata/back-dl/app/services/extraction/base.py) | `BaseExtractor`, `ExtractorRegistry` |
| [pdf_extractor.py](file:///mnt/work/Projects/tauri/datalake/tools-iadata/back-dl/app/services/extraction/pdf_extractor.py) | PDF with Tesseract OCR fallback |
| [office_extractor.py](file:///mnt/work/Projects/tauri/datalake/tools-iadata/back-dl/app/services/extraction/office_extractor.py) | DOCX, XLSX, PPTX |
| [text_extractor.py](file:///mnt/work/Projects/tauri/datalake/tools-iadata/back-dl/app/services/extraction/text_extractor.py) | TXT, MD, HTML, code files |
| [image_extractor.py](file:///mnt/work/Projects/tauri/datalake/tools-iadata/back-dl/app/services/extraction/image_extractor.py) | PNG, JPG, TIFF, BMP, GIF, WebP (OCR) |

---

### 2. Source Handlers

Created `back-dl/app/services/sources/`:

| File | Description |
|------|-------------|
| [base.py](file:///mnt/work/Projects/tauri/datalake/tools-iadata/back-dl/app/services/sources/base.py) | `BaseSourceHandler`, `FileInfo` dataclass |
| [local_handler.py](file:///mnt/work/Projects/tauri/datalake/tools-iadata/back-dl/app/services/sources/local_handler.py) | Docker volume filesystem |
| [google_drive_handler.py](file:///mnt/work/Projects/tauri/datalake/tools-iadata/back-dl/app/services/sources/google_drive_handler.py) | Google Drive API v3 + OAuth |
| [sharepoint_handler.py](file:///mnt/work/Projects/tauri/datalake/tools-iadata/back-dl/app/services/sources/sharepoint_handler.py) | MS Graph API + MSAL App-Only |

---

### 3. OAuth Infrastructure

Created [back-dl/app/routers/oauth.py](file:///mnt/work/Projects/tauri/datalake/tools-iadata/back-dl/app/routers/oauth.py):

| Endpoint | Purpose |
|----------|---------|
| `POST /oauth/google/init` | Get Google OAuth URL |
| `GET /oauth/google/callback` | Exchange code for tokens |
| `POST /oauth/microsoft/init` | Get Microsoft OAuth URL |
| `GET /oauth/microsoft/callback` | Exchange code for tokens |
| `GET /oauth/status/{source_id}` | Check connection status |
| `DELETE /oauth/disconnect/{source_id}` | Revoke tokens |

Added `OAuthToken` model in [resources.py](file:///mnt/work/Projects/tauri/datalake/tools-iadata/back-dl/app/models/resources.py).

---

### 4. Ingestion Pipeline

Updated [resources.py](file:///mnt/work/Projects/tauri/datalake/tools-iadata/back-dl/app/routers/resources.py) `POST /sources/{id}/ingest`:

- **Asynchronous**: Uses FastAPI `BackgroundTasks`
- Returns `job_id` immediately
- **Service**: Logic moved to `app.services.ingestion_service.py`
- Updates `SystemJob` status (PENDING -> RUNNING -> COMPLETED/FAILED)
- Supports all 4 source types:
  - `LOCAL`
  - `LOCAL_BRIDGE`
  - `GOOGLE_DRIVE`
  - `SHAREPOINT`

---

### 5. Frontend Form

Updated [DataSourceForm.tsx](file:///mnt/work/Projects/tauri/datalake/tools-iadata/front-dl/src/components/resources/DataSourceForm.tsx):

- 2x2 grid with 4 source types:
  - **Local Directory** (amber, conditional on `USE_LOCAL_EMBEDDING`)
  - **Web Resource** (blue)
  - **Google Drive** (green)
  - **SharePoint** (purple)
- Submit logic handles all types with proper config

---

### 6. Dependencies & Docker

Updated [requirements.txt](file:///mnt/work/Projects/tauri/datalake/tools-iadata/back-dl/requirements.txt):

```
# Document Extraction
pymupdf, python-docx, openpyxl, python-pptx, pytesseract, Pillow, beautifulsoup4, lxml

# Google Drive
google-api-python-client, google-auth, google-auth-oauthlib

# SharePoint
msal

# Testing
pytest, pytest-asyncio
```

Updated [Dockerfile](file:///mnt/work/Projects/tauri/datalake/tools-iadata/back-dl/Dockerfile):
```dockerfile
RUN apt-get install -y tesseract-ocr tesseract-ocr-eng tesseract-ocr-spa libmagic1
```

---

### 7. Test Data

Updated [100-populate-test.sql](file:///mnt/work/Projects/tauri/datalake/tools-iadata/back-dl/app/sql/100-populate-test.sql) with `GOOGLE_DRIVE` example.

---

### 8. Pytest Test Suites

Created `back-dl/tests/services/`:

- [test_extraction.py](file:///mnt/work/Projects/tauri/datalake/tools-iadata/back-dl/tests/services/test_extraction.py) - 15+ tests
- [test_sources.py](file:///mnt/work/Projects/tauri/datalake/tools-iadata/back-dl/tests/services/test_sources.py) - 10+ tests

---

## Remaining Tasks

### High Priority

1. **Add Cloud Source Input Fields to Frontend**
   - Google Drive: Folder ID input + "Connect" button → OAuth flow
   - SharePoint: Site URL + Folder path inputs
   - Status indicator showing OAuth connection state

2. **~~Vector DB Integration~~ ✓**
   - ~~Wire extracted documents to Qdrant embeddings~~
   - ~~Chunk strategy per document type~~
   - **Implemented**: `VectorService`, `EmbeddingService`, `ChunkingService`
   - **Verified**: Auto-pull of `nomic-embed-text`, 768-dim embeddings, Qdrant upsert/search

3. **Job Status Endpoint** (NEW - Required for Frontend)
   - Create `GET /resources/jobs/{job_id}` to poll `SystemJob` status
   - Returns: `status`, `progress`, `error`, `completed_at`
   - **Action**: Implement in `resources.py`

3. **Environment Variables**
   - Add to `.env.example`:
     ```
     GOOGLE_CLIENT_ID=
     GOOGLE_CLIENT_SECRET=
     GOOGLE_REDIRECT_URI=http://localhost:8000/oauth/google/callback
     MS_TENANT_ID=
     MS_CLIENT_ID=
     MS_CLIENT_SECRET=
     MS_REDIRECT_URI=http://localhost:8000/oauth/microsoft/callback
     ```

### Medium Priority

4. **OAuth Token Refresh**
   - Implement automatic token refresh before expiry
   - Handle refresh failures gracefully

5. **Progress Tracking**
   - Use `SystemJob` model for async ingestion status
   - Real-time progress updates via WebSocket or polling

6. **DataSourceList Enhancement**
   - Show OAuth status indicators
   - Add "Sync Now" button per source

### Low Priority

7. **WEB Source Handler**
   - Implement web scraping with depth limit
   - HTML to text extraction

8. **Token Encryption**
   - Encrypt `OAuthToken.access_token` and `refresh_token` at rest

---

## Files Modified (This Session)

| File | Changes |
|------|---------|
| `back-dl/app/models/resources.py` | Added `OAuthToken` model |
| `back-dl/app/routers/oauth.py` | **NEW** - OAuth endpoints |
| `back-dl/app/routers/resources.py` | Updated ingestion for all types |
| `back-dl/app/main.py` | Registered OAuth router |
| `back-dl/requirements.txt` | 19 new dependencies |
| `back-dl/Dockerfile` | Tesseract OCR packages |
| `back-dl/app/sql/100-populate-test.sql` | GOOGLE_DRIVE example |
| `back-dl/app/services/extraction/*` | **NEW** - 5 files |
| `back-dl/app/services/sources/*` | **NEW** - 5 files |
| `back-dl/tests/services/*` | **NEW** - 3 files |
| `front-dl/src/components/resources/DataSourceForm.tsx` | Cloud source buttons |
| `front-dl/src/app/dashboard/sources/page.tsx` | Hidden MCP tab |

---

## Testing Instructions

```bash
# Rebuild backend
docker compose -f docker-compose.dev.yml up -d --build back-dl

# Run pytest (inside container)
docker exec -it iadata-back-dl pytest tests/ -v

# Test OAuth (requires configured credentials)
# 1. Set env vars in .env.dev
# 2. Create a GOOGLE_DRIVE source via UI
# 3. Click "Connect" to initiate OAuth
```

---

## Related Plans

- [plan-0055-full-mcp-servers](file:///mnt/work/Projects/tauri/datalake/tools-iadata/.claude/plan/plan-0055-full-mcp-servers-200123-u260123.md) - MCP vs Data Source analysis
- [plan-0060-cloud-sources-extraction](file:///mnt/work/Projects/tauri/datalake/tools-iadata/.claude/plan/plan-0060-cloud-sources-extraction-230126-u230126.md) - Original extraction plan
