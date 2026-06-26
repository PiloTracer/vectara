from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from contextlib import asynccontextmanager
from app.db import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Initializing Database...")
    await init_db()
    print("Database Initialized.")

    try:
        from app.services.vector_service import VectorService
        from app.services.embedding_service import EmbeddingService
        from app.services.llm_service import LLMService
        from app.services.ocr_service import OCRService
        from app.config import settings

        vs = VectorService()
        vs.ensure_collection()

        if settings.USE_LOCAL_EMBEDDING:
            embed = EmbeddingService()
            await embed.ensure_model_available()

        llm = LLMService()
        await llm.ensure_model_available()

        if settings.USE_LOCAL_OCR:
            ocr = OCRService()
            await ocr.ensure_model_available()
    except Exception as e:
        print(f"Warning: Service init failed (will retry on demand): {e}")

    yield

app = FastAPI(
    title="Tools IADATA API",
    description="Backend for CodeIva AI Data Lake System",
    version="0.1.0",
    lifespan=lifespan
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

# --- Routers ---
from app.routers import environments, resources, models, agents, oauth, chat, sessions, knowledge
app.include_router(environments.router)
app.include_router(resources.router)
app.include_router(models.router)
app.include_router(agents.router)
app.include_router(oauth.router)
app.include_router(chat.router)
app.include_router(sessions.router)
app.include_router(knowledge.router)

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
