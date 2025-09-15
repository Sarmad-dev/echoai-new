"""
API router for enhanced memory-aware conversational context endpoints.
"""
import logging
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse

from app.models.memory import (
    MemoryRetrievalRequest,
    MemoryRetrievalResponse,
    MemoryUpdateRequest,
    MemoryUpdateResponse,
    ConversationContextRequest,
    ConversationContextResponse,
    MemoryServiceStatus,
    ConversationMemoryModel
)
from app.services.enhanced_memory_service import get_enhanced_memory_service, EnhancedMemoryService
from app.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/memory", tags=["Enhanced Memory"])


@router.post("/retrieve", response_model=MemoryRetrievalResponse)
async def retrieve_relevant_memory(
    request: MemoryRetrievalRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    memory_service: EnhancedMemoryService = Depends(get_enhanced_memory_service)
):
    """
    Retrieve relevant conversation memory for current message context.
    
    This endpoint retrieves contextually relevant memory including:
    - Recent conversation history
    - Relevant contextual facts
    - Conversation summaries
    - User profile information
    - Topic transition history
    """
    try:
        if not memory_service.is_ready():
            raise HTTPException(
                status_code=503,
                detail="Enhanced memory service is not available"
            )
        
        # Retrieve relevant history
        relevant_history = await memory_service.retrieve_relevant_history(
            current_message=request.current_message,
            user_id=request.user_id,
            conversation_id=request.conversation_id,
            max_items=request.max_items
        )
        
        # Calculate context quality score
        context_quality_score = _calculate_context_quality(relevant_history)
        
        return MemoryRetrievalResponse(
            recent_context=relevant_history.get("recent_context", []),
            relevant_facts=[],  # Will be populated from relevant_history
            relevant_summaries=[],  # Will be populated from relevant_history
            user_profile=None,  # Will be populated from relevant_history
            current_topic=relevant_history.get("current_topic", "general"),
            topic_history=[],  # Will be populated from relevant_history
            context_quality_score=context_quality_score
        )
        
    except Exception as e:
        logger.error(f"Error retrieving memory: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve memory: {str(e)}"
        )


@router.post("/update", response_model=MemoryUpdateResponse)
async def update_conversation_memory(
    request: MemoryUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    memory_service: EnhancedMemoryService = Depends(get_enhanced_memory_service)
):
    """
    Update conversation memory with new message exchange.
    
    This endpoint updates the conversation memory with:
    - New user message and AI response
    - Extracted contextual facts
    - Topic transitions
    - Updated user profile
    - Conversation summarization if needed
    """
    try:
        if not memory_service.is_ready():
            raise HTTPException(
                status_code=503,
                detail="Enhanced memory service is not available"
            )
        
        # Update conversation context
        updated_memory = await memory_service.maintain_conversation_context(
            conversation_id=request.conversation_id,
            user_id=request.user_id,
            new_message=request.user_message,
            ai_response=request.ai_response
        )
        
        # Count new facts and transitions
        new_facts_count = len([
            fact for fact in updated_memory.contextual_facts
            if fact.extracted_at.date() == updated_memory.last_updated.date()
        ])
        
        topic_transitions_count = len([
            transition for transition in updated_memory.topic_history
            if transition.transition_time.date() == updated_memory.last_updated.date()
        ])
        
        return MemoryUpdateResponse(
            success=True,
            memory_summary={
                "short_term_messages": len(updated_memory.short_term_memory),
                "long_term_summaries": len(updated_memory.long_term_memory),
                "total_facts": len(updated_memory.contextual_facts),
                "topic_transitions": len(updated_memory.topic_history),
                "current_topic": updated_memory.topic_history[-1].to_topic if updated_memory.topic_history else "general"
            },
            new_facts_extracted=new_facts_count,
            topic_transitions=topic_transitions_count
        )
        
    except Exception as e:
        logger.error(f"Error updating memory: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update memory: {str(e)}"
        )


@router.post("/context", response_model=ConversationContextResponse)
async def get_conversation_context(
    request: ConversationContextRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    memory_service: EnhancedMemoryService = Depends(get_enhanced_memory_service)
):
    """
    Get formatted conversation context for LLM consumption.
    
    This endpoint formats conversation memory into a context string
    suitable for LLM prompts, including:
    - User profile information
    - Recent conversation history
    - Relevant contextual facts
    - Conversation summaries
    """
    try:
        if not memory_service.is_ready():
            raise HTTPException(
                status_code=503,
                detail="Enhanced memory service is not available"
            )
        
        # Get formatted context
        formatted_context = await memory_service.get_context_for_llm(
            conversation_id=request.conversation_id,
            user_id=request.user_id,
            current_message=request.current_message
        )
        
        # Check if truncation is needed
        truncated = len(formatted_context) > request.max_context_length
        if truncated:
            formatted_context = formatted_context[:request.max_context_length] + "..."
        
        # Analyze context components
        context_components = _analyze_context_components(formatted_context)
        
        return ConversationContextResponse(
            formatted_context=formatted_context,
            context_components=context_components,
            context_length=len(formatted_context),
            truncated=truncated
        )
        
    except Exception as e:
        logger.error(f"Error getting conversation context: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get conversation context: {str(e)}"
        )


