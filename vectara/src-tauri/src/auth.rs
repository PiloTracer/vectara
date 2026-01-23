use tauri::command;

#[cfg(target_os = "linux")]
use pam::Authenticator;

#[cfg(target_os = "windows")]
use winapi::um::winbase::{LogonUserW, LOGON32_LOGON_INTERACTIVE, LOGON32_PROVIDER_DEFAULT};
#[cfg(target_os = "windows")]
use winapi::um::winnt::HANDLE;
#[cfg(target_os = "windows")]
use winapi::um::handleapi::CloseHandle;
#[cfg(target_os = "windows")]
use winapi::shared::minwindef::{BOOL, FALSE, TRUE};

#[command]
pub fn get_current_user() -> String {
    users::get_current_username()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

#[command]
pub fn authenticate_user(username: String, password: String) -> bool {
    #[cfg(target_os = "linux")]
    {
        let mut authenticator = match Authenticator::with_password("login") {
            Ok(a) => a,
            Err(_) => return false,
        };
        
        authenticator.get_handler().set_credentials(&username, &password);
        authenticator.authenticate().is_ok()
    }

    #[cfg(target_os = "windows")]
    {
        // Convert to wide strings for Windows API (null-terminated)
        let user: Vec<u16> = username.encode_utf16().chain(std::iter::once(0)).collect();
        let pass: Vec<u16> = password.encode_utf16().chain(std::iter::once(0)).collect();
        
        let mut token: HANDLE = std::ptr::null_mut();

        unsafe {
            let result: BOOL = LogonUserW(
                user.as_ptr(),
                std::ptr::null(), // Domain
                pass.as_ptr(),
                LOGON32_LOGON_INTERACTIVE,
                LOGON32_PROVIDER_DEFAULT,
                &mut token,
            );
            
            if result != FALSE {
                CloseHandle(token);
                return true;
            }
            false
        }
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    {
        println!("Warning: Authentication not implemented for this OS");
        false
    }
}
