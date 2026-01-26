use std::process::Command;
use crate::config::get_app_mode;
use std::fs;
use std::path::PathBuf;

// Status Enum
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq)]
pub struct ContainerInfo {
    pub service: String,
    pub state: String, // "running", "exited"
    pub health: String, // "healthy", "starting", "unhealthy", ""
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq)]
pub struct DetailedDockerState {
    pub status: String, // "Running", "Starting", "Stopped", "Error"
    pub error: Option<String>,
    pub services: Vec<ContainerInfo>,
}

// Compatibility alias for other functions if needed, though we will update them to just return strings or simple logic
// Actually, start/restart/stop return the same type, so we must update them or make them return Generic/Detailed.
// Let's make them return DetailedDockerState as well for consistency.

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

    let compose_path = services_path.join(compose_file_name);
    let env_path = services_path.join(env_file_name);

    // Helper to strip UNC prefix on Windows
    fn clean_path(p: PathBuf) -> PathBuf {
        #[cfg(target_os = "windows")]
        {
            let s = p.to_string_lossy().to_string();
            if s.starts_with(r"\\?\") {
                return PathBuf::from(&s[4..]);
            }
        }
        p
    }

    Some((clean_path(compose_path), clean_path(env_path)))
}

#[tauri::command]
pub async fn check_docker_status(app: tauri::AppHandle) -> Result<DetailedDockerState, String> {
    let mode = get_app_mode(app).map_err(|e| e)?
        .ok_or("Mode not set".to_string())?;

    let (compose_path, env_path) = resolve_paths(&mode).ok_or("Could not find tools-iadata".to_string())?;
    
    // Offload blocking command to thread pool
    let output = tauri::async_runtime::spawn_blocking(move || {
        Command::new("docker")
            .arg("compose")
            .arg("--ansi")
            .arg("always")
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
         return Ok(DetailedDockerState {
             status: "Stopped".into(),
             error: None,
             services: vec![]
         });
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    if stdout.trim().is_empty() || stdout.contains("[]") {
        return Ok(DetailedDockerState {
             status: "Stopped".into(),
             error: None,
             services: vec![]
         });
    }

    // Parse JSON lines to check service states
    let lines: Vec<&str> = stdout.lines().collect();
    let mut services_info = Vec::new();
    let mut all_critical_healthy = true;
    let mut any_running = false;

    for line in lines {
        if let Ok(container) = serde_json::from_str::<serde_json::Value>(line) {
            let service_name = container.get("Service").and_then(|s| s.as_str()).unwrap_or("unknown").to_string();
            let state = container.get("State").and_then(|s| s.as_str()).unwrap_or("unknown").to_string();
            let status_str = container.get("Status").and_then(|s| s.as_str()).unwrap_or("").to_string();
            
            // Extract health from status string e.g. "Up 2 minutes (healthy)"
            let health = if status_str.contains("(healthy)") {
                "healthy".to_string()
            } else if status_str.contains("(starting)") {
                "starting".to_string()
            } else if status_str.contains("(unhealthy)") {
                "unhealthy".to_string()
            } else {
                "".to_string()
            };

            if state == "running" {
                any_running = true;
            }

            // Check Critical Services
            // back-dl, pg-dl, front-dl must be healthy (or running if no health check)
            // But pg-dl and back-dl HAVE healthchecks.
            if (service_name == "back-dl" || service_name == "pg-dl") && health != "healthy" {
                all_critical_healthy = false;
            }
            
            // llm-init is special, it runs then exits. 
            // If it's running, we are definitely "Starting".
            if service_name == "llm-init" && state == "running" {
                all_critical_healthy = false; 
            }

            services_info.push(ContainerInfo {
                service: service_name,
                state,
                health
            });
        }
    }

    let global_status = if services_info.is_empty() {
        "Stopped"
    } else if all_critical_healthy {
        "Running"
    } else if any_running {
        "Starting"
    } else {
        "Stopped"
    };

    Ok(DetailedDockerState {
        status: global_status.into(),
        error: None,
        services: services_info
    })
}

#[tauri::command]
pub async fn start_docker(app: tauri::AppHandle) -> Result<DetailedDockerState, String> {
    use std::io::{BufRead, BufReader};
    use std::process::Stdio;
    use tauri::Emitter;


    let mode = get_app_mode(app.clone()).map_err(|e| e)?
        .ok_or("Mode not set".to_string())?;

    let (compose_path, env_path) = resolve_paths(&mode).ok_or("Could not find tools-iadata".to_string())?;

    // Check for Local LLM setting
    let use_local_llm = crate::config::get_env_var(&env_path, "USE_LOCAL_EMBEDDING")
        .map(|v| v.to_lowercase() == "true")
        .unwrap_or(false);

    let profiles = if use_local_llm { "local-llm" } else { "" };
    
    // Check for GPU setting
    let use_gpu = crate::config::get_env_var(&env_path, "USE_GPU")
        .map(|v| v.to_lowercase() == "true")
        .unwrap_or(false);

    let gpu_compose_path = compose_path.with_file_name("docker-compose.gpu.yml");
    
    // Clone for thread
    let compose_path_clone = compose_path.clone();
    let env_path_clone = env_path.clone();
    let profiles_str = profiles.to_string();
    let gpu_path_clone = gpu_compose_path.clone();
    let app_handle = app.clone();

    // Spawn blocking task to run docker compose up with streaming
    let result = tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = Command::new("docker");
        cmd.arg("compose")
            .arg("--ansi")
            .arg("always")
            .arg("-f")
            .arg(&compose_path_clone);
            
        if use_gpu {
            cmd.arg("-f").arg(&gpu_path_clone);
        }
            
        cmd.arg("--env-file")
            .arg(&env_path_clone)
            .env("COMPOSE_PROFILES", profiles_str)
            .arg("up")
            .arg("-d")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd.spawn()
            .map_err(|e| format!("Failed to spawn docker: {}", e))?;

        // Stream stdout
        if let Some(stdout) = child.stdout.take() {
            let app_h = app_handle.clone();
            std::thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines() {
                    if let Ok(l) = line {
                        let _ = app_h.emit("docker-event-log", l);
                    }
                }
            });
        }

        // Stream stderr
        if let Some(stderr) = child.stderr.take() {
            let app_h = app_handle.clone();
            std::thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines() {
                    if let Ok(l) = line {
                        let _ = app_h.emit("docker-event-log", l);
                    }
                }
            });
        }

        // Wait for completion
        let status = child.wait()
            .map_err(|e| format!("Failed to wait/run docker: {}", e))?;
            
        if status.success() {
            Ok(DetailedDockerState {
                status: "Starting".into(),
                error: None,
                services: vec![]
            })
        } else {
            Err("Docker command returned error code".to_string())
        }
    }).await
    .map_err(|e| format!("Task join error: {}", e))??;

    Ok(result)
}

