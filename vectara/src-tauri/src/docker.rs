use std::process::Command;
use crate::config::get_app_mode;
use std::fs;
use std::path::PathBuf;

// Status Enum
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq)]
pub enum DockerState {
    Running,
    Stopped,
    Starting,
    Error(String),
}

// Reuse config logic to find paths
fn resolve_paths(mode: &str) -> Option<(PathBuf, PathBuf)> {
    // Attempt to locate 'tools-iadata'
    let root_candidates = vec![
        "../tools-iadata",       // sibling of vectara
        "../../tools-iadata",    // sibling of vectara/src-tauri
    ];

    let mut services_path = PathBuf::new();
    let mut found = false;
    for rel in root_candidates {
        if let Ok(p) = fs::canonicalize(rel) {
            if p.exists() {
                services_path = p;
                found = true;
                break;
            }
        }
    }
    
    if !found { return None; }

    let compose_file_name = if mode == "dev" { "docker-compose.dev.yml" } else { "docker-compose.prd.yml" };
    let env_file_name = if mode == "dev" { ".env.dev" } else { ".env.prd" };

    Some((services_path.join(compose_file_name), services_path.join(env_file_name)))
}

#[tauri::command]
pub async fn check_docker_status() -> Result<DockerState, String> {
    let mode = get_app_mode().map_err(|e| e)?
        .ok_or("Mode not set".to_string())?;

    let (compose_path, env_path) = resolve_paths(&mode).ok_or("Could not find tools-iadata".to_string())?;
    
    // Offload blocking command to thread pool
    let output = tauri::async_runtime::spawn_blocking(move || {
        Command::new("docker")
            .arg("compose")
            .arg("-f")
            .arg(&compose_path)
            .arg("--env-file")
            .arg(&env_path)
            .arg("ps")
            .arg("--format")
            .arg("json")
            .output()
    }).await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| format!("Failed to run docker: {}", e))?;

    if !output.status.success() {
         return Ok(DockerState::Stopped);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    if stdout.trim().is_empty() || stdout.contains("[]") {
        return Ok(DockerState::Stopped);
    }
    
    Ok(DockerState::Running)
}

#[tauri::command]
pub async fn start_docker() -> Result<DockerState, String> {
    let mode = get_app_mode().map_err(|e| e)?
        .ok_or("Mode not set".to_string())?;

    let (compose_path, env_path) = resolve_paths(&mode).ok_or("Could not find tools-iadata".to_string())?;

    // Attempt UP in background
    let output = tauri::async_runtime::spawn_blocking(move || {
        Command::new("docker")
            .arg("compose")
            .arg("-f")
            .arg(&compose_path)
            .arg("--env-file")
            .arg(&env_path)
            .arg("up")
            .arg("-d")
            .output()
    }).await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| format!("Failed to spawn docker: {}", e))?;

    if output.status.success() {
        Ok(DockerState::Starting)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Ok(DockerState::Error(stderr.to_string()))
    }
}

#[tauri::command]
pub async fn stop_docker() -> Result<(), String> {
    let mode = match get_app_mode() {
        Ok(Some(m)) => m,
        _ => return Ok(()), // If no mode set, nothing to stop
    };

    if let Some((compose_path, env_path)) = resolve_paths(&mode) {
         // Offload blocking command to thread pool
        let _ = tauri::async_runtime::spawn_blocking(move || {
            Command::new("docker")
                .arg("compose")
                .arg("-f")
                .arg(&compose_path)
                .arg("--env-file")
                .arg(&env_path)
                .arg("down")
                .output()
        }).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn restart_docker() -> Result<DockerState, String> {
    let mode = get_app_mode().map_err(|e| e)?
        .ok_or("Mode not set".to_string())?;

    let (compose_path, env_path) = resolve_paths(&mode).ok_or("Could not find tools-iadata".to_string())?;

    // Offload blocking command to thread pool
    let output = tauri::async_runtime::spawn_blocking(move || {
        // 1. Down
        let _ = Command::new("docker")
            .arg("compose")
            .arg("-f")
            .arg(&compose_path)
            .arg("--env-file")
            .arg(&env_path)
            .arg("down")
            .output();
        
        // 2. Up
        Command::new("docker")
            .arg("compose")
            .arg("-f")
            .arg(&compose_path)
            .arg("--env-file")
            .arg(&env_path)
            .arg("up")
            .arg("-d")
            .output()
    }).await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| format!("Failed to spawn docker: {}", e))?;

    if output.status.success() {
        Ok(DockerState::Starting)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Ok(DockerState::Error(stderr.to_string()))
    }
}

#[tauri::command]
pub async fn get_docker_logs() -> Result<String, String> {
    let mode = match get_app_mode() {
        Ok(Some(m)) => m,
        _ => return Ok("".to_string()),
    };

    let (compose_path, env_path) = match resolve_paths(&mode) {
        Some(p) => p,
        None => return Ok("".to_string()),
    };

    let output = tauri::async_runtime::spawn_blocking(move || {
        Command::new("docker")
            .arg("compose")
            .arg("-f")
            .arg(&compose_path)
            .arg("--env-file")
            .arg(&env_path)
            .arg("logs")
            .arg("--tail")
            .arg("50")
            .output()
    }).await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| format!("Failed to get logs: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    
    // Combine stdout and stderr
    Ok(format!("{}\n{}", stdout, stderr))
}
