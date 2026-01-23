# Plan 0030: Database Structures (PostgreSQL)

## Overview
This plan defines the relational database structure for **Tools IADATA**. It prioritizes a lightweight, flexible schema to manage multi-environment contexts, chat history, and system configurations.

**Strategy**:
- **ORM**: SQLAlchemy (Async)
- **Migration Strategy**: Idempotent `Base.metadata.create_all()` on startup.
> [!IMPORTANT]
> **NO ALEMBIC**. Schema changes must be handled by direct SQL via idempotent scripts or re-creation during dev. DO NOT introduce Alembic for migrations.
- **Format**: JSONB used heavily for configuration fields to avoid over-normalizing variable data (like model parameters or source paths).

## 1. Schema Design

### A. Core Context (`app/models/environment.py`)

#### `environments`
The top-level container for a workspace.
- `id`: UUID (Primary Key)
- `name`: String (Unique per owner?)
- `description`: Text (Nullable)
- `owner_id`: String (Keycloak User 'sub' ID)
- `created_at`: DateTime (Default Now)
- `updated_at`: DateTime

#### `data_sources`
Defines inputs available in an environment.
- `id`: UUID
- `env_id`: UUID (FK -> environments.id)
- `name`: String
- `source_type`: String (Enum: 'LOCAL', 'DRIVE', 'WEB', 'SHAREPOINT')
- `config`: JSONB (Stores paths, URLs, auth tokens, or specific parsing rules)
- `status`: String (Enum: 'ACTIVE', 'INDEXING', 'ERROR')

#### `agents`
Specific personas or tool configurations.
- `id`: UUID
- `env_id`: UUID (FK -> environments.id)
- `name`: String
- `role`: String (e.g., 'Analyst', 'Coder')
- `system_prompt`: Text
- `model_config`: JSONB (Specific model overrides: temperature, model_id)

### B. Chat System (`app/models/chat.py`)

#### `chat_sessions`
History grouping.
- `id`: UUID
- `env_id`: UUID (FK -> environments.id)
- `user_id`: String (Keycloak 'sub')
- `title`: String
- `created_at`: DateTime
- `updated_at`: DateTime (Last active)

#### `chat_messages`
Individual exchanges.
- `id`: UUID
- `session_id`: UUID (FK -> chat_sessions.id)
- `role`: String ('user', 'assistant', 'system')
- `content`: Text (The message body)
- `meta`: JSONB (Token usage, citations, retrieval scores)
- `created_at`: DateTime

## 2. Implementation Structure

The backend will organize these models into a modular structure:

```
back-dl/app/
├── db.py               # Database connection & init logic
├── models/
│   ├── __init__.py     # Export all models for Base Registry
│   ├── base.py         # SQLAlchemy Declarative Base
│   ├── environment.py  # Env, DataSource, Agent classes
│   └── chat.py         # ChatSession, ChatMessage classes
```

### Idempotency
The `db.py` module will export an `init_db()` function called by `main.py` on startup/lifespan.
```python
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
```

## 3. Python Model Definitions (Draft)

### `models/base.py`
```python
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.ext.asyncio import AsyncAttrs

class Base(AsyncAttrs, DeclarativeBase):
    pass
```

### `models/environment.py`
```python
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
    description = Column(Text)
    owner_id = Column(String, index=True) # Keycloak Subject ID
    created_at = Column(DateTime, default=datetime.utcnow)
    
    sources = relationship("DataSource", back_populates="environment", cascade="all, delete")
    agents = relationship("Agent", back_populates="environment", cascade="all, delete")

class DataSource(Base):
    __tablename__ = "data_sources"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    env_id = Column(UUID(as_uuid=True), ForeignKey("environments.id"))
    name = Column(String)
    source_type = Column(String) # LOCAL, DRIVE...
    config = Column(JSONB, default={})
    status = Column(String, default="ACTIVE")
    
    environment = relationship("Environment", back_populates="sources")

class Agent(Base):
    __tablename__ = "agents"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    env_id = Column(UUID(as_uuid=True), ForeignKey("environments.id"))
    name = Column(String)
    system_prompt = Column(Text)
    model_config = Column(JSONB, default={})
    
    environment = relationship("Environment", back_populates="agents")
```
