from sqlalchemy import Column, String, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from .base import Base

class LLMModel(Base):
    """
    Represents an LLM model configuration.
    Can be a local model (Ollama) or an API-based model (OpenAI, Anthropic, etc.)
    """
    __tablename__ = "llm_models"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    env_id = Column(UUID(as_uuid=True), ForeignKey("environments.id"), nullable=True)  # Null = global
    
    name = Column(String, nullable=False)  # Display name
    provider = Column(String, nullable=False)  # "ollama", "openai", "anthropic", "google", "custom"
    model_id = Column(String, nullable=False)  # e.g., "llama3.2", "gpt-4-turbo", "claude-3-opus"
    
    # API Configuration
    api_base_url = Column(String, nullable=True)  # Custom endpoint (for Ollama or custom APIs)
    api_key_env_var = Column(String, nullable=True)  # Environment variable name for API key
    
    # Model capabilities/settings
    capabilities = Column(JSONB, default={})  # {"vision": true, "function_calling": true, etc.}
    default_params = Column(JSONB, default={})  # {"temperature": 0.7, "max_tokens": 4096, etc.}
    
    is_default = Column(Boolean, default=False)  # Is this the default model for the environment?
    enabled = Column(Boolean, default=True)
    
    # Relationship back to environment (optional)
    environment = relationship("Environment", backref="llm_models")
