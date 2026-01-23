from sqlalchemy import Column, String, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from .base import Base

class Agent(Base):
    __tablename__ = "agents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    env_id = Column(UUID(as_uuid=True), ForeignKey("environments.id"))
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    system_prompt = Column(Text, nullable=True)
    tools_config = Column(JSONB, default={}) # Enabled MCP tools
    model_override = Column(JSONB, default={}) # Specific LLM selection
    
    environment = relationship("Environment", back_populates="agents")
