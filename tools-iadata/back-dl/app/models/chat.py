from sqlalchemy import Column, String, ForeignKey, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from .base import Base

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    env_id = Column(UUID(as_uuid=True), ForeignKey("environments.id"))
    user_id = Column(String, index=True, nullable=False)
    title = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    retrieval_strategy = Column(JSONB, default={}) # Snapshot of retrieval settings
    
    environment = relationship("Environment", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete", order_by="ChatMessage.created_at")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id"))
    role = Column(String, nullable=False) # user, assistant, system
    content = Column(Text, nullable=False)
    meta = Column(JSONB, default={}) # Token usage, citations, retrieval metrics
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("ChatSession", back_populates="messages")
