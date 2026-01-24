# Tools IADATA - Project Context

> [!TIP]
> **Model Setup**: For setting up custom models like `Dolphin-X1`, see [docs/manual_model_setup.md](file:///mnt/work/Projects/tauri/datalake/tools-iadata/docs/manual_model_setup.md).

## Overview
**Tools IADATA** is the configurable AI data-lake system for the CodeIva ecosystem. It manages environments, data sources, agents, and LLM integrations to power corporate intelligence.

## Core Components
1.  **front-dl** (Next.js): User interface for management and chat.
2.  **back-dl** (FastAPI): Backend services for orchestration and API.
3.  **pg-dl** (PostgreSQL): Administrative database (async mode).
4.  **ia-dl** (Qdrant): Vector database for embeddings and RAG.

## Objectives
- **Environment Management**: Create sets of sources, agents, and LLMs.
- **Data Ingestion**: Indexing from various sources (Files, Web, DBs).
- **AI Orchestration**: Flexible agent and LLM definition.

## Architecture
- **Service**: Dockerized Microservices
- **Auth**: Integration with Keycloak (via Tools IAM)
- **Persistence**: Local Docker volumes (dev) / Managed (prd)

## Integration Points
- **Tools IAM**: Provides authentication (OIDC).
