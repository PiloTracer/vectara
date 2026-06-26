# Fix: Restore Keycloak SSO

## Goal
Restore the missing authentication service on port 18090 so "Login with SSO" works.

## Implementation Details

### 1. Realm Configuration (`tools-iadata/keycloak/realm-export.json`)
Since we lost the database, we must re-declare the state. We will generate a realm export that defines:
- Realm: `master` (as per .env)
- Client: `vectara`
- Secret: `udBccnk1QVeN5I71wgj3NdyPUONACLuh` (from .env)
- Redirect URIs: `http://localhost:13000/*` (Frontend), `http://localhost:1420/*` (Tauri)
- Web Origins: `*` (for dev)

### 2. Docker Service (`docker-compose.dev.yml`)
Add `keycloak` service:
- Image: `quay.io/keycloak/keycloak:24.0.0`
- Command: `start-dev --import-realm`
- Volumes: Mount `./keycloak/realm-export.json:/opt/keycloak/data/import/realm.json`
- Ports: `18090:8080`

### 3. Verification
- `curl http://localhost:18090/realms/master` should return JSON.
- "Login with SSO" should redirect to Keycloak login page.
