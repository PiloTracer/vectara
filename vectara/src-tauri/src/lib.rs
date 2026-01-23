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
    tauri::Builder::default()
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
                    println!("Resetting to Home...");
                    if let Some(window) = app_handle.get_webview_window("main") {
                         // Reset hash and location
                        let _ = window.eval("window.location.hash = ''; window.location.href = '/'");
                    }
                } else if event.id() == settings_item.id() {
                    println!("Opening Settings...");
                     if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.eval("window.location.hash = '#/settings'");
                    }
                } else if event.id() == quit_item.id() {
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
            docker::start_docker
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
