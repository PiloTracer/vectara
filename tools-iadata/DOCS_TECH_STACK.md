# Tools IADATA - Technology Stack

## Core Components

### Frontend
- **Next.js**: React framework for the `front-dl` application.
- **Vanilla CSS / CSS Modules**: Styling (No TailwindCSS).

### Backend
- **FastAPI**: Python async framework for `back-dl`.
- **Python 3.11+**: Core language.
- **LangChain / LlamaIndex**: (Implied) For AI/Agent logic.

### Data & Persistence
- **PostgreSQL 15**: Administrative data (`pg-dl`).
- **Qdrant**: Vector Search Engine (`ia-dl`).
- **Redis**: Caching (Optional/Future).

### Infrastructure
- **Docker & Docker Compose**: Orchestration.
- **Bash**: Management scripts (`bin/start.sh`).

## Development Environment
- **VS Code**: Recommended IDE.
- **.env**: Configuration management.
