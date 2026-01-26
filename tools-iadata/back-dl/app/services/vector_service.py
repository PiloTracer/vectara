import logging
import uuid
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models
from app.config import settings

logger = logging.getLogger(__name__)

class VectorService:
    """
    Service to interact with Qdrant Vector Database.
    Handles collection management and vector storage.
    """
    
    COLLECTION_NAME = "documents"
    # BGE-M3 (BAAI/bge-m3) outputs 1024-dimensional vectors.
    # This is the default embedding model for this system.
    VECTOR_SIZE = 1024
    
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
        """Ensure the main collection exists."""
        if not self.enabled or not self.client:
            return

        try:
            collections = self.client.get_collections()
            exists = any(c.name == self.COLLECTION_NAME for c in collections.collections)
            
            if not exists:
                logger.info(f"Creating collection '{self.COLLECTION_NAME}'")
                self.client.create_collection(
                    collection_name=self.COLLECTION_NAME,
                    vectors_config=models.VectorParams(
                        size=self.VECTOR_SIZE,
                        distance=models.Distance.COSINE
                    )
                )
        except Exception as e:
            logger.error(f"Error checking/creating collection: {e}")

    def upsert_vectors(self, points: List[Dict[str, Any]]):
        """
        Upsert vectors to Qdrant.
        points: list of dicts with 'id', 'vector', 'payload'
        """
        if not self.enabled or not self.client:
            return

        try:
            # Convert dicts to PointStructs
            point_structs = [
                models.PointStruct(
                    id=str(p.get("id", uuid.uuid4())), 
                    vector=p["vector"],
                    payload=p.get("payload", {})
                ) 
                for p in points
            ]
            
            self.client.upsert(
                collection_name=self.COLLECTION_NAME,
                points=point_structs
            )
            logger.info(f"Upserted {len(point_structs)} vectors to {self.COLLECTION_NAME}")
            
        except Exception as e:
            logger.error(f"Failed to upsert vectors: {e}")
            
    def search(self, query_vector: List[float], limit: int = 5, filters: Optional[Dict[str, Any]] = None):
        """
        Search for similar vectors.
        filters: dict containing filtering criteria (e.g., {'source_ids': ['id1', 'id2']})
        """
        if not self.enabled or not self.client:
            return []

        try:
            query_filter = None
            if filters and "source_ids" in filters:
                # Construct Qdrant Filter
                # We use MatchAny to allow any of the provided source_ids
                query_filter = models.Filter(
                    must=[
                        models.FieldCondition(
                            key="source_id",
                            match=models.MatchAny(any=filters["source_ids"])
                        )
                    ]
                )

            # v1.10+ uses query_points
            result = self.client.query_points(
                collection_name=self.COLLECTION_NAME,
                query=query_vector,
                query_filter=query_filter,
                limit=limit,
                with_payload=True
            )
            return result.points
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return []
