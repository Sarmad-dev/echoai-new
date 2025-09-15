"""
Enhanced streaming router with intelligent response generation and fallback strategies.
"""
import logging
import time
import json
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, Depends
from fastapi.responses import StreamingResponse

from app.models.enhanced_streaming import (
    EnhancedStreamRequest,
    EnhancedStreamRequestWithApiKey,
    EnhancedStreamResponse,
    StreamingConfig
)
from app.services.enhanced_streaming_service import get_enhanced_streaming_service
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
        logger.warning("Missing API key in enhanced streaming request")
        raise HTTPException(
            status_code=401,
            detail="API key is required. Please provide X-API-Key header."
        )
    
    user_service = get_user_service()
    user_info = await user_service.validate_api_key(x_api_key)
    
    if not user_info:
        logger.warning(f"Invalid API key provided in enhanced streaming: {x_api_key[:8]}...")
        raise HTTPException(
            status_code=401,
            detail="Invalid API key provided."
        )
    
    logger.info(f"Valid API key for enhanced streaming user: {user_info['email']}")
    return user_info["user_id"]


@router.post("/enhanced-stream")
async def enhanced_stream_endpoint(
    request: EnhancedStreamRequest,
    user_id: str = Depends(validate_api_key)
):
    """
    Enhanced streaming chat endpoint with intelligent response generation.
    
    This endpoint provides advanced streaming capabilities including:
    1. Intelligent response generation that avoids "I don't know" responses
    2. Fallback strategies for knowledge gaps
    3. Proactive question streaming alongside main responses
    4. Conversation action suggestions in streaming metadata
    5. Topic suggestions and follow-up recommendations
    6. Real-time intelligence analysis streaming
    
    Args:
        request: Enhanced streaming request with configuration options
        user_id: User ID extracted from validated API key
        
    Returns:
        StreamingResponse with enhanced Server-Sent Events
        
    Raises:
        HTTPException: For various error conditions
    """
    start_time = time.time()
    
    try:
        logger.info(f"Processing enhanced streaming request for user {user_id}: {request.message[:100]}...")
        
        # Validate request data
        if not request.message or not request.message.strip():
            raise HTTPException(
                status_code=400,
                detail="Message cannot be empty"
            )
        
        # Override user_id from validated API key
        validated_request = EnhancedStreamRequest(
            message=request.message.strip(),
            user_id=user_id,
            chatbot_id=request.chatbot_id,
            conversation_id=request.conversation_id,
            user_email=request.user_email,
            session_id=request.session_id,
            image_url=request.image_url,
            enable_proactive_questions=request.enable_proactive_questions,
            enable_topic_suggestions=request.enable_topic_suggestions,
            enable_conversation_actions=request.enable_conversation_actions,
            enable_intelligence_metadata=request.enable_intelligence_metadata,
            enable_fallback_strategies=request.enable_fallback_strategies,
            avoid_i_dont_know=request.avoid_i_dont_know
        )
        
        # Get enhanced streaming service
        streaming_service = get_enhanced_streaming_service()
        
        # Check if streaming service is ready
        if not streaming_service.is_ready():
            logger.error("Enhanced streaming service is not ready")
            raise HTTPException(
                status_code=503,
                detail="Enhanced streaming service is temporarily unavailable. Please try again later."
            )
        
        # Create streaming configuration
        config = StreamingConfig(
            chunk_size=1,
            delay_ms=50,
            include_metadata=True,
            enable_typing_indicator=True,
            max_response_tokens=2000
        )
        
        async def generate_enhanced_sse_stream():
            """Generate enhanced Server-Sent Events stream."""
            try:
                async for response_chunk in streaming_service.generate_enhanced_stream(
                    validated_request, 
                    config
                ):
                    # Convert response to JSON
                    chunk_data = response_chunk.dict(exclude_none=True)
                    
                    # Format as Server-Sent Event
                    sse_data = f"data: {json.dumps(chunk_data)}\n\n"
                    yield sse_data
                    
                    # If this is the completion signal, break
                    if response_chunk.type == "done":
                        break
                        
            except Exception as e:
                logger.error(f"Error in enhanced streaming generation: {e}")
                
                # Send error event
                error_response = EnhancedStreamResponse(
                    type="error",
                    error_message=f"Streaming error: {str(e)}",
                    metadata={"timestamp": time.time()}
                )
                error_data = f"data: {json.dumps(error_response.dict(exclude_none=True))}\n\n"
                yield error_data
                
                # Send completion event
                done_response = EnhancedStreamResponse(
                    type="done",
                    metadata={"error": True, "timestamp": time.time()}
                )
                done_data = f"data: {json.dumps(done_response.dict(exclude_none=True))}\n\n"
                yield done_data
        
        processing_time = (time.time() - start_time) * 1000
        logger.info(f"Started enhanced streaming response in {processing_time:.2f}ms for user {user_id}")
        
        # Return streaming response with appropriate headers
        return StreamingResponse(
            generate_enhanced_sse_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "X-Accel-Buffering": "no"  # Disable nginx buffering
            }
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
        
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        logger.error(f"Error processing enhanced streaming request after {processing_time:.2f}ms: {e}")
        
        # Return user-friendly error response
        raise HTTPException(
            status_code=500,
            detail="An error occurred while processing your message. Please try again."
        )


