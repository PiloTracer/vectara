import logging
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

class LLMService:
    """
    Service to interact with a local LLM (Ollama) for chat/generation.
    Handles model availability checks and auto-pulling.
    """
    
    def __init__(self):
        # We assume if embedding is enabled, local LLM usage is also desired, 
        # or we might need a separate flag. For now reusing the main flag or checking model presence.
        self.base_url = settings.OLLAMA_BASE_URL
        self.model_name = settings.LOCAL_MODEL_NAME
        
    async def ensure_model_available(self) -> bool:
        """
        Check if the configured chat model exists in Ollama.
        If not, attempt to pull it.
        """
        try:
            logger.info(f"Checking availability of chat model '{self.model_name}'...")
            async with httpx.AsyncClient() as client:
                # 1. Check existing tags
                resp = await client.get(f"{self.base_url}/api/tags")
                if resp.status_code != 200:
                    logger.error(f"Failed to connect to Ollama: {resp.text}")
                    return False
                    
                models = [m['name'] for m in resp.json().get('models', [])]
                
                # Check for match
                is_present = any(self.model_name in m for m in models)
                
                if is_present:
                    logger.info(f"Chat model '{self.model_name}' is available.")
                    return True
                    
                # 2. Pull model if missing
                logger.info(f"Chat model '{self.model_name}' not found. Initiating pull... this may take time.")
                
                async with client.stream("POST", f"{self.base_url}/api/pull", json={"name": self.model_name}) as response:
                     async for line in response.aiter_lines():
                         if not line: continue
                         pass
                
                logger.info(f"Successfully pulled chat model '{self.model_name}'.")
                return True
                
        except Exception as e:
            logger.error(f"Error ensuring chat model availability: {e}")
            return False
