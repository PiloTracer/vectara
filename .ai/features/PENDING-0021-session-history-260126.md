# PENDING: Session History

> **Status**: PENDING  
> **Priority**: Medium  
> **Complexity**: Low (models already exist)  
> **Created**: 2026-01-26

## Overview

Display and manage chat conversation history. Users can revisit past sessions, continue conversations, or delete old sessions.

## Current State

**Already Exists:**
- `ChatSession` model in `back-dl/app/models/chat.py` ✅
- `ChatMessage` model with relationship to sessions ✅
- PostgreSQL storage ready ✅

**Missing:**
- Backend endpoints for session CRUD
- Frontend page for session list
- Integration with current chat endpoint

---

## Proposed Approach (Minimal)

### Backend: New Router `sessions.py`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/sessions/` | GET | List user's sessions (paginated) |
| `/sessions/{id}` | GET | Get session with messages |
| `/sessions/{id}` | DELETE | Delete session |
| `/sessions/{id}/continue` | POST | Resume session (load history into chat) |

**File:** `back-dl/app/routers/sessions.py` (~80 lines)

### Frontend: New Page

**Location:** `front-dl/src/app/dashboard/history/page.tsx`

**UI Components:**
- Session list (title, date, message count)
- Click to view/continue
- Delete button with confirmation

**Effort:** ~2 hours

---

## Data Flow

```
┌─────────────────┐    GET /sessions/    ┌─────────────────┐
│  History Page   │◄────────────────────►│  sessions.py    │
│  (React)        │                      │  (FastAPI)      │
└────────┬────────┘                      └────────┬────────┘
         │                                        │
         │ Click "Continue"                       │
         ▼                                        ▼
┌─────────────────┐                      ┌─────────────────┐
│   Chat Page     │◄─── Load messages ───│   PostgreSQL    │
│   (existing)    │                      │   chat_sessions │
└─────────────────┘                      └─────────────────┘
```

---

## Integration with Current Chat

**Option A (Simplest):** Pass `session_id` to `/chat/` endpoint
- If provided, append message to existing session
- If not, create new session

**Modify `chat.py`:**
```python
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[UUID] = None  # NEW
    ...
```

---

## Files to Create/Modify

| File | Action | Lines |
|------|--------|-------|
| `back-dl/app/routers/sessions.py` | NEW | ~80 |
| `back-dl/app/main.py` | Add router import | +2 |
| `back-dl/app/routers/chat.py` | Add session_id support | +15 |
| `front-dl/src/app/dashboard/history/page.tsx` | NEW | ~120 |

**Total Effort:** ~3-4 hours

---

## Future Scaling

- Session search (full-text)
- Session export (JSON/Markdown)
- Session sharing
- Session tags/categories
