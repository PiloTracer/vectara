# Feature: initial-check
**ID**: 0001
**Created**: 2026-01-22
**Last Updated**: 2026-01-22
**Status**: IN_PROGRESS

## 1. Objective
Implement "The Gatekeeper" workflow. The Tauri application must verify that the external AI backend (`tools-iadata`) is properly configured before allowing the user to proceed. It validates the runtime environment variables against the schema.

## 2. Requirements
- [ ] **Schema Awareness**: Read `tools-iadata/.env.example` to identify required keys.
- [ ] **Runtime Validation**: Read `tools-iadata/.env.dev` (or appropriate env file) to verify values exist and are not empty.
- [ ] **Local Persistence**: Rust must store the user's selected environment (dev/prd) in a local file (e.g., `app_config.json`) so it remembers the choice on next restart.
- [ ] **Rust-Based Logic**: All file reading and parsing must happen in `src-tauri`.
- [ ] **UI Redirection**:
    -   If Valid: Redirect to Docker URL (e.g., `http://localhost:3000`).
    -   If Invalid: Show a native "Configuration Needed" screen listing missing keys.
- [ ] **Security**: Do not expose raw env contents to frontend unnecessarily; only status or missing keys.
- [ ] **Docker Orchestration**:
    -   **Check**: Verify if the backend services (`ia-dl`, `back-dl`, `pg-dl`) are running.
    -   **Auto-Start**: If not running, execute `docker compose up -d` (using the correct file for the mode).
    -   **Health Check**: Wait for the frontend container (`front-dl`) to be reachable before redirecting.

## 3. Implementation Plan
- [ ] **Rust Command**: `check_env_config` (Existing)
- [ ] **Rust Command**: `check_docker_status`
    -   Returns: `Running`, `Stopped`, or `Starting`.
- [ ] **Rust Command**: `start_docker`
    -   Triggers `docker compose up`.
- [ ] **Frontend**: `Gatekeeper.tsx`
    -   State: "Checking Config" -> "Checking Docker" -> "Starting Services..." -> "Redirect".

## 4. Changelog
- 2026-01-22: Initial Draft
- 2026-01-22: Updated with detailed "Gatekeeper" requirements.
