use axum::{
    extract::{Json, State},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use crate::server::state::AppState;
use tauri_plugin_dialog::DialogExt;
use base64::{Engine as _, engine::general_purpose};


// --- Request/Response Structs ---

#[derive(Deserialize)]
pub struct ReadFileRequest {
    pub path_id: String,
    pub relative_path: String,
}

#[derive(Serialize)]
pub struct ReadFileResponse {
    pub content: String,
    pub is_binary: bool,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Deserialize)]
pub struct WriteFileRequest {
    pub path_id: String,
    pub relative_path: String,
    pub content: String,
}

#[derive(Serialize)]
pub struct GenericResponse {
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Deserialize)]
pub struct ListDirRequest {
    pub path_id: String,
    pub relative_path: Option<String>,
}

#[derive(Serialize)]
pub struct FileInfo {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
}

#[derive(Serialize)]
pub struct ListDirResponse {
    pub files: Vec<FileInfo>,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Serialize)]
pub struct OpenDialogResponse {
    pub path_id: Option<String>,
    pub path: Option<String>,
    pub canceled: bool,
    pub success: bool,
    pub error: Option<String>,
}

// --- Helper Functions ---

fn resolve_path(base_path: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let base_canonical = base_path.canonicalize()
        .map_err(|e| format!("Cannot resolve base path: {}", e))?;
    let full_path = base_canonical.join(relative_path);

    // Normalize by canonicalizing if the path exists, otherwise try parent canonicalization
    let resolved = if full_path.exists() {
        full_path.canonicalize()
            .map_err(|e| format!("Cannot resolve path: {}", e))?
    } else {
        // For new files, canonicalize parent and append filename
        let parent = full_path.parent().ok_or("Invalid path: no parent")?;
        let file_name = full_path.file_name().ok_or("Invalid path: no filename")?;
        let parent_canonical = parent.canonicalize()
            .map_err(|e| format!("Cannot resolve parent path: {}", e))?;
        parent_canonical.join(file_name)
    };

    // Verify resolved path starts with base canonical path
    if !resolved.starts_with(&base_canonical) {
        return Err("Path traversal detected".to_string());
    }

    Ok(resolved)
}

// --- Handlers ---

pub async fn read_file_handler(
    State(state): State<AppState>,
    Json(payload): Json<ReadFileRequest>,
) -> (StatusCode, Json<ReadFileResponse>) {
    let paths = state.authorized_paths.read().await;
    
    let base_path = match paths.get(&payload.path_id) {
        Some(path) => path,
        None => return (StatusCode::FORBIDDEN, Json(ReadFileResponse { 
            content: String::new(), is_binary: false, success: false, error: Some("Path ID not authorized".into()) 
        })),
    };

    let full_path = match resolve_path(base_path, &payload.relative_path) {
        Ok(p) => p,
        Err(e) => return (StatusCode::FORBIDDEN, Json(ReadFileResponse { 
            content: String::new(), is_binary: false, success: false, error: Some(e) 
        })),
    };

    // Read as bytes to support both text and binary files
    match fs::read(&full_path) {
        Ok(bytes) => {
            // Try to interpret as UTF-8 text first
            match String::from_utf8(bytes.clone()) {
                Ok(content) => (StatusCode::OK, Json(ReadFileResponse { 
                    content, is_binary: false, success: true, error: None 
                })),
                Err(_) => {
                    // Binary file - encode as base64
                    let encoded = general_purpose::STANDARD.encode(&bytes);
                    (StatusCode::OK, Json(ReadFileResponse { 
                        content: encoded, is_binary: true, success: true, error: None 
                    }))
                }
            }
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(ReadFileResponse { 
            content: String::new(), is_binary: false, success: false, error: Some(e.to_string()) 
        })),
    }
}

