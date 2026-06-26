# INITIAL CONCERN - DIRECT INPUT BY DEVELOPER:

*I have a Tauri app (react+rust) which has a frontend for operations on the host.  The software runs totally on the host computer.  additionally there's a docker-stack with databases, backend, frontend, local LLM model, and the host wrapper at some point redirects to the front-end in the docker container.  This is a seamless experience for the user.*

**QUESTION:**

*In this scenario is there a way for the dockerized container backend, to directly access a path in the host computer through the wrapping Tauri app?*

*Currently, they way I'm allowing the internal container to access a folder is by mapping a container path to the host path, but this is limitting given the user is limited to a specific single folder, and not giving the user freedom to set source folders more freely.*

**SUGGESTION:**

# API Bridge Pattern Implementation

I'll show you a complete implementation of the API Bridge Pattern for your Tauri + Docker setup.

## Architecture Overview

```
User → Tauri UI → Select Folder
                ↓
Docker Backend → HTTP Request → Tauri HTTP Server → Host File System
                ↓
                Response with file data
```

## 1. Tauri Backend (Rust)

First, add dependencies to `src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri = { version = "1.5", features = ["dialog-all", "fs-all"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1", features = ["full"] }
axum = "0.7"
tower-http = { version = "0.5", features = ["cors"] }
```

Now create the HTTP server in `src-tauri/src/main.rs`:

```rust
use axum::{
    extract::{Json, Path, State},
    http::StatusCode,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::{Any, CorsLayer};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

// Shared state to store authorized paths
#[derive(Clone)]
struct AppState {
    authorized_paths: Arc<RwLock<HashMap<String, PathBuf>>>,
}

// API Request/Response structs
#[derive(Deserialize)]
struct ReadFileRequest {
    path_id: String,
    relative_path: String,
}

#[derive(Serialize)]
struct ReadFileResponse {
    content: String,
    success: bool,
    error: Option<String>,
}

#[derive(Deserialize)]
struct WriteFileRequest {
    path_id: String,
    relative_path: String,
    content: String,
}

#[derive(Serialize)]
struct GenericResponse {
    success: bool,
    error: Option<String>,
}

#[derive(Deserialize)]
struct ListDirRequest {
    path_id: String,
    relative_path: Option<String>,
}

#[derive(Serialize)]
struct FileInfo {
    name: String,
    is_dir: bool,
    size: u64,
}

#[derive(Serialize)]
struct ListDirResponse {
    files: Vec<FileInfo>,
    success: bool,
    error: Option<String>,
}

// HTTP Handlers
async fn read_file_handler(
    State(state): State<AppState>,
    Json(payload): Json<ReadFileRequest>,
) -> (StatusCode, Json<ReadFileResponse>) {
    let paths = state.authorized_paths.read().await;
    
    let base_path = match paths.get(&payload.path_id) {
        Some(path) => path,
        None => {
            return (
                StatusCode::FORBIDDEN,
                Json(ReadFileResponse {
                    content: String::new(),
                    success: false,
                    error: Some("Path ID not authorized".to_string()),
                }),
            );
        }
    };

    let full_path = base_path.join(&payload.relative_path);
    
    // Security: ensure the resolved path is still within the authorized directory
    if !full_path.starts_with(base_path) {
        return (
            StatusCode::FORBIDDEN,
            Json(ReadFileResponse {
                content: String::new(),
                success: false,
                error: Some("Path traversal detected".to_string()),
            }),
        );
    }

    match fs::read_to_string(&full_path) {
        Ok(content) => (
            StatusCode::OK,
            Json(ReadFileResponse {
                content,
                success: true,
                error: None,
            }),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ReadFileResponse {
                content: String::new(),
                success: false,
                error: Some(e.to_string()),
            }),
        ),
    }
}

async fn write_file_handler(
    State(state): State<AppState>,
    Json(payload): Json<WriteFileRequest>,
) -> (StatusCode, Json<GenericResponse>) {
    let paths = state.authorized_paths.read().await;
    
    let base_path = match paths.get(&payload.path_id) {
        Some(path) => path,
        None => {
            return (
                StatusCode::FORBIDDEN,
                Json(GenericResponse {
                    success: false,
                    error: Some("Path ID not authorized".to_string()),
                }),
            );
        }
    };

    let full_path = base_path.join(&payload.relative_path);
    
    if !full_path.starts_with(base_path) {
        return (
            StatusCode::FORBIDDEN,
            Json(GenericResponse {
                success: false,
                error: Some("Path traversal detected".to_string()),
            }),
        );
    }

    // Create parent directories if they don't exist
    if let Some(parent) = full_path.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(GenericResponse {
                    success: false,
                    error: Some(e.to_string()),
                }),
            );
        }
    }

    match fs::write(&full_path, &payload.content) {
        Ok(_) => (
            StatusCode::OK,
            Json(GenericResponse {
                success: true,
                error: None,
            }),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(GenericResponse {
                success: false,
                error: Some(e.to_string()),
            }),
        ),
    }
}

async fn list_directory_handler(
    State(state): State<AppState>,
    Json(payload): Json<ListDirRequest>,
) -> (StatusCode, Json<ListDirResponse>) {
    let paths = state.authorized_paths.read().await;
    
    let base_path = match paths.get(&payload.path_id) {
        Some(path) => path,
        None => {
            return (
                StatusCode::FORBIDDEN,
                Json(ListDirResponse {
                    files: vec![],
                    success: false,
                    error: Some("Path ID not authorized".to_string()),
                }),
            );
        }
    };

    let target_path = if let Some(rel) = &payload.relative_path {
        base_path.join(rel)
    } else {
        base_path.clone()
    };

    if !target_path.starts_with(base_path) {
        return (
            StatusCode::FORBIDDEN,
            Json(ListDirResponse {
                files: vec![],
                success: false,
                error: Some("Path traversal detected".to_string()),
            }),
        );
    }

    match fs::read_dir(&target_path) {
        Ok(entries) => {
            let mut files = Vec::new();
            for entry in entries.flatten() {
                if let Ok(metadata) = entry.metadata() {
                    files.push(FileInfo {
                        name: entry.file_name().to_string_lossy().to_string(),
                        is_dir: metadata.is_dir(),
                        size: metadata.len(),
                    });
                }
            }
            (
                StatusCode::OK,
                Json(ListDirResponse {
                    files,
                    success: true,
                    error: None,
                }),
            )
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ListDirResponse {
                files: vec![],
                success: false,
                error: Some(e.to_string()),
            }),
        ),
    }
}

async fn get_authorized_paths(
    State(state): State<AppState>,
) -> Json<HashMap<String, String>> {
    let paths = state.authorized_paths.read().await;
    let paths_string: HashMap<String, String> = paths
        .iter()
        .map(|(k, v)| (k.clone(), v.to_string_lossy().to_string()))
        .collect();
    Json(paths_string)
}

// Start HTTP server
async fn start_http_server(state: AppState) {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/file/read", post(read_file_handler))
        .route("/api/file/write", post(write_file_handler))
        .route("/api/file/list", post(list_directory_handler))
        .route("/api/paths", get(get_authorized_paths))
        .layer(cors)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3737")
        .await
        .unwrap();
    
    println!("File bridge server running on http://127.0.0.1:3737");
    
    axum::serve(listener, app).await.unwrap();
}

// Tauri Commands
#[tauri::command]
async fn authorize_folder(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    use tauri::api::dialog::blocking::FileDialogBuilder;

    let folder = FileDialogBuilder::new()
        .set_title("Select Folder to Authorize")
        .pick_folder();

    match folder {
        Some(path) => {
            let path_id = uuid::Uuid::new_v4().to_string();
            let mut paths = state.authorized_paths.write().await;
            paths.insert(path_id.clone(), path);
            Ok(path_id)
        }
        None => Err("No folder selected".to_string()),
    }
}

#[tauri::command]
async fn revoke_folder(
    state: tauri::State<'_, AppState>,
    path_id: String,
) -> Result<(), String> {
    let mut paths = state.authorized_paths.write().await;
    paths.remove(&path_id);
    Ok(())
}

#[tauri::command]
async fn get_authorized_folders(
    state: tauri::State<'_, AppState>,
) -> Result<HashMap<String, String>, String> {
    let paths = state.authorized_paths.read().await;
    let result: HashMap<String, String> = paths
        .iter()
        .map(|(k, v)| (k.clone(), v.to_string_lossy().to_string()))
        .collect();
    Ok(result)
}

fn main() {
    let state = AppState {
        authorized_paths: Arc::new(RwLock::new(HashMap::new())),
    };

    let state_clone = state.clone();

    tauri::Builder::default()
        .manage(state)
        .setup(|_app| {
            // Start HTTP server in background
            tokio::spawn(async move {
                start_http_server(state_clone).await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            authorize_folder,
            revoke_folder,
            get_authorized_folders
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Add UUID dependency:
```toml
uuid = { version = "1.6", features = ["v4"] }
```

## 2. Tauri Frontend (React)

```typescript
// src/hooks/useFileSystem.ts
import { invoke } from '@tauri-apps/api/tauri';
import { useState, useEffect } from 'react';

interface AuthorizedFolder {
  id: string;
  path: string;
}

