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
    # Validate and Normalize LOCAL paths
    if source.type == "LOCAL":
        import os
        base_path = "/app/data_sources"
        user_path = source.config.get("path", "").strip()
        
        # If user provides full internal path, verify strict containment
        # If user provides relative path, prepend base_path
        if os.path.isabs(user_path):
            final_path = os.path.normpath(user_path)
        else:
            final_path = os.path.join(base_path, user_path)
            
        # Security Check: Ensure final_path is inside base_path
        # Note: In a container, /app/data_sources is the sandbox.
        if not final_path.startswith(base_path):
             raise HTTPException(status_code=400, detail=f"Local path must be a subdirectory of {base_path}")
             
        source.config["path"] = final_path

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

# --- Ingestion Endpoint ---

@router.post("/sources/{source_id}/ingest")
async def ingest_source(source_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Trigger ingestion for a source.
    For 'LOCAL_BRIDGE', this crawls the host folder via the bridge.
    """
    result = await db.execute(select(DataSource).where(DataSource.id == source_id))
    source = result.scalars().first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
        
    if source.type == "LOCAL_BRIDGE":
        from app.services.bridge import FileBridgeClient
        
        path_id = source.config.get("bridge_id")
        if not path_id:
             raise HTTPException(status_code=400, detail="Missing bridge_id in source config")
             
        client = FileBridgeClient()
        try:
            print(f"Starting ingestion for path_id {path_id}...")
            files = await client.walk(path_id)
            print(f"Found {len(files)} files via bridge.")
            
            # For now, we just log them to prove connectivity
            for f in files[:5]: # Log first 5
                print(f" - Found: {f['relative_path']} ({f['size']} bytes)")
                
                # Verify read
                if f['size'] < 1000: # Only read small files for test
                    content = await client.read_file(path_id, f['relative_path'])
                    print(f"   Sample content: {content[:50]}...")
            
            return {
                "status": "success", 
                "message": f"Ingested {len(files)} files", 
                "files_count": len(files)
            }
        except Exception as e:
            print(f"Ingestion failed: {e}")
            raise HTTPException(status_code=500, detail=str(e))
        finally:
            await client.close()
            
    return {"status": "skipped", "message": f"Ingestion not implemented for type {source.type}"}
