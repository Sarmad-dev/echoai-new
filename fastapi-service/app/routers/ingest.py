"""
Ingest router for document processing endpoints.
"""
import logging
import json
from typing import List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status
from pydantic import ValidationError

from app.models.ingest import IngestRequest, IngestResponse, ProcessingStats, VectorStorageStats
from app.services.document_ingestion_service import get_document_ingestion_service
from app.services.vector_storage_service import get_vector_storage_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/ingest", response_model=IngestResponse)
async def ingest_documents(
    user_id: str = Form(...),
    chatbot_id: str = Form(...),
    urls: Optional[str] = Form(None),  # JSON string of URLs
    files: Optional[List[UploadFile]] = File(None),
    instructions: Optional[str] = Form(None)  # Training instructions
):
    """
    Ingest documents from URLs and/or uploaded files using LangChain loaders.

    Supports:
    - URLs: Processed using WebBaseLoader
    - PDF files: Processed using PyPDFLoader  
    - DOCX files: Processed using Docx2txtLoader
    - Training instructions: Processed and stored as behavior instructions

    All documents are split into chunks and embeddings are generated using Hugging Face models.
    Training instructions are also embedded for retrieval during conversations.
    """
    logger.info(f"Ingest request received for user: {user_id}, chatbot: {chatbot_id}")

    try:
        # Parse URLs from JSON string if provided
        parsed_urls = None
        if urls:
            try:
                parsed_urls = json.loads(urls)
                if not isinstance(parsed_urls, list):
                    raise ValueError("URLs must be a list")
            except (json.JSONDecodeError, ValueError) as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid URLs format: {str(e)}"
                )

        # Validate that at least one source is provided
        if not parsed_urls and not files and not (instructions and instructions.strip()):
            raise HTTPException(
                status_code=400,
                detail="At least one URL, file, or instruction must be provided"
            )

        # Get document ingestion service
        ingestion_service = get_document_ingestion_service()

        # Process documents
        processed_documents = await ingestion_service.process_mixed_sources(
            urls=parsed_urls,
            files=files,
            user_id=user_id,
            chatbot_id=chatbot_id,
            instructions=instructions
        )

        # Get processing statistics
        stats = ingestion_service.get_processing_stats(processed_documents)

        # Get vector storage statistics
        vector_service = get_vector_storage_service()
        vector_stats = await vector_service.get_document_stats(user_id, chatbot_id)

        logger.info(
            f"Successfully processed {len(processed_documents)} document chunks for user {user_id}, chatbot {chatbot_id}")

        return IngestResponse(
            success=True,
            message=f"Successfully processed {stats['total_documents']} documents into {stats['total_chunks']} chunks",
            documents_processed=stats['total_documents'],
            processing_stats=stats,
            vector_storage_stats=vector_stats
        )

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Error processing documents for user {user_id}, chatbot {chatbot_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )
