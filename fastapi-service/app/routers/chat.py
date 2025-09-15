"""
Chat router for AI chat endpoints with full RAG implementation.
"""
import logging
import time
import json
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, Depends, UploadFile, File, Form
from fastapi.responses import JSONResponse, StreamingResponse

# Local imports
from app.models.chat import ChatRequest, ChatRequestWithApiKey, ChatResponse, RAGContext, StreamChatRequest, StreamChatResponse
from app.services.rag_service import get_rag_service
from app.services.user_service import get_user_service
from app.services.lead_analyzer import get_intent_analyzer, ConversationContext

logger = logging.getLogger(__name__)

router = APIRouter()


async def analyze_message_for_leads(
    message: str, 
    conversation_context: Optional[dict] = None
) -> Optional[dict]:
    """
    Analyze a message for lead potential and return lead data if qualified.
    
    Args:
        message: The message to analyze
        conversation_context: Optional conversation context for better scoring
        
    Returns:
        Lead analysis data if qualified, None otherwise
    """
    try:
        analyzer = get_intent_analyzer()
        
        if not analyzer.is_ready():
            logger.warning("Lead analyzer not ready, skipping lead analysis")
            return None
        
        # Convert conversation context if provided
        context = None
        if conversation_context:
            context = ConversationContext(
                message_count=conversation_context.get("message_count", 1),
                conversation_length=conversation_context.get("conversation_length", len(message)),
                engagement_score=conversation_context.get("engagement_score", 0.5),
                sentiment_history=conversation_context.get("sentiment_history", []),
                previous_intents=conversation_context.get("previous_intents", [])
            )
        
        # Analyze lead potential
        lead_score = await analyzer.analyze_lead_potential(message, context)
        
        # Check if should trigger qualification
        should_qualify = analyzer.should_trigger_lead_qualification(lead_score)
        
        if should_qualify:
            # Generate CRM mapping
            crm_mapping = analyzer.get_crm_data_mapping(lead_score, message)
            
            return {
                "lead_qualified": True,
                "lead_score": lead_score.total_score,
                "priority": lead_score.priority.value,
                "lead_type": lead_score.lead_type.value,
                "confidence": lead_score.confidence,
                "extracted_data": lead_score.extracted_data,
                "crm_mapping": crm_mapping,
                "factors": lead_score.factors
            }
        
        return None
        
    except Exception as e:
        logger.error(f"Error in lead analysis: {e}")
        return None


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
        logger.warning("Missing API key in request")
        raise HTTPException(
            status_code=401,
            detail="API key is required. Please provide X-API-Key header."
        )
    
    user_service = get_user_service()
    user_info = await user_service.validate_api_key(x_api_key)
    
    if not user_info:
        logger.warning(f"Invalid API key provided: {x_api_key[:8]}...")
        raise HTTPException(
            status_code=401,
            detail="Invalid API key provided."
        )
    
    logger.info(f"Valid API key for user: {user_info['email']}")
    return user_info["user_id"]


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    request: ChatRequest,
    user_id: str = Depends(validate_api_key)
):
    """
    Process chat messages and return AI responses using RAG pipeline.
    
    This endpoint:
    1. Validates the API key to authenticate the user
    2. Processes the user message through the RAG pipeline
    3. Generates embeddings using Hugging Face Inference API
    4. Retrieves relevant documents from vector storage
    5. Generates contextual responses using LLM via Inference API
    6. Analyzes sentiment using Hugging Face Inference API
    7. Returns structured response with metadata
    
    Args:
        request: Chat request with user message and optional conversation ID
        user_id: User ID extracted from validated API key
        
    Returns:
        ChatResponse with AI-generated response and metadata
        
    Raises:
        HTTPException: For various error conditions
    """
    start_time = time.time()
    
    try:
        logger.info(f"Processing chat request for user {user_id}: {request.message[:100]}...")
        
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
        
        # Get RAG service
        rag_service = get_rag_service()
        
        # Check if RAG service is ready
        if not rag_service.is_ready():
            logger.error("RAG service is not ready")
            raise HTTPException(
                status_code=503,
                detail="AI service is temporarily unavailable. Please try again later."
            )
        
        # Generate response using RAG pipeline
        response = await rag_service.generate_response(validated_request)
        
        processing_time = (time.time() - start_time) * 1000
        logger.info(f"Chat response generated in {processing_time:.2f}ms for user {user_id}")
        
        return response
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
        
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        logger.error(f"Error processing chat request after {processing_time:.2f}ms: {e}")
        
        # Return user-friendly error response
        raise HTTPException(
            status_code=500,
            detail="An error occurred while processing your message. Please try again."
        )


