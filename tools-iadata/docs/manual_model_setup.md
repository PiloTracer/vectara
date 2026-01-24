# Manual Model Import Guide (GGUF)

For custom or fine-tuned models not in the official Ollama library (e.g., `dphn/Dolphin-X1-8B`), you must import them manually using a GGUF file.

## 1. Download the GGUF File

1.  Visit the HuggingFace model page (e.g., [dphn/Dolphin-X1-8B](https://huggingface.co/dphn/Dolphin-X1-8B)).
2.  Go to the **Files and versions** tab.
3.  Look for files ending in `.gguf`.
4.  Download the quantization level appropriate for your VRAM:
    *   **Q4_K_M.gguf** (Recommended balance: ~4.8GB)
    *   **Q5_K_M.gguf** (Higher quality: ~5.5GB)
    *   **Q8_0.gguf** (Max quality: ~8.5GB)

## 2. Create the Modelfile

Create a file named `Modelfile` in the same directory as your downloaded GGUF.

```dockerfile
FROM ./Dolphin-X1-8B-Q4_K_M.gguf

# Set parameters (optional, defaults are usually fine)
PARAMETER temperature 0.7
PARAMETER top_p 0.9

# System prompt
SYSTEM """
You are Dolphin, an uncensored, helpful AI assistant.
"""
```

## 3. Create the Model in Ollama

Run the following command in your terminal:

```bash
ollama create dolphin-x1 -f Modelfile
```

*   `dolphin-x1` is the **tag** you will use in your app configuration.

## 4. Update Application Config

Update your `.env` (or `.env.dev`) file to match the tag you created:

```bash
LOCAL_MODEL_NAME=dolphin-x1
```

Restart the backend for changes to take effect.
