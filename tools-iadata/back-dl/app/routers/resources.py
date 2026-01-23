from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.db import get_db
from app.models.resources import DataSource, MCPServer
from pydantic import BaseModel
from typing import List, Optional, Any
import uuid
from datetime import datetime

router = APIRouter(
    prefix="/resources",
    tags=["resources"]
)

# --- Pydantic Schemas ---

# Data Source
class DataSourceCreate(BaseModel):
    env_id: uuid.UUID
    name: str
    type: str
    config: dict
    indexing_config: Optional[dict] = {}

class DataSourceRead(BaseModel):
    id: uuid.UUID
    env_id: uuid.UUID
    name: str
    type: str
    config: dict
    indexing_config: dict

    class Config:
        from_attributes = True

# MCP Server
class MCPCreate(BaseModel):
    env_id: uuid.UUID
    name: str
    transport_type: str
    command: Optional[str] = None
    url: Optional[str] = None
    env_vars: Optional[dict] = {}
    enabled: bool = True

class MCPRead(BaseModel):
    id: uuid.UUID
    env_id: uuid.UUID
    name: str
    transport_type: str
    command: Optional[str] = None
    url: Optional[str] = None
    env_vars: dict
    enabled: bool

    class Config:
        from_attributes = True

# --- Endpoints: Data Sources ---

@router.get("/env/{env_id}/sources", response_model=List[DataSourceRead])
async def get_sources(env_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DataSource).where(DataSource.env_id == env_id))
    return result.scalars().all()

@router.post("/sources", response_model=DataSourceRead)
async def create_source(source: DataSourceCreate, db: AsyncSession = Depends(get_db)):
    db_source = DataSource(
        env_id=source.env_id,
        name=source.name,
        type=source.type,
        config=source.config,
        indexing_config=source.indexing_config
    )
    db.add(db_source)
    await db.commit()
    await db.refresh(db_source)
    return db_source

@router.delete("/sources/{source_id}")
async def delete_source(source_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DataSource).where(DataSource.id == source_id))
    source = result.scalars().first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    
    await db.delete(source)
    await db.commit()
    return {"status": "success"}

# --- Endpoints: MCP Servers ---

@router.get("/env/{env_id}/mcp", response_model=List[MCPRead])
async def get_mcps(env_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MCPServer).where(MCPServer.env_id == env_id))
    return result.scalars().all()

@router.post("/mcp", response_model=MCPRead)
async def create_mcp(mcp: MCPCreate, db: AsyncSession = Depends(get_db)):
    db_mcp = MCPServer(
        env_id=mcp.env_id,
        name=mcp.name,
        transport_type=mcp.transport_type,
        command=mcp.command,
        url=mcp.url,
        env_vars=mcp.env_vars,
        enabled=mcp.enabled
    )
    db.add(db_mcp)
    await db.commit()
    await db.refresh(db_mcp)
    return db_mcp

@router.delete("/mcp/{mcp_id}")
async def delete_mcp(mcp_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MCPServer).where(MCPServer.id == mcp_id))
    mcp = result.scalars().first()
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP Server not found")
    
    await db.delete(mcp)
    await db.commit()
    return {"status": "success"}
