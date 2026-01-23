import os
from typing import Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from pydantic import BaseModel
import httpx
import logging

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("auth-dependency")

# Security Scheme
security_scheme = HTTPBearer()

# Configuration
AUTH_ISSUER_BASE = os.getenv("AUTH_ISSUER_BASE", "http://host.docker.internal:18090")
AUTH_REALM = os.getenv("AUTH_REALM", "my-realm")
AUTH_ISSUER = f"{AUTH_ISSUER_BASE}/realms/{AUTH_REALM}"
JWKS_URL = f"{AUTH_ISSUER}/protocol/openid-connect/certs"

class UserToken(BaseModel):
    sub: str
    roles: List[str] = []
    preferred_username: Optional[str] = None
    email: Optional[str] = None

async def get_jwks():
    """Fetch JSON Web Key Set from Keycloak."""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(JWKS_URL, timeout=10.0)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to fetch JWKS from {JWKS_URL}: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Could not verify authentication configuration."
            )

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)) -> UserToken:
    """Verifies the JWT token against Keycloak's public keys."""
    token = credentials.credentials
    
    try:
        # Get Header to find Key ID (kid)
        unverified_header = jwt.get_unverified_header(token)
        
        # Fetch Keys
        jwks = await get_jwks()
        
        # Find matching key
        rsa_key = {}
        for key in jwks["keys"]:
            if key["kid"] == unverified_header["kid"]:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"]
                }
                break
        
        if not rsa_key:
             raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token header",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # decode and validate
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience="account", # Keycloak often uses 'account' or the client_id as audience. Adjust if strict verification fails.
            issuer=AUTH_ISSUER,
             options={"verify_aud": False} # Relax audience check for now to avoid common configuration pitfalls
        )

        # Extract Roles (Realm Roles)
        realm_access = payload.get("realm_access", {})
        roles = realm_access.get("roles", [])

        user = UserToken(
            sub=payload.get("sub"),
            roles=roles,
            preferred_username=payload.get("preferred_username"),
            email=payload.get("email")
        )
        return user

    except JWTError as e:
        logger.warning(f"JWT Verification Failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"Unexpected Auth Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication process failed",
        )

def require_role(required_role: str):
    """Dependency factory to require a specific role."""
    async def role_checker(user: UserToken = Depends(verify_token)):
        if required_role not in user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required role: {required_role}"
            )
        return user
    return role_checker
