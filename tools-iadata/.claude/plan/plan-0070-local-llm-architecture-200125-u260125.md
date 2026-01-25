# Implementation Plan: Local LLM Management Architecture

**Document ID:** plan-0070-local-llm-architecture-250126-u250126  
**Date:** 2026-01-25  
**Status:** Proposed  
**Supersedes:** `/mnt/work/Projects/tauri/datalake/.ai/features/0501-local-LLMS-260123-260123.md` (now deprecated)

---

## 1. Executive Summary

This plan establishes the **authoritative architecture** for local LLM management in the Vectara/IADATA system. It defines three distinct model roles, their configuration, auto-acquisition strategy, and integration points.

> [!NOTE]
> **Documentation Ownership**: LLM configuration belongs in `tools-iadata/.claude/plan/` (runtime scope), NOT in `.ai/features/` (Tauri shell scope). The feature file `0501` is now legacy.

---

## 2. The Three-Model Strategy

The system supports **three distinct model roles**, each serving a specific purpose:

| Role | Purpose | Default Model | Required? | Controlled By |
|------|---------|---------------|-----------|---------------|
| **Chat/LLM** | Agent descriptions, Q&A, RAG responses | `qwen2.5:latest` | Optional | `LOCAL_MODEL_NAME` |
| **Embedding** | Text → Vector conversion for Qdrant | `bge-m3:latest` | If `USE_LOCAL_EMBEDDING=true` | `LOCAL_EMBEDDING_MODEL_NAME` |
| **OCR** | Vision-based text extraction from images | `lighton/lightonocr:2b` | Optional | `LOCAL_OCR_MODEL_NAME` |

### 2.1 When Each Model Is Used

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER WORKFLOW                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. USER CREATES AGENT/ENVIRONMENT                                      │
│     └─→ Chat Model (qwen2.5) → Generates agent descriptions             │
│                                                                         │
│  2. DATA SOURCE INGESTION                                               │
│     └─→ For each file:                                                  │
│         ├─→ PDF/Text → Text Extractor (Python libs)                     │
│         ├─→ Scanned PDF/Image → OCR Model (LightOnOCR) [if enabled]     │
│         │                     → Fallback: Tesseract                     │
│         └─→ Extracted Text → Embedding Model (bge-m3) → Qdrant          │
│                                                                         │
│  3. USER QUERIES CHATBOT                                                │
│     └─→ Query → Embedding Model → Qdrant Search                         │
│         └─→ Results + Query → Chat Model → Response                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Model Specifications (CPU-Compatible)

### 3.1 Chat Model: Qwen 2.5

| Property | Value |
|----------|-------|
| **Ollama Name** | `qwen2.5:latest` (defaults to 7B) |
| **Recommended Variant** | `qwen2.5:3b` for low-memory systems |
| **Parameters** | 3B - 7B |
| **RAM Required** | 4GB (3B) / 8GB (7B) |
| **Languages** | Multilingual (English, Spanish, Chinese, etc.) |
| **Use Case** | Agent descriptions, chat, RAG responses |

### 3.2 Embedding Model: BGE-M3

| Property | Value |
|----------|-------|
| **Ollama Name** | `bge-m3:latest` |
| **Source** | BAAI/bge-m3 (Beijing Academy of AI) |
| **Vector Dimensions** | 1024 |
| **RAM Required** | ~2GB |
| **Languages** | 100+ (Multilingual) |
| **Use Case** | Text → Vector for Qdrant storage |
| **Why This Model** | Best multilingual embedding model under 1B parameters |

> [!IMPORTANT]
> **Vector Size Update**: Current `VectorService` uses `VECTOR_SIZE = 768`. BGE-M3 outputs 1024-dimensional vectors. This must be corrected!

### 3.3 OCR Model: LightOnOCR-2-1B

| Property | Value |
|----------|-------|
| **Ollama Name** | `lighton/lightonocr:2b` (pending availability) |
| **HuggingFace** | `lightonai/LightOnOCR-2-1B` |
| **GGUF Size** | ~800MB (Q4_K_S quantization) |
| **RAM Required** | 4-8GB |
| **Use Case** | Extract text from scanned documents and images |
| **Fallback** | Tesseract OCR (already installed in Docker) |

> [!WARNING]
> **Ollama Availability**: As of 2026-01, LightOnOCR is not natively in Ollama's library. Implementation requires either:
> 1. Using `ollama create` with a custom Modelfile
> 2. Direct HuggingFace inference via `transformers`

---

## 4. Environment Configuration

### 4.1 Updated `.env.example`

