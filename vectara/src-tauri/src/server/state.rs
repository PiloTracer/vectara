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
        let mut paths = HashMap::new();
        
        // precise loading
        if let Some(ref handle) = app_handle {
             // Resolve app_local_data_dir which is ~/.local/share/APP/ on Linux
             use tauri::Manager;
             if let Ok(app_dir) = handle.path().app_data_dir() {
                 let file_path = app_dir.join("authorized_paths.json");
                 if file_path.exists() {
                     if let Ok(content) = std::fs::read_to_string(file_path) {
                         if let Ok(saved_paths) = serde_json::from_str::<HashMap<String, PathBuf>>(&content) {
                             paths = saved_paths;
                             println!("Loaded {} authorized paths from disk.", paths.len());
                         }
                     }
                 }
             }
        }

        Self {
            authorized_paths: Arc::new(RwLock::new(paths)),
            app_handle,
        }
    }



    pub async fn persist(&self) {
        if let Some(handle) = &self.app_handle {
             use tauri::Manager;
             if let Ok(app_dir) = handle.path().app_data_dir() {
                 let file_path = app_dir.join("authorized_paths.json");
                 
                 let paths = self.authorized_paths.read().await.clone();
                 
                 // Perform IO on blocking thread
                 tauri::async_runtime::spawn_blocking(move || {
                     if !app_dir.exists() {
                        let _ = std::fs::create_dir_all(&app_dir);
                     }
                     if let Ok(json) = serde_json::to_string_pretty(&paths) {
                         if let Err(e) = std::fs::write(file_path, json) {
                             eprintln!("Failed to save authorized paths: {}", e);
                         }
                     }
                 });
             }
        }
    }
}
