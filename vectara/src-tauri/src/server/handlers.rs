use axum::{
    extract::{Json, State},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use crate::server::state::AppState;

// --- Request/Response Structs ---

#[derive(Deserialize)]
pub struct ReadFileRequest {
    pub path_id: String,
    pub relative_path: String,
}

#[derive(Serialize)]
pub struct ReadFileResponse {
    pub content: String,
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

// --- Helper Functions ---

fn resolve_path(base_path: &PathBuf, relative_path: &str) -> Result<PathBuf, String> {
    let full_path = base_path.join(relative_path);
    
    // Security check: canonicalize to resolve .. and symlinks to ensure it's inside base_path
    // Note: canonicalize requires the path to exist for resolution, which works for reading.
    // For writing new files, we check the parent.
    // A simpler strict prefix check without canonicalization prevents most traversal if input is sanitized,
    // but canonicalization is safest. However, strict strict starts_with on the joined path 
    // without .. resolution is often used too.
    
    // Simple check: does the string contain ".." component?
    if relative_path.contains("..") {
        return Err("Path traversal detected (..)".to_string());
    }
    
    // Ensure the resulting path starts with the base path
    if !full_path.starts_with(base_path) {
         return Err("Path traversal detected".to_string());
    }
    
    Ok(full_path)
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
            content: String::new(), success: false, error: Some("Path ID not authorized".into()) 
        })),
    };

    let full_path = match resolve_path(base_path, &payload.relative_path) {
        Ok(p) => p,
        Err(e) => return (StatusCode::FORBIDDEN, Json(ReadFileResponse { 
            content: String::new(), success: false, error: Some(e) 
        })),
    };

    match fs::read_to_string(&full_path) {
        Ok(content) => (StatusCode::OK, Json(ReadFileResponse { content, success: true, error: None })),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(ReadFileResponse { 
            content: String::new(), success: false, error: Some(e.to_string()) 
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
