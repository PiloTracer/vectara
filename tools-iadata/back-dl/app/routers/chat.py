"""
Enterprise RAG Chat Endpoint.
Implements hybrid search (dense + sparse) with cross-encoder re-ranking.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
from app.services.llm_service import LLMService
from app.services.embedding_service import EmbeddingService
from app.services.vector_service import VectorService
from app.services.reranker_service import RerankerService
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.models.chat import ChatSession, ChatMessage
import uuid
from sqlalchemy import select
from datetime import datetime

router = APIRouter(
    prefix="/chat",
    tags=["chat"]
)

logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = []  # [{"role": "user", "content": "..."}]
    use_rag: Optional[bool] = True
    filter: Optional[Dict[str, Any]] = None  # e.g. {"source_ids": ["uuid-1"]}
    session_id: Optional[uuid.UUID] = None


class ChatResponse(BaseModel):
    response: str
    sources: Optional[List[Dict[str, Any]]] = []
    session_id: Optional[uuid.UUID] = None


@router.post("/", response_model=ChatResponse)
async def chat_endpoint(
    request: ChatRequest,
    llm_service: LLMService = Depends(LLMService),
    embedding_service: EmbeddingService = Depends(EmbeddingService),
    vector_service: VectorService = Depends(VectorService),
    reranker_service: RerankerService = Depends(RerankerService),
    db: AsyncSession = Depends(get_db)
):
    """
    Enterprise Chat Endpoint with RAG capabilities and Session History.
    """
    try:
        # 0. Session Management
        session = None
        if request.session_id:
            stmt = select(ChatSession).where(ChatSession.id == request.session_id)
            result = await db.execute(stmt)
            session = result.scalar_one_or_none()
        
        if not session:
            # Create new session
            session = ChatSession(
                user_id="default_user", # TODO: Auth
                title=request.message[:50]
            )
            db.add(session)
            await db.commit()
            await db.refresh(session)
        
        context_text = ""
        sources = []
        
        # 1. Retrieve Context (RAG)
        if request.use_rag and embedding_service.enabled and vector_service.enabled:
            # ... (RAG logic remains same) ...
             logger.info(f"Generating hybrid embedding for query: {request.message}")
            
             # Generate hybrid embedding (dense + sparse)
             query_embedding = await embedding_service.generate_query_embedding(request.message)
            
             if query_embedding and query_embedding.dense:
                logger.info(f"Performing hybrid search... Filters: {request.filter}")
                
                # Hybrid search with dense + sparse vectors
                raw_results = vector_service.hybrid_search(
                    dense_vector=query_embedding.dense,
                    sparse_indices=query_embedding.sparse_indices if query_embedding.sparse_indices else None,
                    sparse_values=query_embedding.sparse_values if query_embedding.sparse_values else None,
                    limit=50,  # Fetch many for re-ranking
                    filters=request.filter
                )
                
                if raw_results:
                    logger.info(f"Retrieved {len(raw_results)} results, applying re-ranking...")
                    
                    # Prepare documents for re-ranking
                    docs_for_rerank = [
                        {
                            "id": res.id,
                            "score": res.score,
                            "text": res.payload.get('text', '') or res.payload.get('content', ''),
                            "path": res.payload.get('path', 'Unknown'),
                            "payload": res.payload
                        }
                        for res in raw_results
                    ]
                    
                    # Re-rank with cross-encoder for precision
                    reranked = await reranker_service.rerank(
                        query=request.message,
                        documents=docs_for_rerank,
                        text_key="text",
                        top_k=10  # Keep top 10 after re-ranking
                    )
                    
                    logger.info(f"Re-ranked to {len(reranked)} top results")
                    
                    # Build sources list from re-ranked results
                    sources = [
                        {
                            "id": r.payload.get("id"),
                            "score": r.score,
                            "metadata": r.payload.get("payload", r.payload)
                        } 
                        for r in reranked
                    ]
                    
                    # Construct context string from re-ranked results
                    context_parts = []
                    unique_sources = set()
                    
                    for ranked_result in reranked:
                        text = ranked_result.payload.get('text', '')
                        path = ranked_result.payload.get('path', 'Unknown')
                        unique_sources.add(path)
                        
                        if text:
                            context_parts.append(f"--- SOURCE: {path} (relevance: {ranked_result.score:.3f}) ---\n{text}\n")
                    
                    context_text = "\n".join(context_parts)
                    
                    # For inventory queries: also get all unique document paths
                    # This ensures "what books do you have?" always shows all documents
                    all_docs = vector_service.get_all_unique_documents()
                    if all_docs:
                        sources_list = "\n".join(f"- {s}" for s in sorted(all_docs))
                    else:
                        sources_list = "\n".join(f"- {s}" for s in sorted(unique_sources))
                    
                    logger.info(f"Context built from {len(unique_sources)} unique documents, {len(all_docs or [])} total docs available")

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

        # 5. Persist Chat
        if session:
            # Save User Message
            user_msg = ChatMessage(
                session_id=session.id,
                role="user",
                content=request.message
            )
            db.add(user_msg)
            
            # Save Assistant Message
            meta = {"rag_used": bool(context_text), "sources_count": len(sources)}
            assistant_msg = ChatMessage(
                session_id=session.id,
                role="assistant",
                content=assistant_message,
                meta=meta
            )
            db.add(assistant_msg)
            
            session.updated_at = datetime.utcnow()
            await db.commit()
        
        return ChatResponse(
            response=assistant_message,
            sources=sources,
            session_id=session.id
        )

    except Exception as e:
        logger.error(f"Chat failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
