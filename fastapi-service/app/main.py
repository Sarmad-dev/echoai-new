"""
Main FastAPI application with CORS and middleware configuration.
"""
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.config import settings
from app.routers import ingest, chat, search, vision, lead, instruction, enhanced_chat, escalation, memory

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("app.log") if settings.LOG_TO_FILE else logging.NullHandler()
    ]
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown events."""
    logger.info("Starting FastAPI application...")
    
    # Initialize user service
    try:
        from app.services.user_service import get_user_service
        user_service = get_user_service()
        logger.info("User service initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize user service: {e}")
    
    # Initialize model service during startup
    try:
        from app.services.model_service import get_model_service
        model_service = get_model_service()
        logger.info("Model service initialized successfully")
        logger.info(f"Model info: {model_service.get_model_info()}")
    except Exception as e:
        logger.error(f"Failed to initialize model service: {e}")
        # Don't raise here to allow the app to start even if models fail
        # This allows for graceful degradation
    
    logger.info("Application startup complete")
    
    yield
    
    # Shutdown
    logger.info("Shutting down FastAPI application...")
    # User service doesn't need explicit closing
    logger.info("User service cleanup complete")
    
    try:
        from app.services.event_service import get_event_service
        event_service = get_event_service()
        await event_service.close()
        logger.info("Event service closed")
    except Exception as e:
        logger.error(f"Error closing event service: {e}")


# Create FastAPI application
app = FastAPI(
    title="EchoAI FastAPI Service",
    description="AI processing service for EchoAI SaaS MVP",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Add trusted host middleware for security
if settings.TRUSTED_HOSTS:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.TRUSTED_HOSTS
    )

# Include routers
app.include_router(ingest.router, prefix="/api", tags=["ingest"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(enhanced_chat.router, prefix="/api", tags=["enhanced-chat"])
app.include_router(search.router, prefix="/api", tags=["search"])
app.include_router(vision.router, prefix="/api", tags=["vision"])
app.include_router(lead.router, tags=["lead"])
app.include_router(instruction.router, prefix="/api", tags=["instruction"])

# Include simplified instruction router
from app.routers import simple_instruction
app.include_router(simple_instruction.router, tags=["simple-instruction"])
app.include_router(escalation.router, tags=["escalation"])
app.include_router(memory.router, tags=["memory"])

# Include enhanced streaming router
from app.routers import enhanced_streaming
app.include_router(enhanced_streaming.router, prefix="/api", tags=["enhanced-streaming"])


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"message": "EchoAI FastAPI Service is running", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    """Detailed health check endpoint."""
    try:
        from app.services.model_service import get_model_service
        model_service = get_model_service()
        model_info = model_service.get_model_info()
        
        return {
            "status": "healthy",
            "service": "EchoAI FastAPI Service",
            "version": "1.0.0",
            "models": model_info
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "degraded",
            "service": "EchoAI FastAPI Service",
            "version": "1.0.0",
            "error": str(e)
        }