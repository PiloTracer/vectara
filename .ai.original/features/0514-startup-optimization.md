# Optimization: Startup Performance

## Goal
Reduce startup time by preventing redundant model downloads and providing better UI feedback during initialization.

## User Review Required
> [!IMPORTANT]
> **Logic Change**: The system will no longer blindly run `ollama pull` on every boot. It will check `ollama list` first. This assumes that if a model is listed, it is valid/complete.

## Proposed Changes

### Docker Infrastructure (`tools-iadata`)

#### [MODIFY] [docker-compose.dev.yml](file:///mnt/work/Projects/tauri/datalake/tools-iadata/docker-compose.dev.yml)
- Update `llm-init` command script.
- **Logic**: Use `ollama list | grep` to check if the model exists. Only pull if missing.

### Backend (`vectara/src-tauri`)

#### [MODIFY] [src/docker.rs](file:///mnt/work/Projects/tauri/datalake/vectara/src-tauri/src/docker.rs)
- In `start_docker`:
    - Remove or optimize "Phase 1: Pre-Acquire".
    - Currently, it spawns `ollama pull` commands *before* bringing up the full stack.
    - **Change**: Move this logic *inside* the `llm-init` container script (above) or make `start_docker` check existence first via API (`GET /api/tags`).
    - **Optimization**: The `docker.rs` logic waits 60s for Ollama. If we let `docker compose up` handle dependencies, we can return "Starting" to the user faster.

### Frontend (`vectara/src`)

#### [MODIFY] [components/Dashboard.tsx] (Inferred)
- Improve the "Black Screen" issue. The log window likely waits for a successful socket connection or full text buffer.
- Ensure it displays a spinner or "Connecting to Docker daemon..." text immediately.

## Verification Plan

### Automated/Manual Verification
1.  **Cold Start**: Run `start_docker` with no models.
    - Result: Should see logs "Pulling model..."
2.  **Warm Start**: Restart the app.
    - Result: Should see logs "Model already exists. Skipping."
    - Total startup time should drop from ~Minutes to ~Seconds.
