# PENDING: Settings

> **Status**: PENDING  
> **Priority**: Low  
> **Complexity**: Very Low  
> **Created**: 2026-01-26

## Overview

User-facing configuration page for adjusting RAG behavior, model selection, and UI preferences. Settings stored in browser localStorage (frontend) with optional backend persistence.

## Current State

**Already Exists:**
- `.env.dev` contains all backend configuration ✅
- Models selectable via environment variables ✅
- Settings are "fixed" per deployment ✅

**Missing:**
- User-facing settings UI
- Per-user preference storage
- Runtime configuration changes

---

## Proposed Approach (Minimal - Frontend Only)

### Phase 1: Local Storage Settings (No Backend Changes)

Store preferences in browser localStorage. Zero backend work.

**Settings to Expose:**

| Category | Setting | Type | Default |
|----------|---------|------|---------|
| **Appearance** | Theme | light/dark/auto | auto |
| **Chat** | Show sources | boolean | true |
| **Chat** | Auto-scroll | boolean | true |
| **Chat** | Max context chunks | 5/10/15/20 | 10 |
| **Display** | Language | en/es | en |

### Frontend Implementation

**Location:** `front-dl/src/app/dashboard/settings/page.tsx`

**UI Components:**
- Settings form with toggles/dropdowns
- Save button (writes to localStorage)
- Reset to defaults

**Effort:** ~2 hours

---

## Data Storage

```typescript
// localStorage key
const SETTINGS_KEY = 'datalake_user_settings';

// Default settings
const defaultSettings = {
  theme: 'auto',
  showSources: true,
  autoScroll: true,
  maxContextChunks: 10,
  language: 'en'
};

// Usage
const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || defaultSettings;
```

---

## Files to Create

| File | Action | Lines |
|------|--------|-------|
| `front-dl/src/app/dashboard/settings/page.tsx` | NEW | ~100 |
| `front-dl/src/lib/settings.ts` | NEW (helper) | ~30 |

**Total Effort:** ~2-3 hours

---

## Phase 2 (Future): Backend-Persisted Settings

**When Needed:** Multi-device sync, admin-controlled defaults

```python
# New model
class UserSettings(Base):
    __tablename__ = "user_settings"
    user_id = Column(String, primary_key=True)
    settings = Column(JSONB, default={})
```

```python
# New endpoints
GET  /settings/       # Get user settings
PUT  /settings/       # Update settings
```

---

## Future Scaling

- Model selection (GPU/CPU preference)
- API key management (OpenAI, etc.)
- Export/import settings
- Admin settings override
- Per-environment settings
