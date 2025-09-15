"""
Enhanced chat router with intelligent decision-making capabilities.
"""
import logging
import time
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, Depends
from fastapi.responses import JSONResponse

from app.models.decision import (
    EnhancedChatResponse,
    DecisionRequest,
    DecisionResponse
)
from app.models.chat import ChatRequest, ChatRequestWithApiKey
from app.services.enhanced_rag_service import get_enhanced_rag_service
from app.services.user_service import get_user_service

logger = logging.getLogger(__name__)

router = APIRouter()


async def validate_api_key(x_api_key: Optional[str] = Header(None)) -> str:
    """
    Dependency to validate API key from header.
    
    Args:
        x_api_key: API key from X-API-Key header
        
    Returns:
        User ID if valid
        
    Raises:
        HTTPException: If API key is invalid or missing
    """
    if not x_api_key:
        logger.warning("Missing API key in enhanced chat request")
        raise HTTPException(
            status_code=401,
            detail="API key is required. Please provide X-API-Key header."
        )
    
    user_service = get_user_service()
    user_info = await user_service.validate_api_key(x_api_key)
    
    if not user_info:
        logger.warning(f"Invalid API key provided in enhanced chat: {x_api_key[:8]}...")
        raise HTTPException(
            status_code=401,
            detail="Invalid API key provided."
        )
    
    logger.info(f"Valid API key for enhanced chat user: {user_info['email']}")
    return user_info["user_id"]


@router.post("/enhanced-chat", response_model=EnhancedChatResponse)
async def enhanced_chat_endpoint(
    request: ChatRequest,
    user_id: str = Depends(validate_api_key)
):
    """
    Process chat messages with enhanced intelligent decision-making capabilities.
    
    This endpoint extends the standard chat functionality with:
    1. Intelligent conversation context analysis
    2. Proactive assistance and follow-up questions
    3. Topic suggestions and conversation flow optimization
    4. Escalation detection and management
    5. Lead qualification and data collection
    6. Memory-aware conversational context
    
    Args:
        request: Chat request with user message and optional conversation ID
        user_id: User ID extracted from validated API key
        
    Returns:
        EnhancedChatResponse with AI-generated response and intelligent features
        
    Raises:
        HTTPException: For various error conditions
    """
    start_time = time.time()
    
    try:
        logger.info(f"Processing enhanced chat request for user {user_id}: {request.message[:100]}...")
        
        # Validate request data
        if not request.message or not request.message.strip():
            raise HTTPException(
                status_code=400,
                detail="Message cannot be empty"
            )
        
        # Override user_id from validated API key
        validated_request = ChatRequest(
            message=request.message.strip(),
            user_id=user_id,
            conversation_id=request.conversation_id
        )
        
        # Get enhanced RAG service
        enhanced_rag_service = get_enhanced_rag_service()
        
        # Check if enhanced RAG service is ready
        if not enhanced_rag_service.is_ready():
            logger.error("Enhanced RAG service is not ready")
            raise HTTPException(
                status_code=503,
                detail="Enhanced AI service is temporarily unavailable. Please try again later."
            )
        
        # Generate enhanced response
        response = await enhanced_rag_service.generate_enhanced_response(validated_request)
        
        processing_time = (time.time() - start_time) * 1000
        logger.info(f"Enhanced chat response generated in {processing_time:.2f}ms for user {user_id}")
        
        return response
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
        
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        logger.error(f"Error processing enhanced chat request after {processing_time:.2f}ms: {e}")
        
        # Return user-friendly error response
        raise HTTPException(
            status_code=500,
            detail="An error occurred while processing your message. Please try again."
        )


