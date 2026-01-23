use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, Runtime};

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

const CONFIG_FILE_NAME: &str = "app_config.json";

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
    match load_config() {
        Ok(Some(cfg)) => Ok(Some(cfg.environment)),
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn check_env_config(app: AppHandle) -> Result<ConfigStatus, String> {
    // 1. Get Mode
    let mode = match load_config() {
        Ok(Some(cfg)) => cfg.environment,
        Ok(None) => return Err("Environment not set.".to_string()),
        Err(e) => return Err(e.to_string()),
    };

    // 2. Resolve Paths
    // We assume `tools-iadata` is a sibling of the `vectara` root or `datalake` root.
    // In dev, we can try to traverse up.
    // CAUTION: In production build, these paths might differ. For now, optimizing for Dev/Source.
    
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

    // 3. Schema Check
    println!("Checking Schema: {:?}", schema_file);
    let schema_keys = parse_env_keys(&schema_file)?;
    
    // 4. Runtime Validation
    println!("Checking Target: {:?}", target_file);
    let target_vars = parse_env_vars(&target_file)?; // Returns Map or List of present keys

    let mut missing_keys = Vec::new();
    for key in schema_keys {
        if !target_vars.contains(&key) {
            missing_keys.push(key);
        }
        // Could also check for empty values here if needed
    }

    // 5. Determine URL
    // Parse FRONT_PORT from target vars to build dynamic URL?
    // For simplicity, let's grep or parse.
    // But parse_env_vars just got keys. Let's really parse.
    let target_map = parse_env_map(&target_file)?;
    let front_port = target_map.get("FRONT_PORT").map(|s| s.as_str()).unwrap_or("3000"); // Default 3000
    
    let docker_url = format!("http://localhost:{}", front_port);

    Ok(ConfigStatus {
        valid: missing_keys.is_empty(),
        missing_keys,
        environment: mode,
        docker_url,
    })
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
    // For now, store in current working directory of binary or a known relative path.
    // In production, should use tauri::api::path::app_data_dir.
    Path::new("app_config.json").to_path_buf()
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
