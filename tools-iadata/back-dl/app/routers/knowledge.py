from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Dict, Any
from app.services.vector_service import VectorService
from pydantic import BaseModel

router = APIRouter(
    prefix="/knowledge",
    tags=["knowledge"]
)

class DocumentInfo(BaseModel):
    path: str
    chunk_count: int
    source_type: str = "unknown"

class CollectionStats(BaseModel):
    points_count: int
    vectors_count: int
    status: str

@router.get("/", response_model=List[DocumentInfo])
async def list_documents(
    vector_service: VectorService = Depends(VectorService)
):
    """List all documents in the vector database."""
    stats = vector_service.get_document_stats()
    return [
        DocumentInfo(
            path=s["path"],
            chunk_count=s["chunk_count"],
            source_type="local" # TODO: Infer from path or metadata
        ) for s in stats
    ]

@router.get("/stats", response_model=CollectionStats)
async def get_stats(
    vector_service: VectorService = Depends(VectorService)
):
    """Get collection statistics."""
    info = vector_service.get_collection_info()
    if not info:
        raise HTTPException(status_code=503, detail="Vector service unavailable")
    
    return CollectionStats(
        points_count=info.get("points_count", 0),
        vectors_count=info.get("vectors_count", 0),
        status=info.get("status", "unknown")
    )

@router.delete("/{path:path}")
async def delete_document(
    path: str,
    vector_service: VectorService = Depends(VectorService)
):
    """Delete a document by its path."""
    success = vector_service.delete_by_path(path)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found or delete failed")
    
    return {"status": "success", "deleted_path": path}