pub async fn write_file_handler(
    State(state): State<AppState>,
    Json(payload): Json<WriteFileRequest>,
) -> (StatusCode, Json<GenericResponse>) {
    let paths = state.authorized_paths.read().await;
    
    let base_path = match paths.get(&payload.path_id) {
        Some(path) => path,
        None => return (StatusCode::FORBIDDEN, Json(GenericResponse { 
            success: false, error: Some("Path ID not authorized".into()) 
        })),
    };

    let full_path = match resolve_path(base_path, &payload.relative_path) {
        Ok(p) => p,
        Err(e) => return (StatusCode::FORBIDDEN, Json(GenericResponse { 
            success: false, error: Some(e) 
        })),
    };

    // Create parent directories
    if let Some(parent) = full_path.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
             return (StatusCode::INTERNAL_SERVER_ERROR, Json(GenericResponse { 
                success: false, error: Some(e.to_string()) 
            }));
        }
    }

    match fs::write(&full_path, &payload.content) {
        Ok(_) => (StatusCode::OK, Json(GenericResponse { success: true, error: None })),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(GenericResponse { 
            success: false, error: Some(e.to_string()) 
        })),
    }
}

pub async fn list_directory_handler(
    State(state): State<AppState>,
    Json(payload): Json<ListDirRequest>,
) -> (StatusCode, Json<ListDirResponse>) {
    let paths = state.authorized_paths.read().await;
    
    let base_path = match paths.get(&payload.path_id) {
        Some(path) => path,
        None => return (StatusCode::FORBIDDEN, Json(ListDirResponse { 
            files: vec![], success: false, error: Some("Path ID not authorized".into()) 
        })),
    };

    let relative = payload.relative_path.unwrap_or_default();
    let full_path = match resolve_path(base_path, &relative) {
        Ok(p) => p,
        Err(e) => return (StatusCode::FORBIDDEN, Json(ListDirResponse { 
            files: vec![], success: false, error: Some(e) 
        })),
    };

    match fs::read_dir(&full_path) {
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
            (StatusCode::OK, Json(ListDirResponse { files, success: true, error: None }))
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(ListDirResponse { 
            files: vec![], success: false, error: Some(e.to_string()) 
        })),
    }
}

pub async fn get_authorized_paths(
    State(state): State<AppState>,
) -> Json<std::collections::HashMap<String, String>> {
    let paths = state.authorized_paths.read().await;
    let paths_string: std::collections::HashMap<String, String> = paths
        .iter()
        .map(|(k, v)| (k.clone(), v.to_string_lossy().to_string()))
        .collect();
    Json(paths_string)
}

pub async fn open_dialog_handler(
    State(state): State<AppState>,
) ->  (StatusCode, Json<OpenDialogResponse>) {
    let handle = match &state.app_handle {
        Some(h) => h,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, Json(OpenDialogResponse {
            path_id: None, path: None, canceled: false, success: false, error: Some("AppHandle not available".into())
        })),
    };

    // Use blocking_pick_folder. 
    // Since this is an async handler, we should ideally use spawn_blocking if the dialog blocks the thread.
    // However, for simplicity and low traffic, direct call might be okay if it doesn't panic.
    // NOTE: app_handle is Clone.
    let handle_clone = handle.clone();
    
    // We execute the dialog on a blocking thread to avoid blocking the async runtime
    let result = tokio::task::spawn_blocking(move || {
        handle_clone.dialog().file().blocking_pick_folder()
    }).await;

    match result {
        Ok(folder_opt) => {
             match folder_opt {
                Some(path) => {
                    let path_buf = match path.into_path().map_err(|e| e.to_string()) {
                        Ok(p) => p,
                        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(OpenDialogResponse {
                             path_id: None, path: None, canceled: false, success: false, error: Some(e)
                        })),
                    };
                    
                    let path_str = path_buf.to_string_lossy().to_string();
                    let path_id = uuid::Uuid::new_v4().to_string();
                    
                    let mut paths = state.authorized_paths.write().await;
                    paths.insert(path_id.clone(), path_buf);
                    
                    // Hook into persistence
                    let state_clone = state.clone();
                    tauri::async_runtime::spawn(async move {
                        state_clone.persist().await;
                    });

                    (StatusCode::OK, Json(OpenDialogResponse {
                        path_id: Some(path_id),
                        path: Some(path_str),
                        canceled: false,
                        success: true,
                        error: None
                    }))
                }
                None => (StatusCode::OK, Json(OpenDialogResponse {
                    path_id: None, path: None, canceled: true, success: true, error: None
                })),
            }
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(OpenDialogResponse {
             path_id: None, path: None, canceled: false, success: false, error: Some(e.to_string())
        })),
    }
}
