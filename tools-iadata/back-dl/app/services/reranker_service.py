"""
Enterprise RAG Reranker Service.
Uses Cross-Encoder model via Infinity for precise relevance scoring.
"""
import logging
import httpx
from typing import List, Dict, Any, Tuple
from dataclasses import dataclass
from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class RankedResult:
    """Container for a reranked result with its score."""
    index: int
    score: float
    payload: Dict[str, Any]


class RerankerService:
    """
    Cross-encoder reranking service using bge-reranker-v2-m3.
    Takes (query, chunks) and returns accurately scored results.
    """
    
    BATCH_SIZE = 32  # Match server batch size
    
    def __init__(self):
        self.enabled = settings.USE_LOCAL_EMBEDDING
        self.reranker_url = settings.RERANKER_URL
        self._available = None  # Cached availability
        
    async def is_available(self) -> bool:
        """Check if reranker service is available."""
        if self._available is not None:
            return self._available
            
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.reranker_url}/health")
                self._available = resp.status_code == 200
                if self._available:
                    logger.info(f"Reranker service available at {self.reranker_url}")
                return self._available
        except Exception as e:
            logger.warning(f"Reranker not available: {e}")
            self._available = False
            return False
    
    async def rerank(
        self,
        query: str,
        documents: List[Dict[str, Any]],
        text_key: str = "text",
        top_k: int = 10
    ) -> List[RankedResult]:
        """
        Rerank documents by relevance to query using cross-encoder.
        
        Args:
            query: The search query
            documents: List of document dicts with text content
            text_key: Key in document dict containing text to score
            top_k: Number of top results to return
            
        Returns:
            List of RankedResult sorted by score (highest first)
        """
        if not self.enabled or not documents:
            # Return original order if not enabled
            return [
                RankedResult(index=i, score=1.0 - (i * 0.01), payload=doc)
                for i, doc in enumerate(documents[:top_k])
            ]
            
        if not await self.is_available():
            # Fallback: return original order
            logger.warning("Reranker not available, using original order")
            return [
                RankedResult(index=i, score=1.0 - (i * 0.01), payload=doc)
                for i, doc in enumerate(documents[:top_k])
            ]
        
        try:
            # Build query-document pairs
            pairs = []
            valid_indices = []
            
            for i, doc in enumerate(documents):
                text = doc.get(text_key, "") or doc.get("content", "")
                if text:
                    pairs.append([query, text])
                    valid_indices.append(i)
            
            if not pairs:
                return []
            
            # Score pairs via reranker API
            scores = await self._score_pairs(pairs)
            
            # Combine with original documents
            results = []
            for idx, (orig_idx, score) in enumerate(zip(valid_indices, scores)):
                results.append(RankedResult(
                    index=orig_idx,
                    score=score,
                    payload=documents[orig_idx]
                ))
            
            # Sort by score descending
            results.sort(key=lambda x: x.score, reverse=True)
            
            return results[:top_k]
            
        except Exception as e:
            logger.error(f"Reranking failed: {e}")
            return [
                RankedResult(index=i, score=1.0 - (i * 0.01), payload=doc)
                for i, doc in enumerate(documents[:top_k])
            ]
    
    async def _score_pairs(self, pairs: List[List[str]]) -> List[float]:
        """
        Score query-document pairs using cross-encoder API.
        """
        scores = []
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Process in batches
            for i in range(0, len(pairs), self.BATCH_SIZE):
                batch = pairs[i:i + self.BATCH_SIZE]
                
                # Infinity reranker API format
                payload = {
                    "model": "BAAI/bge-reranker-v2-m3",
                    "query": batch[0][0],  # All pairs have same query
                    "documents": [p[1] for p in batch]
                }
                
                resp = await client.post(
                    f"{self.reranker_url}/rerank",
                    json=payload
                )
                
                if resp.status_code == 200:
                    data = resp.json()
                    # Extract scores from response
                    for result in data.get("results", []):
                        scores.append(result.get("relevance_score", 0.0))
                else:
                    logger.error(f"Reranker API failed: {resp.status_code} - {resp.text}")
                    # Return neutral scores for failed batch
                    scores.extend([0.5] * len(batch))
        
        return scores
