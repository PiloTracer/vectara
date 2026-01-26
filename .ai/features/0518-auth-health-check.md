# Feature: Auth Service Health Check

## Goal
Prevent users from seeing "Connection Refused" by detecting if the Auth Service (Keycloak) is reachable before they try to log in.

## Implementation Details

### 1. Health Proxy Endpoint (`src/app/api/auth/check/route.ts`)
Since the browser can't always call `localhost:18090` (due to CORS or network variances), we'll implement a server-side check.
The Next.js server (inside Docker) can definitely reach `host.docker.internal:18090`.
- **GET Endpoint**:
  - Validates connection to Keycloak.
  - Returns `{ status: 'ok' }` or `{ status: 'error' }`.
  - Also verifies if the `vectara` client exists (optional but good).

### 2. Frontend Logic (`src/app/page.tsx`)
- On load (or server render), call the health check.
- **If Healthy**: Show "Sign In with SSO".
- **If Unhealthy**: Show "⚠️ Authentication Unavailable" with a "Retry" button.

### 3. Error Handling
This "handles it properly" by informing the user *why* they can't log in ("Auth service down") rather than crashing the browser tab.

## Verification
1. Stop Keycloak (if possible) or block port.
2. Refresh Web App.
3. Verify "Authentication Unavailable" message appears.
