# PENDING: Knowledge Base

> **Status**: PENDING  
> **Priority**: Medium  
> **Complexity**: Low  
> **Created**: 2026-01-26

## Overview

View and manage ingested documents. Users can see what's in the vector database, view document metadata, and delete documents they no longer need.

## Current State

**Already Exists:**
- Documents stored in Qdrant with `path` metadata ✅
- `get_all_unique_documents()` in `vector_service.py` ✅
- Ingestion pipeline for multiple source types ✅

**Missing:**
- Backend endpoint to list documents with stats
- Backend endpoint to delete documents from Qdrant
- Frontend page to browse knowledge base

---

## Proposed Approach (Minimal)

### Backend: New Router `knowledge.py`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/knowledge/` | GET | List all documents with stats |
| `/knowledge/{doc_path}` | GET | Get document details (chunk count, etc) |
| `/knowledge/{doc_path}` | DELETE | Remove document chunks from Qdrant |
| `/knowledge/stats` | GET | Collection statistics |

**File:** `back-dl/app/routers/knowledge.py` (~100 lines)

### Document Info Structure

```python
class DocumentInfo(BaseModel):
    path: str              # "A Connecticut Yankee in King Arthur's court.pdf"
    chunk_count: int       # 523
    first_ingested: datetime
    source_type: str       # "local", "gdrive", "sharepoint", etc.
```

### Frontend: New Page

**Location:** `front-dl/src/app/dashboard/knowledge/page.tsx`

**UI Components:**
- Document table (name, chunks, source, date)
- Search/filter
- Delete button with confirmation
- Link to view in chat context

**Effort:** ~3 hours

---

## Data Source

All data comes from **Qdrant payloads** (no new database tables):

```python
# vector_service.py already has:
def get_all_unique_documents() -> List[str]

# Extend to:
def get_document_stats() -> List[DocumentInfo]
def delete_document(path: str) -> int  # Returns deleted count
```

---

## Delete Flow

```
User clicks "Delete" on document
        │
        ▼
DELETE /knowledge/{doc_path}
        │
        ▼
vector_service.delete_by_path(path)
        │
        ▼
Qdrant: Delete all points where payload.path == path
```

---

## Files to Create/Modify

| File | Action | Lines |
|------|--------|-------|
| `back-dl/app/routers/knowledge.py` | NEW | ~100 |
| `back-dl/app/main.py` | Add router import | +2 |
| `back-dl/app/services/vector_service.py` | Add delete_by_path(), get_document_stats() | +40 |
| `front-dl/src/app/dashboard/knowledge/page.tsx` | NEW | ~150 |

**Total Effort:** ~4-5 hours

---

## Future Scaling

- Re-ingest single document
- Document preview (first chunk)
- Chunk-level browsing
- Source-based filtering (show only GDrive docs)
- Bulk operations
