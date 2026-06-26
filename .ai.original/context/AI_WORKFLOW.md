# AI System Architecture & Workflows

This document defines the intelligence architecture of the `datalake` system, detailing how Local LLMs, External APIs, and standard protocols (MCP) interact to provide a secure, efficient private RAG experience.

## 1. The Local Intelligence Pipeline (Privacy First)

The core philosophy is **Hybrid Resilience**: Do as much as possible locally (embeddeding, search, simple routing) to ensure privacy and speed, and only escalate to external AI for complex reasoning.

### A. Data Ingestion & Embedding Flow
**Goal**: Convert raw files from the user's host into searchable vectors without data leaving the machine.

1.  **Discovery (Bridge)**:
    *   User selects a folder in `vectara` (Desktop).
    *   Bridge Server reads files (via `api/file/read` or `extract` endpoint).
    *   *Note: Binary files are Base64 encoded during transit.*

2.  **Extraction (IAD Backend)**:
    *   `ingestion_service.py` receives content.
    *   **Text/Code**: Processed directly.
    *   **PDF/Excel/Images**: Passed to specialized extractors (e.g., `LightOnOCR` for images, `pandas` for Excel).

3.  **Tokenization & Chunking**:
    *   Content is split into semantic chunks (e.g., 512-1024 tokens).
    *   *Optimization*: We use overlap (e.g., 128 tokens) to preserve context boundaries.
    *   **Hierarchy Preservation**: Every chunk is tagged with `source_id` and `chunk_index`. This ensures that even though a file is split into 100 parts, every part knows it belongs to "Finance Source" (ID A1).

4.  **Embedding (Local)**:
    *   **Model**: `bge-m3` (running in Ollama).
    *   **Process**: Chunks are sent to Ollama's `/api/embeddings` endpoint.
    *   **Output**: High-dimensional vector stored in **Qdrant**.

### B. RAG & Retrieval Flow
**Goal**: Retrieve the most relevant private context for a user query.

1.  **Query Embedding**:
    *   User question is embedded using the *same* model (`bge-m3`) to ensure vector space alignment.
2.  **Vector Search (Qdrant)**:
    *   Perform cosine similarity search in Qdrant.
    *   **Source Filtering**: We can optionally pass a `filter` (e.g., `source_ids=['A1']`). Qdrant will completely ignore chunks from other sources, effectively creating isolated "Environments" for the AI.
    *   Retrieve top $K$ chunks (typically 5-10) with metadata (source credentials).
3.  **Context Assembly**:
    *   Construct a prompt: `Context: {retrieved_chunks} \n\n Question: {query}`.

### C. Local Generation
**Goal**: Answer questions using only local resources.

*   **Model**: `qwen2.5:3b` (or similar small/mid-sized model in Ollama).
*   **Role**: Summarization, direct fact extraction, simple reasoning.
*   **Pros**: 0 latency penalty, 100% private.
*   **Cons**: Limited reasoning capability compared to GPT-4/Claude.

---

## 2. Hybrid Intelligence Strategy (Optimization)

To balance **Privacy** (Local) with **Intelligence** (External), we implement a **Tiered Processing Architecture**.

### The Flow: Triage -> RAG -> Generation

1.  **Tier 1: The Local Router (Triage)**
    *   **Model**: Local Small LLM (`qwen2.5:3b` or `llama3.2:3b`).
    *   **Task**: Analyze the user's query *before* retrieval.
    *   **Decisions**:
        *   *Is this about local documents?* -> Trigger RAG.
        *   *Is this a general chat?* -> Skip RAG.
        *   *Is this complex?* -> Flag for External API.

2.  **Tier 2: Optimized RAG (Local)**
    *   **Embedding/Retrieval**: ALWAYS happens locally. We never send all your files to OpenAI—only the specific relevant text chunks found by the local search are candidates for sending.

3.  **Tier 3: The Generator (Hybrid)**
    *   **Option A (Private Mode)**: The prompt + context is sent to Local LLM (`qwen2.5`). Fast, private, good for "Summarize this file".
    *   **Option B (Smart Mode)**: The prompt + context is sent to External API (Anthropic/OpenAI).
        *   *Benefit*: Massive reasoning improvement.
        *   *Privacy*: You only leak the specific *snippets* relevant to the question, not the whole database.

### Tuning the System
*   **Token Consumption**: Use local LLMs to pre-summarize chunks *before* sending to External API to save tokens.
*   **Drafting**: Use Local LLM to draft a response, then use External LLM to "Polish" it.

---

## 3. Model Context Protocol (MCP) Integration

**What is it?**
MCP (Model Context Protocol) is a standard allowing AI models to "talk" to data sources and tools (like GitHub, Slack, local DBs) without custom integration code.

### Why integrate MCP?
Current state: We wrote a custom "Bridge" to talk to the local filesystem.
MCP state: We run a "Filesystem MCP Server". The LLM (Claude/GPT) connects to it automatically.

**Improvements MCP brings:**
1.  **Standardized Tools**: Instead of writing `def get_file()`, we import `mcp-filesystem`.
2.  **Ecosystem Access**: Instantly give your AI access to Slack, Postage, GitHub, etc., by just running their MCP server.
3.  **Separation of Concerns**: The "Tool" logic lives in the MCP server, not the main application backend.

### How-To Instructions: Adding a Generic MCP
To add an MCP server (e.g., `mcp-github`) to the workflow:

1.  **Install the MCP Server**:
    Run the MCP server as a subprocess or Docker container side-car to `tools-iadata`.
    ```bash
    # Example in docker-compose
    mcp-github:
      image: mcp/github
      environment:
        - GITHUB_TOKEN=...
    ```

2.  **Configure the Client (IAD Backend)**:
    Update `tools-iadata` to connect to the MCP server.
    ```python
    # Pseudo-code for backend initialization
    client = MCPClient(url="http://mcp-github:8080")
    available_tools = await client.list_tools()
    # Results: [{name: "create_issue", ...}, {name: "read_pr", ...}]
    ```

3.  **Inject into LLM Context**:
    When calling the LLM (Local or External), pass the tool definitions.
    *   If Local: Use generic tool calling formats (e.g. JSON schema).
    *   If External (Claude): Pass these directly as `tools` in the API call.

---

## 4. Developer Workflow (Session Management)

*Legacy instructions for maintaining project context.*

### Session Scripts
*   **Start**: `./scripts/ai/session.sh start` - Refreshes context, updates `CURRENT_FOCUS.md`.
*   **End**: `./scripts/ai/session.sh end` - Logs git dumps, asks for architectural changes, updates context.

### Feature Tracking
*   **New Feature**: `./scripts/ai/feature.sh new` - Creates `ID-slug-UPDATED-CREATED.md`.
*   **Update Feature**: `./scripts/ai/feature.sh update` - Updates timestamp and metadata.
