// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

mod config;
mod docker;

use tauri::menu::{Menu, MenuItem};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle();
            let menu = Menu::new(handle)?;
            
            // File Menu
            let file_menu = tauri::menu::Submenu::new(handle, "File", true)?;
            let home_item = MenuItem::new(handle, "Home / Reset", true, Some("home"))?;
            let settings_item = MenuItem::new(handle, "Settings", true, Some("settings"))?;
            let quit_item = MenuItem::new(handle, "Quit", true, None::<&str>)?;
            
            file_menu.append(&home_item)?;
            file_menu.append(&settings_item)?;
            file_menu.append(&quit_item)?;
            
            menu.append(&file_menu)?;
            
            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| {
                if event.id() == home_item.id() {
                    println!("Resetting Application State...");
                    // 1. Reset Config so Gatekeeper doesn't auto-redirect
                    // We need to call the internal logic of reset_app_mode
                    let _ = config::delete_config_file(); 

                    // 2. Navigate window to internal app
                    if let Some(window) = app_handle.get_webview_window("main") {
                        println!("Navigating to Gatekeeper...");
                        
                        #[cfg(debug_assertions)]
                        let _ = window.eval("window.location.href = 'http://localhost:1420/';");
                        
                        #[cfg(not(debug_assertions))]
                        let _ = window.eval("window.location.href = 'tauri://localhost/index.html';");
                    }
                } else if event.id() == settings_item.id() {
                    println!("Opening Settings...");
                     if let Some(window) = app_handle.get_webview_window("main") {
                        // Force navigation to Settings hash
                        #[cfg(debug_assertions)]
                        let _ = window.eval("window.location.href = 'http://localhost:1420/#/settings';");
                        
                        #[cfg(not(debug_assertions))]
                        let _ = window.eval("window.location.href = 'tauri://localhost/index.html#/settings';");
                    }
                } else if event.id() == quit_item.id() {
                    tauri::async_runtime::block_on(async { let _ = docker::stop_docker().await; });
                    app_handle.exit(0);
                }
            });

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            config::check_env_config,
            config::set_app_mode,
            config::get_app_mode,
            config::get_all_env_vars,

            config::update_env_var,
            config::reset_app_mode,
            docker::check_docker_status,
            docker::start_docker,
            docker::stop_docker,
            docker::restart_docker,
            docker::get_docker_logs
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, event| {
        if let tauri::RunEvent::ExitRequested { .. } = event {
            println!("App exiting. ensuring docker is stopped...");
            tauri::async_runtime::block_on(async {
                let _ = docker::stop_docker().await;
            });
        }
    });
}
