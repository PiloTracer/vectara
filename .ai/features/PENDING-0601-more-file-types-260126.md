# Feature: Extended File Type Support for Document Extraction
> **ID:** PENDING-0601-more-file-types-260126  
> **Date:** 2026-01-26  
> **Status:** Planning  

---

## 1. Overview

Expand document extraction to support the maximum number of file types for investigation and enterprise environments.

---

## 2. Complete File Type Support Matrix

### 2.1 Currently Supported ✅

| Extension | Type | Extractor | Library |
|-----------|------|-----------|---------|
| `.pdf` | PDF | PDFExtractor | PyMuPDF |
| `.docx` | Word 2007+ | OfficeExtractor | python-docx |
| `.xlsx` | Excel 2007+ | OfficeExtractor | openpyxl |
| `.pptx` | PowerPoint 2007+ | OfficeExtractor | python-pptx |
| `.rtf` | Rich Text | RTFExtractor | striprtf |
| `.txt`, `.md`, `.csv`, `.json`, `.yaml`, `.xml` | Text | TextExtractor | Built-in |
| `.html`, `.htm` | HTML | TextExtractor | BeautifulSoup |
| `.png`, `.jpg`, `.jpeg`, `.tiff`, `.bmp`, `.gif`, `.webp` | Images | ImageExtractor | Tesseract/LLM OCR |

### 2.2 Phase 1: Legacy Office & OpenDocument 📋

| Extension | Type | Library | Priority |
|-----------|------|---------|----------|
| `.doc` | Word 97-2003 | `olefile` + `antiword` | 🔴 High |
| `.xls` | Excel 97-2003 | `xlrd` | 🔴 High |
| `.ppt` | PowerPoint 97-2003 | `olefile` | 🔴 High |
| `.odt` | OpenDocument Text | `odfpy` | 🔴 High |
| `.ods` | OpenDocument Spreadsheet | `odfpy` | 🟡 Medium |
| `.odp` | OpenDocument Presentation | `odfpy` | 🟡 Medium |
| `.odg` | OpenDocument Graphics | `odfpy` | 🟢 Low |

### 2.3 Phase 2: Email & Messaging 📧

| Extension | Type | Library | Priority |
|-----------|------|---------|----------|
| `.eml` | Email Message | `email` (stdlib) | 🔴 High |
| `.msg` | Outlook Message | `extract-msg` | 🔴 High |
| `.mbox` | Mailbox Archive | `mailbox` (stdlib) | 🟡 Medium |
| `.pst` | Outlook Archive | `libpff` / `pypff` | 🟡 Medium |
| `.ost` | Outlook Offline | `libpff` / `pypff` | 🟡 Medium |

### 2.4 Phase 3: Archives & Compressed 📦

| Extension | Type | Library | Priority |
|-----------|------|---------|----------|
| `.zip` | ZIP Archive | `zipfile` (stdlib) | 🔴 High |
| `.rar` | RAR Archive | `rarfile` | 🟡 Medium |
| `.7z` | 7-Zip Archive | `py7zr` | 🟡 Medium |
| `.tar`, `.tar.gz`, `.tgz` | Tar Archive | `tarfile` (stdlib) | 🟡 Medium |
| `.gz`, `.bz2`, `.xz` | Compressed | `gzip`, `bz2`, `lzma` (stdlib) | 🟢 Low |

### 2.5 Phase 4: Investigation & Forensic 🔍

| Extension | Type | Library | Priority |
|-----------|------|---------|----------|
| `.evtx` | Windows Event Log | `python-evtx` | 🔴 High |
| `.evt` | Legacy Event Log | `python-evtx` | 🟡 Medium |
| `.lnk` | Windows Shortcut | `pylnk3` | 🟡 Medium |
| `.prefetch` | Prefetch Files | `windowsprefetch` | 🟢 Low |
| `.reg` | Registry Export | Custom parser | 🟡 Medium |
| `.pcap`, `.pcapng` | Network Capture | `scapy` / `pyshark` | 🟢 Low |
| `.sqlite`, `.db` | SQLite Database | `sqlite3` (stdlib) | 🔴 High |

### 2.6 Phase 5: Media & Specialized 🎵

| Extension | Type | Library | Priority |
|-----------|------|---------|----------|
| `.mp3`, `.wav`, `.flac`, `.ogg` | Audio | `whisper` (transcription) | 🟢 Low |
| `.mp4`, `.avi`, `.mkv`, `.mov` | Video | `whisper` + frame extraction | 🟢 Low |
| `.svg` | Vector Graphics | `svglib` | 🟢 Low |
| `.eps`, `.ai` | Adobe Illustrator | Conversion to PDF | 🟢 Low |
| `.psd` | Photoshop | `psd-tools` | 🟢 Low |
| `.dwg`, `.dxf` | CAD Files | `ezdxf` | 🟢 Low |

### 2.7 Phase 6: Code & Technical 💻

| Extension | Type | Library | Priority |
|-----------|------|---------|----------|
| `.py`, `.js`, `.ts`, `.java`, `.c`, `.cpp`, `.rs`, `.go` | Source Code | Built-in (text) | ✅ Done |
| `.ipynb` | Jupyter Notebook | `nbformat` | 🟡 Medium |
| `.log` | Log Files | Built-in (text) | ✅ Done |
| `.ini`, `.cfg`, `.conf` | Config Files | Built-in (text) | ✅ Done |