```env
# =============================================
# LOCAL AI CONFIGURATION
# =============================================

# Master Switch - Enables local embedding and vector storage
USE_LOCAL_EMBEDDING=false

# Ollama Connection (host.docker.internal for host-side Ollama)
OLLAMA_HOST=host.docker.internal
OLLAMA_PORT=11434

# ---------------------------------------------
# MODEL DEFINITIONS (All models must run on CPU)
# ---------------------------------------------

# Chat/LLM Model - For agent descriptions and RAG responses
# Options: qwen2.5, qwen2.5:3b (lighter), llama3.2, mistral
LOCAL_MODEL_NAME=qwen2.5

# Embedding Model - For text → vector conversion
# Options: bge-m3 (recommended), nomic-embed-text, mxbai-embed-large
LOCAL_EMBEDDING_MODEL_NAME=bge-m3

# OCR Model - For vision-based text extraction (OPTIONAL)
# Set to empty string to use Tesseract fallback only
# Options: lighton/lightonocr:2b (when available), llava
LOCAL_OCR_MODEL_NAME=

# Enable LLM-based OCR (vs Tesseract-only)
USE_LOCAL_OCR=false
```

### 4.2 Updated `config.py`

Add to `Settings` class:

```python
# OCR Model (Vision)
LOCAL_OCR_MODEL_NAME: str = os.getenv("LOCAL_OCR_MODEL_NAME", "")
USE_LOCAL_OCR: bool = os.getenv("USE_LOCAL_OCR", "false").lower() == "true"
```

---

## 5. Service Architecture

### 5.1 Services to Create/Modify

| Service | Status | Changes Needed |
|---------|--------|----------------|
| `embedding_service.py` | ✅ Exists | Update `VECTOR_SIZE` to 1024 |
| `llm_service.py` | ✅ Exists | No changes |
| `ocr_service.py` | ❌ NEW | Create for LightOnOCR integration |
| `vector_service.py` | ✅ Exists | Update `VECTOR_SIZE = 1024` |

### 5.2 New File: `back-dl/app/services/ocr_service.py`

```python
"""
Service for LLM-based OCR using vision models.
Falls back to Tesseract if disabled or unavailable.
"""
import logging
import httpx
import base64
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)

class OCRService:
    """
    LLM-based OCR using vision models (e.g., LightOnOCR).
    Falls back to Tesseract if model unavailable.
    """
    
    def __init__(self):
        self.enabled = settings.USE_LOCAL_OCR and bool(settings.LOCAL_OCR_MODEL_NAME)
        self.base_url = settings.OLLAMA_BASE_URL
        self.model_name = settings.LOCAL_OCR_MODEL_NAME
        
    async def ensure_model_available(self) -> bool:
        """Check/pull OCR model. Similar to EmbeddingService."""
        if not self.enabled:
            return True
        # ... (same pattern as embedding_service.py)
        
    async def extract_text(self, image_bytes: bytes) -> Optional[str]:
        """
        Extract text from image using vision model.
        Returns None to signal fallback to Tesseract.
        """
        if not self.enabled:
            return None
            
        try:
            b64_image = base64.b64encode(image_bytes).decode('utf-8')
            
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model_name,
                        "prompt": "Extract all text from this image. Return only the text, no commentary.",
                        "images": [b64_image],
                        "stream": False
                    }
                )
                
                if resp.status_code == 200:
                    return resp.json().get("response", "").strip()
                    
        except Exception as e:
            logger.warning(f"OCR model failed, falling back to Tesseract: {e}")
            
        return None  # Signal fallback
```

### 5.3 Update Extraction Pipeline

Modify `image_extractor.py` to use OCR service:

```python
from app.services.ocr_service import OCRService

class ImageExtractor(BaseExtractor):
    async def extract(self, file_path: Path, content: bytes) -> ExtractedDocument:
        # Try LLM-based OCR first
        ocr_service = OCRService()
        text = await ocr_service.extract_text(content)
        
        # Fallback to Tesseract
        if text is None:
            image = Image.open(io.BytesIO(content))
            text = pytesseract.image_to_string(image)
            
        return ExtractedDocument(content=text, metadata={"type": "image", "ocr": True})
```

---

## 6. Responsibility & Availability Timeline

### 6.1 WHO Is Responsible?

| Component | Responsibility | When |
|-----------|---------------|------|
| **Tauri Gatekeeper** (Rust) | Starts `llm-dl` (Ollama) container via Docker Compose | App launch, if `USE_LOCAL_EMBEDDING=true` |
| **Python Backend** (`back-dl`) | Auto-pulls models from Ollama on startup | Container startup event |
| **Ollama** (`llm-dl`) | Hosts and serves models via HTTP API | After container is running |

