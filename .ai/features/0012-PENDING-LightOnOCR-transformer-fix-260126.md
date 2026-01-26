# PENDING: LightOnOCR Transformer Compatibility Fix

> **Status**: PENDING  
> **Priority**: Low (non-blocking)  
> **Created**: 2026-01-26

## Problem

The OCR service fails to initialize with the following error:

```
ERROR:app.services.ocr_service:LightOnOCR requires transformers from source. 
Run: pip install git+https://github.com/huggingface/transformers 
Error: cannot import name 'LightOnOcrForConditionalGeneration' from 'transformers'
```

The `lightonai/LightOnOCR-2-1B` model requires the `LightOnOcrForConditionalGeneration` class, which is only available in the bleeding-edge transformers (not yet in stable PyPI release).

## Impact

- **Affected**: Document OCR/image text extraction
- **Not Affected**: Core RAG pipeline, embeddings, chat, ingestion of text-based documents

---

## Solution: Install Transformers from GitHub Source

### Step 1: Update `requirements.txt`

Replace the stable transformers line with the GitHub source:

```diff
- transformers>=4.40.0
+ git+https://github.com/huggingface/transformers
```

### Step 2: Update Dockerfile (if pinned separately)

If transformers is installed separately in the Dockerfile:

```dockerfile
# Replace:
RUN pip install transformers
# With:
RUN pip install git+https://github.com/huggingface/transformers
```

### Step 3: Rebuild Backend Container

```bash
cd /mnt/work/Projects/tauri/datalake/tools-iadata
docker compose -f docker-compose.dev.yml build --no-cache back-dl
docker compose -f docker-compose.dev.yml --env-file .env.dev up -d back-dl
```

---

## Verification

After applying the fix, check the backend logs:

```bash
docker logs iadata_back_dl_dev 2>&1 | grep -i ocr
```

**Expected**: No OCR errors, or `LightOnOCR initialized successfully`

**Test**: Ingest a scanned PDF or image file and verify text extraction works.

---

## Resource Requirements

| Resource | Requirement |
|----------|-------------|
| **Model Download** | ~2-4 GB (one-time) |
| **RAM during OCR** | ~4-6 GB |
| **GPU (optional)** | ~3-4 GB VRAM for acceleration |
| **CPU-only** | Works, ~5-15 sec/page |

> [!NOTE]
> The transformers source install adds no overhead—it's just a newer version. The resource usage comes from the LightOnOCR model itself during inference.
