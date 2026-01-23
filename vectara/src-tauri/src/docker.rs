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
    
    // Command: docker compose -f ... --env-file ... ps --format json
    // Simplified: Just check exit code or output
    
    // We want to check if the *entire stack* is up. 
    // Specifically "front-dl" which is our target.
    // Let's check for the frontend container specifically.
    // However, project name might vary. Let's just run 'ps' and see if services are listed.
    
    let output = Command::new("docker")
        .arg("compose")
        .arg("-f")
        .arg(&compose_path)
        .arg("--env-file")
        .arg(&env_path)
        .arg("ps")
        .arg("--format")
        .arg("json")
        .output()
        .map_err(|e| format!("Failed to run docker: {}", e))?;

    if !output.status.success() {
         return Ok(DockerState::Stopped); // Or error, but likely just not running configs match
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    // If output is empty or json list empty, it's stopped.
    if stdout.trim().is_empty() || stdout.contains("[]") {
        return Ok(DockerState::Stopped);
    }
    
    // Naive check: if we see "front-dl" or "frontend" logic in running state
    // For now, if PS returns services, we assume Running.
    // A better check would be to parse the JSON and check 'State' == 'running' for all.
    
    Ok(DockerState::Running)
}

#[tauri::command]
pub async fn start_docker() -> Result<DockerState, String> {
    let mode = get_app_mode().map_err(|e| e)?
        .ok_or("Mode not set".to_string())?;

    let (compose_path, env_path) = resolve_paths(&mode).ok_or("Could not find tools-iadata".to_string())?;

    // Attempt UP
    let output = Command::new("docker")
        .arg("compose")
        .arg("-f")
        .arg(&compose_path)
        .arg("--env-file")
        .arg(&env_path)
        .arg("up")
        .arg("-d")
        // .arg("--build") // Make optional? Script does it. Let's do it to be safe.
        .output()
        .map_err(|e| format!("Failed to spawn docker: {}", e))?;

    if output.status.success() {
        Ok(DockerState::Starting)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Ok(DockerState::Error(stderr.to_string()))
    }
}
