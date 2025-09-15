"""
Search router for vector similarity search endpoints.
"""
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.vector_storage_service import get_vector_storage_service

logger = logging.getLogger(__name__)

router = APIRouter()


class SearchRequest(BaseModel):
    """Request model for similarity search."""
    query: str
    chatbot_id: str
    k: Optional[int] = 5
    score_threshold: Optional[float] = 0.0


class SearchResult(BaseModel):
    """Individual search result."""
    content: str
    metadata: dict
    similarity_score: float


class SearchResponse(BaseModel):
    """Response model for similarity search."""
    success: bool
    query: str
    results: List[SearchResult]
    total_results: int


@router.post("/search", response_model=SearchResponse)
async def similarity_search(request: SearchRequest):
    """
    Perform similarity search on user's documents using vector embeddings.
    
    Returns the most similar document chunks based on cosine similarity.
    """
    logger.info(f"Similarity search request for chatbot {request.chatbot_id}: {request.query[:100]}...")
    
    try:
        # Get vector storage service
        vector_service = get_vector_storage_service()
        
        # Perform similarity search
        search_results = await vector_service.similarity_search(
            query=request.query,
            chatbot_id=request.chatbot_id,
            k=request.k,
            score_threshold=request.score_threshold
        )
        
        # Convert results to response format
        results = []
        for doc, score in search_results:
            results.append(SearchResult(
                content=doc.page_content,
                metadata=doc.metadata,
                similarity_score=score
            ))
        
        logger.info(f"Found {len(results)} similar documents for chatbot {request.chatbot_id}")
        
        return SearchResponse(
            success=True,
            query=request.query,
            results=results,
            total_results=len(results)
        )
        
    except Exception as e:
        logger.error(f"Error in similarity search for chatbot {request.chatbot_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Search failed: {str(e)}"
        )


@router.get("/documents/{user_id}")
async def get_user_documents(
    user_id: str,
    limit: int = Query(default=100, ge=1, le=1000)
):
    """
    Get all documents for a specific user.
    """
    logger.info(f"Retrieving documents for user {user_id}")
    
    try:
        vector_service = get_vector_storage_service()
        documents = await vector_service.get_user_documents(user_id, limit)
        
        # Convert documents to response format
        doc_list = []
        for doc in documents:
            doc_list.append({
                "content": doc.page_content,
                "metadata": doc.metadata
            })
        
        return {
            "success": True,
            "user_id": user_id,
            "documents": doc_list,
            "total_documents": len(doc_list)
        }
        
    except Exception as e:
        logger.error(f"Error retrieving documents for user {user_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve documents: {str(e)}"
        )


@router.get("/stats/{user_id}")
async def get_document_stats(user_id: str):
    """
    Get document statistics for a specific user.
    """
    logger.info(f"Getting document statistics for user {user_id}")
    
    try:
        vector_service = get_vector_storage_service()
        stats = await vector_service.get_document_stats(user_id)
        
        return {
            "success": True,
            "user_id": user_id,
            "stats": stats
        }
        
    except Exception as e:
        logger.error(f"Error getting statistics for user {user_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get statistics: {str(e)}"
        )


@router.delete("/documents/{user_id}")
async def delete_user_documents(user_id: str):
    """
    Delete all documents for a specific user.
    """
    logger.info(f"Deleting documents for user {user_id}")
    
    try:
        vector_service = get_vector_storage_service()
        deleted_count = await vector_service.delete_user_documents(user_id)
        
        return {
            "success": True,
            "user_id": user_id,
            "deleted_count": deleted_count,
            "message": f"Successfully deleted {deleted_count} documents"
        }
        
    except Exception as e:
        logger.error(f"Error deleting documents for user {user_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete documents: {str(e)}"
        )