@router.post("/enhanced-stream/widget")
async def enhanced_stream_widget_endpoint(request: EnhancedStreamRequestWithApiKey):
    """
    Enhanced streaming endpoint for embedded widgets with API key in request body.
    
    This endpoint provides the same enhanced streaming functionality as the main
    streaming endpoint but is designed for embedded chat widgets where API keys
    are included in the request body rather than headers.
    
    Args:
        request: Enhanced streaming request with API key and configuration options
        
    Returns:
        StreamingResponse with enhanced Server-Sent Events
        
    Raises:
        HTTPException: For various error conditions
    """
    start_time = time.time()
    
    try:
        logger.info(f"Processing enhanced widget streaming request: {request.message[:100]}...")
        
        # Validate chatbot API key
        user_service = get_user_service()
        chatbot_info = await user_service.validate_chatbot_api_key(request.api_key)
        
        if not chatbot_info:
            logger.warning(f"Invalid chatbot API key in enhanced widget streaming: {request.api_key[:8]}...")
            raise HTTPException(
                status_code=401,
                detail="Invalid chatbot API key provided."
            )
        
        chatbot_id = chatbot_info["chatbot_id"]
        user_id = chatbot_info["user_id"]
        logger.info(f"Valid chatbot API key for enhanced widget streaming from chatbot: {chatbot_info['name']}")
        
        # Create validated request with chatbot_id and session info
        validated_request = EnhancedStreamRequest(
            message=request.message,
            user_id=user_id,
            chatbot_id=chatbot_id,
            conversation_id=request.conversation_id,
            user_email=request.user_email,
            session_id=request.session_id,
            image_url=request.image_url,
            enable_proactive_questions=request.enable_proactive_questions,
            enable_topic_suggestions=request.enable_topic_suggestions,
            enable_conversation_actions=request.enable_conversation_actions,
            enable_intelligence_metadata=request.enable_intelligence_metadata,
            enable_fallback_strategies=request.enable_fallback_strategies,
            avoid_i_dont_know=request.avoid_i_dont_know
        )
        
        # Get enhanced streaming service
        streaming_service = get_enhanced_streaming_service()
        
        # Check if streaming service is ready
        if not streaming_service.is_ready():
            logger.error("Enhanced streaming service is not ready for widget request")
            raise HTTPException(
                status_code=503,
                detail="Enhanced streaming service is temporarily unavailable. Please try again later."
            )
        
        # Create streaming configuration
        config = StreamingConfig(
            chunk_size=1,
            delay_ms=50,
            include_metadata=True,
            enable_typing_indicator=True,
            max_response_tokens=2000
        )
        
        async def generate_enhanced_widget_sse_stream():
            """Generate enhanced Server-Sent Events stream for widget."""
            try:
                async for response_chunk in streaming_service.generate_enhanced_stream(
                    validated_request, 
                    config
                ):
                    # Convert response to JSON
                    chunk_data = response_chunk.dict(exclude_none=True)
                    
                    # Format as Server-Sent Event
                    sse_data = f"data: {json.dumps(chunk_data)}\n\n"
                    yield sse_data
                    
                    # If this is the completion signal, break
                    if response_chunk.type == "done":
                        break
                        
            except Exception as e:
                logger.error(f"Error in enhanced widget streaming generation: {e}")
                
                # Send error event
                error_response = EnhancedStreamResponse(
                    type="error",
                    error_message=f"Widget streaming error: {str(e)}",
                    metadata={"timestamp": time.time()}
                )
                error_data = f"data: {json.dumps(error_response.dict(exclude_none=True))}\n\n"
                yield error_data
                
                # Send completion event
                done_response = EnhancedStreamResponse(
                    type="done",
                    metadata={"error": True, "timestamp": time.time()}
                )
                done_data = f"data: {json.dumps(done_response.dict(exclude_none=True))}\n\n"
                yield done_data
        
        processing_time = (time.time() - start_time) * 1000
        logger.info(f"Started enhanced widget streaming response in {processing_time:.2f}ms for user {user_id}")
        
        # Return streaming response with appropriate headers
        return StreamingResponse(
            generate_enhanced_widget_sse_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "X-Accel-Buffering": "no"  # Disable nginx buffering
            }
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
        
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        logger.error(f"Error processing enhanced widget streaming request after {processing_time:.2f}ms: {e}")
        
        # Return user-friendly error response
        raise HTTPException(
            status_code=500,
            detail="An error occurred while processing your message. Please try again."
        )


@router.get("/enhanced-stream/health")
async def enhanced_stream_health_check():
    """
    Health check endpoint for enhanced streaming service components.
    
    Returns:
        Health status of enhanced streaming service and all intelligent features
    """
    try:
        streaming_service = get_enhanced_streaming_service()
        
        service_info = streaming_service.get_service_info()
        
        overall_health = streaming_service.is_ready()
        
        return {
            "status": "healthy" if overall_health else "degraded",
            "timestamp": time.time(),
            "enhanced_streaming_enabled": True,
            "endpoints": {
                "enhanced_stream": "/api/enhanced-stream",
                "enhanced_stream_widget": "/api/enhanced-stream/widget",
                "enhanced_stream_health": "/api/enhanced-stream/health"
            },
            "service_info": service_info,
            "streaming_features": {
                "intelligent_response_generation": True,
                "fallback_strategies": True,
                "avoid_i_dont_know_responses": True,
                "proactive_question_streaming": True,
                "topic_suggestion_streaming": True,
                "conversation_action_streaming": True,
                "intelligence_metadata_streaming": True,
                "configurable_streaming_behavior": True,
                "error_recovery": True,
                "emergency_fallback": True
            }
        }
        
    except Exception as e:
        logger.error(f"Enhanced streaming health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": time.time()
        }