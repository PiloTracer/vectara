from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(
    title="Tools IADATA API",
    description="Backend for CodeIva AI Data Lake System",
    version="0.1.0"
)

# CORS Configuration
origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "message": "Welcome to Tools IADATA API",
        "status": "online",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# --- Auth Integration Example ---
from app.dependencies.auth import verify_token, UserToken, require_role
from fastapi import Depends

@app.get("/secure-data")
async def secure_data_endpoint(user: UserToken = Depends(verify_token)):
    """Example protected endpoint."""
    return {
        "message": "This is secured data.",
        "user": user.email,
        "roles": user.roles
    }

@app.get("/admin-only")
async def admin_only_endpoint(user: UserToken = Depends(require_role("app-admin"))):
    """Example admin-only endpoint."""
    return {"message": "Hello Admin!"}
