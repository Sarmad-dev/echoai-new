"""
Environment configuration and settings for the FastAPI service.
"""
import os
from typing import List, Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Database configuration
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://localhost/echoai")
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    
    # CORS configuration
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://localhost:3000",
        "http://192.168.1.10:3000",
        "http://192.168.1.3:3000",
        "http://192.168.38.157:3000",
        "http://192.168.1.4:3000",
        "http://192.168.1.2:3000",
        "http://192.168.1.5:3000"
    ]
    
    # Security configuration
    TRUSTED_HOSTS: Optional[List[str]] = ["localhost", "127.0.0.1", "192.168.1.10", "192.168.1.3", "192.168.38.157", "192.168.1.4", "192.168.1.2", "192.168.1.5"]
    
    # Logging configuration
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_TO_FILE: bool = os.getenv("LOG_TO_FILE", "false").lower() == "true"
    
    # Hugging Face Inference API configuration
    HUGGINGFACE_API_TOKEN: str = os.getenv("HUGGINGFACE_API_TOKEN", "")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "BAAI/bge-base-en-v1.5")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "HuggingFaceH4/zephyr-7b-beta")
    SENTIMENT_MODEL: str = os.getenv("SENTIMENT_MODEL", "siebert/sentiment-roberta-large-english")
    
    # OpenAI API configuration
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    
    # Frontend integration configuration
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    FASTAPI_EVENT_API_KEY: str = os.getenv("FASTAPI_EVENT_API_KEY", "")
    
    # Inference API configuration
    INFERENCE_API_TIMEOUT: int = int(os.getenv("INFERENCE_API_TIMEOUT", "30"))
    INFERENCE_API_MAX_RETRIES: int = int(os.getenv("INFERENCE_API_MAX_RETRIES", "3"))
    INFERENCE_API_RETRY_DELAY: float = float(os.getenv("INFERENCE_API_RETRY_DELAY", "1.0"))
    
    # Text processing configuration
    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "1000"))
    CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "200"))
    
    # Inngest
    INNGEST_EVENT_KEY: str = os.getenv("INNGEST_EVENT_KEY", "")
    INNGEST_SIGNING_KEY: str = os.getenv("INNGEST_SIGNING_KEY", "")
    
    # Redis configuration for memory storage
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB: int = int(os.getenv("REDIS_DB", "0"))
    REDIS_PASSWORD: Optional[str] = os.getenv("REDIS_PASSWORD")
    
    # Memory configuration
    MEMORY_WINDOW_SIZE: int = int(os.getenv("MEMORY_WINDOW_SIZE", "20"))
    CONVERSATION_SUMMARY_THRESHOLD: int = int(os.getenv("CONVERSATION_SUMMARY_THRESHOLD", "50"))
    USER_PROFILE_RETENTION_DAYS: int = int(os.getenv("USER_PROFILE_RETENTION_DAYS", "30"))
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()