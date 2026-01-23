use tauri::command;
use std::process::Command;

#[derive(serde::Serialize)]
pub struct GpuInfo {
    pub available: bool,
    pub name: Option<String>,
}

#[command]
pub fn detect_gpu() -> GpuInfo {
    // Try checking for nvidia-smi
    let output = Command::new("nvidia-smi")
        .args(["--query-gpu=name", "--format=csv,noheader"])
        .output();

    match output {
        Ok(o) if o.status.success() => {
            let name = String::from_utf8_lossy(&o.stdout).trim().to_string();
            GpuInfo {
                available: !name.is_empty(),
                name: if name.is_empty() { None } else { Some(name) },
            }
        }
        _ => {
            // Future: Check for AMD/ROCm or other accelerators
            GpuInfo {
                available: false,
                name: None,
            }
        }
    }
}
