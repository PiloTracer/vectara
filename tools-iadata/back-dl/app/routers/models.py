from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db import get_db
from app.models.llm import LLMModel
from pydantic import BaseModel
from typing import List, Optional
import uuid

router = APIRouter(
    prefix="/models",
    tags=["models"]
)

# --- Pydantic Schemas ---

class LLMModelCreate(BaseModel):
    env_id: Optional[uuid.UUID] = None  # Null = global model
    name: str
    provider: str  # "ollama", "openai", "anthropic", "google", "custom"
    model_id: str  # e.g., "llama3.2", "gpt-4-turbo"
    api_base_url: Optional[str] = None
    api_key_env_var: Optional[str] = None
    capabilities: Optional[dict] = {}
    default_params: Optional[dict] = {}
    is_default: bool = False
    enabled: bool = True

class LLMModelUpdate(BaseModel):
    name: Optional[str] = None
    api_base_url: Optional[str] = None
    api_key_env_var: Optional[str] = None
    capabilities: Optional[dict] = None
    default_params: Optional[dict] = None
    is_default: Optional[bool] = None
    enabled: Optional[bool] = None

class LLMModelRead(BaseModel):
    id: uuid.UUID
    env_id: Optional[uuid.UUID]
    name: str
    provider: str
    model_id: str
    api_base_url: Optional[str]
    api_key_env_var: Optional[str]
    capabilities: dict
    default_params: dict
    is_default: bool
    enabled: bool

    class Config:
        from_attributes = True

# --- Endpoints ---

@router.get("/", response_model=List[LLMModelRead])
async def get_all_models(db: AsyncSession = Depends(get_db)):
    """Get all global models (env_id is null)."""
    result = await db.execute(select(LLMModel).where(LLMModel.env_id == None))
    return result.scalars().all()

@router.get("/env/{env_id}", response_model=List[LLMModelRead])
async def get_models_for_env(env_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get models for a specific environment + global models."""
    result = await db.execute(
        select(LLMModel).where(
            (LLMModel.env_id == env_id) | (LLMModel.env_id == None)
        )
    )
    return result.scalars().all()

@router.post("/", response_model=LLMModelRead)
async def create_model(model: LLMModelCreate, db: AsyncSession = Depends(get_db)):
    """Create a new LLM model configuration."""
    db_model = LLMModel(
        env_id=model.env_id,
        name=model.name,
        provider=model.provider,
        model_id=model.model_id,
        api_base_url=model.api_base_url,
        api_key_env_var=model.api_key_env_var,
        capabilities=model.capabilities,
        default_params=model.default_params,
        is_default=model.is_default,
        enabled=model.enabled
    )
    
    # If this is set as default, unset other defaults for same env
    if model.is_default:
        existing = await db.execute(
            select(LLMModel).where(
                LLMModel.env_id == model.env_id,
                LLMModel.is_default == True
            )
        )
        for m in existing.scalars().all():
            m.is_default = False
    
    db.add(db_model)
    await db.commit()
    await db.refresh(db_model)
    return db_model

@router.put("/{model_id}", response_model=LLMModelRead)
async def update_model(model_id: uuid.UUID, updates: LLMModelUpdate, db: AsyncSession = Depends(get_db)):
    """Update an existing LLM model configuration."""
    result = await db.execute(select(LLMModel).where(LLMModel.id == model_id))
    db_model = result.scalars().first()
    
    if not db_model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    if updates.name is not None:
        db_model.name = updates.name
    if updates.api_base_url is not None:
        db_model.api_base_url = updates.api_base_url
    if updates.api_key_env_var is not None:
        db_model.api_key_env_var = updates.api_key_env_var
    if updates.capabilities is not None:
        db_model.capabilities = updates.capabilities
    if updates.default_params is not None:
        db_model.default_params = updates.default_params
    if updates.enabled is not None:
        db_model.enabled = updates.enabled
    if updates.is_default is not None:
        if updates.is_default:
            # Unset other defaults
            existing = await db.execute(
                select(LLMModel).where(
                    LLMModel.env_id == db_model.env_id,
                    LLMModel.is_default == True,
                    LLMModel.id != model_id
                )
            )
            for m in existing.scalars().all():
                m.is_default = False
        db_model.is_default = updates.is_default
    
    await db.commit()
    await db.refresh(db_model)
    return db_model

@router.delete("/{model_id}")
async def delete_model(model_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Delete an LLM model configuration."""
    result = await db.execute(select(LLMModel).where(LLMModel.id == model_id))
    db_model = result.scalars().first()
    
    if not db_model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    await db.delete(db_model)
    await db.commit()
    return {"status": "success"}

# --- Special Endpoints ---

@router.get("/providers")
async def get_providers():
    """Get list of supported LLM providers with their configurations."""
    return {
        "providers": [
            {
                "id": "ollama",
                "name": "Ollama (Local)",
                "description": "Run models locally using Ollama",
                "requires_api_key": False,
                "default_base_url": "http://host.docker.internal:11434",
                "popular_models": ["llama3.2", "llama3.1", "mistral", "codellama", "phi3"]
            },
            {
                "id": "openai",
                "name": "OpenAI",
                "description": "GPT-4, GPT-3.5 and other OpenAI models",
                "requires_api_key": True,
                "api_key_env_var": "OPENAI_API_KEY",
                "default_base_url": "https://api.openai.com/v1",
                "popular_models": ["gpt-4-turbo", "gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"]
            },
            {
                "id": "anthropic",
                "name": "Anthropic",
                "description": "Claude 3 family of models",
                "requires_api_key": True,
                "api_key_env_var": "ANTHROPIC_API_KEY",
                "default_base_url": "https://api.anthropic.com",
                "popular_models": ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku", "claude-3.5-sonnet"]
            },
            {
                "id": "google",
                "name": "Google AI",
                "description": "Gemini models via Google AI Studio",
                "requires_api_key": True,
                "api_key_env_var": "GOOGLE_API_KEY",
                "default_base_url": "https://generativelanguage.googleapis.com",
                "popular_models": ["gemini-pro", "gemini-1.5-pro", "gemini-1.5-flash"]
            },
            {
                "id": "custom",
                "name": "Custom / OpenAI-Compatible",
                "description": "Any OpenAI-compatible API endpoint",
                "requires_api_key": True,
                "api_key_env_var": None,
                "default_base_url": None,
                "popular_models": []
            }
        ]
    }
