# Skill: High-Performance Cross-Platform Desktop Architect (Tauri)

**Description**: Expertise in building tiny, fast, and secure desktop applications using the Tauri framework. This skill encompasses the bridge between a web-based frontend and a high-performance Rust backend.

## 1. Core Competencies & Instructions

### 🔒 Security First
- **Principle of Least Privilege**: When generating `tauri.conf.json` or capabilities, ONLY enable the specific APIs required for the task.
- **IPC Validation**: Never trust input from the frontend. Validate all payloads in Rust.

### 🦀 Rust Backend Logic
- **Heavy Lifting**: Move ALL heavy computations, file system access, and system-level integrations to the `src-tauri` layer.
- **Type Safety**: Provide corresponding TypeScript interfaces for all Rust structs to ensure safety across the bridge.
- **Commands**: Use strongly typed `#[tauri::command]` functions.

### 🌐 Frontend Agnostic with Shell Capabilities
- **Integration**: Capable of integrating with React, Vue, Svelte, or vanilla JS/TS.
- **The "Shell" Strategy**: For this project (`vectara`), the Tauri app acts as a **Shell** for the Dockerized backend (`tools-iadata`).
- **Embedding Strategy**:
    - **Recommended**: **Webview Redirection**. Point the main window (or a secondary window) directly to the Docker service URL (e.g., `http://localhost:8000`) once it is ready. This provides a focused, native feel.
    - **Fallback**: **Iframe Embedding**. Use an `<iframe>` only if strict DOM isolation is required or if you need to overlay native UI controls *on top* of the external content permanently.

### 💾 State Management
- **Managed State**: Use Tauri's `manage` (e.g., `app.manage(MyState { ... })`) to share state (db connections, config) across Rust commands.
- **Sync**: Use Events to keep Frontend state in sync with Backend truth.

### ⚡ Optimization
- **Binary Size**: Minimize the final binary size. Strip debug symbols in release.
- **Memory**: Leverage system native webviews (WebKit/WebView2) instead of bundling Chromium.

### 📡 Event Handling
- **Full-Duplex**: Implement full-duplex communication using `emit` and `listen` for asynchronous updates (e.g., "Docker Container Started" -> UI Update).

---

## 2. Project-Specific Workflows

### Feature 1: Initial Configuration Check ("The Gatekeeper")
Before showing the main UI, `vectara` must:
1.  **Verify**: Rust backend reads `/mnt/work/Projects/tauri/datalake/tools-iadata/.env.example` (or the actual `.env`).
2.  **Validate**: Check if keys are set (e.g., `OPENAI_API_KEY`).
3.  **Decide**:
    - **IF Valid**: Redirect Webview to the Docker App.
    - **IF Invalid**: Show a native Tauri reconfiguration screen.

## 3. System Prompt Behavior
> "When tasked with Tauri development, always look for opportunities to move performance-critical logic into Rust and provide the corresponding TypeScript interfaces for the frontend to ensure type safety across the bridge."
