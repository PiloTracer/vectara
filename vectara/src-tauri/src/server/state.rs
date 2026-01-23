use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct AppState {
    pub authorized_paths: Arc<RwLock<HashMap<String, PathBuf>>>,
    pub app_handle: Option<tauri::AppHandle>,
}

impl AppState {
    pub fn new(app_handle: Option<tauri::AppHandle>) -> Self {
        Self {
            authorized_paths: Arc::new(RwLock::new(HashMap::new())),
            app_handle,
        }
    }
}
