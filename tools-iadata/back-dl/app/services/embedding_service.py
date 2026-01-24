import logging
import httpx
from typing import List
from app.config import settings

logger = logging.getLogger(__name__)

class EmbeddingService:
    """
    Service to generate embeddings using a local LLM (Ollama).
    handles model availability checks and auto-pulling.
    """
    
    def __init__(self):
        self.enabled = settings.USE_LOCAL_EMBEDDING
        self.base_url = settings.OLLAMA_BASE_URL
        self.model_name = settings.LOCAL_EMBEDDING_MODEL_NAME
        
    async def ensure_model_available(self) -> bool:
        """
        Check if the configured model exists in Ollama.
        If not, attempt to pull it.
        """
        if not self.enabled:
            return True # Not relevant if disabled
            
        try:
            async with httpx.AsyncClient() as client:
                # 1. Check existing tags
                resp = await client.get(f"{self.base_url}/api/tags")
                if resp.status_code != 200:
                    logger.error(f"Failed to connect to Ollama: {resp.text}")
                    return False
                    
                models = [m['name'] for m in resp.json().get('models', [])]
                
                # Check for match (fuzzy or exact)
                # Ollama tags often have :latest suffix
                is_present = any(self.model_name in m for m in models)
                
                if is_present:
                    logger.info(f"Model '{self.model_name}' is available.")
                    return True
                    
                # 2. Pull model if missing
                logger.info(f"Model '{self.model_name}' not found. Initiating pull... this may take time.")
                
                # Streaming pull to keep connection alive
                async with client.stream("POST", f"{self.base_url}/api/pull", json={"name": self.model_name}) as response:
                     async for line in response.aiter_lines():
                         if not line: continue
                         # Simply consuming the stream waits for completion
                         # Could parse JSON for progress bar here
                         pass
                
                logger.info(f"Successfully pulled model '{self.model_name}'.")
                return True
                
        except Exception as e:
            logger.error(f"Error ensuring model availability: {e}")
            return False

    async def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for a batch of texts.
        Returns empty list if disabled or failed.
        """
        if not self.enabled:
            return []
            
        embeddings = []
        try:
            async with httpx.AsyncClient() as client:
                for text in texts:
                    # Ollama embedding API is single-text per request usually
                    resp = await client.post(
                        f"{self.base_url}/api/embeddings",
                        json={
                            "model": self.model_name,
                            "prompt": text
                        },
                        timeout=60.0 # Embeddings can be slow
                    )
                    
                    if resp.status_code == 200:
                        embedding = resp.json().get("embedding")
                        if embedding:
                            embeddings.append(embedding)
                    else:
                        logger.error(f"Embedding failed: {resp.text}")
                        
        except Exception as e:
            logger.error(f"Error generating embeddings: {e}")
            
        return embeddings
