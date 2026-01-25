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
                logger.info("Searching vector database...")
                search_results = vector_service.search(embeddings[0], limit=5)
                
                if search_results:
                    sources = [
                        {"id": p.id, "score": p.score, "metadata": p.payload} 
                        for p in search_results
                    ]
                    
                    # Construct context string
                    context_parts = []
                    for res in search_results:
                        text = res.payload.get('text', '') or res.payload.get('content', '')
                        filename = res.payload.get('path', 'Unknown') # Changed from filename to path
                        if text:
                            context_parts.append(f"--- SOURCE: {filename} ---\n{text}\n")
                    
                    context_text = "\n".join(context_parts)
                    logger.info(f"Found {len(search_results)} relevant documents.")
        
        # 2. Construct System Prompt
        system_prompt = (
            "You are a helpful AI assistant. "
            "Use the following context to answer the user's question. "
            "If the answer is not in the context, say so, but you can still try to help based on your general knowledge. "
            "Always cite the source filename if you use information from the context.\n\n"
        )
        
        if context_text:
            system_prompt += f"CONTEXT:\n{context_text}\n\n"
            
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
