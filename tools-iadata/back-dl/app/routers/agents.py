from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db import get_db
from app.models.intelligence import Agent
from pydantic import BaseModel, field_validator
from typing import List, Optional
import uuid

router = APIRouter(
    prefix="/agents",
    tags=["agents"]
)

# --- Pydantic Schemas ---

class AgentCreate(BaseModel):
    env_id: uuid.UUID
    name: str
    role: str  # e.g., "assistant", "researcher", "coder", "analyst"
    system_prompt: Optional[str] = None
    tools_config: Optional[dict] = {}  # {"enabled_tools": ["search", "code"], "mcp_servers": [...]}
    model_override: Optional[dict] = {}  # {"model_id": "...", "provider": "..."}

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    system_prompt: Optional[str] = None
    tools_config: Optional[dict] = None
    model_override: Optional[dict] = None

class AgentRead(BaseModel):
    id: uuid.UUID
    env_id: uuid.UUID
    name: str
    role: str
    system_prompt: Optional[str]
    tools_config: Optional[dict] = {}
    model_override: Optional[dict] = {}
    
    @field_validator('tools_config', 'model_override', mode='before')
    @classmethod
    def default_empty_dict(cls, v):
        return v or {}

    class Config:
        from_attributes = True

# --- Endpoints ---

@router.get("/env/{env_id}", response_model=List[AgentRead])
async def get_agents(env_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get all agents for an environment."""
    result = await db.execute(select(Agent).where(Agent.env_id == env_id))
    return result.scalars().all()

@router.get("/{agent_id}", response_model=AgentRead)
async def get_agent(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get a single agent by ID."""
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalars().first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent

@router.post("/", response_model=AgentRead)
async def create_agent(agent: AgentCreate, db: AsyncSession = Depends(get_db)):
    """Create a new agent."""
    db_agent = Agent(
        env_id=agent.env_id,
        name=agent.name,
        role=agent.role,
        system_prompt=agent.system_prompt,
        tools_config=agent.tools_config,
        model_override=agent.model_override
    )
    db.add(db_agent)
    await db.commit()
    await db.refresh(db_agent)
    return db_agent

@router.put("/{agent_id}", response_model=AgentRead)
async def update_agent(agent_id: uuid.UUID, updates: AgentUpdate, db: AsyncSession = Depends(get_db)):
    """Update an existing agent."""
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    db_agent = result.scalars().first()
    
    if not db_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if updates.name is not None:
        db_agent.name = updates.name
    if updates.role is not None:
        db_agent.role = updates.role
    if updates.system_prompt is not None:
        db_agent.system_prompt = updates.system_prompt
    if updates.tools_config is not None:
        db_agent.tools_config = updates.tools_config
    if updates.model_override is not None:
        db_agent.model_override = updates.model_override
    
    await db.commit()
    await db.refresh(db_agent)
    return db_agent

@router.delete("/{agent_id}")
async def delete_agent(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Delete an agent."""
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    db_agent = result.scalars().first()
    
    if not db_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    await db.delete(db_agent)
    await db.commit()
    return {"status": "success"}

# --- Preset Roles ---

@router.get("/presets/roles")
async def get_role_presets():
    """Get preset agent roles with default system prompts."""
    return {
        "roles": [
            {
                "id": "assistant",
                "name": "General Assistant",
                "icon": "💬",
                "description": "A helpful general-purpose assistant",
                "default_prompt": "You are a helpful AI assistant. Be concise, accurate, and friendly."
            },
            {
                "id": "researcher",
                "name": "Research Analyst",
                "icon": "🔍",
                "description": "Specializes in research and analysis tasks",
                "default_prompt": "You are a research analyst. Gather information thoroughly, cite sources, and provide well-structured analysis. Focus on accuracy and depth."
            },
            {
                "id": "coder",
                "name": "Code Assistant",
                "icon": "💻",
                "description": "Helps with programming and code review",
                "default_prompt": "You are an expert programmer. Write clean, efficient, and well-documented code. Explain your implementations clearly and follow best practices."
            },
            {
                "id": "writer",
                "name": "Content Writer",
                "icon": "✍️",
                "description": "Creates and edits written content",
                "default_prompt": "You are a skilled content writer. Create engaging, well-structured content. Adapt your tone and style to the context."
            },
            {
                "id": "analyst",
                "name": "Data Analyst",
                "icon": "📊",
                "description": "Analyzes data and provides insights",
                "default_prompt": "You are a data analyst. Interpret data accurately, identify patterns, and provide actionable insights with clear visualizations when helpful."
            },
            {
                "id": "custom",
                "name": "Custom Agent",
                "icon": "🎯",
                "description": "Create a fully custom agent",
                "default_prompt": ""
            }
        ]
    }
