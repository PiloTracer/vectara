# Analysis: MCP Servers vs Data Sources for Cloud Storage Access

**Document ID:** plan-0055-full-mcp-servers-200123-u260123  
**Date:** 2026-01-23  
**Status:** Analysis Complete

---

## Executive Summary

This document analyzes whether the **MCP Server** feature in the Resources definition is the appropriate mechanism for accessing data repositories in **SharePoint** and **Google Drive**.

> [!IMPORTANT]
> **Conclusion:** MCP Servers are **NOT** the correct mechanism for accessing SharePoint/Google Drive data repositories. These cloud storage platforms should be implemented as **Data Source** types, not MCP Servers.

---

## 1. Understanding the Current Architecture

### 1.1 Data Sources (`data_sources` table)

Data Sources are designed for **content ingestion and indexing**. They represent repositories of documents that the system will:
- Crawl and discover files
- Extract text content
- Chunk and embed into vector storage
- Make searchable via RAG

**Current Implementation:**
```python
class DataSource(Base):
    __tablename__ = "data_sources"
    
    type = Column(String)  # LOCAL, DRIVE, WEB, SHAREPOINT
    name = Column(String)
    config = Column(JSONB)  # Paths, URLs, credentials
    indexing_config = Column(JSONB)  # Chunk size, exclusions
```

**Supported Types (per model comments):**
| Type | Description |
|------|-------------|
| `LOCAL` | Local filesystem directory (Docker volume or Bridge) |
| `WEB` | Web URL to scrape |
| `DRIVE` | Google Drive (planned) |
| `SHAREPOINT` | SharePoint Online (planned) |

---

### 1.2 MCP Servers (`mcp_servers` table)

MCP (Model Context Protocol) Servers are designed to **extend AI agent capabilities** with external tools and resources. They provide:
- Database query capabilities
- API integrations
- Code execution environments
- External service connections

**Current Implementation:**
```python
class MCPServer(Base):
    __tablename__ = "mcp_servers"
    
    transport_type = Column(String)  # STDIO, SSE
    command = Column(String)         # For STDIO (e.g., "npx @mcp/server-postgres")
    url = Column(String)             # For SSE endpoints
    env_vars = Column(JSONB)         # API keys, secrets
    enabled = Column(Boolean)
```

**Use Cases:**
- `@modelcontextprotocol/server-postgres` - Query PostgreSQL databases
- `@modelcontextprotocol/server-filesystem` - File operations
- `@modelcontextprotocol/server-github` - GitHub API access
- Custom SSE servers for specialized tools

---

## 2. Key Differences

| Aspect | Data Sources | MCP Servers |
|--------|--------------|-------------|
| **Primary Purpose** | Content ingestion for RAG | Tool execution for AI agents |
| **Data Flow** | Pull content → Index → Store embeddings | Request/Response tool calls |
| **Processing** | Batch crawling, chunking, embedding | Real-time tool invocation |
| **Output** | Vector embeddings in Qdrant | Tool results to LLM |
| **Authentication** | OAuth/API keys for content access | Environment variables for tool auth |
| **Examples** | SharePoint docs, Drive files, Web pages | Database queries, API calls, Code execution |

---

## 3. SharePoint & Google Drive Analysis

### 3.1 SharePoint Access Requirements

**What SharePoint provides:**
- Document libraries with Word, Excel, PDF, PowerPoint files
- Folder hierarchies
- File metadata and versioning
- OAuth 2.0 authentication via Microsoft Graph API

**Integration Pattern:**
```
SharePoint → Microsoft Graph API → Download Files → Index Content
```

**Required Config:**
```json
{
  "site_url": "https://company.sharepoint.com/sites/team",
  "folder": "Documents/Reports",
  "client_id": "xxx",
  "client_secret": "xxx",  // or certificate auth
  "tenant_id": "xxx"
}
```

### 3.2 Google Drive Access Requirements

**What Google Drive provides:**
- Documents, Sheets, Slides (native + uploaded files)
- Folder hierarchies with shared drives
- OAuth 2.0 authentication via Google APIs

**Integration Pattern:**
```
Google Drive → Drive API → Download/Export Files → Index Content
```

**Required Config:**
```json
{
  "folder_id": "1ABC...",
  "service_account_json": "...",  // or OAuth refresh token
  "include_shared": true,
  "mime_types": ["application/pdf", "application/vnd.google-apps.document"]
}
```

---

## 4. Why NOT MCP for Cloud Storage?

### 4.1 Architectural Mismatch

MCP Servers are designed for **synchronous tool calls** during agent conversations:
```
User Query → LLM → MCP Tool Call → Result → LLM → Response
```

Data ingestion requires **batch processing**:
```
Scheduler → Crawl Files → Extract Text → Chunk → Embed → Store
```

### 4.2 No RAG Integration Path

MCP tool results go directly to the LLM context, **not** into the vector database. This means:
- Documents wouldn't be searchable
- No semantic retrieval
- No chunking/embedding
- Context window limits would apply

### 4.3 Existing MCP Limitations

