
use tower_http::cors::{Any, CorsLayer};
use axum::{routing::{get, post}, Router};
use std::net::SocketAddr;
use tauri_plugin_dialog::DialogExt;

pub mod state;
pub mod handlers;

use state::AppState;
use handlers::{read_file_handler, write_file_handler, list_directory_handler, get_authorized_paths};

// --- HTTP Server Startup ---

pub async fn start_http_server(state: AppState) {
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

    // Bind strictly to localhost
    let addr = SocketAddr::from(([127, 0, 0, 1], 3737));
    // Check if port is available or handle error? For now unwrap is fine for dev.
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    
    println!("Bridge Server running on http://127.0.0.1:3737");
    
    axum::serve(listener, app).await.unwrap();
}


// --- Tauri Commands ---

#[tauri::command]
pub async fn authorize_folder(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    // In Tauri v2 with tauri-plugin-dialog
    let folder = app_handle.dialog().file().blocking_pick_folder();

    match folder {
        Some(path) => {
            // path is FilePath which usually can display as string.
            // On v2, it's often a FilePath struct. We need to convert it.
            let path_buf = path.into_path().map_err(|e| e.to_string())?;
            // Let's assume into_path_buf works or we use to_string methods
            // Actually, `blocking_pick_folder` returns `Option<FilePath>`.
            // `FilePath` usually impls `Into<PathBuf>`.
            
            let path_id = uuid::Uuid::new_v4().to_string();
            let mut paths = state.authorized_paths.write().await;
            paths.insert(path_id.clone(), path_buf);
            Ok(path_id)
        }
        None => Err("No folder selected".to_string()),
    }
}

#[tauri::command]
pub async fn revoke_folder(
    state: tauri::State<'_, AppState>,
    path_id: String,
) -> Result<(), String> {
    let mut paths = state.authorized_paths.write().await;
    paths.remove(&path_id);
    Ok(())
}

#[tauri::command]
pub async fn get_authorized_folders(
    state: tauri::State<'_, AppState>,
) -> Result<std::collections::HashMap<String, String>, String> {
    let paths = state.authorized_paths.read().await;
    let result: std::collections::HashMap<String, String> = paths
        .iter()
        .map(|(k, v)| (k.clone(), v.to_string_lossy().to_string()))
        .collect();
    Ok(result)
}