### 6.2 Orchestration Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. USER LAUNCHES TAURI APP                                                  │
│    └─→ Gatekeeper (Rust) reads .env                                         │
│        └─→ Checks USE_LOCAL_EMBEDDING                                       │
│            └─→ If true: sets COMPOSE_PROFILES=local-llm                     │
│                └─→ Runs: docker compose up -d                               │
│                    └─→ llm-dl (Ollama) container STARTS                     │
│                                                                             │
│ 2. BACKEND CONTAINER (back-dl) STARTS                                       │
│    └─→ FastAPI @router.on_event("startup") fires                            │
│        └─→ VectorService().ensure_collection()     [Qdrant ready]           │
│        └─→ EmbeddingService().ensure_model_available()                      │
│            └─→ Calls Ollama API: GET /api/tags                              │
│            └─→ If model missing: POST /api/pull {"name": "bge-m3"}          │
│                └─→ MODEL DOWNLOADING... (~2-10 min first run)               │
│        └─→ LLMService().ensure_model_available()                            │
│            └─→ Same pattern for qwen2.5                                     │
│        └─→ OCRService().ensure_model_available() [if USE_LOCAL_OCR=true]    │
│                                                                             │
│ 3. MODELS AVAILABLE                                                         │
│    └─→ Backend ready to serve requests                                      │
│    └─→ Models cached in ollama_data volume (persistent)                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 WHEN Are Models Available?

| Event | Status |
|-------|--------|
| App launches | Ollama container started, models **NOT YET** downloaded |
| Backend startup begins | Auto-pull triggered, **BLOCKING** until complete |
| First run (~2-10 min) | Models downloading from `ollama.ai` registry |
| Pull completes | Models **FULLY AVAILABLE**, backend serves requests |
| Subsequent launches | Models cached, **IMMEDIATELY AVAILABLE** |

> [!IMPORTANT]
> **First-Run Blocking**: The backend startup blocks until models are pulled. For large models like `qwen2.5:7b`, this can take 5-10 minutes on first run. Frontend should display a loading indicator during this time.

---

## 7. Auto-Pull Sequence

On backend startup (`resources.py` router), models are pulled in order:

```python
@router.on_event("startup")
async def router_startup():
    # 1. Vector Collection
    VectorService().ensure_collection()
    
    # 2. Embedding Model (if enabled)
    if settings.USE_LOCAL_EMBEDDING:
        await EmbeddingService().ensure_model_available()
    
    # 3. Chat Model (always try if Ollama reachable)
    await LLMService().ensure_model_available()
    
    # 4. OCR Model (if enabled)
    if settings.USE_LOCAL_OCR:
        await OCRService().ensure_model_available()
```

---

## 8. Verification Plan

### 7.1 Automated Tests

```bash
# Test model connectivity
docker exec -it iadata-back-dl python -c "
from app.services.embedding_service import EmbeddingService
from app.services.llm_service import LLMService
import asyncio

async def test():
    print('Testing Embedding:', await EmbeddingService().ensure_model_available())
    print('Testing LLM:', await LLMService().ensure_model_available())

asyncio.run(test())
"
```

### 7.2 Manual Verification

1. Set `USE_LOCAL_EMBEDDING=true` in `.env.dev`
2. Restart backend: `docker compose up -d --build back-dl`
3. Check logs for model pull progress
4. Create a data source and trigger ingestion
5. Verify vectors appear in Qdrant

---

## 9. Implementation Priority

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | Update `.env.example` with OCR vars | 10 min | Documentation |
| 2 | Update `config.py` with OCR settings | 10 min | Foundation |
| 3 | Fix `VECTOR_SIZE = 1024` in `vector_service.py` | 5 min | **Critical Bug** |
| 4 | Create `ocr_service.py` | 1 hour | New Feature |
| 5 | Update `image_extractor.py` to use OCR service | 30 min | Integration |
| 6 | Add OCR to startup sequence | 15 min | Activation |
| 7 | Deprecate `0501-local-LLMS` feature doc | 5 min | Cleanup |

---

## 10. Summary

This plan establishes:

1. **Three-Model Strategy**: Chat, Embedding, OCR (each with CPU-compatible defaults)
2. **Clear Configuration**: All settings in `.env` with proper defaults
3. **Auto-Acquisition**: Models auto-pulled on startup if missing
4. **Fallback Pattern**: OCR falls back to Tesseract if model unavailable
5. **Documentation Ownership**: LLM logic documented in `tools-iadata/.claude/plan/`

The feature file `0501-local-LLMS` in `.ai/features/` is now **deprecated** and should reference this plan.

---

*Authoritative Local LLM Management Plan for Tools IADATA v2.0*
