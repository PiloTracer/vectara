# Startup Progress Feedback Plan
> **Date**: 2026-01-26
> **Problem**: User sees a blank "Docker Logs" box while Docker images are pulling/downloading, causing uncertainty.
> **Goal**: Stream real-time output from `docker compose up` (esp. pull progress) to the UI.

## 1. Analysis
The current `start_docker` implementation in `src-tauri/src/docker.rs` runs `docker compose up -d` as a blocking command:
```rust
// Current (Blocking)
let output = Command::new("docker").arg("up").output(); // Waits until 100% done
```
While this runs (which can take minutes for 5GB models), the frontend receives **zero feedback**. The existing log poller (`get_docker_logs`) also returns nothing because containers haven't started yet.

## 2. Solution Strategy
We will switch from "Blocking Output" to "Streaming Events".

### Backend (Rust)
1.  **Refactor `start_docker`**:
    *   Instead of `.output()`, use `Stdio::piped()` and spawn the process.
    *   Create a `BufReader` for both stdout and stderr.
    *   Read lines asynchronously.
    *   **Emit Tauri Event** (`docker-event-log`) for each line read.
    *   Ensure the process continues to run until finished (startup complete).

### Frontend (React)
1.  **Listen for Events**:
    *   In `DockerControl.tsx` (or equivalent), add `listen('docker-event-log', ...)`
    *   Append these payloads to the log terminal window.
2.  **Transition**:
    *   While "Starting" state is active, display these stream logs.
    *   Once started, switch to the standard `get_docker_logs` polling.

## 3. Implementation Steps

### Step 1: Rust Dependency
Ensure `start_docker` has access to the `AppHandle` or `Window` to emit events. (It already takes `AppHandle`).

### Step 2: Rewrite `start_docker` in `docker.rs`
```rust
// Pseudo-code
use tauri::Manager;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};

let mut child = Command::new("docker")
    .args(["compose", "up", "-d"])
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()
    .expect("Failed to spawn");

// Spawn threads to read stdout/stderr and emit events
let app_handle = app.clone();
let stdout = child.stdout.take().unwrap();
std::thread::spawn(move || {
    let reader = BufReader::new(stdout);
    for line in reader.lines() {
        if let Ok(l) = line {
            app_handle.emit_all("docker-event-log", l).unwrap();
        }
    }
});
// Repeat for stderr...
```

### Step 3: Update Frontend
Locate the component responsible for the log window (likely `vectara/src/components/dashboard/DockerControl.tsx` or similar) and add the event listener.

## 4. Verification
1.  Run `docker system prune` to delete local images (simulating a fresh user).
2.  Click "Start Services".
3.  Verify that lines like `Pulling layers...` appear in the log box immediately.
