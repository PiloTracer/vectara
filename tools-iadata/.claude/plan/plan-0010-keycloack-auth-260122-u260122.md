# Plan 0010: Keycloak Authentication Integration

## Context
This plan details the integration of "Tools IAM" (Keycloak) into the **Tools IADATA** system. It bridges the `front-dl` (Next.js) and `back-dl` (FastAPI) components using OpenID Connect (OIDC).

## Configuration Strategy
The system uses a split configuration model where the "Base URL" and "Realm" are separate, allowing for flexible deployment.

**Environment Variables**:
- `AUTH_ISSUER_BASE`: The base URL of the Keycloak server (e.g., `http://localhost:18090`).
- `AUTH_REALM`: The specific realm name (e.g., `my-realm`).
- `AUTH_CLIENT_ID`: The OIDC Client ID.
- `AUTH_CLIENT_SECRET`: The OIDC Client Secret.

**Constructed Issuer URL**:
The application must dynamically construct the full Issuer URL:
```javascript
// Constructed Issuer URL
const issuer = `${process.env.AUTH_ISSUER_BASE}/realms/${process.env.AUTH_REALM}`;
```

## Frontend Implementation (`front-dl`)
### 1. Dependencies
- Install `next-auth@beta` (v5) or `next-auth` (v4) as appropriate.
- *Note*: Using standard v5 patterns for App Router.

### 2. Authentication Config (`src/auth.ts`)
- Implement `NextAuth` config.
- **Provider**: `KeycloakProvider`.
- **Callbacks**:
    - `jwt`: Capture `roles` from the Access Token.
    - `session`: Pass `roles` to the Client Session.
- **Role Mapping**:
    - `realm_access.roles` -> `session.user.roles`.

### 3. Middleware (`src/middleware.ts`)
- Protect all routes under `/dashboard` (or equivalent).
- Redirect unauthenticated users to Keycloak.

## Backend Implementation (`back-dl`)
### 1. Behaviors
- `python-jose[cryptography]`: For JWT decoding/validation.
- `fastapi-security`: For `HTTPBearer`.

### 2. Dependency Injection (`app/dependencies/auth.py`)
- `verify_token`:
    - Fetch OIDC Discovery Config from `${AUTH_ISSUER_BASE}/realms/${AUTH_REALM}/.well-known/openid-configuration`.
    - Retrieve Public Keys (JWKS).
    - Validate Token Signature.
    - **Guard**: Reject if validation fails.

### 3. Role Validation
- Implement dependency `require_role(role_name)`:
    - Checks if `token.conf.resource_access` or `token.realm_access` contains the required role.

## User Flows
1.  **Login**: User hits `/`, redirects to Keycloak, authenticates, returns to App.
2.  **API Request**: Frontend attaches `Authorization: Bearer <access_token>` to requests.
3.  **Logout**: Frontend calls sign-out, which also triggers OIDC end-session endpoint.
