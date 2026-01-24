# Implementation Plan: Cloud Data Sources with Document Extraction

**Document ID:** plan-0060-cloud-sources-extraction-230126-u230126  
**Date:** 2026-01-23  
**Status:** Superseded by plan-0061
**Superseded By:** [plan-0061-cloud-integration](file:///mnt/work/Projects/tauri/datalake/tools-iadata/.claude/plan/plan-0061-cloud-integration-260123-u260123.md)

---

## 1. Executive Summary

This plan covers the implementation of:
1. **Google Drive** and **Microsoft SharePoint** as new Data Source types
2. **Document extraction pipeline** with OCR support for all source types
3. **Hide MCP Servers** from UI (keep backend code for future use)

---

## 2. Current State Analysis

### 2.1 Existing Data Source Types
| Type | Status | Implementation |
|------|--------|----------------|
| `LOCAL` | ✅ Working | Docker volume path |
| `LOCAL_BRIDGE` | ✅ Working | Desktop app bridge for host filesystem |
| `WEB` | 🔶 Placeholder | Not implemented (scraping) |
| `GOOGLE_DRIVE` | ❌ Missing | Needs implementation |
| `SHAREPOINT` | ❌ Missing | Needs implementation |

### 2.2 Existing Infrastructure
- **FileBridgeClient**: HTTP client for desktop bridge communication
- **Ingestion Endpoint**: `/resources/sources/{id}/ingest` - triggers crawling
- **Qdrant**: Vector database is running (needs embedding pipeline)
- **No extraction/OCR**: Currently only reads raw text files

---

## 3. Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                             │
├─────────────┬─────────────┬─────────────┬─────────────┬────────┤
│   LOCAL     │ LOCAL_BRIDGE│   WEB       │ GOOGLE_DRIVE│SHAREPOINT│
│ (Volume)    │ (Desktop)   │ (Scraper)   │ (API)       │ (Graph) │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴────┬────┘
       │             │             │             │           │
       └─────────────┴─────────────┴─────────────┴───────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │     SOURCE HANDLER          │
                    │  (Abstract Interface)       │
                    │  - list_files()             │
                    │  - download_file()          │
                    │  - get_metadata()           │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   DOCUMENT EXTRACTOR        │
                    │  - PDF (PyMuPDF + OCR)      │
                    │  - DOCX (python-docx)       │
                    │  - XLSX (openpyxl)          │
                    │  - PPTX (python-pptx)       │
                    │  - Images (Tesseract OCR)   │
                    │  - HTML (BeautifulSoup)     │
                    │  - Plain Text               │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │       CHUNKER               │
                    │  - Semantic chunking        │
                    │  - Configurable size        │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │       EMBEDDER              │
                    │  - Local: sentence-transformers │
                    │  - API: OpenAI/Voyage       │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │       QDRANT                │
                    │  (Vector Storage)           │
                    └─────────────────────────────┘
```

---

## 4. Implementation Phases

### Phase 1: Hide MCP Servers & UI Cleanup
**Files to modify:**
- `front-dl/src/app/dashboard/sources/page.tsx` - Remove MCP tab

### Phase 2: Document Extraction Pipeline
**New files:**
```
back-dl/app/services/extraction/
├── __init__.py
├── base.py           # Abstract Extractor interface
├── pdf_extractor.py  # PDF with optional OCR
├── office_extractor.py  # DOCX, XLSX, PPTX
├── text_extractor.py # Plain text, Markdown
└── image_extractor.py  # OCR for images
```

**Dependencies to add:**
```
# back-dl/requirements.txt
pymupdf==1.24.0        # PDF extraction
python-docx==1.1.0     # DOCX
openpyxl==3.1.0        # XLSX
python-pptx==0.6.23    # PPTX
pytesseract==0.3.10    # OCR
pillow==10.0.0         # Image processing
beautifulsoup4==4.12.0 # HTML parsing
```

### Phase 3: Google Drive Integration
**New files:**
```
back-dl/app/services/sources/
├── __init__.py
├── base.py              # Abstract SourceHandler
├── local_handler.py     # Existing LOCAL logic
├── bridge_handler.py    # Existing LOCAL_BRIDGE logic
├── google_drive_handler.py  # NEW
└── sharepoint_handler.py    # NEW
```

**OAuth Flow:**
```
back-dl/app/routers/auth_oauth.py  # OAuth callbacks
```

**Frontend:**
```
front-dl/src/components/resources/DataSourceForm.tsx  # Add GOOGLE_DRIVE type
```

### Phase 4: SharePoint Integration
Similar to Google Drive but using Microsoft Graph API.

---

## 5. Detailed Changes

### 5.1 Hide MCP Servers Tab

#### [MODIFY] [page.tsx](file:///mnt/work/Projects/tauri/datalake/tools-iadata/front-dl/src/app/dashboard/sources/page.tsx)

Remove or comment out the MCP tab switcher and related state/logic:
```tsx
// Hide MCP tab - keep code but don't render
const SHOW_MCP_TAB = false;

// In render, conditionally show tab
{SHOW_MCP_TAB && (
  <button onClick={() => setTab("MCP")} ...>
    MCP Servers
  </button>
)}
```

---

### 5.2 Document Extractor Service

#### [NEW] [base.py](file:///mnt/work/Projects/tauri/datalake/tools-iadata/back-dl/app/services/extraction/base.py)

```python
from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from dataclasses import dataclass

@dataclass
class ExtractedDocument:
    content: str
    metadata: Dict
    pages: Optional[int] = None
    
class BaseExtractor(ABC):
    @abstractmethod
    async def extract(self, file_bytes: bytes, filename: str) -> ExtractedDocument:
        pass
    
    @abstractmethod
    def supported_extensions(self) -> List[str]:
        pass
```

#### [NEW] [pdf_extractor.py](file:///mnt/work/Projects/tauri/datalake/tools-iadata/back-dl/app/services/extraction/pdf_extractor.py)

```python
import fitz  # PyMuPDF
import pytesseract
from PIL import Image
from .base import BaseExtractor, ExtractedDocument

class PDFExtractor(BaseExtractor):
    def __init__(self, use_ocr: bool = True, ocr_threshold: int = 50):
        self.use_ocr = use_ocr
        self.ocr_threshold = ocr_threshold  # Min chars per page before OCR
        
    async def extract(self, file_bytes: bytes, filename: str) -> ExtractedDocument:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        text_parts = []
        
        for page in doc:
            text = page.get_text()
            
            # If page has very little text, try OCR
            if self.use_ocr and len(text.strip()) < self.ocr_threshold:
                pix = page.get_pixmap()
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                ocr_text = pytesseract.image_to_string(img)
                text = ocr_text if ocr_text.strip() else text
                
            text_parts.append(text)
            
        return ExtractedDocument(
            content="\n\n".join(text_parts),
            metadata={"filename": filename, "type": "pdf"},
            pages=len(doc)
        )
    
    def supported_extensions(self) -> List[str]:
        return [".pdf"]
```

---

### 5.3 Google Drive Handler

#### [NEW] [google_drive_handler.py](file:///mnt/work/Projects/tauri/datalake/tools-iadata/back-dl/app/services/sources/google_drive_handler.py)

```python
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from .base import BaseSourceHandler, FileInfo
import io

class GoogleDriveHandler(BaseSourceHandler):
    SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
    
    # Google Workspace MIME types need export
    EXPORT_MAP = {
        'application/vnd.google-apps.document': 'application/pdf',
        'application/vnd.google-apps.spreadsheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.google-apps.presentation': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    }
    
    def __init__(self, credentials: dict):
        creds = Credentials.from_authorized_user_info(credentials, self.SCOPES)
        self.service = build('drive', 'v3', credentials=creds)
        
    async def list_files(self, folder_id: str) -> List[FileInfo]:
        results = []
        page_token = None
        
        while True:
            response = self.service.files().list(
                q=f"'{folder_id}' in parents and trashed=false",
                spaces='drive',
                fields='nextPageToken, files(id, name, mimeType, size, modifiedTime)',
                pageToken=page_token
            ).execute()
            
            for file in response.get('files', []):
                results.append(FileInfo(
                    id=file['id'],
                    name=file['name'],
                    mime_type=file['mimeType'],
                    size=int(file.get('size', 0)),
                    modified=file['modifiedTime']
                ))
                
            page_token = response.get('nextPageToken')
            if not page_token:
                break
                
        return results
        
    async def download_file(self, file_id: str, mime_type: str) -> bytes:
        # Check if it's a Google Workspace file that needs export
        if mime_type in self.EXPORT_MAP:
            request = self.service.files().export_media(
                fileId=file_id,
                mimeType=self.EXPORT_MAP[mime_type]
            )
        else:
            request = self.service.files().get_media(fileId=file_id)
            
        buffer = io.BytesIO()
        downloader = MediaIoBaseDownload(buffer, request)
        
        done = False
        while not done:
            _, done = downloader.next_chunk()
            
        return buffer.getvalue()
```

---

### 5.4 SharePoint Handler

#### [NEW] [sharepoint_handler.py](file:///mnt/work/Projects/tauri/datalake/tools-iadata/back-dl/app/services/sources/sharepoint_handler.py)

```python
import httpx
from msal import ConfidentialClientApplication
from .base import BaseSourceHandler, FileInfo

class SharePointHandler(BaseSourceHandler):
    GRAPH_API = "https://graph.microsoft.com/v1.0"
    
    def __init__(self, tenant_id: str, client_id: str, client_secret: str, site_url: str):
        self.site_url = site_url
        
        # MSAL authentication
        self.app = ConfidentialClientApplication(
            client_id,
            authority=f"https://login.microsoftonline.com/{tenant_id}",
            client_credential=client_secret
        )
        
    def _get_token(self) -> str:
        result = self.app.acquire_token_for_client(
            scopes=["https://graph.microsoft.com/.default"]
        )
        return result['access_token']
        
    async def list_files(self, folder_path: str = "") -> List[FileInfo]:
        token = self._get_token()
        
        async with httpx.AsyncClient() as client:
            # First, get site ID from URL
            site_resp = await client.get(
                f"{self.GRAPH_API}/sites/{self.site_url}",
                headers={"Authorization": f"Bearer {token}"}
            )
            site_id = site_resp.json()['id']
            
            # List files in drive
            url = f"{self.GRAPH_API}/sites/{site_id}/drive/root"
            if folder_path:
                url += f":/{folder_path}:"
            url += "/children"
            
            resp = await client.get(url, headers={"Authorization": f"Bearer {token}"})
            
            results = []
            for item in resp.json().get('value', []):
                if 'file' in item:  # Skip folders
                    results.append(FileInfo(
                        id=item['id'],
                        name=item['name'],
                        mime_type=item.get('file', {}).get('mimeType', ''),
                        size=item.get('size', 0),
                        modified=item.get('lastModifiedDateTime', '')
                    ))
                    
            return results
            
    async def download_file(self, file_id: str) -> bytes:
        token = self._get_token()
        
        async with httpx.AsyncClient() as client:
            # Get download URL
            resp = await client.get(
                f"{self.GRAPH_API}/drives/{file_id}/content",
                headers={"Authorization": f"Bearer {token}"},
                follow_redirects=True
            )
            return resp.content
```

---

### 5.5 Frontend: New Source Type Options

#### [MODIFY] [DataSourceForm.tsx](file:///mnt/work/Projects/tauri/datalake/tools-iadata/front-dl/src/components/resources/DataSourceForm.tsx)

Add new type options for Google Drive and SharePoint with OAuth connection buttons.

---

## 6. OAuth Implementation

### 6.1 Google Drive OAuth Flow

1. User clicks "Connect Google Drive" in form
2. Backend redirects to Google OAuth consent screen
3. User grants access to Drive (read-only)
4. Callback stores refresh token in `config.credentials`
5. Handler uses refresh token to get access tokens

### 6.2 SharePoint OAuth Flow

Two options:
- **App-Only**: Service principal with client secret (simpler, for org-wide access)
- **Delegated**: User signs in via Microsoft (per-user access)

Recommend: **App-Only** for simplicity in initial implementation.

---

## 7. Docker Configuration

### 7.1 Tesseract for OCR

Add to `back-dl/Dockerfile`:
```dockerfile
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*
```

---

## 8. Environment Variables

```env
# Google Drive OAuth
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback

# SharePoint / Microsoft Graph
MS_TENANT_ID=xxx
MS_CLIENT_ID=xxx
MS_CLIENT_SECRET=xxx
```

---

## 9. MCP Decision

> [!NOTE]
> **Keep MCP code, hide from UI.** MCP may be useful later for:
> - Database query tools for agents
> - Real-time API integrations
> - Custom tool servers

The MCP infrastructure is orthogonal to data ingestion and can coexist.

---

## 10. Verification Plan

### 10.1 Unit Tests

**Document Extraction:**
```bash
# Run extraction tests (to be created)
cd back-dl
pytest tests/services/extraction/ -v
```

Test files needed:
- `tests/services/extraction/test_pdf_extractor.py`
- `tests/services/extraction/test_office_extractor.py`

### 10.2 Integration Tests

**Google Drive Integration:**
```bash
# Requires test credentials
pytest tests/integration/test_google_drive.py -v --env=test
```

### 10.3 Manual Verification

1. **Hide MCP Tab:**
   - Navigate to `http://localhost:13000/dashboard/sources`
   - Verify only "Data Sources" tab is visible
   - Verify no "MCP Servers" tab appears

2. **Document Extraction:**
   - Create a LOCAL source with PDF files
   - Trigger ingestion via API
   - Verify text is extracted (check logs)

3. **Google Drive (after OAuth setup):**
   - Click "Connect Google Drive" in form
   - Complete OAuth flow
   - Select folder
   - Save source
   - Trigger ingestion
   - Verify files are listed and content extracted

---

## 11. Implementation Priority

| Priority | Component | Effort | Impact |
|----------|-----------|--------|--------|
| 1 | Hide MCP Tab | 15 min | Cleanup |
| 2 | Document Extraction Pipeline | 4 hours | Critical |
| 3 | Google Drive Integration | 6 hours | High |
| 4 | SharePoint Integration | 6 hours | High |
| 5 | OAuth Infrastructure | 4 hours | Required for 3 & 4 |

**Recommended Order:** 1 → 2 → 5 → 3 → 4

---

## 12. Dependencies Summary

```
# New Python packages
pymupdf>=1.24.0
python-docx>=1.1.0
openpyxl>=3.1.0
python-pptx>=0.6.23
pytesseract>=0.3.10
pillow>=10.0.0
beautifulsoup4>=4.12.0
google-api-python-client>=2.100.0
google-auth>=2.23.0
msal>=1.24.0
```

---

*Implementation plan for Tools IADATA cloud data sources.*