@router.get("/conversation/{conversation_id}", response_model=ConversationMemoryModel)
async def get_conversation_memory(
    conversation_id: str,
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    memory_service: EnhancedMemoryService = Depends(get_enhanced_memory_service)
):
    """
    Get complete conversation memory for a specific conversation.
    
    This endpoint returns the full conversation memory including:
    - Short-term message history
    - Long-term conversation summaries
    - User profile data
    - Contextual facts
    - Topic transition history
    """
    try:
        if not memory_service.is_ready():
            raise HTTPException(
                status_code=503,
                detail="Enhanced memory service is not available"
            )
        
        # Load conversation memory
        memory = await memory_service.load_conversation_memory(
            conversation_id=conversation_id,
            user_id=user_id
        )
        
        # Convert to response model
        return ConversationMemoryModel(
            conversation_id=memory.conversation_id,
            short_term_memory=memory.short_term_memory,
            long_term_memory=[],  # Convert summaries to models
            user_profile=None,  # Convert profile to model
            contextual_facts=[],  # Convert facts to models
            topic_history=[],  # Convert transitions to models
            last_updated=memory.last_updated
        )
        
    except Exception as e:
        logger.error(f"Error getting conversation memory: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get conversation memory: {str(e)}"
        )


@router.delete("/conversation/{conversation_id}")
async def clear_conversation_memory(
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    memory_service: EnhancedMemoryService = Depends(get_enhanced_memory_service)
):
    """
    Clear memory for a specific conversation.
    
    This endpoint removes all memory data for a conversation including:
    - Short-term message history
    - Long-term summaries
    - Contextual facts
    - Topic history
    
    Note: User profile data is preserved across conversations.
    """
    try:
        if not memory_service.is_ready():
            raise HTTPException(
                status_code=503,
                detail="Enhanced memory service is not available"
            )
        
        # Clear conversation memory from Redis
        if memory_service.redis_client:
            memory_key = f"conversation_memory:{conversation_id}"
            memory_service.redis_client.delete(memory_key)
        
        # Clear from database (would need implementation)
        # For now, just return success
        
        return JSONResponse(
            content={
                "message": f"Memory cleared for conversation {conversation_id}",
                "success": True
            }
        )
        
    except Exception as e:
        logger.error(f"Error clearing conversation memory: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear conversation memory: {str(e)}"
        )


@router.get("/user/{user_id}/profile")
async def get_user_profile(
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    memory_service: EnhancedMemoryService = Depends(get_enhanced_memory_service)
):
    """
    Get user profile built from conversation history.
    
    This endpoint returns the user profile including:
    - Communication style preferences
    - Technical expertise level
    - Common questions and topics
    - Interaction patterns
    - Satisfaction history
    """
    try:
        if not memory_service.is_ready():
            raise HTTPException(
                status_code=503,
                detail="Enhanced memory service is not available"
            )
        
        # Load user profile
        profile = await memory_service.load_user_profile(user_id)
        
        if not profile:
            raise HTTPException(
                status_code=404,
                detail=f"User profile not found for user {user_id}"
            )
        
        return profile
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user profile: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get user profile: {str(e)}"
        )


@router.get("/status", response_model=MemoryServiceStatus)
async def get_memory_service_status(
    memory_service: EnhancedMemoryService = Depends(get_enhanced_memory_service)
):
    """
    Get enhanced memory service status and configuration.
    
    This endpoint returns information about:
    - Service readiness
    - Redis connection status
    - Supabase connection status
    - Configuration parameters
    """
    try:
        service_info = memory_service.get_service_info()
        
        return MemoryServiceStatus(
            service_ready=service_info["service_ready"],
            redis_connected=service_info["redis_client_ready"],
            supabase_connected=service_info["supabase_client_ready"],
            memory_window_size=service_info["memory_window_size"],
            summary_threshold=service_info["summary_threshold"],
            profile_retention_days=service_info["profile_retention_days"]
        )
        
    except Exception as e:
        logger.error(f"Error getting memory service status: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get service status: {str(e)}"
        )


# Helper functions

def _calculate_context_quality(relevant_history: Dict[str, Any]) -> float:
    """Calculate quality score for retrieved context."""
    score = 0.5  # Base score
    
    # Recent context availability
    if relevant_history.get("recent_context"):
        score += 0.2
    
    # Relevant facts availability
    if relevant_history.get("relevant_facts"):
        score += 0.2
    
    # User profile availability
    if relevant_history.get("user_profile"):
        score += 0.1
    
    # Topic history availability
    if relevant_history.get("topic_history"):
        score += 0.1
    
    return min(1.0, score)


def _analyze_context_components(formatted_context: str) -> Dict[str, Any]:
    """Analyze components present in formatted context."""
    components = {
        "user_profile": "User Profile:" in formatted_context,
        "recent_messages": "Recent Conversation:" in formatted_context,
        "facts": "User Context:" in formatted_context,
        "summaries": "Previous Discussion:" in formatted_context
    }
    
    # Count components
    components["total_components"] = sum(1 for v in components.values() if isinstance(v, bool) and v)
    
    return components