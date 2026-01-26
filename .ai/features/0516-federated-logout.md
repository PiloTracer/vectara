# Feature: Federated Logout (Keycloak)

## Goal
Ensure that clicking "Sign Out" clears the session **both** locally (Next.js) AND remotely (Keycloak). This prevents the "Sign In with SSO" button from auto-logging in the next user immediately.

## Proposed Changes

### 1. Capture ID Token (`tools-iadata/front-dl/src/auth.ts`)
We need the `id_token` to hint Keycloak which session to kill (avoiding the "Confirm Logout" prompt).
- **Update `jwt` callback**: Save `account.id_token` to `token.idToken`.
- **Update `session` callback**: Pass `token.idToken` to `session.idToken` (if safe) or use it server-side.

### 2. Implement Federated Logout Action (`tools-iadata/front-dl/src/app/page.tsx`)
Replace the standard `signOut()` call with a sequence:
- **Step 1**: Call `signOut({ redirect: false })` to clear local cookie.
- **Step 2**: Construct Keycloak Logout URL.
  - URL: `${AUTH_ISSUER_BASE}/realms/${AUTH_REALM}/protocol/openid-connect/logout`
  - Params: `post_logout_redirect_uri` (back to localhost:13000), `id_token_hint` (from session).
- **Step 3**: Redirect browser to that URL.

## Verification Plan
1.  **Manual Test**:
    - Login via SSO.
    - Click "Sign Out".
    - **Observe**: Redirects to Keycloak -> Keycloak clears session -> Redirects back to App.
    - Click "Sign In with SSO".
    - **Observe**: PROMPTS for credentials (username/password), instead of auto-login.
