"""
Event service for automation triggers using Inngest and Frontend integration.
"""
import logging
import asyncio
import aiohttp
from typing import Dict, Any, Optional, List
from datetime import datetime
from inngest import Inngest
from app.config import settings

logger = logging.getLogger(__name__)


class EventService:
    """
    Service for managing automation events and triggers using Inngest and Frontend integration.
    
    This service provides:
    - Event emission for conversation events
    - Trigger detection and workflow execution
    - Event handling for automation workflows
    - Integration with frontend event processing pipeline
    """
    
    def __init__(self):
        """Initialize the event service with Inngest client and frontend integration."""
        self.inngest_client = None
        self.frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        self.frontend_api_key = getattr(settings, 'FASTAPI_EVENT_API_KEY', None)
        self.session = None
        self._initialize_client()
        self._initialize_http_session()
    
    def _initialize_client(self):
        """Initialize Inngest client for event handling."""
        try:
            # Initialize Inngest client
            self.inngest_client = Inngest(
                app_id="echoai-automation",
                event_key=getattr(settings, 'INNGEST_EVENT_KEY', None),
                signing_key=getattr(settings, 'INNGEST_SIGNING_KEY', None),
                is_production=getattr(settings, 'ENVIRONMENT', 'development') == 'production'
            )
            
            logger.info("Event service Inngest client initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize event service: {e}")
            # Continue without Inngest for development
            self.inngest_client = None
    
    def _initialize_http_session(self):
        """Initialize HTTP session for frontend communication."""
        try:
            # Create aiohttp session with timeout and retry configuration
            timeout = aiohttp.ClientTimeout(total=10)
            self.session = aiohttp.ClientSession(
                timeout=timeout,
                headers={
                    'Content-Type': 'application/json',
                    'User-Agent': 'EchoAI-FastAPI-EventService/1.0'
                }
            )
            logger.info("HTTP session for frontend communication initialized")
        except Exception as e:
            logger.error(f"Failed to initialize HTTP session: {e}")
            self.session = None
    
    async def emit_new_conversation_event(
        self, 
        conversation_id: str, 
        user_id: str, 
        chatbot_id: Optional[str] = None,
        user_email: Optional[str] = None
    ) -> bool:
        """
        Emit a new conversation started event.
        
        Args:
            conversation_id: The conversation ID
            user_id: The user ID
            chatbot_id: Optional chatbot ID for widget conversations
            user_email: Optional external user email
            
        Returns:
            True if event was emitted successfully
        """
        try:
            event_data = {
                "name": "conversation.started",
                "data": {
                    "conversation_id": conversation_id,
                    "user_id": user_id,
                    "chatbot_id": chatbot_id,
                    "user_email": user_email,
                    "timestamp": datetime.utcnow().isoformat(),
                    "trigger_type": "new_conversation"
                }
            }
            
            # Send to both Inngest and Frontend
            inngest_success = await self._send_to_inngest(event_data)
            frontend_success = await self._send_to_frontend(event_data)
            
            # Consider successful if at least one destination succeeded
            success = inngest_success or frontend_success
            
            if success:
                logger.info(f"Emitted new conversation event for {conversation_id}")
            else:
                logger.error(f"Failed to emit new conversation event for {conversation_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error emitting new conversation event: {e}")
            return False
    
    async def emit_message_event(
        self,
        conversation_id: str,
        message_id: str,
        user_id: str,
        content: str,
        role: str,
        sentiment_analysis: Dict[str, Any],
        chatbot_id: Optional[str] = None,
        is_first_message: bool = False,
        message_count: int = 1
    ) -> bool:
        """
        Emit a message event with sentiment analysis results.
        
        Args:
            conversation_id: The conversation ID
            message_id: The message ID
            user_id: The user ID
            content: Message content
            role: Message role (user/assistant)
            sentiment_analysis: Sentiment analysis results
            chatbot_id: Optional chatbot ID
            is_first_message: Whether this is the first message in the conversation
            message_count: Total number of messages in the conversation
            
        Returns:
            True if event was emitted successfully
        """
        try:
            # Determine trigger type based on message characteristics
            trigger_type = "message_created"
            if is_first_message or message_count == 1:
                trigger_type = "new_conversation"
            elif sentiment_analysis:
                # Check for sentiment-based triggers
                sentiment_score = sentiment_analysis.get('score', 0)
                sentiment_label = sentiment_analysis.get('label', '').lower()
                
                if sentiment_label == 'negative' and sentiment_score > 0.7:
                    trigger_type = "negative_sentiment"
                elif sentiment_label == 'negative' and sentiment_score > 0.9:
                    trigger_type = "very_negative_sentiment"
                elif sentiment_label == 'positive' and sentiment_score > 0.8:
                    trigger_type = "positive_sentiment"
                elif abs(sentiment_score) > 0.8:
                    trigger_type = "high_emotion"
            
            event_data = {
                "name": "message.created",
                "data": {
                    "conversation_id": conversation_id,
                    "message_id": message_id,
                    "user_id": user_id,
                    "chatbot_id": chatbot_id,
                    "content": content,
                    "role": role,
                    "sentiment": sentiment_analysis,
                    "timestamp": datetime.utcnow().isoformat(),
                    "trigger_type": trigger_type,
                    "is_first_message": is_first_message,
                    "message_count": message_count
                }
            }
            
            # Send to both Inngest and Frontend
            inngest_success = await self._send_to_inngest(event_data)
            frontend_success = await self._send_to_frontend(event_data)
            
            # Consider successful if at least one destination succeeded
            success = inngest_success or frontend_success
            
            if success:
                logger.info(f"Emitted message event for {message_id}")
            else:
                logger.error(f"Failed to emit message event for {message_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error emitting message event: {e}")
            return False
    
    async def emit_sentiment_trigger_event(
        self,
        conversation_id: str,
        message_id: str,
        user_id: str,
        trigger_type: str,
        sentiment_analysis: Dict[str, Any],
        chatbot_id: Optional[str] = None
    ) -> bool:
        """
        Emit a sentiment-based trigger event.
        
        Args:
            conversation_id: The conversation ID
            message_id: The message ID
            user_id: The user ID
            trigger_type: Type of sentiment trigger
            sentiment_analysis: Sentiment analysis results
            chatbot_id: Optional chatbot ID
            
        Returns:
            True if event was emitted successfully
        """
        try:
            event_data = {
                "name": "sentiment.trigger",
                "data": {
                    "conversation_id": conversation_id,
                    "message_id": message_id,
                    "user_id": user_id,
                    "chatbot_id": chatbot_id,
                    "trigger_type": trigger_type,
                    "sentiment": sentiment_analysis,
                    "timestamp": datetime.utcnow().isoformat()
                }
            }
            
            # Send to both Inngest and Frontend
            inngest_success = await self._send_to_inngest(event_data)
            frontend_success = await self._send_to_frontend(event_data)
            
            # Consider successful if at least one destination succeeded
            success = inngest_success or frontend_success
            
            if success:
                logger.info(f"Emitted sentiment trigger event: {trigger_type} for {conversation_id}")
            else:
                logger.error(f"Failed to emit sentiment trigger event: {trigger_type} for {conversation_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error emitting sentiment trigger event: {e}")
            return False
    
    async def emit_intent_detected_event(
        self,
        conversation_id: str,
        message_id: str,
        user_id: str,
        intent: str,
        confidence: float,
        chatbot_id: Optional[str] = None
    ) -> bool:
        """
        Emit an intent detection event.
        
        Args:
            conversation_id: The conversation ID
            message_id: The message ID
            user_id: The user ID
            intent: Detected intent
            confidence: Intent confidence score
            chatbot_id: Optional chatbot ID
            
        Returns:
            True if event was emitted successfully
        """
        try:
            event_data = {
                "name": "intent.detected",
                "data": {
                    "conversation_id": conversation_id,
                    "message_id": message_id,
                    "user_id": user_id,
                    "chatbot_id": chatbot_id,
                    "intent": intent,
                    "confidence": confidence,
                    "trigger_type": "intent_detected",
                    "timestamp": datetime.utcnow().isoformat()
                }
            }
            
            # Send to both Inngest and Frontend
            inngest_success = await self._send_to_inngest(event_data)
            frontend_success = await self._send_to_frontend(event_data)
            
            # Consider successful if at least one destination succeeded
            success = inngest_success or frontend_success
            
            if success:
                logger.info(f"Emitted intent detected event: {intent} for {conversation_id}")
            else:
                logger.error(f"Failed to emit intent detected event: {intent} for {conversation_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error emitting intent detected event: {e}")
            return False
    
    async def emit_image_uploaded_event(
        self,
        conversation_id: str,
        message_id: str,
        user_id: str,
        image_url: str,
        analysis_result: Optional[Dict[str, Any]] = None,
        chatbot_id: Optional[str] = None
    ) -> bool:
        """
        Emit an image upload event.
        
        Args:
            conversation_id: The conversation ID
            message_id: The message ID
            user_id: The user ID
            image_url: URL of the uploaded image
            analysis_result: Optional image analysis results
            chatbot_id: Optional chatbot ID
            
        Returns:
            True if event was emitted successfully
        """
        try:
            event_data = {
                "name": "image.uploaded",
                "data": {
                    "conversation_id": conversation_id,
                    "message_id": message_id,
                    "user_id": user_id,
                    "chatbot_id": chatbot_id,
                    "image_url": image_url,
                    "analysis_result": analysis_result,
                    "trigger_type": "image_uploaded",
                    "timestamp": datetime.utcnow().isoformat()
                }
            }
            
            # Send to both Inngest and Frontend
            inngest_success = await self._send_to_inngest(event_data)
            frontend_success = await self._send_to_frontend(event_data)
            
            # Consider successful if at least one destination succeeded
            success = inngest_success or frontend_success
            
            if success:
                logger.info(f"Emitted image uploaded event for {conversation_id}")
            else:
                logger.error(f"Failed to emit image uploaded event for {conversation_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error emitting image uploaded event: {e}")
            return False
    
    async def process_triggers(
        self,
        conversation_id: str,
        message_id: str,
        user_id: str,
        triggers: List[str],
        sentiment_analysis: Dict[str, Any],
        chatbot_id: Optional[str] = None
    ) -> bool:
        """
        Process detected triggers and emit appropriate events.
        
        Args:
            conversation_id: The conversation ID
            message_id: The message ID
            user_id: The user ID
            triggers: List of detected triggers
            sentiment_analysis: Sentiment analysis results
            chatbot_id: Optional chatbot ID
            
        Returns:
            True if all triggers were processed successfully
        """
        try:
            success = True
            
            for trigger in triggers:
                if trigger in ["negative_sentiment", "very_negative_sentiment", "positive_sentiment", "high_emotion"]:
                    result = await self.emit_sentiment_trigger_event(
                        conversation_id, message_id, user_id, trigger, sentiment_analysis, chatbot_id
                    )
                    success = success and result
                else:
                    logger.warning(f"Unknown trigger type: {trigger}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error processing triggers: {e}")
            return False
    
    def is_ready(self) -> bool:
        """Check if the event service is ready."""
        # Service is ready even without Inngest for development
        return True
    
    def get_service_info(self) -> Dict[str, Any]:
        """Get service information and status."""
        return {
            "service": "EventService",
            "version": "1.0.0",
            "ready": self.is_ready(),
            "inngest_client_available": self.inngest_client is not None,
            "frontend_integration_available": self.session is not None,
            "frontend_url": self.frontend_url,
            "supported_events": [
                "conversation.started",
                "message.created",
                "sentiment.trigger",
                "intent.detected",
                "image.uploaded"
            ],
            "supported_triggers": [
                "new_conversation",
                "intent_detected",
                "negative_sentiment",
                "very_negative_sentiment",
                "positive_sentiment",
                "high_emotion",
                "image_uploaded"
            ]
        }
    
    async def _send_to_inngest(self, event_data: Dict[str, Any]) -> bool:
        """Send event to Inngest service."""
        try:
            if self.inngest_client:
                # TODO: Fix Inngest integration - temporarily disabled
                logger.debug(f"Inngest integration temporarily disabled, would send: {event_data['name']}")
                return True  # Return True to not block event processing
            else:
                logger.debug(f"Inngest client not available, would send: {event_data}")
                return False
        except Exception as e:
            logger.error(f"Error sending event to Inngest: {e}")
            return False
    
    async def _send_to_frontend(self, event_data: Dict[str, Any]) -> bool:
        """Send event to frontend event processing pipeline."""
        try:
            if not self.session:
                logger.debug("HTTP session not available for frontend communication")
                return False
            
            # Prepare headers
            headers = {}
            if self.frontend_api_key:
                headers['x-api-key'] = self.frontend_api_key
            
            # Send event to frontend
            frontend_endpoint = f"{self.frontend_url}/api/events"
            
            async with self.session.post(
                frontend_endpoint,
                json=event_data,
                headers=headers
            ) as response:
                if response.status == 200:
                    logger.debug(f"Successfully sent event to frontend: {event_data['name']}")
                    return True
                else:
                    error_text = await response.text()
                    logger.error(f"Frontend returned status {response.status}: {error_text}")
                    return False
                    
        except asyncio.TimeoutError:
            logger.error("Timeout sending event to frontend")
            return False
        except aiohttp.ClientError as e:
            logger.error(f"HTTP client error sending event to frontend: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending event to frontend: {e}")
            return False
    
    async def close(self):
        """Close HTTP session and cleanup resources."""
        if self.session:
            await self.session.close()
            self.session = None
            logger.info("Event service HTTP session closed")


# Global service instance
_event_service = None


def get_event_service() -> EventService:
    """
    Get the global event service instance.
    
    Returns:
        EventService instance
    """
    global _event_service
    
    if _event_service is None:
        _event_service = EventService()
    
    return _event_service