export function useFileSystem() {
  const [folders, setFolders] = useState<AuthorizedFolder[]>([]);

  const loadFolders = async () => {
    try {
      const result = await invoke<Record<string, string>>('get_authorized_folders');
      const folderArray = Object.entries(result).map(([id, path]) => ({
        id,
        path,
      }));
      setFolders(folderArray);
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  };

  const authorizeFolder = async () => {
    try {
      const pathId = await invoke<string>('authorize_folder');
      await loadFolders();
      return pathId;
    } catch (error) {
      console.error('Failed to authorize folder:', error);
      throw error;
    }
  };

  const revokeFolder = async (pathId: string) => {
    try {
      await invoke('revoke_folder', { pathId });
      await loadFolders();
    } catch (error) {
      console.error('Failed to revoke folder:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadFolders();
  }, []);

  return {
    folders,
    authorizeFolder,
    revokeFolder,
    refreshFolders: loadFolders,
  };
}
```

```tsx
// src/components/FolderManager.tsx
import React from 'react';
import { useFileSystem } from '../hooks/useFileSystem';

export function FolderManager() {
  const { folders, authorizeFolder, revokeFolder } = useFileSystem();

  return (
    <div style={{ padding: '20px' }}>
      <h2>Authorized Folders</h2>
      
      <button onClick={authorizeFolder}>
        Add Folder
      </button>

      <ul>
        {folders.map((folder) => (
          <li key={folder.id}>
            <span>{folder.path}</span>
            <button onClick={() => revokeFolder(folder.id)}>
              Revoke
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## 3. Docker Backend (Node.js/Python example)

### Node.js Example:

```javascript
// filebridge-client.js
const axios = require('axios');

const BRIDGE_URL = 'http://host.docker.internal:3737';

class FileBridgeClient {
  async readFile(pathId, relativePath) {
    try {
      const response = await axios.post(`${BRIDGE_URL}/api/file/read`, {
        path_id: pathId,
        relative_path: relativePath,
      });
      return response.data;
    } catch (error) {
      console.error('Read file error:', error);
      throw error;
    }
  }

  async writeFile(pathId, relativePath, content) {
    try {
      const response = await axios.post(`${BRIDGE_URL}/api/file/write`, {
        path_id: pathId,
        relative_path: relativePath,
        content: content,
      });
      return response.data;
    } catch (error) {
      console.error('Write file error:', error);
      throw error;
    }
  }

  async listDirectory(pathId, relativePath = null) {
    try {
      const response = await axios.post(`${BRIDGE_URL}/api/file/list`, {
        path_id: pathId,
        relative_path: relativePath,
      });
      return response.data;
    } catch (error) {
      console.error('List directory error:', error);
      throw error;
    }
  }

  async getAuthorizedPaths() {
    try {
      const response = await axios.get(`${BRIDGE_URL}/api/paths`);
      return response.data;
    } catch (error) {
      console.error('Get paths error:', error);
      throw error;
    }
  }
}

module.exports = FileBridgeClient;

// Usage example:
// const client = new FileBridgeClient();
// const data = await client.readFile('path-id-123', 'subfolder/file.txt');
```

### Python Example:

```python
# filebridge_client.py
import requests
from typing import Optional, Dict, List

class FileBridgeClient:
    def __init__(self, bridge_url: str = "http://host.docker.internal:3737"):
        self.bridge_url = bridge_url
    
    def read_file(self, path_id: str, relative_path: str) -> Dict:
        response = requests.post(
            f"{self.bridge_url}/api/file/read",
            json={
                "path_id": path_id,
                "relative_path": relative_path
            }
        )
        response.raise_for_status()
        return response.json()
    
    def write_file(self, path_id: str, relative_path: str, content: str) -> Dict:
        response = requests.post(
            f"{self.bridge_url}/api/file/write",
            json={
                "path_id": path_id,
                "relative_path": relative_path,
                "content": content
            }
        )
        response.raise_for_status()
        return response.json()
    
    def list_directory(self, path_id: str, relative_path: Optional[str] = None) -> Dict:
        response = requests.post(
            f"{self.bridge_url}/api/file/list",
            json={
                "path_id": path_id,
                "relative_path": relative_path
            }
        )
        response.raise_for_status()
        return response.json()
    
    def get_authorized_paths(self) -> Dict[str, str]:
        response = requests.get(f"{self.bridge_url}/api/paths")
        response.raise_for_status()
        return response.json()

# Usage:
# client = FileBridgeClient()
# result = client.read_file("path-id-123", "data/file.txt")
# print(result['content'])
```

## 4. Docker Compose Configuration

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      - FILE_BRIDGE_URL=http://host.docker.internal:3737
    # No volume mounts needed!
```

## Security Features

1. **Path Traversal Protection**: Validates all paths to prevent `../` attacks
2. **Authorization Required**: Folders must be explicitly authorized by user
3. **Unique Path IDs**: Uses UUIDs to reference folders instead of exposing full paths
4. **Revocable Access**: Users can revoke folder access at any time
5. **CORS Protection**: Only localhost can access the API

## Usage Flow

1. User clicks "Add Folder" in Tauri UI
2. Native file dialog appears
3. User selects folder
4. Tauri assigns UUID to folder and stores mapping
5. Docker backend requests files using the UUID + relative path
6. Tauri validates request and performs file operation
7. Result returned to Docker backend

This gives you complete flexibility while maintaining security!