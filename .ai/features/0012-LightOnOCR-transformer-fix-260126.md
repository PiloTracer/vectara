# LightOnOCR Transformer Fix - IMPLEMENTED ✅

> **Date**: 2026-01-26  
> **Status**: COMPLETED  
> **Problem**: OCR service failed with `cannot import name 'LightOnOcrForConditionalGeneration' from 'transformers'`  
> **Solution**: Install transformers from GitHub source (bleeding-edge) instead of stable PyPI.

---

## Implementation Summary

### Step 1: Updated `requirements.txt`

Changed transformers dependency from stable PyPI to GitHub source:

```diff
-# OCR Model (HuggingFace LightOnOCR)
-transformers>=4.40.0
+# OCR Model (HuggingFace LightOnOCR - requires transformers from source)
+git+https://github.com/huggingface/transformers
```

### Step 2: Updated `Dockerfile`

Added `git` to system dependencies (required for pip to clone from GitHub):

```diff
-# Install system dependencies including Tesseract OCR
+# Install system dependencies including Tesseract OCR and git (for pip source installs)
 RUN apt-get update && apt-get install -y \
     gcc \
+    git \
     libpq-dev \
```

### Step 3: Rebuild Backend Container

```bash
cd /mnt/work/Projects/tauri/datalake/tools-iadata
docker compose -f docker-compose.dev.yml build --no-cache back-dl
docker compose -f docker-compose.dev.yml --env-file .env.dev up -d back-dl
```

---

## Files Modified

| File | Change |
|------|--------|
| `back-dl/requirements.txt` | Changed `transformers>=4.40.0` to `git+https://github.com/huggingface/transformers` |
| `back-dl/Dockerfile` | Added `git` to apt-get install list |

---

## Verification

Backend logs now show OCR model loading instead of import error:

```
INFO:app.services.ocr_service:Loading OCR model 'lightonai/LightOnOCR-2-1B' from HuggingFace...
INFO:app.services.ocr_service:Using device: cpu, dtype: torch.float32
INFO:app.services.ocr_service:This may take several minutes on first run (downloading model)...
```

---

## Notes

- **transformers 5.0.1.dev0** installed from source
- First startup downloads the ~2GB LightOnOCR model from HuggingFace
- Warning about "mistral3 type" is benign (model architecture naming)
- OCR runs on CPU by default (~5-15 sec/page)
