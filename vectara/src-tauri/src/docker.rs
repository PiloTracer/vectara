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
    let mode = get_app_mode(app).map_err(|e| e)?
        .ok_or("Mode not set".to_string())?;

    let (compose_path, env_path) = resolve_paths(&mode).ok_or("Could not find tools-iadata".to_string())?;

    // Check for Local LLM setting
    let use_local_llm = crate::config::get_env_var(&env_path, "USE_LOCAL_EMBEDDING")
        .map(|v| v.to_lowercase() == "true")
        .unwrap_or(false);

    let profiles = if use_local_llm { "local-llm" } else { "" };
    
    // Clone paths for async closures
    let compose_path_clone = compose_path.clone();
    let env_path_clone = env_path.clone();
    let profiles_str = profiles.to_string();

    // Phase 1: Pre-acquire LLM models if enabled
    if use_local_llm {
        let embed_model = crate::config::get_env_var(&env_path, "LOCAL_EMBEDDING_MODEL_NAME")
            .unwrap_or_else(|| "bge-m3".to_string());
        let chat_model = crate::config::get_env_var(&env_path, "LOCAL_MODEL_NAME")
            .unwrap_or_else(|| "qwen2.5:3b".to_string());
        
        let deploy_suffix = crate::config::get_env_var(&env_path, "DEPLOY_SUFFIX")
            .unwrap_or_else(|| "dev".to_string());
        let llm_container = format!("iadata_llm_{}", deploy_suffix);
        
        let cp = compose_path.clone();
        let ep = env_path.clone();
        let ps = profiles_str.clone();
        
        // Step 1: Start only llm-dl
        let _ = tauri::async_runtime::spawn_blocking(move || {
            Command::new("docker")
                .arg("compose")
                .arg("-f").arg(&cp)
                .arg("--env-file").arg(&ep)
                .env("COMPOSE_PROFILES", &ps)
                .arg("up").arg("-d").arg("llm-dl")
                .output()
        }).await;
        
        // Step 2: Wait for Ollama to be ready (up to 120s)
        let container = llm_container.clone();
        let ready = tauri::async_runtime::spawn_blocking(move || {
            for _ in 0..60 {
                let result = Command::new("docker")
                    .arg("exec").arg(&container)
                    .arg("curl").arg("-sf").arg("http://localhost:11434/api/tags")
                    .output();
                if let Ok(output) = result {
                    if output.status.success() {
                        return true;
                    }
                }
                std::thread::sleep(std::time::Duration::from_secs(2));
            }
            false
        }).await.unwrap_or(false);
        
        if ready {
            // Step 3: Pull models
            let container1 = llm_container.clone();
            let model1 = embed_model.clone();
            let _ = tauri::async_runtime::spawn_blocking(move || {
                Command::new("docker")
                    .arg("exec").arg(&container1)
                    .arg("ollama").arg("pull").arg(&model1)
                    .output()
                }).await;
            
            let container2 = llm_container.clone();
            let model2 = chat_model.clone();
            let _ = tauri::async_runtime::spawn_blocking(move || {
                Command::new("docker")
                    .arg("exec").arg(&container2)
                    .arg("ollama").arg("pull").arg(&model2)
                    .output()
            }).await;
        }
    }

    // Check for GPU setting
    let use_gpu = crate::config::get_env_var(&env_path, "USE_GPU")
        .map(|v| v.to_lowercase() == "true")
        .unwrap_or(false);

    let gpu_compose_path = compose_path.with_file_name("docker-compose.gpu.yml");
    let gpu_path_clone = gpu_compose_path.clone();

    // Phase 2: Start full stack
    let output = tauri::async_runtime::spawn_blocking(move || {
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
            .arg("-d");
        
        cmd.output()
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
                .arg("down")
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
            .arg("down")
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
