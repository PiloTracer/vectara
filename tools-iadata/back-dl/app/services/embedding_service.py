"""
Enterprise RAG Embedding Service.
Uses Infinity inference server for high-performance batch embeddings.
Generates both dense and sparse (lexical) vectors from bge-m3.
"""
import logging
import httpx
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class HybridEmbedding:
    """Container for dense + sparse vector pair."""
    dense: List[float]
    sparse_indices: List[int]
    sparse_values: List[float]


class EmbeddingService:
    """
    Enterprise-grade embedding service using Infinity inference server.
    Supports batch processing and hybrid (dense + sparse) embeddings.
    """
    
    BATCH_SIZE = 32  # Match Infinity server batch size
    
    def __init__(self):
        self.enabled = settings.USE_LOCAL_EMBEDDING
        self.infinity_url = settings.INFINITY_URL
        # Fallback to Ollama if Infinity not configured
        self.ollama_url = settings.OLLAMA_BASE_URL
        self.model_name = settings.LOCAL_EMBEDDING_MODEL_NAME
        self._use_infinity = True  # Will be set based on health check
        
    async def ensure_model_available(self) -> bool:
        """
        Check if Infinity embedding server is available.
        Falls back to Ollama if Infinity is not available.
        """
        if not self.enabled:
            return True
            
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Check Infinity first
                try:
                    resp = await client.get(f"{self.infinity_url}/health")
                    if resp.status_code == 200:
                        logger.info(f"Infinity embedding server available at {self.infinity_url}")
                        self._use_infinity = True
                        return True
                except Exception as e:
                    logger.warning(f"Infinity not available: {e}")
                
                # Fallback to Ollama
                logger.info("Falling back to Ollama for embeddings...")
                self._use_infinity = False
                resp = await client.get(f"{self.ollama_url}/api/tags")
                if resp.status_code == 200:
                    models = [m['name'] for m in resp.json().get('models', [])]
                    is_present = any(self.model_name in m for m in models)
                    if is_present:
                        logger.info(f"Ollama model '{self.model_name}' is available.")
                        return True
                    # Pull if missing
                    logger.info(f"Pulling {self.model_name} via Ollama...")
                    async with client.stream("POST", f"{self.ollama_url}/api/pull", 
                                            json={"name": self.model_name}) as response:
                        async for _ in response.aiter_lines():
                            pass
                    return True
                    
        except Exception as e:
            logger.error(f"Error ensuring model availability: {e}")
            return False
        
        return False

    async def generate_embeddings(
        self, 
        texts: List[str],
        return_sparse: bool = True
    ) -> List[HybridEmbedding]:
        """
        Generate embeddings for a batch of texts.
        Returns list of HybridEmbedding objects with dense + sparse vectors.
        
        If Infinity is available: batch processing with sparse vectors.
        If Ollama fallback: serial processing, dense only.
        """
        if not self.enabled or not texts:
            return []
            
        if self._use_infinity:
            return await self._generate_infinity_embeddings(texts, return_sparse)
        else:
            return await self._generate_ollama_embeddings(texts)
    
    async def _generate_infinity_embeddings(
        self, 
        texts: List[str],
        return_sparse: bool = True
    ) -> List[HybridEmbedding]:
        """
        Use Infinity server for batch embeddings with sparse support.
        """
        embeddings = []
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                # Process in batches
                for i in range(0, len(texts), self.BATCH_SIZE):
                    batch = texts[i:i + self.BATCH_SIZE]
                    
                    # Infinity API expects 'input' parameter
                    payload = {
                        "model": "BAAI/bge-m3",
                        "input": batch
                    }
                    
                    resp = await client.post(
                        f"{self.infinity_url}/embeddings",
                        json=payload
                    )
                    
                    if resp.status_code == 200:
                        data = resp.json()
                        
                        for item in data.get("data", []):
                            dense = item.get("embedding", [])
                            
                            # Extract sparse vectors if available
                            sparse_indices = []
                            sparse_values = []
                            
                            if return_sparse and "sparse_embedding" in item:
                                sparse = item["sparse_embedding"]
                                sparse_indices = sparse.get("indices", [])
                                sparse_values = sparse.get("values", [])
                            
                            embeddings.append(HybridEmbedding(
                                dense=dense,
                                sparse_indices=sparse_indices,
                                sparse_values=sparse_values
                            ))
                    else:
                        logger.error(f"Infinity embedding failed: {resp.status_code} - {resp.text}")
                        # Return empty embeddings for failed batch
                        for _ in batch:
                            embeddings.append(HybridEmbedding(
                                dense=[], sparse_indices=[], sparse_values=[]
                            ))
                            
        except Exception as e:
            logger.error(f"Error generating Infinity embeddings: {e}")
            
        return embeddings
    
    async def _generate_ollama_embeddings(self, texts: List[str]) -> List[HybridEmbedding]:
        """
        Fallback to Ollama for embeddings (dense only, serial processing).
        """
        embeddings = []
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                for text in texts:
                    resp = await client.post(
                        f"{self.ollama_url}/api/embeddings",
                        json={
                            "model": self.model_name,
                            "prompt": text
                        }
                    )
                    
                    if resp.status_code == 200:
                        dense = resp.json().get("embedding", [])
                        embeddings.append(HybridEmbedding(
                            dense=dense,
                            sparse_indices=[],
                            sparse_values=[]
                        ))
                    else:
                        logger.error(f"Ollama embedding failed: {resp.text}")
                        embeddings.append(HybridEmbedding(
                            dense=[], sparse_indices=[], sparse_values=[]
                        ))
                        
        except Exception as e:
            logger.error(f"Error generating Ollama embeddings: {e}")
            
        return embeddings

    async def generate_query_embedding(self, query: str) -> Optional[HybridEmbedding]:
        """
        Generate embedding for a single query.
        Convenience method for search operations.
        """
        results = await self.generate_embeddings([query], return_sparse=True)
        return results[0] if results else None
