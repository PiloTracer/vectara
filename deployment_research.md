# Research: Automated Deployment Strategy

## 1. Code Acquisition (`tools-iadata`)
**Problem**: The user currently has to manually clone the repo.
**Goal**: The `vectara` executable should "have" this code.

### Option A: Tauri Resources (Recommended)
Tauri allows bundling external files (the `resources` object in `tauri.conf.json`).
*   **How it works**: We list `../tools-iadata` as a resource.
*   **Result**: When `vectara` is installed, these files are included in the installer (MSI/DEB/DMG) and unpacked to a known location (e.g., `/usr/lib/vectara/resources` or `%AppData%/vectara`).
*   **Pros**: Zero download at runtime. Truly "offline" capable.
*   **Cons**: Increases installer size (currently +400MB due to `tools-iadata` size, though this can be trimmed significantly by excluding `tmp`, `venv`, `__pycache__`).

### Option B: Runtime Git Clone
*   **How it works**: On first launch, app runs `git clone ...`.
*   **Pros**: Tiny installer.
*   **Cons**: Requires Git installed, requires Internet, fragile.

## 2. Docker Acquisition
**Problem**: User needs Docker Desktop installed.

### Option A: Detection & Prompt (Standard)
*   **Logic**: App checks `docker --version`.
*   **If missing**: Show a beautiful UI: "We need Docker. [Click here to Install]".
*   **Pros**: Reliable, respects user machine.
*   **Cons**: User manual step.

### Option B: Embedded Docker (Not Recommended)
*   It is technically possible to bundle `Docker Desktop Installer.exe` inside the Tauri app, but it is massive (500MB+) and often requires admin privileges / reboot. It is usually better to guide the user.

## 3. The "One-Click" Vision (Proposed Architecture)

1.  **Bundling**:
    *   Clean `tools-iadata` (remove `tmp`, `venv`, `src` garbage).
    *   Configure `tauri.conf.json` to bundle it as a **Sidecar Resource**.
2.  **Runtime**:
    *   App starts.
    *   Checks: `Do I have the backend files in $APP_DATA?`
    *   If No: **Extracts/Copies** them from the Resource path to `$APP_DATA/tools-iadata`.
    *   Checks: `Is Docker running?`
    *   If No: Prompts user to start/install it.
    *   Runs: `start_docker` (which now points to `$APP_DATA/tools-iadata`).

This achieves the goal: **Deploy 1 executable, everything else happens automatically.**
