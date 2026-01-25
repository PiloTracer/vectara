from fastapi import APIRouter, Depends, HTTPException, Body, BackgroundTasks
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

@router.on_event("startup")
async def router_startup():
    from app.services.vector_service import VectorService
    from app.services.embedding_service import EmbeddingService
    from app.services.llm_service import LLMService
    from app.services.ocr_service import OCRService
    from app.config import settings
    
    try:
        # 1. Ensure Vector Collection
        service = VectorService()
        service.ensure_collection()
        
        # 2. Ensure Models (Auto-Pull)
        # Sequential to avoid overloading Ollama if multiple models need pulling.
        # Order: Embedding (critical) -> Chat (important) -> OCR (optional)
        
        if settings.USE_LOCAL_EMBEDDING:
            embed_service = EmbeddingService()
            await embed_service.ensure_model_available()
        
        llm_service = LLMService()
        await llm_service.ensure_model_available()
        
        if settings.USE_LOCAL_OCR:
            ocr_service = OCRService()
            await ocr_service.ensure_model_available()
        
    except Exception as e:
        print(f"Warning: Failed to initialize Resources/Models: {e}")

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

# Job Status
class JobRead(BaseModel):
    id: uuid.UUID
    resource_id: Optional[uuid.UUID]
    type: str
    status: str
    progress: dict
    error: Optional[str]

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


# --- Ingestion Endpoint ---

@router.post("/sources/{source_id}/ingest")
async def ingest_source(
    source_id: uuid.UUID, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Trigger asynchronous ingestion for a data source.
    Returns a Job ID to track progress.
    """
    from app.models.resources import SystemJob
    from app.services.ingestion_service import process_ingestion_task
    
    # Verify source exists
    result = await db.execute(select(DataSource).where(DataSource.id == source_id))
    source = result.scalars().first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    
    # Create Job Record
    job = SystemJob(
        id=uuid.uuid4(),
        resource_id=source.id,
        type="INGESTION",
        status="PENDING",
        progress={"message": "Queued for processing"}
    )
    db.add(job)
    await db.commit()
    
    # Queue Background Task
    background_tasks.add_task(process_ingestion_task, job.id, source.id)
    
    return {
        "status": "queued",
        "job_id": job.id,
        "message": "Ingestion started in background"
    }

# --- Endpoints: Job Status ---

@router.get("/jobs/{job_id}", response_model=JobRead)
async def get_job_status(job_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Get the status of a background job.
    """
    from app.models.resources import SystemJob
    
    result = await db.execute(select(SystemJob).where(SystemJob.id == job_id))
    job = result.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return job
