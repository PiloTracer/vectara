"""
Enterprise RAG Vector Service.
Manages Qdrant collection with hybrid (dense + sparse) vector storage.
Implements multi-stage hybrid search with prefetch.
"""
import logging
import uuid
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models
from app.config import settings

logger = logging.getLogger(__name__)


class VectorService:
    """
    Enterprise-grade vector service with hybrid search capabilities.
    Supports both dense (semantic) and sparse (lexical) vectors.
    """
    
    COLLECTION_NAME = "documents"
    # BGE-M3 outputs 1024-dimensional dense vectors
    DENSE_VECTOR_SIZE = 1024
    
    def __init__(self):
        self.enabled = settings.USE_LOCAL_EMBEDDING
        self.client = None
        if self.enabled:
            try:
                self.client = QdrantClient(url=settings.QDRANT_URL)
            except Exception as e:
                logger.error(f"Failed to initialize Qdrant client: {e}")
                self.enabled = False 

    def ensure_collection(self):
        """
        Ensure the collection exists with hybrid vector configuration.
        Supports both 'dense' and 'sparse' named vectors.
        """
        if not self.enabled or not self.client:
            return

        try:
            collections = self.client.get_collections()
            exists = any(c.name == self.COLLECTION_NAME for c in collections.collections)
            
            if not exists:
                logger.info(f"Creating hybrid collection '{self.COLLECTION_NAME}'")
                self.client.create_collection(
                    collection_name=self.COLLECTION_NAME,
                    vectors_config={
                        "dense": models.VectorParams(
                            size=self.DENSE_VECTOR_SIZE,
                            distance=models.Distance.COSINE
                        )
                    },
                    sparse_vectors_config={
                        "sparse": models.SparseVectorParams(
                            modifier=models.Modifier.IDF  # For lexical similarity
                        )
                    }
                )
                logger.info(f"Created hybrid collection with dense + sparse vectors")
            else:
                # Check if we need to migrate from legacy single-vector format
                collection_info = self.client.get_collection(self.COLLECTION_NAME)
                config = collection_info.config.params.vectors
                
                # If vectors is a VectorParams (legacy), we need to recreate
                if isinstance(config, models.VectorParams):
                    logger.warning("Legacy collection detected. Consider recreating with hybrid config.")
                    # For now, we'll work with legacy format
                    
        except Exception as e:
            logger.error(f"Error checking/creating collection: {e}")

    def upsert_vectors(self, points: List[Dict[str, Any]]):
        """
        Upsert vectors to Qdrant.
        
        Expects points with structure:
        {
            'id': uuid,
            'dense_vector': [...],
            'sparse_indices': [...],
            'sparse_values': [...],
            'payload': {...}
        }
        
        Also supports legacy format with single 'vector' key.
        """
        if not self.enabled or not self.client:
            return

        try:
            point_structs = []
            
            for p in points:
                point_id = str(p.get("id", uuid.uuid4()))
                payload = p.get("payload", {})
                
                # Check for new hybrid format
                if "dense_vector" in p:
                    dense = p["dense_vector"]
                    sparse_indices = p.get("sparse_indices", [])
                    sparse_values = p.get("sparse_values", [])
                    
                    vectors = {"dense": dense}
                    
                    # Add sparse vector if available
                    if sparse_indices and sparse_values:
                        vectors["sparse"] = models.SparseVector(
                            indices=sparse_indices,
                            values=sparse_values
                        )
                    
                    point_structs.append(
                        models.PointStruct(
                            id=point_id,
                            vector=vectors,
                            payload=payload
                        )
                    )
                else:
                    # Legacy format with single 'vector'
                    point_structs.append(
                        models.PointStruct(
                            id=point_id,
                            vector=p["vector"],
                            payload=payload
                        )
                    )
            
            self.client.upsert(
                collection_name=self.COLLECTION_NAME,
                points=point_structs
            )
            logger.info(f"Upserted {len(point_structs)} vectors to {self.COLLECTION_NAME}")
            
        except Exception as e:
            logger.error(f"Failed to upsert vectors: {e}")

    def search(
        self, 
        query_vector: List[float], 
        limit: int = 5, 
        filters: Optional[Dict[str, Any]] = None
    ):
        """
        Legacy search method for backwards compatibility.
        Uses dense vector only.
        """
        return self.hybrid_search(
            dense_vector=query_vector,
            sparse_indices=None,
            sparse_values=None,
            limit=limit,
            filters=filters
        )

    def hybrid_search(
        self,
        dense_vector: List[float],
        sparse_indices: Optional[List[int]] = None,
        sparse_values: Optional[List[float]] = None,
        limit: int = 50,
        filters: Optional[Dict[str, Any]] = None
    ):
        """
        Enterprise hybrid search using both dense and sparse vectors.
        
        Uses Qdrant's prefetch mechanism for multi-stage retrieval:
        1. Prefetch candidates from dense vector (semantic)
        2. Prefetch candidates from sparse vector (lexical)
        3. Fuse results using RRF (Reciprocal Rank Fusion)
        """
        if not self.enabled or not self.client:
            return []

        try:
            query_filter = None
            if filters and "source_ids" in filters:
                query_filter = models.Filter(
                    must=[
                        models.FieldCondition(
                            key="source_id",
                            match=models.MatchAny(any=filters["source_ids"])
                        )
                    ]
                )

            # Check collection format
            collection_info = self.client.get_collection(self.COLLECTION_NAME)
            config = collection_info.config.params.vectors
            
            # Legacy single-vector collection
            if isinstance(config, models.VectorParams):
                result = self.client.query_points(
                    collection_name=self.COLLECTION_NAME,
                    query=dense_vector,
                    query_filter=query_filter,
                    limit=limit,
                    with_payload=True
                )
                return result.points
            
            # New hybrid collection - use prefetch for multi-stage retrieval
            prefetch_queries = []
            
            # Dense vector prefetch (semantic)
            prefetch_queries.append(
                models.Prefetch(
                    query=dense_vector,
                    using="dense",
                    limit=limit * 2  # Fetch more for fusion
                )
            )
            
            # Sparse vector prefetch (lexical) if available
            if sparse_indices and sparse_values:
                prefetch_queries.append(
                    models.Prefetch(
                        query=models.SparseVector(
                            indices=sparse_indices,
                            values=sparse_values
                        ),
                        using="sparse",
                        limit=limit * 2
                    )
                )
            
            # Query with RRF fusion
            result = self.client.query_points(
                collection_name=self.COLLECTION_NAME,
                prefetch=prefetch_queries if len(prefetch_queries) > 1 else None,
                query=dense_vector if len(prefetch_queries) == 1 else models.FusionQuery(
                    fusion=models.Fusion.RRF  # Reciprocal Rank Fusion
                ),
                using="dense" if len(prefetch_queries) == 1 else None,
                query_filter=query_filter,
                limit=limit,
                with_payload=True
            )
            
            return result.points
            
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return []

    def delete_by_source(self, source_id: str):
        """Delete all vectors for a specific data source."""
        if not self.enabled or not self.client:
            return

        try:
            self.client.delete(
                collection_name=self.COLLECTION_NAME,
                points_selector=models.FilterSelector(
                    filter=models.Filter(
                        must=[
                            models.FieldCondition(
                                key="source_id",
                                match=models.MatchValue(value=source_id)
                            )
                        ]
                    )
                )
            )
            logger.info(f"Deleted vectors for source {source_id}")
        except Exception as e:
            logger.error(f"Failed to delete vectors: {e}")

    def get_collection_info(self) -> Optional[Dict[str, Any]]:
        """Get collection statistics."""
        if not self.enabled or not self.client:
            return None

        try:
            info = self.client.get_collection(self.COLLECTION_NAME)
            return {
                "points_count": info.points_count,
                "vectors_count": info.vectors_count,
                "status": info.status
            }
        except Exception as e:
            logger.error(f"Failed to get collection info: {e}")
            return None
