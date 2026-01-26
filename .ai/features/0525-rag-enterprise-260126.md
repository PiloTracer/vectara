# Enterprise RAG Uprade Plan
> **Date**: 2026-01-26
> **Current Status**: Intermediate (Heuristic-based)
> **Target**: Production Enterprise (SOTA)

## 1. Executive Summary
The current system uses an "Intermediate" RAG approach:
- **Strengths**: Diversity heuristic (MMR-lite), Metadata injection.
- **Weaknesses**: Serial API calls (slow ingestion), Dense-only vectors (misses exact keywords), Logic spread across controllers.

To reach "Enterprise" level, we must move from "Smart Scripts" to "Robust Pipelines" involving **Hybrid Search** (Dense + Sparse), **Re-ranking** (Cross-Encoders), and **Query Transformation**.

## 2. Model Selection: Competitors vs. bge-m3

You asked for a "lighter/better" competitor. Here is the evaluation:

### The Incumbent: `BAAI/bge-m3`
- **Verdict**: **KEEP IT, but use it correctly.**
- **Why**: It is currently "SOTA" for open-source multilingual because it generates THREE types of embeddings:
  1. **Dense** (Standard semantic search)
  2. **Sparse** (Learned "BM25" - handles extract keywords/codes better than dense)
  3. **ColBERT** (Multi-vector for fine-grained interaction)
- **Current Problem**: You are running it via Ollama, which usually **throws away** the Sparse and ColBERT outputs, giving you only the Dense vector. You are paying the compute cost of `bge-m3` but only getting 33% of the value.
- **Enterprise Fix**: Run `bge-m3` via a specialized inference container (e.g., `infinity` or `text-embeddings-inference`) or native Python `FlagEmbedding` to get both Dense and Sparse vectors.

### The Challenger: `nomic-embed-text-v1.5`
- **Pros**: 
  - **Matryoshka Embeddings**: You can "slice" the vector from 768d down to 256d to save storage/speed with minimal accuracy loss.
  - **Context**: 8192 tokens (same as bge-m3).
  - **English Performance**: Slightly better than bge-m3 on pure English benchmarks.
- **Cons**: Sparse support is not native/integrated in the same "One Model, All Features" way as bge-m3.

### The Modern Alternative: `jina-embeddings-v3`
- **Pros**: 
  - **Task Adapters**: You can tell it "this is for retrieval" vs "this is for clustering".
  - **Multilingual**: Excellent.
- **Cons**: Newer, slightly more complex ecosystem integration.

### **Recommendation**
**Stick with `bge-m3`**. Its ability to output **Sparse Vectors** natively allows us to implement **Hybrid Search** without managing a separate Elasticsearch/BM25 index. This simplifies infrastructure while hitting "Enterprise" quality.

---

## 3. Implementation Phases

### Phase 1: High-Performance Embedding Infrastructure
**Goal**: Decouple Embeddings from Ollama to unlock parallelism and Sparse Vectors.

1. **Replace Ollama for Embeddings**:
   - **Why**: Ollama processes serially. Ingestion of 1000 chunks takes forever.
   - **Action**: Use `infinity` (fastest) or `text-embeddings-inference` (HuggingFace) docker container.
   - **Benefit**: Batch processing (embed 100 chunks at once).

2. **Implement Hybrid Search (Dense + Sparse)**:
   - **Ingestion**: Compute both `dense_vector` and `sparse_vector` (lexical weights) for each chunk.
   - **Storage**: Qdrant supports named vectors. Store both.
   - **Retrieval**: Query Qdrant with `prefetch` (Hybrid fusion). This solves the "keyword match" problem (e.g., searching for specific ID "XJ-900").

### Phase 2: Precision & Re-ranking
**Goal**: Show the LLM *only* the best chunks, not just "kinda related" ones.

1. **Add Cross-Encoder Re-ranker**:
   - **Model**: `BAAI/bge-reranker-v2-m3` (pairs perfectly with bge-m3).
   - **Flow**: 
     - Retrieve Top-50 chunks via Hybrid Search.
     - Pass (Query, Chunk) pairs to Re-ranker.
     - Re-ranker scores them 0.0-1.0.
     - Take Top-10 for the LLM.
   - **Impact**: Massive quality jump. The Re-ranker "reads" the text and understands nuance that vector math misses.

### Phase 3: Query Intelligence
**Goal**: Fix user questions before searching.

1. **Query Rewriting**:
   - Use `Qwen2.5:7b` to rewrite "Compare them" -> "Compare Document A and Document B".
2. **Decomposition**:
   - Break complex questions "What is the revenue for 2021 and 2022?" into two searches.

---

## 4. Proposed Architecture Changes

### New Container: `inference-server`
Add `michaelf34/infinity` to `docker-compose.yml`.
```yaml
inference-server:
  image: michaelf34/infinity:latest
  command: v2 --model-id BAAI/bge-m3 --engine torch
  ports:
    - "7997:7997"
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```
*Note: Infinity is CPU optimized too if no GPU.*

### GPU/CPU Configuration Strategy

The Enterprise RAG services (`infinity`, `reranker`) are configured using a **Docker Compose override pattern**:

| File                      | Purpose                                              |
|---------------------------|------------------------------------------------------|
| `docker-compose.dev.yml`  | **Base file** - CPU mode (default, safe for all HW) |
| `docker-compose.gpu.yml`  | **Override file** - Adds GPU acceleration           |

**CPU Mode (Default)** - `docker-compose.dev.yml`:
- Sets `CUDA_VISIBLE_DEVICES=""` to force PyTorch CPU
- No `deploy.resources.reservations.devices` block
- Uses default `--dtype` (float32 for CPU compatibility)

**GPU Mode (Optional)** - Apply overlay `docker-compose.gpu.yml`:
```bash
docker compose -f docker-compose.dev.yml -f docker-compose.gpu.yml --profile local-llm up
```
- Adds `--dtype float16 --device cuda` to command
- Sets `CUDA_VISIBLE_DEVICES=0`
- Adds NVIDIA GPU reservation

> [!IMPORTANT]
> The `docker-compose.gpu.yml` file is an **override-only** file. It does NOT contain full service definitions—only the properties that differ from the base file. This keeps it minimal and maintainable.

### Python Dependency
Add `sentence-transformers` or `httpx` (for calling Infinity API) to `back-dl`.

---

## 5. Next Steps Checklist
- [ ] **Infrastructure**: Add `infinity` or `tei` to docker-compose.
- [ ] **Backend**: Rewrite `EmbeddingService` to hit the new inference server (batch mode).
- [ ] **DB**: Update Qdrant collection config to support `sparse_vectors`.
- [ ] **Logic**: Update `ingestion_service` to generate sparse weights.
- [ ] **Logic**: Update `chat.py` to perform Hybrid Search (Dense + Sparse).
