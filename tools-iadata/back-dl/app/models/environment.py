from sqlalchemy import Column, String, ForeignKey, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from .base import Base

class Environment(Base):
    __tablename__ = "environments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    owner_id = Column(String, index=True, nullable=False) # Keycloak 'sub'
    settings = Column(JSONB, default={}) # Global env settings (default model, etc)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    access_list = relationship("EnvironmentAccess", back_populates="environment", cascade="all, delete")
    data_sources = relationship("DataSource", back_populates="environment", cascade="all, delete")
    mcp_servers = relationship("MCPServer", back_populates="environment", cascade="all, delete")
    agents = relationship("Agent", back_populates="environment", cascade="all, delete")
    chat_sessions = relationship("ChatSession", back_populates="environment", cascade="all, delete")
    llm_models = relationship("LLMModel", back_populates="environment", cascade="all, delete")

class EnvironmentAccess(Base):
    __tablename__ = "environment_access"
    
    env_id = Column(UUID(as_uuid=True), ForeignKey("environments.id"), primary_key=True)
    user_id = Column(String, primary_key=True) # Keycloak 'sub'
    role = Column(String, default="VIEWER") # VIEWER, EDITOR, ADMIN
    
    environment = relationship("Environment", back_populates="access_list")
