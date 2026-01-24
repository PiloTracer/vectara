"""
OAuth routes for Google Drive and SharePoint authentication.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db import get_db
from app.models.resources import DataSource, OAuthToken
from pydantic import BaseModel
from typing import Optional
import uuid
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/oauth",
    tags=["oauth"]
)

# Environment variables for OAuth
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/oauth/google/callback")

MS_CLIENT_ID = os.getenv("MS_CLIENT_ID", "")
MS_CLIENT_SECRET = os.getenv("MS_CLIENT_SECRET", "")
MS_TENANT_ID = os.getenv("MS_TENANT_ID", "common")
MS_REDIRECT_URI = os.getenv("MS_REDIRECT_URI", "http://localhost:8000/oauth/microsoft/callback")


class OAuthInitRequest(BaseModel):
    source_id: uuid.UUID
    return_url: Optional[str] = None


class OAuthStatus(BaseModel):
    connected: bool
    provider: Optional[str] = None
    expires_at: Optional[str] = None


# --- Google OAuth ---

@router.post("/google/init")
async def init_google_oauth(request: OAuthInitRequest):
    """
    Initialize Google OAuth flow.
    Returns the authorization URL to redirect the user to.
    """
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    
    from urllib.parse import urlencode
    
    # Store source_id in state for callback
    state = f"{request.source_id}"
    if request.return_url:
        state += f"|{request.return_url}"
    
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/drive.readonly",
        "access_type": "offline",
        "prompt": "consent",
        "state": state
    }
    
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    return {"auth_url": auth_url}


@router.get("/google/callback")
async def google_oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Handle Google OAuth callback.
    Exchanges code for tokens and stores them.
    """
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    
    import httpx
    from datetime import datetime, timedelta
    
    # Parse state
    parts = state.split("|")
    source_id = uuid.UUID(parts[0])
    return_url = parts[1] if len(parts) > 1 else "/dashboard/sources"
    
    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": GOOGLE_REDIRECT_URI
            }
        )
        
        if response.status_code != 200:
            logger.error(f"Google token exchange failed: {response.text}")
            raise HTTPException(status_code=400, detail="Failed to exchange authorization code")
        
        tokens = response.json()
    
    # Calculate expiry
    expires_in = tokens.get("expires_in", 3600)
    expires_at = (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()
    
    # Store or update token
    result = await db.execute(
        select(OAuthToken).where(OAuthToken.source_id == source_id)
    )
    existing = result.scalars().first()
    
    if existing:
        existing.access_token = tokens["access_token"]
        existing.refresh_token = tokens.get("refresh_token", existing.refresh_token)
        existing.expires_at = expires_at
    else:
        oauth_token = OAuthToken(
            source_id=source_id,
            provider="GOOGLE_DRIVE",
            access_token=tokens["access_token"],
            refresh_token=tokens.get("refresh_token"),
            expires_at=expires_at,
            scopes=["https://www.googleapis.com/auth/drive.readonly"]
        )
        db.add(oauth_token)
    
    await db.commit()
    
    return RedirectResponse(url=return_url)


# --- Microsoft/SharePoint OAuth ---

@router.post("/microsoft/init")
async def init_microsoft_oauth(request: OAuthInitRequest):
    """
    Initialize Microsoft OAuth flow for SharePoint access.
    """
    if not MS_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Microsoft OAuth not configured")
    
    from urllib.parse import urlencode
    
    state = f"{request.source_id}"
    if request.return_url:
        state += f"|{request.return_url}"
    
    params = {
        "client_id": MS_CLIENT_ID,
        "redirect_uri": MS_REDIRECT_URI,
        "response_type": "code",
        "scope": "https://graph.microsoft.com/Sites.Read.All offline_access",
        "state": state
    }
    
    auth_url = f"https://login.microsoftonline.com/{MS_TENANT_ID}/oauth2/v2.0/authorize?{urlencode(params)}"
    return {"auth_url": auth_url}


@router.get("/microsoft/callback")
async def microsoft_oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Handle Microsoft OAuth callback.
    """
    if not MS_CLIENT_ID or not MS_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Microsoft OAuth not configured")
    
    import httpx
    from datetime import datetime, timedelta
    
    parts = state.split("|")
    source_id = uuid.UUID(parts[0])
    return_url = parts[1] if len(parts) > 1 else "/dashboard/sources"
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"https://login.microsoftonline.com/{MS_TENANT_ID}/oauth2/v2.0/token",
            data={
                "client_id": MS_CLIENT_ID,
                "client_secret": MS_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": MS_REDIRECT_URI
            }
        )
        
        if response.status_code != 200:
            logger.error(f"Microsoft token exchange failed: {response.text}")
            raise HTTPException(status_code=400, detail="Failed to exchange authorization code")
        
        tokens = response.json()
    
    expires_in = tokens.get("expires_in", 3600)
    expires_at = (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()
    
    result = await db.execute(
        select(OAuthToken).where(OAuthToken.source_id == source_id)
    )
    existing = result.scalars().first()
    
    if existing:
        existing.access_token = tokens["access_token"]
        existing.refresh_token = tokens.get("refresh_token", existing.refresh_token)
        existing.expires_at = expires_at
    else:
        oauth_token = OAuthToken(
            source_id=source_id,
            provider="SHAREPOINT",
            access_token=tokens["access_token"],
            refresh_token=tokens.get("refresh_token"),
            expires_at=expires_at,
            scopes=["https://graph.microsoft.com/Sites.Read.All"]
        )
        db.add(oauth_token)
    
    await db.commit()
    
    return RedirectResponse(url=return_url)


# --- Status endpoints ---

@router.get("/status/{source_id}", response_model=OAuthStatus)
async def get_oauth_status(source_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Check if a data source has active OAuth credentials.
    """
    result = await db.execute(
        select(OAuthToken).where(OAuthToken.source_id == source_id)
    )
    token = result.scalars().first()
    
    if not token:
        return OAuthStatus(connected=False)
    
    return OAuthStatus(
        connected=True,
        provider=token.provider,
        expires_at=token.expires_at
    )


@router.delete("/disconnect/{source_id}")
async def disconnect_oauth(source_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Remove OAuth tokens for a data source.
    """
    result = await db.execute(
        select(OAuthToken).where(OAuthToken.source_id == source_id)
    )
    token = result.scalars().first()
    
    if token:
        await db.delete(token)
        await db.commit()
    
    return {"status": "disconnected"}
