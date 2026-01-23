from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db import get_db
from app.models import Environment
from pydantic import BaseModel
from typing import List, Optional
import uuid

router = APIRouter(
    prefix="/environments",
    tags=["environments"]
)

# --- Pydantic Schemas ---
class EnvironmentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    settings: Optional[dict] = {}

from datetime import datetime

class EnvironmentRead(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    owner_id: str
    settings: Optional[dict] = {}
    created_at: datetime

    class Config:
        from_attributes = True

# --- Endpoints ---

@router.get("/", response_model=List[EnvironmentRead])
async def get_environments(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Environment))
    envs = result.scalars().all()
    # Convert datetime to string for Pydantic if needed, or rely on internal converter
    return envs

@router.post("/", response_model=EnvironmentRead)
async def create_environment(env: EnvironmentCreate, db: AsyncSession = Depends(get_db)):
    # TODO: Get real owner_id from Auth token
    owner_id = "placeholder-owner-id" 
    
    new_env = Environment(
        name=env.name,
        description=env.description,
        settings=env.settings,
        owner_id=owner_id
    )
    db.add(new_env)
    await db.commit()
    await db.refresh(new_env)
    return new_env

@router.get("/{env_id}", response_model=EnvironmentRead)
async def get_environment_by_id(env_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Environment).where(Environment.id == env_id))
    env = result.scalars().first()
    if not env:
        raise HTTPException(status_code=404, detail="Environment not found")
    return env
