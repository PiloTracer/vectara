from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
from app.services.llm_service import LLMService
from app.services.embedding_service import EmbeddingService
from app.services.vector_service import VectorService
from app.config import settings

router = APIRouter(
    prefix="/chat",
    tags=["chat"]
)

logger = logging.getLogger(__name__)

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = [] # [{"role": "user", "content": "..."}, ...]
    use_rag: Optional[bool] = True
    filter: Optional[Dict[str, Any]] = None # e.g. {"source_ids": ["uuid-1", "uuid-2"]}
    
class ChatResponse(BaseModel):
    response: str
    sources: Optional[List[Dict[str, Any]]] = []

@router.post("/", response_model=ChatResponse)
async def chat_endpoint(
    request: ChatRequest,
    llm_service: LLMService = Depends(LLMService),
    embedding_service: EmbeddingService = Depends(EmbeddingService),
    vector_service: VectorService = Depends(VectorService)
):
    """
    Generic Chat Endpoint with RAG capabilities.
    """
    try:
        context_text = ""
        sources = []
        
        # 1. Retrieve Context (RAG)
        if request.use_rag and embedding_service.enabled and vector_service.enabled:
            logger.info(f"Generating embedding for query: {request.message}")
            embeddings = await embedding_service.generate_embeddings([request.message])
            
            if embeddings:
                logger.info(f"Searching vector database... Filters: {request.filter}")
                
                # Fetch more results for diversity
                raw_results = vector_service.search(
                    embeddings[0], 
                    limit=30,  # Fetch more to allow for diversification
                    filters=request.filter
                )
                
                if raw_results:
                    # Diversify results: ensure representation from all unique documents
                    # Take up to 2 best chunks per document, max 10 total
                    doc_chunks = {}  # path -> list of results
                    for res in raw_results:
                        doc_path = res.payload.get('path', 'Unknown')
                        if doc_path not in doc_chunks:
                            doc_chunks[doc_path] = []
                        if len(doc_chunks[doc_path]) < 2:  # Max 2 chunks per doc
                            doc_chunks[doc_path].append(res)
                    
                    # Flatten and take best overall (interleave from each doc)
                    diverse_results = []
                    max_rounds = 2
                    for round_idx in range(max_rounds):
                        for doc_path in sorted(doc_chunks.keys()):
                            if round_idx < len(doc_chunks[doc_path]):
                                diverse_results.append(doc_chunks[doc_path][round_idx])
                            if len(diverse_results) >= 12:
                                break
                        if len(diverse_results) >= 12:
                            break
                    
                    # Build sources list from diverse results
                    sources = [
                        {"id": p.id, "score": p.score, "metadata": p.payload} 
                        for p in diverse_results
                    ]
                    
                    # Construct context string
                    context_parts = []
                    unique_sources = set()
                    for res in diverse_results:
                        text = res.payload.get('text', '') or res.payload.get('content', '')
                        filename = res.payload.get('path', 'Unknown')
                        unique_sources.add(filename)
                        if text:
                            context_parts.append(f"--- SOURCE: {filename} ---\n{text}\n")
                    
                    context_text = "\n".join(context_parts)
                    sources_list = "\n".join(f"- {s}" for s in sorted(unique_sources))
                    logger.info(f"Found {len(diverse_results)} diverse results from {len(unique_sources)} documents.")
        
        # 2. Construct System Prompt
        system_prompt = (
            "You are a document assistant. Answer questions based ONLY on the context provided below.\n"
            "RULES:\n"
            "1. Each PDF filename in AVAILABLE DOCUMENTS is a REAL, VALID book or document.\n"
            "2. When listing available books, list ALL filenames from AVAILABLE DOCUMENTS.\n"
            "3. Use ONLY information from the CONTEXT section to answer questions.\n"
            "4. Cite the source filename when providing information.\n"
            "5. If information is not in the context, say 'I don't have that information in the provided context.'\n\n"
        )
        
        if context_text:
            system_prompt += f"AVAILABLE DOCUMENTS:\n{sources_list}\n\n"
            system_prompt += f"CONTEXT FROM DOCUMENTS:\n{context_text}\n\n"
            
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add history
        for msg in request.history:
            messages.append(msg)
            
        # Add current message
        messages.append({"role": "user", "content": request.message})
        
        # 3. Call LLM
        logger.info("Sending request to LLM...")
        llm_response = await llm_service.chat(messages)
        
        # 4. Extract Response
        assistant_message = llm_response.get("message", {}).get("content", "")
        
        return ChatResponse(
            response=assistant_message,
            sources=sources
        )

    except Exception as e:
        logger.error(f"Chat failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