@router.post("/chat/stream")
async def chat_stream_endpoint(
    request: StreamChatRequest,
    user_id: str = Depends(validate_api_key)
):
    """
    Process chat messages and return streaming AI responses using enhanced RAG pipeline.
    
    This endpoint provides real-time streaming responses using Server-Sent Events (SSE):
    1. Validates the API key to authenticate the user
    2. Processes the user message through the enhanced RAG pipeline
    3. Streams response tokens in real-time via SSE with intelligent features
    4. Includes metadata streaming for conversation ID and sentiment analysis
    5. Implements fallback strategies for knowledge gaps
    6. Avoids "I don't know" responses with intelligent alternatives
    7. Handles connection management and cleanup for Inference API connections
    
    Args:
        request: Streaming chat request with user message and options
        user_id: User ID extracted from validated API key
        
    Returns:
        StreamingResponse with Server-Sent Events containing enhanced tokens and metadata
        
    Raises:
        HTTPException: For various error conditions
    """
    start_time = time.time()
    
    try:
        logger.info(f"Processing enhanced streaming chat request for user {user_id}: {request.message[:100]}...")
        
        # Validate request data
        if not request.message or not request.message.strip():
            raise HTTPException(
                status_code=400,
                detail="Message cannot be empty"
            )
        
        # Try enhanced streaming first, fallback to standard if needed
        try:
            from app.models.enhanced_streaming import EnhancedStreamRequest, StreamingConfig
            from app.services.enhanced_streaming_service import get_enhanced_streaming_service
            
            # Convert to enhanced streaming request
            enhanced_request = EnhancedStreamRequest(
                message=request.message.strip(),
                user_id=user_id,
                conversation_id=request.conversation_id,
                enable_proactive_questions=True,
                enable_topic_suggestions=True,
                enable_conversation_actions=True,
                enable_intelligence_metadata=request.stream_metadata,
                enable_fallback_strategies=True,
                avoid_i_dont_know=True
            )
            
            # Get enhanced streaming service
            enhanced_streaming_service = get_enhanced_streaming_service()
            
            if enhanced_streaming_service.is_ready():
                config = StreamingConfig(
                    chunk_size=1,
                    delay_ms=50,
                    include_metadata=request.stream_metadata,
                    enable_typing_indicator=True,
                    max_response_tokens=2000
                )
                
                async def generate_enhanced_sse_stream():
                    """Generate enhanced Server-Sent Events stream for chat response."""
                    try:
                        async for response_chunk in enhanced_streaming_service.generate_enhanced_stream(
                            enhanced_request, 
                            config
                        ):
                            # Convert enhanced response to standard format for compatibility
                            if response_chunk.type == "token":
                                chunk_data = {
                                    "type": "token",
                                    "content": response_chunk.content,
                                    "metadata": response_chunk.metadata
                                }
                            elif response_chunk.type == "done":
                                chunk_data = {
                                    "type": "done",
                                    "content": None,
                                    "metadata": response_chunk.metadata
                                }
                            else:
                                # Include enhanced features in metadata
                                chunk_data = {
                                    "type": "metadata",
                                    "content": None,
                                    "metadata": {
                                        "enhanced_feature": response_chunk.type,
                                        "data": response_chunk.dict(exclude_none=True)
                                    }
                                }
                            
                            # Format as Server-Sent Event
                            sse_data = f"data: {json.dumps(chunk_data)}\n\n"
                            yield sse_data
                            
                            # If this is the completion signal, break
                            if response_chunk.type == "done":
                                break
                                
                    except Exception as e:
                        logger.error(f"Error in enhanced streaming generation: {e}")
                        # Send error event
                        error_response = {
                            "type": "metadata",
                            "content": None,
                            "metadata": {"error": str(e)}
                        }
                        error_data = f"data: {json.dumps(error_response)}\n\n"
                        yield error_data
                        
                        # Send completion event
                        done_response = {
                            "type": "done",
                            "content": None,
                            "metadata": {"error": True}
                        }
                        done_data = f"data: {json.dumps(done_response)}\n\n"
                        yield done_data
                
                processing_time = (time.time() - start_time) * 1000
                logger.info(f"Started enhanced streaming chat response in {processing_time:.2f}ms for user {user_id}")
                
                # Return enhanced streaming response
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
            
        except Exception as enhanced_error:
            logger.warning(f"Enhanced streaming failed, falling back to standard: {enhanced_error}")
        
        # Fallback to standard streaming
        # Override user_id from validated API key
        validated_request = ChatRequest(
            message=request.message.strip(),
            user_id=user_id,
            conversation_id=request.conversation_id
        )
        
        # Get RAG service
        rag_service = get_rag_service()
        
        # Check if RAG service is ready
        if not rag_service.is_ready():
            logger.error("RAG service is not ready for streaming")
            raise HTTPException(
                status_code=503,
                detail="AI service is temporarily unavailable. Please try again later."
            )
        
        async def generate_sse_stream():
            """Generate Server-Sent Events stream for chat response."""
            try:
                async for response_chunk in rag_service.generate_response_stream(validated_request):
                    # Convert response to JSON
                    chunk_data = response_chunk.dict()
                    
                    # Format as Server-Sent Event
                    sse_data = f"data: {json.dumps(chunk_data)}\n\n"
                    yield sse_data
                    
                    # If this is the completion signal, break
                    if response_chunk.type == "done":
                        break
                        
            except Exception as e:
                logger.error(f"Error in streaming generation: {e}")
                # Send error event
                error_response = StreamChatResponse(
                    type="metadata",
                    content=None,
                    metadata={"error": str(e)}
                )
                error_data = f"data: {json.dumps(error_response.dict())}\n\n"
                yield error_data
                
                # Send completion event
                done_response = StreamChatResponse(
                    type="done",
                    content=None,
                    metadata=None
                )
                done_data = f"data: {json.dumps(done_response.dict())}\n\n"
                yield done_data
        
        processing_time = (time.time() - start_time) * 1000
        logger.info(f"Started standard streaming chat response in {processing_time:.2f}ms for user {user_id}")
        
        # Return streaming response with appropriate headers
        return StreamingResponse(
            generate_sse_stream(),
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
        logger.error(f"Error processing streaming chat request after {processing_time:.2f}ms: {e}")
        
        # Return user-friendly error response
        raise HTTPException(
            status_code=500,
            detail="An error occurred while processing your message. Please try again."
        )


@router.post("/chat/widget/stream")
async def chat_widget_stream_endpoint(request: ChatRequestWithApiKey):
    """
    Enhanced streaming chat endpoint for embedded widgets with API key in request body.
    
    This endpoint provides enhanced streaming functionality for embedded chat widgets
    with intelligent response generation, fallback strategies, and proactive features.
    API keys are included in the request body rather than headers.
    
    Args:
        request: Chat request with message, API key, and optional conversation ID
        
    Returns:
        StreamingResponse with enhanced Server-Sent Events containing intelligent features
        
    Raises:
        HTTPException: For various error conditions
    """
    start_time = time.time()
    
    try:
        logger.info(f"Processing enhanced widget streaming chat request: {request.message[:100]}...")
        
        # Validate chatbot API key
        user_service = get_user_service()
        chatbot_info = await user_service.validate_chatbot_api_key(request.api_key)
        
        if not chatbot_info:
            logger.warning(f"Invalid chatbot API key in widget streaming request: {request.api_key[:8]}...")
            raise HTTPException(
                status_code=401,
                detail="Invalid chatbot API key provided."
            )
        
        chatbot_id = chatbot_info["chatbot_id"]
        user_id = chatbot_info["user_id"]
        logger.info(f"Valid chatbot API key for enhanced widget streaming from chatbot: {chatbot_info['name']}")
        
        # Try enhanced streaming first, fallback to standard if needed
        try:
            from app.models.enhanced_streaming import EnhancedStreamRequest, StreamingConfig
            from app.services.enhanced_streaming_service import get_enhanced_streaming_service
            
            # Convert to enhanced streaming request
            enhanced_request = EnhancedStreamRequest(
                message=request.message,
                user_id=user_id,
                chatbot_id=chatbot_id,
                conversation_id=request.conversation_id,
                user_email=request.user_email if hasattr(request, 'user_email') else None,
                session_id=request.session_id if hasattr(request, 'session_id') else None,
                enable_proactive_questions=True,
                enable_topic_suggestions=True,
                enable_conversation_actions=True,
                enable_intelligence_metadata=True,
                enable_fallback_strategies=True,
                avoid_i_dont_know=True
            )
            
            # Get enhanced streaming service
            enhanced_streaming_service = get_enhanced_streaming_service()
            
            if enhanced_streaming_service.is_ready():
                config = StreamingConfig(
                    chunk_size=1,
                    delay_ms=50,
                    include_metadata=True,
                    enable_typing_indicator=True,
                    max_response_tokens=2000
                )
                
                async def generate_enhanced_widget_sse_stream():
                    """Generate enhanced Server-Sent Events stream for widget chat response."""
                    try:
                        async for response_chunk in enhanced_streaming_service.generate_enhanced_stream(
                            enhanced_request, 
                            config
                        ):
                            # Convert enhanced response to standard format for compatibility
                            if response_chunk.type == "token":
                                chunk_data = {
                                    "type": "token",
                                    "content": response_chunk.content,
                                    "metadata": response_chunk.metadata
                                }
                            elif response_chunk.type == "done":
                                chunk_data = {
                                    "type": "done",
                                    "content": None,
                                    "metadata": response_chunk.metadata
                                }
                            else:
                                # Include enhanced features in metadata
                                chunk_data = {
                                    "type": "metadata",
                                    "content": None,
                                    "metadata": {
                                        "enhanced_feature": response_chunk.type,
                                        "data": response_chunk.dict(exclude_none=True)
                                    }
                                }
                            
                            # Format as Server-Sent Event
                            sse_data = f"data: {json.dumps(chunk_data)}\n\n"
                            yield sse_data
                            
                            # If this is the completion signal, break
                            if response_chunk.type == "done":
                                break
                                
                    except Exception as e:
                        logger.error(f"Error in enhanced widget streaming generation: {e}")
                        # Send error event
                        error_response = {
                            "type": "metadata",
                            "content": None,
                            "metadata": {"error": str(e)}
                        }
                        error_data = f"data: {json.dumps(error_response)}\n\n"
                        yield error_data
                        
                        # Send completion event
                        done_response = {
                            "type": "done",
                            "content": None,
                            "metadata": {"error": True}
                        }
                        done_data = f"data: {json.dumps(done_response)}\n\n"
                        yield done_data
                
                processing_time = (time.time() - start_time) * 1000
                logger.info(f"Started enhanced widget streaming response in {processing_time:.2f}ms for user {user_id}")
                
                # Return enhanced streaming response
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
            
        except Exception as enhanced_error:
            logger.warning(f"Enhanced widget streaming failed, falling back to standard: {enhanced_error}")
        
        # Fallback to standard streaming
        # Create validated request with chatbot_id and session info
        validated_request = ChatRequest(
            message=request.message,
            user_id=user_id,
            chatbot_id=chatbot_id,
            conversation_id=request.conversation_id,
            user_email=request.user_email if hasattr(request, 'user_email') else None,
            session_id=request.session_id if hasattr(request, 'session_id') else None
        )
        
        # Get RAG service
        rag_service = get_rag_service()
        
        # Check if RAG service is ready
        if not rag_service.is_ready():
            logger.error("RAG service is not ready for widget streaming request")
            raise HTTPException(
                status_code=503,
                detail="AI service is temporarily unavailable. Please try again later."
            )
        
        async def generate_widget_sse_stream():
            """Generate Server-Sent Events stream for widget chat response."""
            try:
                async for response_chunk in rag_service.generate_response_stream(validated_request):
                    # Convert response to JSON
                    chunk_data = response_chunk.dict()
                    
                    # Format as Server-Sent Event
                    sse_data = f"data: {json.dumps(chunk_data)}\n\n"
                    yield sse_data
                    
                    # If this is the completion signal, break
                    if response_chunk.type == "done":
                        break
                        
            except Exception as e:
                logger.error(f"Error in widget streaming generation: {e}")
                # Send error event
                error_response = StreamChatResponse(
                    type="metadata",
                    content=None,
                    metadata={"error": str(e)}
                )
                error_data = f"data: {json.dumps(error_response.dict())}\n\n"
                yield error_data
                
                # Send completion event
                done_response = StreamChatResponse(
                    type="done",
                    content=None,
                    metadata=None
                )
                done_data = f"data: {json.dumps(done_response.dict())}\n\n"
                yield done_data
        
        processing_time = (time.time() - start_time) * 1000
        logger.info(f"Started standard widget streaming response in {processing_time:.2f}ms for user {user_id}")
        
        # Return streaming response with appropriate headers
        return StreamingResponse(
            generate_widget_sse_stream(),
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
        logger.error(f"Error processing widget streaming chat request after {processing_time:.2f}ms: {e}")
        
        # Return user-friendly error response
        raise HTTPException(
            status_code=500,
            detail="An error occurred while processing your message. Please try again."
        )


@router.post("/chat/context", response_model=RAGContext)
async def get_chat_context(
    request: ChatRequest,
    user_id: str = Depends(validate_api_key)
):
    """
    Get RAG context information for debugging and monitoring.
    
    This endpoint provides detailed information about the RAG pipeline
    processing without generating a full response. Useful for:
    - Debugging document retrieval issues
    - Monitoring embedding generation performance
    - Understanding context construction
    
    Args:
        request: Chat request with user message
        user_id: User ID extracted from validated API key
        
    Returns:
        RAGContext with processing information and metrics
    """
    try:
        logger.info(f"Getting RAG context for user {user_id}: {request.message[:100]}...")
        
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
        
        # Get RAG service
        rag_service = get_rag_service()
        
        # Get context information
        context = await rag_service.get_rag_context(validated_request)
        
        logger.info(f"RAG context retrieved for user {user_id}")
        return context
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
        
    except Exception as e:
        logger.error(f"Error getting RAG context: {e}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while retrieving context information."
        )


@router.post("/chat/widget", response_model=ChatResponse)
async def chat_widget_endpoint(request: ChatRequestWithApiKey):
    """
    Chat endpoint for embedded widgets with API key in request body.
    
    This endpoint is designed for embedded chat widgets where API keys
    are included in the request body rather than headers. It provides
    the same RAG functionality as the main chat endpoint.
    
    Args:
        request: Chat request with message, API key, and optional conversation ID
        
    Returns:
        ChatResponse with AI-generated response and metadata
        
    Raises:
        HTTPException: For various error conditions
    """
    start_time = time.time()
    
    try:
        logger.info(f"Processing widget chat request: {request.message[:100]}...")
        
        # Validate chatbot API key
        user_service = get_user_service()
        chatbot_info = await user_service.validate_chatbot_api_key(request.api_key)
        
        if not chatbot_info:
            logger.warning(f"Invalid chatbot API key in widget request: {request.api_key[:8]}...")
            raise HTTPException(
                status_code=401,
                detail="Invalid chatbot API key provided."
            )
        
        chatbot_id = chatbot_info["chatbot_id"]
        user_id = chatbot_info["user_id"]
        logger.info(f"Valid chatbot API key for widget request from chatbot: {chatbot_info['name']}")
        
        # Create validated request with chatbot_id and session info
        validated_request = ChatRequest(
            message=request.message,
            user_id=user_id,
            chatbot_id=chatbot_id,
            conversation_id=request.conversation_id,
            user_email=request.user_email if hasattr(request, 'user_email') else None,
            session_id=request.session_id if hasattr(request, 'session_id') else None
        )
        
        # Get RAG service
        rag_service = get_rag_service()
        
        # Check if RAG service is ready
        if not rag_service.is_ready():
            logger.error("RAG service is not ready for widget request")
            raise HTTPException(
                status_code=503,
                detail="AI service is temporarily unavailable. Please try again later."
            )
        
        # Generate response using RAG pipeline
        response = await rag_service.generate_response(validated_request)
        
        processing_time = (time.time() - start_time) * 1000
        logger.info(f"Widget chat response generated in {processing_time:.2f}ms for user {user_id}")
        
        return response
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
        
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        logger.error(f"Error processing widget chat request after {processing_time:.2f}ms: {e}")
        
        # Return user-friendly error response
        raise HTTPException(
            status_code=500,
            detail="An error occurred while processing your message. Please try again."
        )


@router.post("/chat/upload-image")
async def upload_image_endpoint(
    file: UploadFile = File(...),
    user_id: str = Depends(validate_api_key)
):
    """
    Upload an image for analysis in chat conversations.
    
    This endpoint:
    1. Validates the uploaded file format and size
    2. Stores the image temporarily (or in cloud storage)
    3. Returns a secure URL for the image
    4. The URL can then be used in chat requests for analysis
    
    Args:
        file: Uploaded image file
        user_id: User ID extracted from validated API key
        
    Returns:
        Dict with image URL and metadata
        
    Raises:
        HTTPException: For invalid files or upload errors
    """
    try:
        logger.info(f"Processing image upload for user {user_id}: {file.filename}")
        
        # Validate file type
        allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed types: {', '.join(allowed_types)}"
            )
        
        # Validate file size (max 10MB)
        max_size = 10 * 1024 * 1024  # 10MB
        file_content = await file.read()
        if len(file_content) > max_size:
            raise HTTPException(
                status_code=400,
                detail="File size too large. Maximum size is 10MB."
            )
        
        # Reset file pointer
        await file.seek(0)
        
        # For now, we'll use a simple approach with base64 encoding
        # In production, you'd want to use cloud storage (S3, etc.)
        import base64
        import uuid as uuid_lib
        
        # Generate unique filename
        file_id = str(uuid_lib.uuid4())
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        
        # Encode file content as base64 data URL
        encoded_content = base64.b64encode(file_content).decode('utf-8')
        data_url = f"data:{file.content_type};base64,{encoded_content}"
        
        logger.info(f"Image uploaded successfully for user {user_id}: {file_id}")
        
        return {
            "image_url": data_url,
            "file_id": file_id,
            "filename": file.filename,
            "content_type": file.content_type,
            "size": len(file_content),
            "message": "Image uploaded successfully. Use the image_url in your chat request for analysis."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading image for user {user_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while uploading the image. Please try again."
        )


@router.post("/chat/widget/upload-image")
async def upload_image_widget_endpoint(
    file: UploadFile = File(...),
    api_key: str = Form(...)
):
    """
    Upload an image for analysis in chat widget conversations.
    
    This endpoint is designed for embedded chat widgets where API keys
    are provided as form data rather than headers.
    
    Args:
        file: Uploaded image file
        api_key: Chatbot API key for authentication
        
    Returns:
        Dict with image URL and metadata
        
    Raises:
        HTTPException: For invalid files or upload errors
    """
    try:
        logger.info(f"Processing widget image upload: {file.filename}")
        
        # Validate chatbot API key
        from app.services.user_service import get_user_service
        user_service = get_user_service()
        chatbot_info = await user_service.validate_chatbot_api_key(api_key)
        
        if not chatbot_info:
            logger.warning(f"Invalid chatbot API key in widget image upload: {api_key[:8]}...")
            raise HTTPException(
                status_code=401,
                detail="Invalid chatbot API key provided."
            )
        
        user_id = chatbot_info["user_id"]
        logger.info(f"Valid chatbot API key for widget image upload from chatbot: {chatbot_info['name']}")
        
        # Validate file type
        allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed types: {', '.join(allowed_types)}"
            )
        
        # Validate file size (max 10MB)
        max_size = 10 * 1024 * 1024  # 10MB
        file_content = await file.read()
        if len(file_content) > max_size:
            raise HTTPException(
                status_code=400,
                detail="File size too large. Maximum size is 10MB."
            )
        
        # Reset file pointer
        await file.seek(0)
        
        # Generate unique filename and encode as data URL
        import base64
        import uuid as uuid_lib
        
        file_id = str(uuid_lib.uuid4())
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        
        # Encode file content as base64 data URL
        encoded_content = base64.b64encode(file_content).decode('utf-8')
        data_url = f"data:{file.content_type};base64,{encoded_content}"
        
        logger.info(f"Widget image uploaded successfully for user {user_id}: {file_id}")
        
        return {
            "image_url": data_url,
            "file_id": file_id,
            "filename": file.filename,
            "content_type": file.content_type,
            "size": len(file_content),
            "message": "Image uploaded successfully. Use the image_url in your chat request for analysis."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading widget image: {e}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while uploading the image. Please try again."
        )


@router.get("/chat/health")
async def chat_health_check():
    """
    Health check endpoint for chat service components.
    
    Returns:
        Health status of RAG service components including streaming capabilities
    """
    try:
        from app.services.conversation_service import get_conversation_service
        
        rag_service = get_rag_service()
        user_service = get_user_service()
        conversation_service = get_conversation_service()
        
        rag_info = rag_service.get_service_info()
        user_info = user_service.get_service_info()
        conversation_info = conversation_service.get_service_info()
        
        overall_health = (
            rag_service.is_ready() and 
            user_service.is_ready() and
            conversation_service.is_ready()
        )
        
        return {
            "status": "healthy" if overall_health else "degraded",
            "timestamp": time.time(),
            "streaming_enabled": True,
            "endpoints": {
                "chat": "/api/chat",
                "chat_stream": "/api/chat/stream",
                "chat_widget": "/api/chat/widget",
                "chat_widget_stream": "/api/chat/widget/stream",
                "chat_context": "/api/chat/context"
            },
            "components": {
                "rag_service": rag_info,
                "user_service": user_info,
                "conversation_service": conversation_info
            }
        }
        
    except Exception as e:
        logger.error(f"Chat health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "timestamp": time.time(),
                "error": str(e)
            }
        )
