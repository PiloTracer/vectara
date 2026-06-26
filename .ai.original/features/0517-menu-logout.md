# Feature: Logout Menu Option (Revised)

## Goal
Add a "Logout" option that works even when the Tauri app is displaying the external Docker dashboard.

## Strategy
Since the Dashboard (Next.js) cannot receive Tauri events, the Rust backend will force the WebView to navigate to a logout endpoint.

## Implementation Details

### 1. Frontend Endpoint (`tools-iadata/front-dl/src/app/logout/route.ts`)
Create a Route Handler that:
- Reads the session.
- Constructs the Keycloak Logout URL.
- Clears the internal `next-auth` session.
- Redirects the browser to Keycloak (which then redirects back to the App Root).

### 2. Backend Logic (`src-tauri/src/lib.rs`)
Update `logout_item` handler:
- Emit `menu-logout` (for Gatekeeper, if listening).
- **CRITICAL**: Execute JS to check location or force navigation:
  ```rust
  window.eval("if (window.location.host.includes('13000')) { window.location.href = '/logout'; } else { window.location.reload(); }")
  ```

## Verification
- **Scenario A (Dashboard)**: Click Logout -> Navigates to `/logout` -> Keycloak -> Back to Login.
- **Scenario B (Gatekeeper)**: Click Logout -> Reloads/Resets state.
