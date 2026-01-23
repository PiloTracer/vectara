use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct AppState {
    pub authorized_paths: Arc<RwLock<HashMap<String, PathBuf>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            authorized_paths: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}
