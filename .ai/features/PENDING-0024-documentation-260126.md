# PENDING: Documentation

> **Status**: PENDING  
> **Priority**: Low  
> **Complexity**: Very Low (static content)  
> **Created**: 2026-01-26

## Overview

In-app help and documentation page. Users can learn how to use the system, understand features, and troubleshoot common issues.

## Current State

**Already Exists:**
- `_reference/README.md` contains project docs ✅
- `.ai/features/` contains feature documentation ✅

**Missing:**
- User-facing help page
- Tooltips/contextual help
- FAQ section

---

## Proposed Approach (Minimal - Static MDX)

### Static Markdown Pages

No backend needed. Just serve markdown content rendered in React.

**Structure:**
```
front-dl/src/app/dashboard/docs/
├── page.tsx           # Main docs landing
├── getting-started/
│   └── page.tsx       # Getting started guide
├── features/
│   └── page.tsx       # Feature overview
└── faq/
    └── page.tsx       # FAQ
```

### Content Sections

| Section | Content |
|---------|---------|
| **Getting Started** | How to add documents, start chatting |
| **Features** | RAG, OCR, Sources, History |
| **Integrations** | Google Drive, SharePoint setup |
| **FAQ** | Common questions |
| **Troubleshooting** | Docker issues, model errors |

**Effort:** ~2-3 hours (writing + styling)

---

## Implementation Options

### Option A: Hardcoded TSX (Simplest)

Just write the content directly in React components:

```tsx
// docs/page.tsx
export default function DocsPage() {
  return (
    <div className="docs">
      <h1>Documentation</h1>
      <section>
        <h2>Getting Started</h2>
        <p>...</p>
      </section>
    </div>
  );
}
```

**Pros:** Zero dependencies, fast  
**Cons:** Content changes require code deploy

### Option B: MDX (Recommended)

Use Next.js MDX support for writing docs in Markdown:

```bash
npm install @next/mdx @mdx-js/loader
```

```
front-dl/src/content/docs/
├── getting-started.mdx
├── features.mdx
└── faq.mdx
```

**Pros:** Easy to edit, markdown syntax  
**Cons:** Adds MDX dependency

### Option C: External Link

Just link to GitHub README or external docs site:

```tsx
<a href="https://github.com/PiloTracer/vectara#readme">View Documentation</a>
```

**Pros:** Zero work  
**Cons:** Leaves the app

---

## Files to Create

| File | Action | Lines |
|------|--------|-------|
| `front-dl/src/app/dashboard/docs/page.tsx` | NEW | ~150 |
| `front-dl/src/app/dashboard/docs/layout.tsx` | NEW (optional) | ~30 |

**Total Effort:** ~2-3 hours

---

## Contextual Help (Future)

Add tooltips and help icons next to complex features:

```tsx
<HelpTooltip>
  RAG retrieves relevant document chunks to help the AI answer your question.
</HelpTooltip>
```

---

## Future Scaling

- Searchable docs
- Video tutorials
- Interactive walkthroughs
- Version-specific docs
- API reference (auto-generated from OpenAPI)
