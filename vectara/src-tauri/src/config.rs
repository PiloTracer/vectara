use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

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
pub fn set_app_mode(mode: String) -> Result<(), String> {
    if mode != "dev" && mode != "prd" {
        return Err("Invalid mode. Must be 'dev' or 'prd'.".to_string());
    }

    let config = AppModeConfig { environment: mode };
    save_config(&config).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_app_mode() -> Result<Option<String>, String> {
    println!("Debug: get_app_mode called");
    match load_config() {
        Ok(Some(cfg)) => {
            println!("Debug: get_app_mode found: {}", cfg.environment);
            Ok(Some(cfg.environment))
        },
        Ok(None) => {
            println!("Debug: get_app_mode found None");
            Ok(None)
        },
        Err(e) => {
            println!("Debug: get_app_mode error: {}", e);
            Err(e.to_string())
        },
    }
}

#[tauri::command]
pub fn reset_app_mode() -> Result<(), String> {
    let path = get_config_path();
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn check_env_config(_app: AppHandle) -> Result<ConfigStatus, String> {
    println!("Debug: check_env_config called");
    // 1. Get Mode
    let mode = match load_config() {
        Ok(Some(cfg)) => {
            println!("Debug: load_config returned mode: {}", cfg.environment);
            cfg.environment
        },
        Ok(None) => {
            println!("Debug: load_config returned None");
            return Err("Environment not set.".to_string());
        },
        Err(e) => {
             println!("Debug: load_config error: {}", e);
             return Err(e.to_string());
        },
    };

    println!("Debug: resolving env paths for mode: {}", mode);
    let (services_path, _, target_file) = resolve_env_paths(&mode)?;
    println!("Debug: paths resolved: {:?}", services_path);
    let schema_file = services_path.join(".env.example");

    // 3. Schema Check
    let schema_keys = parse_env_keys(&schema_file)?;
    
    // 4. Runtime Validation
    let target_vars = parse_env_vars(&target_file)?;

    let mut missing_keys = Vec::new();
    for key in schema_keys {
        if !target_vars.contains(&key) {
            missing_keys.push(key);
        }
    }

    // 5. Determine URL
    let target_map = parse_env_map(&target_file)?;
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
pub fn get_all_env_vars() -> Result<std::collections::HashMap<String, String>, String> {
    let mode = match load_config() {
        Ok(Some(cfg)) => cfg.environment,
        Ok(None) => return Err("Environment not set.".to_string()),
        Err(e) => return Err(e.to_string()),
    };
    
    let (_, _, target_file) = resolve_env_paths(&mode)?;
    parse_env_map(&target_file)
}

#[tauri::command]
pub fn update_env_var(key: String, value: String) -> Result<(), String> {
    let mode = match load_config() {
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
    let new_content = new_lines.join("\n");
    fs::write(&target_file, new_content).map_err(|e| e.to_string())?;
    
    Ok(())
}

fn resolve_env_paths(mode: &str) -> Result<(PathBuf, PathBuf, PathBuf), String> {
     // Attempt to find project root by looking for 'tools-iadata'
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
    
    if !found {
        return Err("Could not locate 'tools-iadata' directory.".to_string());
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

fn parse_env_vars(path: &Path) -> Result<HashSet<String>, String> {
    let content = fs::read_to_string(path).map_err(|_| "Target env file missing".to_string())?; // Soft verify existence provided it fails gracefully
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

fn get_config_path() -> PathBuf {
    // Save to project root (../) to avoid triggering cargo-watch in src-tauri
    Path::new("../.app_config.json").to_path_buf()
}

fn save_config(config: &AppModeConfig) -> std::io::Result<()> {
    let json = serde_json::to_string_pretty(config)?;
    fs::write(get_config_path(), json)
}

fn load_config() -> std::io::Result<Option<AppModeConfig>> {
    let path = get_config_path();
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path)?;
    let config: AppModeConfig = serde_json::from_str(&content)?;
    Ok(Some(config))
}
