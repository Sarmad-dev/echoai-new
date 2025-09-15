"""
Enhanced RAG service with intelligent decision-making capabilities.
"""
import logging
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime

from app.models.chat import ChatRequest, ChatResponse
from app.models.decision import (
    EnhancedChatResponse,
    DecisionRequest,
    DecisionResponse,
    ConversationContext,
    ConversationIntelligence,
    ProactiveAction
)
from app.services.rag_service import get_rag_service
from app.services.decision_manager import get_decision_manager
from app.services.conversation_intelligence import get_conversation_intelligence_service
from app.services.proactive_assistant import get_proactive_assistant
from app.services.conversation_service import get_conversation_service
from app.services.escalation_manager import EscalationManager
from app.services.escalation_tracking_service import EscalationTrackingService
from app.services.enhanced_memory_service import get_enhanced_memory_service

logger = logging.getLogger(__name__)


class EnhancedRAGService:
    """
    Enhanced RAG service that integrates intelligent decision-making capabilities
    with the existing RAG pipeline.
    """
    
    def __init__(self):
        """Initialize the enhanced RAG service."""
        self.rag_service = get_rag_service()
        self.decision_manager = get_decision_manager()
        self.conversation_intelligence = get_conversation_intelligence_service()
        self.proactive_assistant = get_proactive_assistant()
        self.conversation_service = get_conversation_service()
        self.escalation_manager = EscalationManager()
        self.escalation_tracking = EscalationTrackingService()
        self.enhanced_memory_service = get_enhanced_memory_service()
        
        logger.info("Enhanced RAG service initialized with escalation management and enhanced memory")
    
    async def generate_enhanced_response(
        self,
        request: ChatRequest
    ) -> EnhancedChatResponse:
        """
        Generate an enhanced response with intelligent decision-making capabilities.
        
        Args:
            request: Chat request with user message and context
            
        Returns:
            Enhanced chat response with proactive features
        """
        try:
            # Step 1: Handle conversation creation/validation
            conversation_id = await self._ensure_conversation_exists(request)
            
            # Update request with validated conversation ID
            request.conversation_id = conversation_id
            
            # Step 2: Load conversation memory and get context
            conversation_context = ""
            if conversation_id and request.user_id and self.enhanced_memory_service.is_ready():
                conversation_context = await self.enhanced_memory_service.get_context_for_llm(
                    conversation_id=conversation_id,
                    user_id=request.user_id,
                    current_message=request.message
                )
            
            # Step 3: Generate enhanced RAG response with memory context
            enhanced_request = ChatRequest(
                message=request.message,
                user_id=request.user_id,
                chatbot_id=request.chatbot_id,
                conversation_id=conversation_id,
                user_email=request.user_email,
                session_id=request.session_id,
                image_url=request.image_url
            )
            
            # Don't modify the original message - let RAG service work with the original user message
            # The conversation context will be handled separately in the response generation
            logger.info(f"🔍 Enhanced RAG DEBUG - Calling RAG service with original message: {request.message[:100]}...")
            logger.info(f"📋 Conversation context available: {len(conversation_context) if conversation_context else 0} characters")
            
            standard_response = await self.rag_service.generate_response(enhanced_request)
            
            logger.info(f"✅ Enhanced RAG DEBUG - RAG service returned response: {standard_response.response[:100]}...")
            logger.info(f"📚 RAG service used {standard_response.sources_count} sources, context_used: {standard_response.context_used}")
            
            # Step 4: Get conversation history
            conversation_history = []
            if conversation_id:
                conversation_history = await self.conversation_service.get_conversation_history(
                    conversation_id
                )
            
            # Step 5: Analyze conversation context
            context = await self.decision_manager.analyze_conversation_context(
                request.message,
                conversation_history
            )
            
            # Step 6: Generate conversation intelligence
            intelligence = await self.conversation_intelligence.analyze_conversation_intelligence(
                conversation_id=conversation_id,
                user_id=request.user_id,
                chatbot_id=request.chatbot_id,
                context=context,
                conversation_history=conversation_history,
                current_message=request.message
            )
            
            # Step 4.5: Analyze for escalation needs
            escalation_analysis = await self.escalation_manager.analyze_conversation_for_escalation(
                request.message,
                conversation_history
            )
            
            # Handle escalation if needed
            escalation_response = None
            if escalation_analysis.should_escalate:
                # Create escalation request
                escalation_request = await self.escalation_tracking.create_escalation_request(
                    conversation_id=conversation_id,
                    chatbot_id=request.chatbot_id or "unknown",
                    escalation_type=escalation_analysis.escalation_type,
                    trigger_reason=f"Escalation confidence: {escalation_analysis.confidence:.2f}",
                    urgency_level=escalation_analysis.urgency_level,
                    customer_sentiment=standard_response.sentiment,
                    conversation_context={
                        "message_count": len(conversation_history) + 1,
                        "sentiment_score": standard_response.sentiment_score,
                        "triggers": [trigger.dict() for trigger in escalation_analysis.triggers]
                    }
                )
                
                # Notify agents
                await self.escalation_manager.notify_human_agents(escalation_request)
                
                # Generate escalation response
                escalation_response = await self.escalation_manager.generate_escalation_response(
                    escalation_analysis.escalation_type,
                    await self.escalation_manager.detect_escalation_triggers(
                        request.message,
                        self.escalation_manager._build_conversation_context(request.message, conversation_history)
                    )
                )
                
                logger.info(f"Escalation created for conversation {conversation_id}: {escalation_analysis.escalation_type}")
            
            # Step 5: Determine proactive actions
            proactive_actions = await self.decision_manager.determine_proactive_actions(
                context,
                standard_response.response
            )
            
            # Step 6: Generate enhanced response
            # Use escalation response if escalation is needed, otherwise use intelligent response
            if escalation_response and escalation_analysis.should_escalate:
                enhanced_response_text = escalation_response.message
            else:
                # Use the original RAG response and enhance it with conversation context if available
                enhanced_response_text = standard_response.response
                
                # If we have conversation context, we can optionally enhance the response
                # but we don't modify the core RAG response which already has the correct context
                if conversation_context and len(conversation_context.strip()) > 0:
                    # Only add context reference if it would be helpful and not redundant
                    logger.info(f"Conversation context available but using original RAG response to preserve context accuracy")
                
                # Apply intelligent enhancements from decision manager
                enhanced_response_text = await self.decision_manager.generate_intelligent_response(
                    context,
                    enhanced_response_text,
                    proactive_actions
                )
            
            # Step 7: Generate follow-up questions
            followup_questions = []
            if await self.decision_manager.should_ask_followup(context):
                followup_questions = await self.proactive_assistant.generate_followup_questions(
                    context,
                    conversation_history,
                    request.message,
                    standard_response.response
                )
            
            # Step 8: Generate topic suggestions
            suggested_topics = await self.proactive_assistant.generate_topic_suggestions(
                context,
                conversation_history,
                request.message,
                standard_response.response
            )
            
            # Step 9: Generate additional proactive assistance
            additional_actions = await self.proactive_assistant.generate_proactive_assistance(
                context,
                intelligence,
                conversation_history,
                request.message
            )
            
            # Combine all proactive actions
            all_actions = proactive_actions + additional_actions
            all_actions.sort(key=lambda x: x.priority, reverse=True)
            
            # Step 10: Create enhanced response
            # Update intelligence metadata with escalation information
            if escalation_analysis.should_escalate:
                intelligence.escalation_risk = escalation_analysis.confidence
                
                # Add escalation action to conversation actions if not already present
                escalation_action = ProactiveAction(
                    action_type="escalate",
                    priority=1.0,  # Highest priority
                    content=escalation_response.message if escalation_response else "Connecting you with a human agent...",
                    reasoning=f"Escalation needed: {escalation_analysis.escalation_type.value}",
                    confidence=escalation_analysis.confidence,
                    metadata={
                        "escalation_type": escalation_analysis.escalation_type.value,
                        "urgency_level": escalation_analysis.urgency_level.value,
                        "triggers": [trigger.dict() for trigger in escalation_analysis.triggers]
                    }
                )
                all_actions.insert(0, escalation_action)  # Add at the beginning
            
            enhanced_response = EnhancedChatResponse(
                response=enhanced_response_text,
                proactive_questions=followup_questions,
                suggested_topics=suggested_topics,
                conversation_actions=all_actions[:5],  # Top 5 actions
                intelligence_metadata=intelligence,
                context_used=standard_response.context_used,
                sources_count=standard_response.sources_count,
                confidence_score=standard_response.confidence_score,
                sentiment=standard_response.sentiment,
                sentiment_score=standard_response.sentiment_score,
                sentiment_confidence=standard_response.sentiment_confidence,
                triggers_detected=standard_response.triggers_detected,
                conversation_id=conversation_id,  # Use the validated conversation_id
                session_id=getattr(standard_response, 'session_id', None),
                image_analysis=getattr(standard_response, 'image_analysis', None),
                lead_analysis=getattr(standard_response, 'lead_analysis', None)
            )
            
            # Step 11: Update conversation memory
            if conversation_id and request.user_id and self.enhanced_memory_service.is_ready():
                try:
                    await self.enhanced_memory_service.maintain_conversation_context(
                        conversation_id=conversation_id,
                        user_id=request.user_id,
                        new_message={
                            "content": request.message,
                            "metadata": {
                                "sentiment": standard_response.sentiment,
                                "sentiment_score": standard_response.sentiment_score,
                                "timestamp": datetime.utcnow().isoformat()
                            }
                        },
                        ai_response={
                            "content": enhanced_response_text,
                            "metadata": {
                                "confidence": standard_response.confidence_score,
                                "sources_count": standard_response.sources_count,
                                "proactive_actions_count": len(all_actions),
                                "escalation_risk": intelligence.escalation_risk,
                                "timestamp": datetime.utcnow().isoformat()
                            }
                        }
                    )
                    logger.debug(f"Updated conversation memory for conversation {request.conversation_id}")
                except Exception as memory_error:
                    logger.warning(f"Failed to update conversation memory: {memory_error}")
            
            logger.info(f"Enhanced response generated with {len(all_actions)} proactive actions")
            return enhanced_response
            
        except Exception as e:
            logger.error(f"Error generating enhanced response: {e}")
            # Fallback to standard response
            standard_response = await self.rag_service.generate_response(request)
            
            # Create minimal enhanced response
            return EnhancedChatResponse(
                response=standard_response.response,
                proactive_questions=[],
                suggested_topics=[],
                conversation_actions=[],
                intelligence_metadata=ConversationIntelligence(
                    conversation_id=request.conversation_id or f"temp_{datetime.utcnow().timestamp()}",
                    user_id=request.user_id,
                    chatbot_id=request.chatbot_id,
                    context_understanding=0.5,
                    proactive_score=0.5,
                    helpfulness_score=0.5,
                    conversation_flow_score=0.5,
                    user_satisfaction_prediction=0.5,
                    escalation_risk=0.2,
                    lead_potential=0.3,
                    topics_covered=[],
                    user_goals_identified=[],
                    knowledge_gaps_found=[],
                    created_at=datetime.utcnow()
                ),
                context_used=standard_response.context_used,
                sources_count=standard_response.sources_count,
                confidence_score=standard_response.confidence_score,
                sentiment=standard_response.sentiment,
                sentiment_score=standard_response.sentiment_score,
                sentiment_confidence=standard_response.sentiment_confidence,
                triggers_detected=standard_response.triggers_detected,
                conversation_id=standard_response.conversation_id
            )
    
    async def analyze_decision_context(
        self,
        request: DecisionRequest
    ) -> DecisionResponse:
        """
        Analyze conversation context and provide decision-making insights.
        
        Args:
            request: Decision analysis request
            
        Returns:
            Decision analysis response with recommendations
        """
        try:
            # Analyze conversation context
            context = await self.decision_manager.analyze_conversation_context(
                request.message,
                request.conversation_history
            )
            
            # Generate conversation intelligence
            intelligence = await self.conversation_intelligence.analyze_conversation_intelligence(
                conversation_id=request.conversation_id or f"temp_{datetime.utcnow().timestamp()}",
                user_id=request.user_id,
                chatbot_id=request.chatbot_id,
                context=context,
                conversation_history=request.conversation_history,
                current_message=request.message
            )
            
            # Determine proactive actions
            proactive_actions = await self.decision_manager.determine_proactive_actions(
                context,
                request.rag_response
            )
            
            # Generate enhanced response if RAG response provided
            enhanced_response = request.rag_response or ""
            if request.rag_response:
                enhanced_response = await self.decision_manager.generate_intelligent_response(
                    context,
                    request.rag_response,
                    proactive_actions
                )
            
            # Check if should ask follow-up
            should_ask_followup = await self.decision_manager.should_ask_followup(context)
            
            # Generate follow-up questions
            followup_questions = []
            if should_ask_followup:
                followup_questions = await self.proactive_assistant.generate_followup_questions(
                    context,
                    request.conversation_history,
                    request.message,
                    request.rag_response
                )
            
            # Generate topic suggestions
            suggested_topics = await self.proactive_assistant.generate_topic_suggestions(
                context,
                request.conversation_history,
                request.message,
                request.rag_response
            )
            
            # Calculate confidence score
            confidence_score = (
                context.user_intent_clarity * 0.3 +
                intelligence.context_understanding * 0.3 +
                intelligence.helpfulness_score * 0.4
            )
            
            return DecisionResponse(
                enhanced_response=enhanced_response,
                conversation_context=context,
                proactive_actions=proactive_actions,
                intelligence_analysis=intelligence,
                should_ask_followup=should_ask_followup,
                followup_questions=followup_questions,
                suggested_topics=suggested_topics,
                confidence_score=confidence_score
            )
            
        except Exception as e:
            logger.error(f"Error analyzing decision context: {e}")
            raise
    
    async def get_conversation_insights(
        self,
        conversation_id: str,
        time_window_hours: int = 24
    ) -> Dict[str, Any]:
        """
        Get conversation insights for monitoring and analysis.
        
        Args:
            conversation_id: Conversation ID to analyze
            time_window_hours: Time window for analysis
            
        Returns:
            Conversation insights and analytics
        """
        try:
            return await self.conversation_intelligence.get_conversation_insights(
                conversation_id,
                time_window_hours
            )
        except Exception as e:
            logger.error(f"Error getting conversation insights: {e}")
            return {"error": str(e)}
    
    async def get_user_patterns(
        self,
        user_id: str,
        days_back: int = 7
    ) -> Dict[str, Any]:
        """
        Get user conversation patterns for personalization.
        
        Args:
            user_id: User ID to analyze
            days_back: Number of days to analyze
            
        Returns:
            User conversation patterns and preferences
        """
        try:
            return await self.conversation_intelligence.get_user_conversation_patterns(
                user_id,
                days_back
            )
        except Exception as e:
            logger.error(f"Error getting user patterns: {e}")
            return {"error": str(e)}
    
    async def _ensure_conversation_exists(self, request: ChatRequest) -> str:
        """
        Ensure a conversation exists for the request, creating one if necessary.
        
        Args:
            request: Chat request
            
        Returns:
            Valid conversation ID
        """
        try:
            # If no conversation ID provided, create a new one
            if not request.conversation_id:
                logger.info(f"Creating new conversation for user {request.user_id}")
                conversation_id = await self.conversation_service.create_conversation(
                    request.user_id, 
                    request.user_email,
                    request.user_email
                )
                
                # If chatbot_id is provided, update the conversation with chatbot info
                if request.chatbot_id and conversation_id and not conversation_id.startswith("temp_"):
                    try:
                        # Update conversation with chatbot_id
                        self.conversation_service.supabase_client.table("Conversation").update({
                            "chatbotId": request.chatbot_id,
                            "updatedAt": datetime.utcnow().isoformat()
                        }).eq("id", conversation_id).execute()
                        logger.debug(f"Updated conversation {conversation_id} with chatbot {request.chatbot_id}")
                    except Exception as e:
                        logger.warning(f"Failed to update conversation with chatbot_id: {e}")
                
                return conversation_id
            
            # Check if the provided conversation exists
            conversation_exists = await self.conversation_service.conversation_exists(
                request.conversation_id, 
                request.user_id
            )
            
            if conversation_exists:
                logger.info(f"Using existing conversation {request.conversation_id} for user {request.user_id}")
                return request.conversation_id
            else:
                logger.warning(f"Conversation {request.conversation_id} does not exist for user {request.user_id}, will create new one")
            
            # Conversation doesn't exist, create it with the provided ID
            logger.info(f"Creating conversation with ID {request.conversation_id} for user {request.user_id}")
            try:
                await self.conversation_service.create_conversation_with_id(
                    request.conversation_id,
                    request.user_id,
                    request.chatbot_id,
                    request.user_email,
                    request.user_email
                )
                return request.conversation_id
            except Exception as e:
                logger.warning(f"Failed to create conversation with specific ID {request.conversation_id}: {e}")
                # Fall back to creating a new conversation
                return await self.conversation_service.create_conversation(
                    request.user_id, 
                    request.user_email,
                    request.user_email
                )
                
        except Exception as e:
            logger.error(f"Error ensuring conversation exists: {e}")
            # Return a temporary conversation ID as fallback
            return f"temp_{datetime.utcnow().timestamp()}"
    
    def is_ready(self) -> bool:
        """Check if the enhanced RAG service is ready."""
        return (
            self.rag_service.is_ready() and
            self.conversation_intelligence.is_ready()
        )
    
    def get_service_info(self) -> Dict[str, Any]:
        """Get information about the enhanced RAG service configuration."""
        return {
            "rag_service_ready": self.rag_service.is_ready(),
            "decision_manager_ready": True,
            "conversation_intelligence_ready": self.conversation_intelligence.is_ready(),
            "proactive_assistant_ready": True,
            "conversation_service_ready": self.conversation_service.is_ready(),
            "escalation_manager_ready": True,
            "escalation_tracking_ready": True,
            "service_ready": self.is_ready(),
            "features": {
                "intelligent_responses": True,
                "proactive_assistance": True,
                "conversation_intelligence": True,
                "follow_up_questions": True,
                "topic_suggestions": True,
                "escalation_detection": True,
                "escalation_management": True,
                "escalation_tracking": True,
                "human_agent_notification": True,
                "lead_analysis": True
            }
        }


# Global enhanced RAG service instance
enhanced_rag_service: Optional[EnhancedRAGService] = None


def get_enhanced_rag_service() -> EnhancedRAGService:
    """Get the global enhanced RAG service instance."""
    global enhanced_rag_service
    if enhanced_rag_service is None:
        enhanced_rag_service = EnhancedRAGService()
    return enhanced_rag_service