#[tauri::command]
pub async fn stop_docker(app: tauri::AppHandle) -> Result<(), String> {
    let mode = match get_app_mode(app) {
        Ok(Some(m)) => m,
        _ => return Ok(()), // If no mode set, nothing to stop
    };

    if let Some((compose_path, env_path)) = resolve_paths(&mode) {
         // Offload blocking command to thread pool
        let _ = tauri::async_runtime::spawn_blocking(move || {
            Command::new("docker")
                .arg("compose")
                .arg("--ansi")
                .arg("always")
                .arg("-f")
                .arg(&compose_path)
                .arg("--env-file")
                .arg(&env_path)
                .arg("stop")
                .output()
        }).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn restart_docker(app: tauri::AppHandle) -> Result<DetailedDockerState, String> {
    let mode = get_app_mode(app).map_err(|e| e)?
        .ok_or("Mode not set".to_string())?;

    let (compose_path, env_path) = resolve_paths(&mode).ok_or("Could not find tools-iadata".to_string())?;

    // Offload blocking command to thread pool
    let output = tauri::async_runtime::spawn_blocking(move || {
        // 1. Down
        let _ = Command::new("docker")
            .arg("compose")
            .arg("--ansi")
            .arg("always")
            .arg("-f")
            .arg(&compose_path)
            .arg("--env-file")
            .arg(&env_path)
            .arg("stop")
            .output();
        
        // 2. Up
        Command::new("docker")
            .arg("compose")
            .arg("--ansi")
            .arg("always")
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
        Ok(DetailedDockerState {
            status: "Starting".into(),
            error: None,
            services: vec![]
        })
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Ok(DetailedDockerState {
            status: "Error".into(),
            error: Some(stderr.to_string()),
            services: vec![]
        })
    }
}

#[tauri::command]
pub async fn get_docker_logs(app: tauri::AppHandle) -> Result<String, String> {
    let mode = match get_app_mode(app) {
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
            .arg("--ansi")
            .arg("always")
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

#[tauri::command]
pub async fn pull_local_model(app: tauri::AppHandle, model: String) -> Result<String, String> {
    let mode = get_app_mode(app).map_err(|e| e)?
        .ok_or("Mode not set".to_string())?;

    let (compose_path, env_path) = resolve_paths(&mode).ok_or("Could not find tools-iadata".to_string())?;

    let model_clone = model.clone();
    // Offload blocking command
    // docker compose -f ... exec llm-dl ollama pull <model>
    let output = tauri::async_runtime::spawn_blocking(move || {
        Command::new("docker")
            .arg("compose")
            .arg("--ansi")
            .arg("always")
            .arg("-f")
            .arg(&compose_path)
            .arg("--env-file")
            .arg(&env_path)
            .arg("exec")
            .arg("llm-dl")
            .arg("ollama")
            .arg("pull")
            .arg(&model_clone)
            .output()
    }).await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| format!("Failed to pull model: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    
    if output.status.success() {
         Ok(format!("Model '{}' pulled successfully.\n{}", model, stdout))
    } else {
         Err(format!("Failed to pull model '{}':\n{}", model, stderr))
    }
}
