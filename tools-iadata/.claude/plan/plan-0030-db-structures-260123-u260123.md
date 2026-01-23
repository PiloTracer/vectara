# Plan 0030: Database Structures (PostgreSQL) - Rev 2

## Overview
This plan defines the relational database structure for **Tools IADATA**. It implements a hierarchy where Environments serve as the container for Sources, MCPs, Agents, and permissions.

**Strategy**:
- **ORM**: SQLAlchemy (Async)
- **Migration Strategy**: Idempotent `Base.metadata.create_all()` on startup.
> [!IMPORTANT]
> **NO ALEMBIC**. Schema changes must be handled by direct SQL via idempotent scripts or re-creation during dev. DO NOT introduce Alembic for migrations.

## 1. Schema Hierarchy

### A. Context & Access (`app/models/environment.py`)

#### `environments`
The root container.
- `id`: UUID (PK)
- `name`: String
- `description`: Text
- `owner_id`: String (Keycloak 'sub')
- `settings`: JSONB (Global env settings: default model, embedding strategy)
- `created_at`: DateTime

#### `environment_access`
Manages shared access (RBAC).
- `env_id`: UUID (PK, FK)
- `user_id`: String (PK, Keycloak 'sub')
- `role`: String (Enum: 'VIEWER', 'EDITOR', 'ADMIN')

### B. Resources (`app/models/resources.py`)

#### `data_sources`
Static/Streaming inputs.
- `id`: UUID (PK)
- `env_id`: UUID (FK)
- `type`: String (Enum: 'LOCAL', 'DRIVE', 'WEB', 'SHAREPOINT')
- `name`: String
- `config`: JSONB (Paths, URLs, credentials)
- `indexing_config`: JSONB (Chunk size, exclusion patterns)

#### `mcp_servers`
Dynamic tool/resource providers.
- `id`: UUID (PK)
- `env_id`: UUID (FK)
- `name`: String
- `transport_type`: String (Enum: 'STDIO', 'SSE')
- `command`: String (For STDIO)
- `url`: String (For SSE)
- `env_vars`: JSONB (Encrypted env vars for the server)
- `enabled`: Boolean

#### `system_jobs`
Long-running async tasks (Indexing, Crawling).
- `id`: UUID (PK)
- `resource_id`: UUID (FK -> data_sources.id or mcp_servers.id)
- `type`: String ('INDEXING', 'VectorSync')
- `status`: String ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')
- `progress`: JSONB ({ "processed": 10, "total": 100 })
- `error`: Text

### C. Intelligence (`app/models/intelligence.py`)

#### `agents`
- `id`: UUID (PK)
- `env_id`: UUID (FK)
- `name`: String
- `role`: String
- `system_prompt`: Text
- `tools_config`: JSONB (Which MCP tools are enabled for this agent)
- `model_override`: JSONB (Specific LLM selection)

### D. Chat System (`app/models/chat.py`)

#### `chat_sessions`
- `id`: UUID (PK)
- `env_id`: UUID (FK)
- `user_id`: String
- `title`: String
- `retrieval_strategy`: JSONB (Snapshot of search settings used)

#### `chat_messages`
- `id`: UUID
- `session_id`: UUID (FK)
- `role`: String
- `content`: Text
- `sources`: JSONB (Citations/Retrieval results)

## 2. Implementation Structure

```
back-dl/app/
├── db.py               
├── models/
│   ├── __init__.py     
│   ├── base.py         
│   ├── environment.py  # Environment + Access
│   ├── resources.py    # DataSources + MCPs + Jobs
│   ├── intelligence.py # Agents
│   └── chat.py         
```

## 3. Key Python Model Definitions (Draft)

### `models/resources.py` (`sys_jobs` + `mcp`)
```python
class MCPServer(Base):
    __tablename__ = "mcp_servers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    env_id = Column(UUID(as_uuid=True), ForeignKey("environments.id"))
    name = Column(String, nullable=False)
    transport_type = Column(String, nullable=False) # STDIO, SSE
    command = Column(String) # mcp-server-git --repo ...
    url = Column(String)
    env_vars = Column(JSONB, default={}) # {"GITHUB_TOKEN": "..."}
    enabled = Column(Boolean, default=True)
    
    environment = relationship("Environment", back_populates="mcp_servers")

class SystemJob(Base):
    __tablename__ = "system_jobs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Generic FK to either DataSource or MCP often handled by explicit nullable Columns or logic
    resource_id = Column(UUID(as_uuid=True), nullable=True) 
    type = Column(String)
    status = Column(String, default="PENDING")
    progress = Column(JSONB, default={})
    error = Column(Text)
```