@router.post("/enhanced-chat/widget", response_model=EnhancedChatResponse)
async def enhanced_chat_widget_endpoint(request: ChatRequestWithApiKey):
    """
    Enhanced chat endpoint for embedded widgets with API key in request body.
    
    This endpoint provides enhanced intelligent chat functionality for embedded
    widgets where API keys are included in the request body rather than headers.
    
    Args:
        request: Chat request with message, API key, and optional conversation ID
        
    Returns:
        EnhancedChatResponse with AI-generated response and intelligent features
        
    Raises:
        HTTPException: For various error conditions
    """
    start_time = time.time()
    
    try:
        logger.info(f"Processing enhanced widget chat request: {request.message[:100]}...")
        
        # Validate chatbot API key
        user_service = get_user_service()
        chatbot_info = await user_service.validate_chatbot_api_key(request.api_key)
        
        if not chatbot_info:
            logger.warning(f"Invalid chatbot API key in enhanced widget request: {request.api_key[:8]}...")
            raise HTTPException(
                status_code=401,
                detail="Invalid chatbot API key provided."
            )
        
        chatbot_id = chatbot_info["chatbot_id"]
        user_id = chatbot_info["user_id"]
        logger.info(f"Valid chatbot API key for enhanced widget request from chatbot: {chatbot_info['name']}")
        
        # Create validated request with chatbot_id and session info
        validated_request = ChatRequest(
            message=request.message,
            user_id=user_id,
            chatbot_id=chatbot_id,
            conversation_id=request.conversation_id,
            user_email=request.user_email if hasattr(request, 'user_email') else None,
            session_id=request.session_id if hasattr(request, 'session_id') else None
        )
        
        # Get enhanced RAG service
        enhanced_rag_service = get_enhanced_rag_service()
        
        # Check if enhanced RAG service is ready
        if not enhanced_rag_service.is_ready():
            logger.error("Enhanced RAG service is not ready for widget request")
            raise HTTPException(
                status_code=503,
                detail="Enhanced AI service is temporarily unavailable. Please try again later."
            )
        
        # Generate enhanced response
        response = await enhanced_rag_service.generate_enhanced_response(validated_request)
        
        processing_time = (time.time() - start_time) * 1000
        logger.info(f"Enhanced widget chat response generated in {processing_time:.2f}ms for user {user_id}")
        
        return response
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
        
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        logger.error(f"Error processing enhanced widget chat request after {processing_time:.2f}ms: {e}")
        
        # Return user-friendly error response
        raise HTTPException(
            status_code=500,
            detail="An error occurred while processing your message. Please try again."
        )


@router.post("/decision-analysis", response_model=DecisionResponse)
async def decision_analysis_endpoint(
    request: DecisionRequest,
    user_id: str = Depends(validate_api_key)
):
    """
    Analyze conversation context and provide intelligent decision-making insights.
    
    This endpoint provides detailed analysis of conversation context without
    generating a full response. Useful for:
    - Understanding conversation intelligence metrics
    - Getting proactive action recommendations
    - Analyzing user engagement and satisfaction
    - Monitoring escalation risks and lead potential
    
    Args:
        request: Decision analysis request with conversation context
        user_id: User ID extracted from validated API key
        
    Returns:
        DecisionResponse with analysis results and recommendations
        
    Raises:
        HTTPException: For various error conditions
    """
    start_time = time.time()
    
    try:
        logger.info(f"Processing decision analysis for user {user_id}: {request.message[:100]}...")
        
        # Validate request data
        if not request.message or not request.message.strip():
            raise HTTPException(
                status_code=400,
                detail="Message cannot be empty"
            )
        
        # Override user_id from validated API key
        validated_request = DecisionRequest(
            message=request.message.strip(),
            conversation_history=request.conversation_history,
            user_id=user_id,
            chatbot_id=request.chatbot_id,
            conversation_id=request.conversation_id,
            rag_response=request.rag_response,
            context_documents=request.context_documents
        )
        
        # Get enhanced RAG service
        enhanced_rag_service = get_enhanced_rag_service()
        
        # Check if enhanced RAG service is ready
        if not enhanced_rag_service.is_ready():
            logger.error("Enhanced RAG service is not ready for decision analysis")
            raise HTTPException(
                status_code=503,
                detail="Enhanced AI service is temporarily unavailable. Please try again later."
            )
        
        # Analyze decision context
        response = await enhanced_rag_service.analyze_decision_context(validated_request)
        
        processing_time = (time.time() - start_time) * 1000
        logger.info(f"Decision analysis completed in {processing_time:.2f}ms for user {user_id}")
        
        return response
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
        
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        logger.error(f"Error processing decision analysis after {processing_time:.2f}ms: {e}")
        
        # Return user-friendly error response
        raise HTTPException(
            status_code=500,
            detail="An error occurred while analyzing the conversation. Please try again."
        )