### 2.8 Phase 7: Legacy & Rare Formats 📜

| Extension | Type | Library | Priority |
|-----------|------|---------|----------|
| `.wps` | MS Works | Limited support | 🟢 Low |
| `.wpd` | WordPerfect | `antiword` (limited) | 🟢 Low |
| `.pages` | Apple Pages | Unzip + XML parse | 🟢 Low |
| `.numbers` | Apple Numbers | Unzip + protobuf | 🟢 Low |
| `.key` | Apple Keynote | Unzip + XML parse | 🟢 Low |
| `.hwp` | Hangul (Korean) | `pyhwp` | 🟢 Low |

---

## 3. Implementation Plan

### Phase 1: Legacy Office & ODF (Priority: High)

**New file:** `legacy_office_extractor.py`

```python
# Dependencies to add
xlrd>=2.0.1           # Excel 97-2003 (.xls)
olefile>=0.46         # OLE compound files (.doc, .ppt)
odfpy>=1.4.1          # OpenDocument formats
```

```python
class LegacyOfficeExtractor(BaseExtractor):
    def supported_extensions(self):
        return [".doc", ".xls", ".ppt", ".odt", ".ods", ".odp"]
    
    async def extract(self, file_bytes, filename):
        ext = self._get_extension(filename).lower()
        
        if ext == ".doc":
            return await self._extract_doc(file_bytes, filename)
        elif ext == ".xls":
            return await self._extract_xls(file_bytes, filename)
        # ... etc
```

### Phase 2: Email Extractor

**New file:** `email_extractor.py`

```python
# Dependencies
extract-msg>=0.45.0   # Outlook .msg files
```

```python
class EmailExtractor(BaseExtractor):
    def supported_extensions(self):
        return [".eml", ".msg"]
    
    async def extract(self, file_bytes, filename):
        # Extract subject, from, to, date, body, attachments
        # Recursively extract attachments
```

### Phase 3: Archive Handler

**New file:** `archive_extractor.py`

```python
# Dependencies
rarfile>=4.1          # RAR support
py7zr>=0.20.0         # 7z support
```

> [!NOTE]
> Archives are special: they contain multiple files.  
> Strategy: Extract all, process each, concatenate results with file markers.

---

## 4. Dependencies Summary

```txt
# requirements.txt additions

# Phase 1: Legacy Office & ODF
xlrd>=2.0.1
olefile>=0.46
odfpy>=1.4.1

# Phase 2: Email
extract-msg>=0.45.0

# Phase 3: Archives
rarfile>=4.1
py7zr>=0.20.0

# Phase 4: Investigation
python-evtx>=0.7.4
pylnk3>=0.4.2

# Phase 5: Media (optional)
openai-whisper>=20231117  # Audio transcription

# Phase 6: Code
nbformat>=5.9.0

# Phase 7: Rare formats
pyhwp>=0.1b12  # Korean Hangul
```

---

## 5. Dockerfile Updates

```dockerfile
# System packages for legacy format support
RUN apt-get update && apt-get install -y \
    antiword \           # .doc extraction fallback
    unrar \              # RAR extraction
    p7zip-full \         # 7z extraction
    libevtx-utils \      # Windows event logs
    && rm -rf /var/lib/apt/lists/*
```

---

## 6. Extractor Registry Structure

```
app/services/extraction/
├── __init__.py              # Registry
├── base.py                  # BaseExtractor, ExtractedDocument
├── pdf_extractor.py         ✅ Done
├── office_extractor.py      ✅ Done (OOXML)
├── text_extractor.py        ✅ Done
├── image_extractor.py       ✅ Done
├── rtf_extractor.py         ✅ Done
├── legacy_office_extractor.py   📋 Phase 1
├── odf_extractor.py             📋 Phase 1
├── email_extractor.py           📋 Phase 2
├── archive_extractor.py         📋 Phase 3
├── forensic_extractor.py        📋 Phase 4
├── media_extractor.py           📋 Phase 5
└── notebook_extractor.py        📋 Phase 6
```

---

## 7. Implementation Priority

| Phase | File Types | Effort | Impact |
|-------|------------|--------|--------|
| **1** | `.doc`, `.xls`, `.ppt`, `.odt` | 3 hr | 🔴 High - Common legacy formats |
| **2** | `.eml`, `.msg` | 2 hr | 🔴 High - Critical for investigations |
| **3** | `.zip`, `.rar`, `.7z` | 2 hr | 🟡 Medium - Recursive extraction |
| **4** | `.evtx`, `.sqlite` | 2 hr | 🔴 High - Forensic analysis |
| **5** | Audio/Video | 4 hr | 🟢 Low - Whisper integration |
| **6** | `.ipynb` | 1 hr | 🟡 Medium - Jupyter notebooks |
| **7** | Rare formats | 3 hr | 🟢 Low - Edge cases |

**Total estimated effort:** ~17 hours

---

## 8. Testing Strategy

For each new extractor:
1. Create test files in `tests/fixtures/extraction/`
2. Unit test: `pytest tests/services/test_<extractor>.py`
3. Integration test: Ingest sample files, verify searchability

---

## 9. Open Questions

1. **Archive depth limit:** How deep should recursive archive extraction go? (Recommend: 3 levels)
2. **Attachment handling:** Should email attachments be separate documents or inline?
3. **Audio/Video:** Enable Whisper transcription by default, or opt-in?

---

*End of feature document.*
