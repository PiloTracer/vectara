import os
from functools import lru_cache
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Environment
    ENVIRONMENT: str = "development"
    
    # Database
    DB_USER: str = os.getenv("DB_USER", "postgres")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "password")
    DB_HOST: str = os.getenv("DB_HOST", "pg-dl")
    DB_PORT: str = "5432"
    DB_NAME: str = os.getenv("DB_NAME", "tools_iadata")
    
    @property
    def DB_URL(self) -> str:
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    # Qdrant (Vector DB)
    QDRANT_HOST: str = os.getenv("QDRANT_HOST", "ia-dl")
    QDRANT_PORT: int = int(os.getenv("QDRANT_PORT", 6333))

    @property
    def QDRANT_URL(self) -> str:
        return f"http://{self.QDRANT_HOST}:{self.QDRANT_PORT}"
    
    # LLM & Embeddings
    USE_LOCAL_EMBEDDING: bool = os.getenv("USE_LOCAL_EMBEDDING", "false").lower() == "true"
    LOCAL_MODEL_NAME: str = os.getenv("LOCAL_MODEL_NAME", "qwen2.5:7b") # Chat Model (3B for CPU)
    LOCAL_EMBEDDING_MODEL_NAME: str = os.getenv("LOCAL_EMBEDDING_MODEL_NAME", "bge-m3") # Embedding Model
    OLLAMA_HOST: str = os.getenv("OLLAMA_HOST", "llm-dl")
    OLLAMA_PORT: int = int(os.getenv("OLLAMA_PORT", 11434))
    
    # OCR Model (Vision-based text extraction)
    USE_LOCAL_OCR: bool = os.getenv("USE_LOCAL_OCR", "false").lower() == "true"
    LOCAL_OCR_MODEL_NAME: str = os.getenv("LOCAL_OCR_MODEL_NAME", "")
    
    @property
    def OLLAMA_BASE_URL(self) -> str:
        return f"http://{self.OLLAMA_HOST}:{self.OLLAMA_PORT}"

    # Enterprise RAG: Infinity Embedding Server
    INFINITY_HOST: str = os.getenv("INFINITY_HOST", "infinity")
    INFINITY_PORT: int = int(os.getenv("INFINITY_PORT", 7997))
    
    @property
    def INFINITY_URL(self) -> str:
        return f"http://{self.INFINITY_HOST}:{self.INFINITY_PORT}"
    
    # Enterprise RAG: Cross-Encoder Reranker
    RERANKER_HOST: str = os.getenv("RERANKER_HOST", "reranker")
    RERANKER_PORT: int = int(os.getenv("RERANKER_PORT", 7997))
    
    @property
    def RERANKER_URL(self) -> str:
        return f"http://{self.RERANKER_HOST}:{self.RERANKER_PORT}"

    # OAuth
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv("GOOGLE_REDIRECT_URI", "")
    
    MS_CLIENT_ID: str = os.getenv("MS_CLIENT_ID", "")
    MS_CLIENT_SECRET: str = os.getenv("MS_CLIENT_SECRET", "")
    MS_TENANT_ID: str = os.getenv("MS_TENANT_ID", "")
    MS_REDIRECT_URI: str = os.getenv("MS_REDIRECT_URI", "")

    class Config:
        env_file = ".env"

@lru_cache(maxsize=1)
def get_settings():
    return Settings()

settings = get_settings()