@router.get("/conversation-insights/{conversation_id}")
async def get_conversation_insights_endpoint(
    conversation_id: str,
    time_window_hours: int = 24,
    user_id: str = Depends(validate_api_key)
):
    """
    Get conversation insights and analytics for a specific conversation.
    
    Args:
        conversation_id: Conversation ID to analyze
        time_window_hours: Time window for analysis in hours (default: 24)
        user_id: User ID extracted from validated API key
        
    Returns:
        Conversation insights and analytics data
        
    Raises:
        HTTPException: For various error conditions
    """
    try:
        logger.info(f"Getting conversation insights for user {user_id}, conversation {conversation_id}")
        
        # Get enhanced RAG service
        enhanced_rag_service = get_enhanced_rag_service()
        
        # Get conversation insights
        insights = await enhanced_rag_service.get_conversation_insights(
            conversation_id,
            time_window_hours
        )
        
        logger.info(f"Conversation insights retrieved for user {user_id}")
        return insights
        
    except Exception as e:
        logger.error(f"Error getting conversation insights: {e}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while retrieving conversation insights."
        )


@router.get("/user-patterns/{target_user_id}")
async def get_user_patterns_endpoint(
    target_user_id: str,
    days_back: int = 7,
    user_id: str = Depends(validate_api_key)
):
    """
    Get user conversation patterns for personalization and analysis.
    
    Args:
        target_user_id: User ID to analyze patterns for
        days_back: Number of days to analyze (default: 7)
        user_id: User ID extracted from validated API key (for authorization)
        
    Returns:
        User conversation patterns and preferences
        
    Raises:
        HTTPException: For various error conditions
    """
    try:
        logger.info(f"Getting user patterns for user {user_id}, target user {target_user_id}")
        
        # For now, allow users to only access their own patterns
        # In a production system, you'd implement proper authorization
        if user_id != target_user_id:
            raise HTTPException(
                status_code=403,
                detail="Access denied. You can only access your own conversation patterns."
            )
        
        # Get enhanced RAG service
        enhanced_rag_service = get_enhanced_rag_service()
        
        # Get user patterns
        patterns = await enhanced_rag_service.get_user_patterns(
            target_user_id,
            days_back
        )
        
        logger.info(f"User patterns retrieved for user {user_id}")
        return patterns
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user patterns: {e}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while retrieving user patterns."
        )


@router.get("/enhanced-chat/health")
async def enhanced_chat_health_check():
    """
    Health check endpoint for enhanced chat service components.
    
    Returns:
        Health status of enhanced RAG service and all intelligent features
    """
    try:
        enhanced_rag_service = get_enhanced_rag_service()
        
        service_info = enhanced_rag_service.get_service_info()
        
        overall_health = enhanced_rag_service.is_ready()
        
        return {
            "status": "healthy" if overall_health else "degraded",
            "timestamp": time.time(),
            "enhanced_features_enabled": True,
            "endpoints": {
                "enhanced_chat": "/api/enhanced-chat",
                "enhanced_chat_widget": "/api/enhanced-chat/widget",
                "decision_analysis": "/api/decision-analysis",
                "conversation_insights": "/api/conversation-insights/{conversation_id}",
                "user_patterns": "/api/user-patterns/{user_id}"
            },
            "service_info": service_info
        }
        
    except Exception as e:
        logger.error(f"Enhanced chat health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": str(e),
                "timestamp": time.time()
            }
        )