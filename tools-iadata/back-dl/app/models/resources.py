from sqlalchemy import Column, String, ForeignKey, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from .base import Base

class DataSource(Base):
    __tablename__ = "data_sources"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    env_id = Column(UUID(as_uuid=True), ForeignKey("environments.id"))
    type = Column(String, nullable=False) # LOCAL, DRIVE, WEB, SHAREPOINT
    name = Column(String, nullable=False)
    config = Column(JSONB, default={}) # Paths, URLs, credentials
    indexing_config = Column(JSONB, default={}) # Chunk size, exclusions
    
    environment = relationship("Environment", back_populates="data_sources")
    # One source can have multiple jobs (current and history)
    jobs = relationship("SystemJob", primaryjoin="foreign(SystemJob.resource_id) == DataSource.id", cascade="all, delete", overlaps="jobs")

class MCPServer(Base):
    __tablename__ = "mcp_servers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    env_id = Column(UUID(as_uuid=True), ForeignKey("environments.id"))
    name = Column(String, nullable=False)
    transport_type = Column(String, nullable=False) # STDIO, SSE
    command = Column(String, nullable=True) # For STDIO
    url = Column(String, nullable=True) # For SSE
    env_vars = Column(JSONB, default={}) # Encrypted API Keys
    enabled = Column(Boolean, default=True)
    
    environment = relationship("Environment", back_populates="mcp_servers")
    jobs = relationship("SystemJob", primaryjoin="foreign(SystemJob.resource_id) == MCPServer.id", cascade="all, delete", overlaps="jobs")

class SystemJob(Base):
    __tablename__ = "system_jobs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resource_id = Column(UUID(as_uuid=True), nullable=True, index=True) # Generic FK
    type = Column(String, nullable=False) # INDEXING, VECTOR_SYNC
    status = Column(String, default="PENDING") # PENDING, RUNNING, COMPLETED, FAILED
    progress = Column(JSONB, default={}) # {processed: X, total: Y}
    error = Column(Text, nullable=True)


class OAuthToken(Base):
    """
    Stores OAuth tokens for cloud data sources.
    Tokens are encrypted at rest using the app's secret key.
    """
    __tablename__ = "oauth_tokens"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id = Column(UUID(as_uuid=True), ForeignKey("data_sources.id", ondelete="CASCADE"), unique=True)
    provider = Column(String, nullable=False)  # GOOGLE_DRIVE, SHAREPOINT
    access_token = Column(Text, nullable=False)  # Encrypted
    refresh_token = Column(Text, nullable=True)  # Encrypted
    token_type = Column(String, default="Bearer")
    expires_at = Column(JSONB, nullable=True)  # ISO timestamp
    scopes = Column(JSONB, default=[])
    
    # Relationship
    data_source = relationship("DataSource", backref="oauth_token")

