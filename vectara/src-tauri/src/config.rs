use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppModeConfig {
    pub environment: String, // "dev" or "prd"
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ConfigStatus {
    pub valid: bool,
    pub missing_keys: Vec<String>,
    pub environment: String,
    pub docker_url: String, // e.g. "http://localhost:3000" or empty
}

// --- Commands ---

#[tauri::command]
pub fn set_app_mode(app: AppHandle, mode: String) -> Result<(), String> {
    if mode != "dev" && mode != "prd" {
        return Err("Invalid mode. Must be 'dev' or 'prd'.".to_string());
    }

    let config = AppModeConfig { environment: mode };
    save_config(&app, &config).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_app_mode(app: AppHandle) -> Result<Option<String>, String> {
    match load_config(&app) {
        Ok(Some(cfg)) => Ok(Some(cfg.environment)),
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn reset_app_mode(app: AppHandle) -> Result<(), String> {
    delete_config_file(&app)
}

pub fn delete_config_file(app: &AppHandle) -> Result<(), String> {
    let path = get_config_path(app)?;
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn check_env_config(app: AppHandle) -> Result<ConfigStatus, String> {
    // 1. Get Mode
    let mode = match load_config(&app) {
        Ok(Some(cfg)) => cfg.environment,
        Ok(None) => return Err("Environment not set.".to_string()),
        Err(e) => return Err(e.to_string()),
    };

    let (services_path, _, target_file) = resolve_env_paths(&mode)?;
    let schema_file = services_path.join(".env.example");

    // 3. Schema Check
    let schema_keys = parse_env_keys(&schema_file)?;
    
    // 4. Runtime Validation
    // Use map to check values
    let target_map = parse_env_map(&target_file)?;

    let mut missing_keys = Vec::new();
    for key in schema_keys {
        match target_map.get(&key) {
            Some(value) if !value.trim().is_empty() => {
                // Key exists and is not empty (after trim)
            },
            _ => {
                // Key missing OR value is empty/whitespace
                missing_keys.push(key);
            }
        }
    }

    // 5. Determine URL
    // target_map is already loaded
    let front_port = target_map.get("FRONT_PORT").map(|s| s.as_str()).unwrap_or("3000"); 
    let docker_url = format!("http://localhost:{}", front_port);

    Ok(ConfigStatus {
        valid: missing_keys.is_empty(),
        missing_keys,
        environment: mode,
        docker_url,
    })
}

#[tauri::command]
pub fn get_all_env_vars(app: AppHandle) -> Result<std::collections::HashMap<String, String>, String> {
    let mode = match load_config(&app) {
        Ok(Some(cfg)) => cfg.environment,
        Ok(None) => return Err("Environment not set.".to_string()),
        Err(e) => return Err(e.to_string()),
    };
    
    let (_, _, target_file) = resolve_env_paths(&mode)?;
    parse_env_map(&target_file)
}

#[tauri::command]
pub fn get_os_type() -> String {
    std::env::consts::OS.to_string()
}

#[tauri::command]
pub fn update_env_var(app: AppHandle, key: String, value: String) -> Result<(), String> {
    let mode = match load_config(&app) {
        Ok(Some(cfg)) => cfg.environment,
        Ok(None) => return Err("Environment not set.".to_string()),
        Err(e) => return Err(e.to_string()),
    };
    
    let (_, _, target_file) = resolve_env_paths(&mode)?;
    
    // Read existing content
    let content = fs::read_to_string(&target_file).map_err(|e| e.to_string())?;
    let mut new_lines = Vec::new();
    let mut found = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("#") || trimmed.is_empty() {
             new_lines.push(line.to_string());
             continue;
        }

        if let Some((k, _)) = trimmed.split_once('=') {
            if k.trim() == key {
                new_lines.push(format!("{}={}", key, value));
                found = true;
            } else {
                new_lines.push(line.to_string());
            }
        } else {
             new_lines.push(line.to_string());
        }
    }

    if !found {
        new_lines.push(format!("{}={}", key, value));
    }

    // Join with newlines
    let new_content = new_lines.join("\n") + "\n";
    let tmp_file = target_file.with_extension("env.tmp");
    fs::write(&tmp_file, &new_content).map_err(|e| e.to_string())?;
    fs::rename(&tmp_file, &target_file).map_err(|e| e.to_string())?;

    Ok(())
}

fn resolve_env_paths(mode: &str) -> Result<(PathBuf, PathBuf, PathBuf), String> {
    let mut root_candidates = vec![
        PathBuf::from("../tools-iadata"),
        PathBuf::from("../../tools-iadata"),
    ];

    // Also try resolving relative to the executable's location
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            root_candidates.push(exe_dir.join("../tools-iadata"));
            root_candidates.push(exe_dir.join("../../tools-iadata"));
        }
    }

    let mut services_path = PathBuf::new();
    let mut found = false;
    for rel in &root_candidates {
        if let Ok(p) = fs::canonicalize(rel) {
            if p.exists() {
                services_path = p;
                found = true;
                break;
            }
        }
    }
    
    if !found {
        return Err("Could not locate 'tools-iadata' directory. Searched multiple paths relative to CWD and executable.".to_string());
    }

    let schema_file = services_path.join(".env.example");
    let target_file_name = if mode == "dev" { ".env.dev" } else { ".env.prd" };
    let target_file = services_path.join(target_file_name);
    
    Ok((services_path, schema_file, target_file))
}


// --- Helpers ---

fn parse_env_keys(path: &Path) -> Result<HashSet<String>, String> {
    let content = fs::read_to_string(path).map_err(|e| format!("Failed to read {:?}: {}", path, e))?;
    let mut keys = HashSet::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('#') || trimmed.is_empty() {
            continue;
        }
        if let Some((key, _)) = trimmed.split_once('=') {
            keys.insert(key.trim().to_string());
        }
    }
    Ok(keys)
}



fn parse_env_map(path: &Path) -> Result<std::collections::HashMap<String, String>, String> {
     let content = fs::read_to_string(path).unwrap_or_default();
     let mut map = std::collections::HashMap::new();
     for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('#') || trimmed.is_empty() {
            continue;
        }
        if let Some((key, val)) = trimmed.split_once('=') {
            map.insert(key.trim().to_string(), val.trim().to_string());
        }
    }
    Ok(map)
}

fn get_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app.path().app_config_dir().map_err(|e| e.to_string())?;
    // Ensure dir exists
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }
    Ok(path.join("app_config.json"))
}

fn save_config(app: &AppHandle, config: &AppModeConfig) -> std::io::Result<()> {
    let path = get_config_path(app).map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
    let json = serde_json::to_string_pretty(config)?;
    fs::write(path, json)
}

fn load_config(app: &AppHandle) -> std::io::Result<Option<AppModeConfig>> {
    let path = match get_config_path(app) {
        Ok(p) => p,
        Err(_) => return Ok(None),
    };
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path)?;
    let config: AppModeConfig = serde_json::from_str(&content)?;
    Ok(Some(config))
}

pub fn get_env_var(env_path: &PathBuf, key: &str) -> Option<String> {
    if let Ok(content) = fs::read_to_string(env_path) {
        for line in content.lines() {
            if let Some((k, v)) = line.split_once('=') {
                if k.trim() == key {
                    return Some(v.trim().to_string());
                }
            }
        }
    }
    None
}
