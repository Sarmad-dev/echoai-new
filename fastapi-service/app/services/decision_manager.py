"""
Decision Manager service for intelligent conversation context analysis and decision-making.
"""
import logging
import re
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime

from app.models.decision import (
    ConversationContext,
    ConversationContextType,
    ProactiveAction,
    ProactiveActionType,
    DecisionRequest,
    DecisionResponse,
    ConversationIntelligence
)

logger = logging.getLogger(__name__)


class DecisionManager:
    """
    Service for analyzing conversation context and making intelligent decisions
    about proactive assistance and response enhancement.
    """
    
    def __init__(self):
        """Initialize the decision manager."""
        self.confusion_keywords = [
            "confused", "don't understand", "what do you mean", "unclear",
            "not sure", "can you explain", "i'm lost", "help me understand",
            "what", "how", "why", "huh", "sorry"
        ]
        
        self.satisfaction_keywords = [
            "thank you", "thanks", "great", "perfect", "excellent",
            "helpful", "good", "awesome", "amazing", "wonderful"
        ]
        
        self.escalation_keywords = [
            "frustrated", "angry", "upset", "disappointed", "terrible",
            "awful", "horrible", "useless", "waste of time", "speak to human",
            "manager", "supervisor", "complaint"
        ]
        
        self.greeting_patterns = [
            r'\b(hi|hello|hey|good morning|good afternoon|good evening)\b',
            r'\b(greetings|salutations)\b'
        ]
        
        self.goodbye_patterns = [
            r'\b(bye|goodbye|see you|farewell|thanks|thank you)\b.*\b(bye|later|soon)\b',
            r'\b(have a good|take care|talk soon)\b'
        ]
        
        logger.info("Decision Manager initialized")
    
    async def analyze_conversation_context(
        self, 
        message: str, 
        conversation_history: List[Dict[str, Any]]
    ) -> ConversationContext:
        """
        Analyze the conversation context to understand the current state.
        
        Args:
            message: Current user message
            conversation_history: Previous conversation messages
            
        Returns:
            ConversationContext with analysis results
        """
        try:
            # Basic conversation metrics
            message_count = len(conversation_history) + 1
            conversation_length = sum(len(msg.content) for msg in conversation_history) + len(message)
            
            # Determine context type
            context_type = self._determine_context_type(message)
            
            # Analyze sentiment trend
            sentiment_trend = self._extract_sentiment_trend(conversation_history)
            current_sentiment = self._analyze_message_sentiment(message)
            sentiment_trend.append(current_sentiment)
            
            # Calculate engagement score
            engagement_score = self._calculate_engagement_score(message, conversation_history)
            
            # Detect confusion and satisfaction indicators
            confusion_indicators = self._detect_confusion_indicators(message)
            satisfaction_indicators = self._detect_satisfaction_indicators(message)
            
            # Count topic changes
            topic_changes = self._count_topic_changes(conversation_history)
            
            # Assess user intent clarity
            user_intent_clarity = self._assess_intent_clarity(message)
            
            # Identify knowledge gaps
            knowledge_gaps = self._identify_knowledge_gaps(message, conversation_history)
            
            # Determine if last response was helpful
            last_response_helpful = self._assess_last_response_helpfulness(conversation_history)
            
            return ConversationContext(
                message_count=message_count,
                conversation_length=conversation_length,
                context_type=context_type,
                sentiment_score=current_sentiment,
                sentiment_trend=sentiment_trend[-5:],  # Keep last 5 sentiment scores
                engagement_score=engagement_score,
                confusion_indicators=confusion_indicators,
                satisfaction_indicators=satisfaction_indicators,
                topic_changes=topic_changes,
                last_response_helpful=last_response_helpful,
                user_intent_clarity=user_intent_clarity,
                knowledge_gaps=knowledge_gaps
            )
            
        except Exception as e:
            logger.error(f"Error analyzing conversation context: {e}")
            # Return basic context on error
            return ConversationContext(
                message_count=len(conversation_history) + 1,
                conversation_length=len(message),
                context_type=ConversationContextType.UNKNOWN,
                sentiment_score=0.0,
                engagement_score=0.5,
                user_intent_clarity=0.5
            )
    
    async def determine_proactive_actions(
        self, 
        context: ConversationContext,
        rag_response: Optional[str] = None
    ) -> List[ProactiveAction]:
        """
        Determine what proactive actions should be taken based on conversation context.
        
        Args:
            context: Analyzed conversation context
            rag_response: Generated RAG response for analysis
            
        Returns:
            List of recommended proactive actions
        """
        try:
            actions = []
            
            # Check for confusion - offer clarification
            if context.confusion_indicators or context.user_intent_clarity < 0.5:
                actions.append(ProactiveAction(
                    action_type=ProactiveActionType.CLARIFY_QUESTION,
                    priority=0.9,
                    content="I want to make sure I understand your question correctly. Could you provide a bit more detail about what you're looking for?",
                    reasoning="User shows signs of confusion or unclear intent",
                    confidence=0.8,
                    metadata={"confusion_indicators": context.confusion_indicators}
                ))
            
            # Check for escalation needs
            if context.sentiment_score < -0.5 or any(keyword in " ".join(context.confusion_indicators).lower() for keyword in self.escalation_keywords):
                actions.append(ProactiveAction(
                    action_type=ProactiveActionType.ESCALATE,
                    priority=0.95,
                    content="I understand this might be frustrating. Would you like me to connect you with one of our human support specialists?",
                    reasoning="Negative sentiment or escalation keywords detected",
                    confidence=0.85,
                    metadata={"sentiment_score": context.sentiment_score}
                ))
            
            # Check for follow-up opportunities
            if context.context_type in [ConversationContextType.QUESTION, ConversationContextType.REQUEST]:
                if context.engagement_score > 0.6 and not context.confusion_indicators:
                    followup_questions = self._generate_followup_questions(context, rag_response)
                    if followup_questions:
                        actions.append(ProactiveAction(
                            action_type=ProactiveActionType.ASK_FOLLOWUP,
                            priority=0.7,
                            content=followup_questions[0],
                            reasoning="User is engaged and might benefit from follow-up questions",
                            confidence=0.7,
                            metadata={"all_questions": followup_questions}
                        ))
            
            # Check for topic suggestions
            if context.message_count > 2 and context.engagement_score > 0.5:
                suggested_topics = self._suggest_related_topics(context, rag_response)
                if suggested_topics:
                    actions.append(ProactiveAction(
                        action_type=ProactiveActionType.SUGGEST_TOPIC,
                        priority=0.6,
                        content=f"You might also be interested in learning about {suggested_topics[0]}.",
                        reasoning="User is engaged and might benefit from related topic suggestions",
                        confidence=0.6,
                        metadata={"suggested_topics": suggested_topics}
                    ))
            
            # Check for help offers
            if context.knowledge_gaps and context.engagement_score > 0.4:
                actions.append(ProactiveAction(
                    action_type=ProactiveActionType.OFFER_HELP,
                    priority=0.5,
                    content="I noticed you might need more information about this topic. Is there anything specific I can help clarify?",
                    reasoning="Knowledge gaps identified in conversation",
                    confidence=0.6,
                    metadata={"knowledge_gaps": context.knowledge_gaps}
                ))
            
            # Sort actions by priority
            actions.sort(key=lambda x: x.priority, reverse=True)
            
            return actions[:3]  # Return top 3 actions
            
        except Exception as e:
            logger.error(f"Error determining proactive actions: {e}")
            return []
    
    async def generate_intelligent_response(
        self, 
        context: ConversationContext, 
        rag_response: str,
        proactive_actions: List[ProactiveAction]
    ) -> str:
        """
        Generate an enhanced response by combining RAG response with intelligent improvements.
        
        Args:
            context: Analyzed conversation context
            rag_response: Original RAG response
            proactive_actions: Recommended proactive actions
            
        Returns:
            Enhanced response string
        """
        try:
            enhanced_response = rag_response
            
            # Add proactive elements based on actions
            for action in proactive_actions:
                if action.action_type == ProactiveActionType.CLARIFY_QUESTION and action.priority > 0.8:
                    enhanced_response += f"\n\n{action.content}"
                elif action.action_type == ProactiveActionType.ASK_FOLLOWUP and action.priority > 0.6:
                    enhanced_response += f"\n\n{action.content}"
                elif action.action_type == ProactiveActionType.ESCALATE and action.priority > 0.9:
                    enhanced_response = f"{action.content}\n\n{enhanced_response}"
            
            # Adjust tone based on sentiment
            if context.sentiment_score < -0.3:
                enhanced_response = self._adjust_tone_for_negative_sentiment(enhanced_response)
            elif context.sentiment_score > 0.5:
                enhanced_response = self._adjust_tone_for_positive_sentiment(enhanced_response)
            
            return enhanced_response
            
        except Exception as e:
            logger.error(f"Error generating intelligent response: {e}")
            return rag_response
    
    async def should_ask_followup(self, context: ConversationContext) -> bool:
        """
        Determine if follow-up questions should be asked.
        
        Args:
            context: Analyzed conversation context
            
        Returns:
            True if follow-up questions should be asked
        """
        try:
            # Ask follow-up if user is engaged and not confused
            if (context.engagement_score > 0.6 and 
                context.user_intent_clarity > 0.6 and 
                not context.confusion_indicators and
                context.sentiment_score > -0.2):
                return True
            
            # Ask follow-up if there are knowledge gaps to address
            if context.knowledge_gaps and context.engagement_score > 0.4:
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error determining follow-up need: {e}")
            return False
    
    async def generate_followup_questions(
        self, 
        context: ConversationContext,
        rag_response: Optional[str] = None
    ) -> List[str]:
        """
        Generate relevant follow-up questions based on context.
        
        Args:
            context: Analyzed conversation context
            rag_response: Generated RAG response for context
            
        Returns:
            List of follow-up questions
        """
        try:
            return self._generate_followup_questions(context, rag_response)
        except Exception as e:
            logger.error(f"Error generating follow-up questions: {e}")
            return []
    
    def _determine_context_type(self, message: str) -> ConversationContextType:
        """Determine the type of context for the current message."""
        message_lower = message.lower()
        
        # Check for greetings
        for pattern in self.greeting_patterns:
            if re.search(pattern, message_lower):
                return ConversationContextType.GREETING
        
        # Check for goodbyes
        for pattern in self.goodbye_patterns:
            if re.search(pattern, message_lower):
                return ConversationContextType.GOODBYE
        
        # Check for complaints
        if any(keyword in message_lower for keyword in self.escalation_keywords):
            return ConversationContextType.COMPLAINT
        
        # Check for compliments
        if any(keyword in message_lower for keyword in self.satisfaction_keywords):
            return ConversationContextType.COMPLIMENT
        
        # Check for questions
        if "?" in message or any(word in message_lower for word in ["what", "how", "why", "when", "where", "who"]):
            return ConversationContextType.QUESTION
        
        # Check for requests
        if any(word in message_lower for word in ["can you", "could you", "please", "i need", "i want"]):
            return ConversationContextType.REQUEST
        
        # Check for clarification
        if any(phrase in message_lower for phrase in ["what do you mean", "can you explain", "i don't understand"]):
            return ConversationContextType.CLARIFICATION
        
        return ConversationContextType.UNKNOWN
    
    def _analyze_message_sentiment(self, message: str) -> float:
        """Analyze sentiment of a message (simplified implementation)."""
        message_lower = message.lower()
        
        positive_words = ["good", "great", "excellent", "amazing", "wonderful", "perfect", "love", "like", "happy", "satisfied"]
        negative_words = ["bad", "terrible", "awful", "horrible", "hate", "dislike", "angry", "frustrated", "disappointed", "upset"]
        
        positive_count = sum(1 for word in positive_words if word in message_lower)
        negative_count = sum(1 for word in negative_words if word in message_lower)
        
        if positive_count > negative_count:
            return min(0.8, positive_count * 0.3)
        elif negative_count > positive_count:
            return max(-0.8, -negative_count * 0.3)
        else:
            return 0.0
    
    def _extract_sentiment_trend(self, conversation_history: List[Dict[str, Any]]) -> List[float]:
        """Extract sentiment trend from conversation history."""
        trend = []
        for msg in conversation_history[-5:]:  # Last 5 messages
            if msg.role == "user":
                sentiment = self._analyze_message_sentiment(msg.content)
                trend.append(sentiment)
        return trend
    
    def _calculate_engagement_score(self, message: str, conversation_history: List[Dict[str, Any]]) -> float:
        """Calculate user engagement score based on message characteristics."""
        score = 0.5  # Base score
        
        # Length indicates engagement
        if len(message) > 50:
            score += 0.2
        elif len(message) > 20:
            score += 0.1
        
        # Questions indicate engagement
        if "?" in message:
            score += 0.2
        
        # Specific details indicate engagement
        if any(word in message.lower() for word in ["specific", "detail", "example", "more about"]):
            score += 0.2
        
        # Conversation continuation indicates engagement
        if len(conversation_history) > 2:
            score += 0.1
        
        return min(1.0, score)
    
    def _detect_confusion_indicators(self, message: str) -> List[str]:
        """Detect indicators of user confusion."""
        indicators = []
        message_lower = message.lower()
        
        for keyword in self.confusion_keywords:
            if keyword in message_lower:
                indicators.append(keyword)
        
        return indicators
    
    def _detect_satisfaction_indicators(self, message: str) -> List[str]:
        """Detect indicators of user satisfaction."""
        indicators = []
        message_lower = message.lower()
        
        for keyword in self.satisfaction_keywords:
            if keyword in message_lower:
                indicators.append(keyword)
        
        return indicators
    
    def _count_topic_changes(self, conversation_history: List[Dict[str, Any]]) -> int:
        """Count the number of topic changes in conversation (simplified)."""
        # This is a simplified implementation
        # In a real system, you'd use more sophisticated topic modeling
        topics = set()
        for msg in conversation_history:
            if msg.role == "user":
                content = msg.content.lower()
                # Simple keyword-based topic detection
                if any(word in content for word in ["price", "cost", "pricing"]):
                    topics.add("pricing")
                if any(word in content for word in ["feature", "functionality", "capability"]):
                    topics.add("features")
                if any(word in content for word in ["support", "help", "assistance"]):
                    topics.add("support")
        
        return len(topics)
    
    def _assess_intent_clarity(self, message: str) -> float:
        """Assess how clear the user's intent is."""
        clarity = 0.5  # Base clarity
        
        # Clear questions increase clarity
        if "?" in message:
            clarity += 0.3
        
        # Specific keywords increase clarity
        specific_words = ["what", "how", "when", "where", "why", "can you", "i need", "i want"]
        if any(word in message.lower() for word in specific_words):
            clarity += 0.2
        
        # Vague language decreases clarity
        vague_words = ["something", "anything", "stuff", "things", "maybe", "i guess"]
        if any(word in message.lower() for word in vague_words):
            clarity -= 0.2
        
        return max(0.0, min(1.0, clarity))
    
    def _identify_knowledge_gaps(self, message: str, conversation_history: List[Dict[str, Any]]) -> List[str]:
        """Identify knowledge gaps in the conversation."""
        gaps = []
        message_lower = message.lower()
        
        # Check for explicit knowledge gap indicators
        if any(phrase in message_lower for phrase in ["don't know", "not sure", "unclear", "confused"]):
            gaps.append("general_understanding")
        
        # Check for specific topic gaps
        if any(word in message_lower for word in ["price", "cost", "pricing"]) and "how much" in message_lower:
            gaps.append("pricing_details")
        
        if any(word in message_lower for word in ["how", "setup", "install", "implement"]):
            gaps.append("implementation_process")
        
        return gaps
    
    def _assess_last_response_helpfulness(self, conversation_history: List[Dict[str, Any]]) -> Optional[bool]:
        """Assess if the last response was helpful based on user reaction."""
        if len(conversation_history) < 2:
            return None
        
        last_user_msg = None
        for msg in reversed(conversation_history):
            if msg.role == "user":
                last_user_msg = msg.content.lower()
                break
        
        if not last_user_msg:
            return None
        
        # Positive indicators
        if any(word in last_user_msg for word in self.satisfaction_keywords):
            return True
        
        # Negative indicators
        if any(word in last_user_msg for word in ["not helpful", "doesn't answer", "still confused"]):
            return False
        
        return None
    
    def _generate_followup_questions(self, context: ConversationContext, rag_response: Optional[str] = None) -> List[str]:
        """Generate contextual follow-up questions."""
        questions = []
        
        # Based on context type
        if context.context_type == ConversationContextType.QUESTION:
            questions.extend([
                "Is there anything specific about this topic you'd like me to elaborate on?",
                "Do you have any other questions related to this?",
                "Would you like to know more about how this works in practice?"
            ])
        
        # Based on knowledge gaps
        if "pricing_details" in context.knowledge_gaps:
            questions.extend([
                "Would you like to know more about our pricing options?",
                "Are you interested in learning about which plan might work best for your needs?"
            ])
        
        if "implementation_process" in context.knowledge_gaps:
            questions.extend([
                "Would you like to know more about our implementation process?",
                "Are you curious about how long setup typically takes?"
            ])
        
        # Based on engagement level
        if context.engagement_score > 0.7:
            questions.extend([
                "What other aspects of our service are you most interested in?",
                "Is there anything else I can help you explore?"
            ])
        
        return questions[:3]  # Return top 3 questions
    
    def _suggest_related_topics(self, context: ConversationContext, rag_response: Optional[str] = None) -> List[str]:
        """Suggest related topics based on conversation context."""
        topics = []
        
        # Based on context type and content
        if context.context_type == ConversationContextType.QUESTION:
            topics.extend(["implementation_support", "best_practices", "advanced_features"])
        
        # Based on knowledge gaps
        if context.knowledge_gaps:
            if "pricing_details" in context.knowledge_gaps:
                topics.extend(["pricing_comparison", "value_proposition"])
            if "implementation_process" in context.knowledge_gaps:
                topics.extend(["setup_guide", "training_resources"])
        
        return topics[:3]  # Return top 3 topics
    
    def _adjust_tone_for_negative_sentiment(self, response: str) -> str:
        """Adjust response tone for negative sentiment."""
        # Add empathetic language
        if not any(phrase in response.lower() for phrase in ["understand", "sorry", "apologize"]):
            response = f"I understand this can be frustrating. {response}"
        
        return response
    
    def _adjust_tone_for_positive_sentiment(self, response: str) -> str:
        """Adjust response tone for positive sentiment."""
        # Add enthusiastic language
        if not any(phrase in response.lower() for phrase in ["great", "excellent", "wonderful"]):
            response = f"Great question! {response}"
        
        return response


# Global decision manager instance
decision_manager: Optional[DecisionManager] = None


def get_decision_manager() -> DecisionManager:
    """Get the global decision manager instance."""
    global decision_manager
    if decision_manager is None:
        decision_manager = DecisionManager()
    return decision_manager