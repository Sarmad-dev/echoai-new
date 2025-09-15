"""
Enhanced streaming service with intelligent response generation and fallback strategies.
"""
import logging
import asyncio
import json
import re
from typing import AsyncGenerator, List, Optional, Dict, Any
from datetime import datetime

from app.models.chat import ChatRequest
from app.models.enhanced_streaming import (
    EnhancedStreamResponse,
    EnhancedStreamRequest,
    StreamResponseType,
    FallbackStrategy,
    StreamingConfig
)
from app.models.decision import ProactiveAction, ConversationIntelligence
from app.services.enhanced_rag_service import get_enhanced_rag_service
from app.services.rag_service import get_rag_service
from app.services.decision_manager import get_decision_manager
from app.services.proactive_assistant import get_proactive_assistant
from app.services.conversation_intelligence import get_conversation_intelligence_service

logger = logging.getLogger(__name__)


class EnhancedStreamingService:
    """
    Enhanced streaming service that provides intelligent response generation
    with fallback strategies and proactive features.
    """
    
    def __init__(self):
        """Initialize the enhanced streaming service."""
        self.enhanced_rag_service = get_enhanced_rag_service()
        self.rag_service = get_rag_service()
        self.decision_manager = get_decision_manager()
        self.proactive_assistant = get_proactive_assistant()
        self.conversation_intelligence = get_conversation_intelligence_service()
        
        # Patterns to detect "I don't know" responses
        self.i_dont_know_patterns = [
            r"i don't know",
            r"i'm not sure",
            r"i don't have information",
            r"i cannot provide",
            r"i'm unable to",
            r"i don't understand",
            r"i'm not familiar",
            r"i can't help",
            r"i don't have access",
            r"i'm not aware"
        ]
        
        logger.info("Enhanced streaming service initialized")
    
    async def generate_enhanced_stream(
        self,
        request: EnhancedStreamRequest,
        config: Optional[StreamingConfig] = None
    ) -> AsyncGenerator[EnhancedStreamResponse, None]:
        """
        Generate enhanced streaming response with intelligent features.
        
        Args:
            request: Enhanced streaming request
            config: Streaming configuration
            
        Yields:
            Enhanced streaming response chunks
        """
        if config is None:
            config = StreamingConfig()
        
        try:
            # Convert to ChatRequest for processing
            chat_request = ChatRequest(
                message=request.message,
                user_id=request.user_id,
                chatbot_id=request.chatbot_id,
                conversation_id=request.conversation_id,
                user_email=request.user_email,
                session_id=request.session_id,
                image_url=request.image_url
            )
            
            # Generate enhanced response
            enhanced_response = await self.enhanced_rag_service.generate_enhanced_response(chat_request)
            
            # Send conversation metadata early so frontend can save conversation ID
            if enhanced_response.conversation_id:
                yield EnhancedStreamResponse(
                    type=StreamResponseType.METADATA,
                    metadata={
                        "conversation_id": enhanced_response.conversation_id,
                        "sentiment": enhanced_response.sentiment,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                )
            
            # Check if response needs fallback strategy
            response_text = enhanced_response.response
            needs_fallback = self._needs_fallback_strategy(response_text, request.avoid_i_dont_know)
            
            if needs_fallback:
                # Generate fallback strategy
                fallback_strategy = await self._generate_fallback_strategy(
                    request.message,
                    enhanced_response,
                    chat_request
                )
                
                # Stream fallback strategy first
                if request.enable_fallback_strategies:
                    yield EnhancedStreamResponse(
                        type=StreamResponseType.FALLBACK_STRATEGY,
                        fallback_strategy=fallback_strategy,
                        metadata={"timestamp": datetime.utcnow().isoformat()}
                    )
                
                # Use fallback content as response
                response_text = fallback_strategy.content
            
            # Stream the main response tokens
            async for chunk in self._stream_response_tokens(response_text, config):
                yield chunk
            
            # Stream proactive questions
            if request.enable_proactive_questions and enhanced_response.proactive_questions:
                for question in enhanced_response.proactive_questions:
                    yield EnhancedStreamResponse(
                        type=StreamResponseType.PROACTIVE_QUESTION,
                        proactive_question=question,
                        metadata={"timestamp": datetime.utcnow().isoformat()}
                    )
                    
                    if config.delay_ms > 0:
                        await asyncio.sleep(config.delay_ms / 1000)
            
            # Stream suggested topics
            if request.enable_topic_suggestions and enhanced_response.suggested_topics:
                for topic in enhanced_response.suggested_topics:
                    yield EnhancedStreamResponse(
                        type=StreamResponseType.SUGGESTED_TOPIC,
                        suggested_topic=topic,
                        metadata={"timestamp": datetime.utcnow().isoformat()}
                    )
                    
                    if config.delay_ms > 0:
                        await asyncio.sleep(config.delay_ms / 1000)
            
            # Stream conversation actions
            if request.enable_conversation_actions and enhanced_response.conversation_actions:
                for action in enhanced_response.conversation_actions:
                    yield EnhancedStreamResponse(
                        type=StreamResponseType.CONVERSATION_ACTION,
                        conversation_action=action,
                        metadata={"timestamp": datetime.utcnow().isoformat()}
                    )
                    
                    if config.delay_ms > 0:
                        await asyncio.sleep(config.delay_ms / 1000)
            
            # Stream intelligence metadata
            if request.enable_intelligence_metadata and config.include_metadata:
                yield EnhancedStreamResponse(
                    type=StreamResponseType.INTELLIGENCE_METADATA,
                    intelligence_metadata=enhanced_response.intelligence_metadata,
                    metadata={
                        "timestamp": datetime.utcnow().isoformat(),
                        "confidence_score": enhanced_response.confidence_score,
                        "sources_count": enhanced_response.sources_count,
                        "context_used": enhanced_response.context_used
                    }
                )
            
            # Send completion signal
            yield EnhancedStreamResponse(
                type=StreamResponseType.DONE,
                metadata={
                    "timestamp": datetime.utcnow().isoformat(),
                    "conversation_id": enhanced_response.conversation_id,
                    "total_tokens": len(response_text.split()),
                    "fallback_used": needs_fallback
                }
            )
            
        except Exception as e:
            logger.error(f"Error in enhanced streaming: {e}")
            
            # Send error response
            yield EnhancedStreamResponse(
                type=StreamResponseType.ERROR,
                error_message=f"An error occurred while generating the response: {str(e)}",
                metadata={"timestamp": datetime.utcnow().isoformat()}
            )
            
            # Try to provide fallback response
            try:
                fallback_response = await self._generate_emergency_fallback(request.message)
                async for chunk in self._stream_response_tokens(fallback_response, config):
                    yield chunk
            except Exception as fallback_error:
                logger.error(f"Emergency fallback failed: {fallback_error}")
            
            # Send completion signal
            yield EnhancedStreamResponse(
                type=StreamResponseType.DONE,
                metadata={
                    "timestamp": datetime.utcnow().isoformat(),
                    "error": True
                }
            )
    
    async def _stream_response_tokens(
        self,
        response_text: str,
        config: StreamingConfig
    ) -> AsyncGenerator[EnhancedStreamResponse, None]:
        """
        Stream response text as individual tokens.
        
        Args:
            response_text: Text to stream
            config: Streaming configuration
            
        Yields:
            Token streaming chunks
        """
        # Split response into tokens (words and punctuation)
        tokens = self._tokenize_response(response_text)
        
        # Limit tokens if necessary
        if len(tokens) > config.max_response_tokens:
            tokens = tokens[:config.max_response_tokens]
            tokens.append("...")
        
        # Stream tokens in chunks
        for i in range(0, len(tokens), config.chunk_size):
            chunk_tokens = tokens[i:i + config.chunk_size]
            chunk_content = "".join(chunk_tokens)  # Don't add spaces since they're preserved as tokens
            
            yield EnhancedStreamResponse(
                type=StreamResponseType.TOKEN,
                content=chunk_content,
                metadata={
                    "token_index": i,
                    "chunk_size": len(chunk_tokens),
                    "total_tokens": len(tokens),
                    "timestamp": datetime.utcnow().isoformat()
                }
            )
            
            # Add delay between chunks for realistic typing effect
            if config.delay_ms > 0:
                await asyncio.sleep(config.delay_ms / 1000)
    
    def _tokenize_response(self, text: str) -> List[str]:
        """
        Tokenize response text into words, punctuation, and spaces.
        
        Args:
            text: Text to tokenize
            
        Returns:
            List of tokens that preserve original spacing
        """
        # Simple tokenization that preserves punctuation and spaces
        tokens = []
        current_word = ""
        
        for char in text:
            if char.isalnum() or char in ["'", "-"]:
                current_word += char
            else:
                if current_word:
                    tokens.append(current_word)
                    current_word = ""
                # Include all characters including spaces to preserve formatting
                tokens.append(char)
        
        if current_word:
            tokens.append(current_word)
        
        return tokens
    
    def _needs_fallback_strategy(self, response: str, avoid_i_dont_know: bool) -> bool:
        """
        Check if response needs a fallback strategy.
        
        Args:
            response: Generated response text
            avoid_i_dont_know: Whether to avoid "I don't know" responses
            
        Returns:
            True if fallback strategy is needed
        """
        if not avoid_i_dont_know:
            return False
        
        response_lower = response.lower()
        
        # Check for "I don't know" patterns
        for pattern in self.i_dont_know_patterns:
            if re.search(pattern, response_lower):
                return True
        
        # Check for very short responses that might be unhelpful
        if len(response.strip()) < 20:
            return True
        
        # Check for responses that don't provide value
        unhelpful_indicators = [
            "sorry, i can't",
            "i'm unable to help",
            "no information available",
            "not in my knowledge",
            "beyond my capabilities"
        ]
        
        for indicator in unhelpful_indicators:
            if indicator in response_lower:
                return True
        
        return False
    
    async def _generate_fallback_strategy(
        self,
        user_message: str,
        enhanced_response: Any,
        chat_request: ChatRequest
    ) -> FallbackStrategy:
        """
        Generate a fallback strategy for knowledge gaps.
        
        Args:
            user_message: Original user message
            enhanced_response: Enhanced response that needs fallback
            chat_request: Original chat request
            
        Returns:
            Fallback strategy
        """
        try:
            # Analyze what the user is asking about
            topic_keywords = self._extract_topic_keywords(user_message)
            
            # Try to find related information
            related_suggestions = await self._find_related_suggestions(
                user_message,
                topic_keywords,
                chat_request
            )
            
            # Generate fallback content based on available information
            if related_suggestions:
                strategy_type = "related_information"
                content = f"While I don't have specific information about that exact topic, I can help you with related areas. {related_suggestions[0]}"
                alternative_suggestions = related_suggestions[1:] if len(related_suggestions) > 1 else []
            else:
                strategy_type = "general_assistance"
                content = f"I don't have specific information about {' '.join(topic_keywords)} in my current knowledge base, but I'd be happy to help you in other ways."
                alternative_suggestions = [
                    "I can connect you with a human agent who might have more detailed information",
                    "You might find what you're looking for in our documentation or help center",
                    "Feel free to ask me about other topics I might be able to help with"
                ]
            
            # Always offer escalation for knowledge gaps
            escalation_offered = True
            content += " Would you like me to connect you with a human agent who might have more detailed information?"
            
            return FallbackStrategy(
                strategy_type=strategy_type,
                content=content,
                reasoning=f"No specific information found for query about {' '.join(topic_keywords)}",
                alternative_suggestions=alternative_suggestions,
                escalation_offered=escalation_offered
            )
            
        except Exception as e:
            logger.error(f"Error generating fallback strategy: {e}")
            
            # Emergency fallback
            return FallbackStrategy(
                strategy_type="emergency_fallback",
                content="I apologize, but I'm having trouble finding the specific information you're looking for. Let me connect you with a human agent who can better assist you.",
                reasoning="Error in fallback generation",
                alternative_suggestions=["Contact human support"],
                escalation_offered=True
            )
    
    def _extract_topic_keywords(self, message: str) -> List[str]:
        """
        Extract key topic words from user message.
        
        Args:
            message: User message
            
        Returns:
            List of topic keywords
        """
        # Simple keyword extraction
        stop_words = {
            "what", "how", "when", "where", "why", "who", "which", "can", "could", 
            "would", "should", "do", "does", "did", "is", "are", "was", "were",
            "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
            "of", "with", "by", "about", "your", "you", "i", "me", "my"
        }
        
        words = re.findall(r'\b\w+\b', message.lower())
        keywords = [word for word in words if word not in stop_words and len(word) > 2]
        
        return keywords[:5]  # Return top 5 keywords
    
    async def _find_related_suggestions(
        self,
        user_message: str,
        topic_keywords: List[str],
        chat_request: ChatRequest
    ) -> List[str]:
        """
        Find related suggestions when direct answer isn't available.
        
        Args:
            user_message: Original user message
            topic_keywords: Extracted topic keywords
            chat_request: Chat request for context
            
        Returns:
            List of related suggestions
        """
        suggestions = []
        
        try:
            # Try to get RAG context for related information
            rag_context = await self.rag_service.get_rag_context(chat_request)
            
            if rag_context.documents_retrieved > 0:
                suggestions.append("I found some related information in our documentation that might be helpful.")
            
            # Generate topic-based suggestions
            if "pricing" in topic_keywords or "cost" in topic_keywords:
                suggestions.append("I can help you understand our pricing structure and available plans.")
            
            if "feature" in topic_keywords or "functionality" in topic_keywords:
                suggestions.append("I can explain our key features and capabilities.")
            
            if "support" in topic_keywords or "help" in topic_keywords:
                suggestions.append("I can guide you to our support resources and contact options.")
            
            if "integration" in topic_keywords or "api" in topic_keywords:
                suggestions.append("I can provide information about our integration options and API documentation.")
            
            # Generic helpful suggestions
            if not suggestions:
                suggestions.extend([
                    "I can help you with general questions about our product and services.",
                    "I can guide you to relevant resources and documentation.",
                    "I can connect you with the right person who can provide detailed assistance."
                ])
            
        except Exception as e:
            logger.error(f"Error finding related suggestions: {e}")
            suggestions = ["I can help you with other questions or connect you with human support."]
        
        return suggestions[:3]  # Return top 3 suggestions
    
    async def _generate_emergency_fallback(self, user_message: str) -> str:
        """
        Generate emergency fallback response when all else fails.
        
        Args:
            user_message: Original user message
            
        Returns:
            Emergency fallback response
        """
        return (
            "I apologize for the technical difficulty. I want to make sure you get the help you need. "
            "Let me connect you with a human agent who can assist you properly with your question."
        )
    
    def is_ready(self) -> bool:
        """Check if the enhanced streaming service is ready."""
        return (
            self.enhanced_rag_service.is_ready() and
            self.rag_service.is_ready()
        )
    
    def get_service_info(self) -> Dict[str, Any]:
        """Get information about the enhanced streaming service."""
        return {
            "enhanced_rag_service_ready": self.enhanced_rag_service.is_ready(),
            "rag_service_ready": self.rag_service.is_ready(),
            "decision_manager_ready": True,
            "proactive_assistant_ready": True,
            "conversation_intelligence_ready": self.conversation_intelligence.is_ready(),
            "service_ready": self.is_ready(),
            "features": {
                "intelligent_streaming": True,
                "fallback_strategies": True,
                "avoid_i_dont_know": True,
                "proactive_question_streaming": True,
                "topic_suggestion_streaming": True,
                "conversation_action_streaming": True,
                "intelligence_metadata_streaming": True,
                "token_by_token_streaming": True,
                "configurable_streaming": True
            },
            "supported_fallback_strategies": [
                "related_information",
                "general_assistance",
                "emergency_fallback"
            ]
        }


# Global enhanced streaming service instance
enhanced_streaming_service: Optional[EnhancedStreamingService] = None


def get_enhanced_streaming_service() -> EnhancedStreamingService:
    """Get the global enhanced streaming service instance."""
    global enhanced_streaming_service
    if enhanced_streaming_service is None:
        enhanced_streaming_service = EnhancedStreamingService()
    return enhanced_streaming_service