While MCP servers exist for Google Drive and OneDrive, they are designed for:
- Listing files in a conversation
- Reading specific file content on-demand
- Performing operations (create, delete, move)

They are **NOT** designed for:
- Bulk indexing
- Vector embedding
- Persistent storage for RAG

---

## 5. Recommended Implementation

### 5.1 Implement as Data Source Types

SharePoint and Google Drive should be added as **new Data Source types** alongside `LOCAL` and `WEB`:

```typescript
// front-dl/src/components/resources/DataSourceForm.tsx

// Add new type options:
type: "LOCAL" | "WEB" | "SHAREPOINT" | "GOOGLE_DRIVE"
```

### 5.2 Backend Changes Required

#### 5.2.1 New Source Handlers

Create source-specific handlers in the backend:

```
back-dl/app/services/sources/
├── __init__.py
├── base.py           # Abstract SourceHandler
├── local.py          # LOCAL type handler
├── web.py            # WEB type handler
├── sharepoint.py     # NEW: SharePoint handler
└── google_drive.py   # NEW: Google Drive handler
```

#### 5.2.2 SharePoint Handler

```python
# back-dl/app/services/sources/sharepoint.py

class SharePointHandler(SourceHandler):
    async def authenticate(self, config: dict):
        # Microsoft Graph OAuth flow
        pass
    
    async def list_files(self, folder: str) -> List[FileInfo]:
        # GET /sites/{site-id}/drive/items
        pass
    
    async def download_file(self, file_id: str) -> bytes:
        # GET /sites/{site-id}/drive/items/{item-id}/content
        pass
```

#### 5.2.3 Google Drive Handler

```python
# back-dl/app/services/sources/google_drive.py

class GoogleDriveHandler(SourceHandler):
    async def authenticate(self, config: dict):
        # Google OAuth or Service Account auth
        pass
    
    async def list_files(self, folder_id: str) -> List[FileInfo]:
        # files.list with query
        pass
    
    async def download_file(self, file_id: str) -> bytes:
        # files.get with alt=media
        pass
    
    async def export_google_doc(self, file_id: str, mime_type: str) -> bytes:
        # files.export for native Google formats
        pass
```

### 5.3 Frontend Changes Required

#### 5.3.1 New Source Type Cards

Add SharePoint and Google Drive options to `DataSourceForm.tsx`:

```tsx
// Type selection cards
<button onClick={() => setType("SHAREPOINT")} ...>
  <Cloud className="w-5 h-5" />
  SharePoint
</button>

<button onClick={() => setType("GOOGLE_DRIVE")} ...>
  <HardDrive className="w-5 h-5" />
  Google Drive
</button>
```

#### 5.3.2 OAuth Flow Integration

Both platforms require OAuth consent flows:

```tsx
// SharePoint OAuth
const handleSharePointAuth = () => {
  window.location.href = `/api/auth/sharepoint/authorize?redirect=${window.location.href}`;
};

// Google Drive OAuth
const handleGoogleAuth = () => {
  window.location.href = `/api/auth/google/authorize?redirect=${window.location.href}`;
};
```

### 5.4 Database Migration

No schema changes needed - the existing `DataSource` model already supports:
- `type`: String field can hold "SHAREPOINT" or "GOOGLE_DRIVE"
- `config`: JSONB for storing OAuth tokens, folder paths, etc.

---

## 6. When TO Use MCP Servers

MCP Servers remain the correct choice for:

| Use Case | Example |
|----------|---------|
| **Database Access** | Let agents query PostgreSQL, MySQL, etc. |
| **API Tools** | GitHub, Slack, Jira integrations |
| **Code Execution** | Python/JS sandboxes, Jupyter-style |
| **Real-time Data** | Live API calls during conversations |
| **External Services** | Custom business logic servers |

---

## 7. Implementation Roadmap

### Phase 1: OAuth Infrastructure
- [ ] Add OAuth routes for Microsoft Identity Platform
- [ ] Add OAuth routes for Google Cloud Console
- [ ] Implement token storage and refresh logic

### Phase 2: SharePoint Integration
- [ ] Implement `SharePointHandler` in backend
- [ ] Add SharePoint UI form in frontend
- [ ] Integrate with indexing pipeline

### Phase 3: Google Drive Integration
- [ ] Implement `GoogleDriveHandler` in backend
- [ ] Handle Google Docs export (native formats → text)
- [ ] Add Google Drive UI form in frontend

### Phase 4: Shared Functionality
- [ ] File type detection and parsing
- [ ] Incremental sync (detect changes)
- [ ] Error handling and retry logic

---

## 8. Conclusion

| Question | Answer |
|----------|--------|
| Is MCP the right approach for SharePoint? | **No** |
| Is MCP the right approach for Google Drive? | **No** |
| What is the correct approach? | **Data Source types** |
| Does the model already support this? | **Yes** (type field accepts any string) |
| What work is needed? | Backend handlers + OAuth + Frontend forms |

The MCP Server feature should continue to be used for its intended purpose: extending AI agent capabilities with external tools and services. Cloud storage access for RAG should be implemented as Data Source types with proper OAuth flows and indexing pipelines.

---

*Analysis prepared for Tools IADATA project.*
