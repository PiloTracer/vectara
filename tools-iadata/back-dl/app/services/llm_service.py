import logging
from typing import AsyncGenerator
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

class LLMService:
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.model_name = settings.LOCAL_MODEL_NAME

    async def ensure_model_available(self) -> bool:
        try:
            logger.info(f"Checking availability of chat model '{self.model_name}'...")
            async with httpx.AsyncClient() as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                if resp.status_code != 200:
                    logger.error(f"Failed to connect to Ollama: {resp.text}")
                    return False

                models = [m['name'] for m in resp.json().get('models', [])]
                if any(self.model_name in m for m in models):
                    logger.info(f"Chat model '{self.model_name}' is available.")
                    return True

                logger.info(f"Chat model '{self.model_name}' not found. Initiating pull...")
                async with client.stream("POST", f"{self.base_url}/api/pull", json={"name": self.model_name}) as response:
                    async for line in response.aiter_lines():
                        if not line:
                            continue

                logger.info(f"Successfully pulled chat model '{self.model_name}'.")
                return True

        except Exception as e:
            logger.error(f"Error ensuring chat model availability: {e}")
            return False

    async def chat(self, messages: list, stream: bool = False):
        payload = {
            "model": self.model_name,
            "messages": messages,
            "stream": stream,
            "options": {
                "temperature": 0.1,
                "top_p": 0.5,
                "repeat_penalty": 1.2,
                "num_ctx": 8192,
            }
        }

        if stream:
            return self._stream_response(payload)
        else:
            async with httpx.AsyncClient(timeout=120.0) as client:
                try:
                    response = await client.post(f"{self.base_url}/api/chat", json=payload)
                    response.raise_for_status()
                    return response.json()
                except Exception as e:
                    logger.error(f"Error during chat generation: {e}")
                    raise

    async def _stream_response(self, payload: dict) -> AsyncGenerator[str, None]:
        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                async with client.stream("POST", f"{self.base_url}/api/chat", json=payload) as response:
                    async for line in response.aiter_lines():
                        if line:
                            yield line
            except Exception as e:
                logger.error(f"Error during streaming chat: {e}")
                raise
