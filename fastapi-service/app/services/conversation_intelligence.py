"""
Conversation Intelligence service for tracking conversation flow and analyzing patterns.
"""
import logging
import uuid
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from supabase import create_client, Client

from app.models.decision import ConversationIntelligence, ConversationContext
from app.config import settings

logger = logging.getLogger(__name__)


class ConversationIntelligenceService:
    """
    Service for tracking conversation flow, analyzing patterns, and generating intelligence insights.
    """
    
    def __init__(self):
        """Initialize the conversation intelligence service."""
        self.supabase_client: Optional[Client] = None
        self._initialize_client()
        
        # Conversation flow patterns
        self.positive_flow_indicators = [
            "engagement_increase", "question_answered", "satisfaction_expressed",
            "follow_up_questions", "specific_requests"
        ]
        
        self.negative_flow_indicators = [
            "repeated_questions", "confusion_expressed", "frustration_detected",
            "topic_abandonment", "short_responses"
        ]
        
        logger.info("Conversation Intelligence service initialized")
    
    def _initialize_client(self):
        """Initialize Supabase client for conversation intelligence operations."""
        try:
            if settings.SUPABASE_URL and settings.SUPABASE_KEY:
                self.supabase_client = create_client(
                    settings.SUPABASE_URL,
                    settings.SUPABASE_KEY
                )
                logger.info("Conversation Intelligence Supabase client initialized successfully")
            else:
                logger.warning("Supabase credentials not provided for conversation intelligence service")
        except Exception as e:
            logger.error(f"Failed to initialize conversation intelligence service: {e}")
    
    async def analyze_conversation_intelligence(
        self,
        conversation_id: str,
        user_id: str,
        chatbot_id: Optional[str],
        context: ConversationContext,
        conversation_history: List[Dict[str, Any]],
        current_message: str
    ) -> ConversationIntelligence:
        """
        Analyze conversation intelligence and generate insights.
        
        Args:
            conversation_id: Conversation ID
            user_id: User ID
            chatbot_id: Optional chatbot ID
            context: Analyzed conversation context
            conversation_history: Previous conversation messages
            current_message: Current user message
            
        Returns:
            ConversationIntelligence analysis
        """
        try:
            # Calculate intelligence scores
            context_understanding = self._calculate_context_understanding(context, conversation_history)
            proactive_score = self._calculate_proactive_score(context, conversation_history)
            helpfulness_score = self._calculate_helpfulness_score(context, conversation_history)
            conversation_flow_score = self._calculate_conversation_flow_score(conversation_history)
            user_satisfaction_prediction = self._predict_user_satisfaction(context, conversation_history)
            escalation_risk = self._calculate_escalation_risk(context, conversation_history)
            lead_potential = self._calculate_lead_potential(context, conversation_history, current_message)
            
            # Extract conversation insights
            topics_covered = self._extract_topics_covered(conversation_history, current_message)
            user_goals_identified = self._identify_user_goals(conversation_history, current_message)
            knowledge_gaps_found = context.knowledge_gaps
            
            intelligence = ConversationIntelligence(
                conversation_id=conversation_id,
                user_id=user_id,
                chatbot_id=chatbot_id,
                context_understanding=context_understanding,
                proactive_score=proactive_score,
                helpfulness_score=helpfulness_score,
                conversation_flow_score=conversation_flow_score,
                user_satisfaction_prediction=user_satisfaction_prediction,
                escalation_risk=escalation_risk,
                lead_potential=lead_potential,
                topics_covered=topics_covered,
                user_goals_identified=user_goals_identified,
                knowledge_gaps_found=knowledge_gaps_found,
                created_at=datetime.utcnow()
            )
            
            # Store intelligence data
            await self._store_intelligence_data(intelligence)
            
            return intelligence
            
        except Exception as e:
            logger.error(f"Error analyzing conversation intelligence: {e}")
            # Return basic intelligence on error
            return ConversationIntelligence(
                conversation_id=conversation_id,
                user_id=user_id,
                chatbot_id=chatbot_id,
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
            )
    
    async def track_conversation_flow(
        self,
        conversation_id: str,
        message_role: str,
        message_content: str,
        sentiment_score: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Track conversation flow patterns and identify trends.
        
        Args:
            conversation_id: Conversation ID
            message_role: Role of the message sender (user/assistant)
            message_content: Content of the message
            sentiment_score: Optional sentiment score
            metadata: Optional message metadata
            
        Returns:
            Flow analysis results
        """
        try:
            # Analyze message characteristics
            message_analysis = {
                "length": len(message_content),
                "question_count": message_content.count("?"),
                "exclamation_count": message_content.count("!"),
                "sentiment_score": sentiment_score,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # Detect flow patterns
            flow_patterns = self._detect_flow_patterns(message_content, message_role)
            
            # Store flow data
            flow_data = {
                "conversation_id": conversation_id,
                "message_role": message_role,
                "message_analysis": message_analysis,
                "flow_patterns": flow_patterns,
                "metadata": metadata or {}
            }
            
            await self._store_flow_data(flow_data)
            
            return flow_data
            
        except Exception as e:
            logger.error(f"Error tracking conversation flow: {e}")
            return {}
    
    async def get_conversation_insights(
        self,
        conversation_id: str,
        time_window_hours: int = 24
    ) -> Dict[str, Any]:
        """
        Get conversation insights for a specific conversation.
        
        Args:
            conversation_id: Conversation ID
            time_window_hours: Time window for analysis in hours
            
        Returns:
            Conversation insights
        """
        try:
            if not self.supabase_client:
                logger.warning("Supabase client not initialized")
                return {}
            
            # Get intelligence data
            cutoff_time = datetime.utcnow() - timedelta(hours=time_window_hours)
            
            response = self.supabase_client.table("ConversationIntelligence").select(
                "*"
            ).eq("conversationId", conversation_id).gte(
                "createdAt", cutoff_time.isoformat()
            ).order("createdAt", desc=True).limit(10).execute()
            
            if not response.data:
                return {"message": "No intelligence data found for this conversation"}
            
            # Analyze trends
            intelligence_records = response.data
            trends = self._analyze_intelligence_trends(intelligence_records)
            
            # Get latest intelligence
            latest_intelligence = intelligence_records[0]
            
            return {
                "conversation_id": conversation_id,
                "latest_intelligence": latest_intelligence,
                "trends": trends,
                "analysis_count": len(intelligence_records),
                "time_window_hours": time_window_hours
            }
            
        except Exception as e:
            logger.error(f"Error getting conversation insights: {e}")
            return {"error": str(e)}
    
    async def get_user_conversation_patterns(
        self,
        user_id: str,
        days_back: int = 7
    ) -> Dict[str, Any]:
        """
        Get conversation patterns for a specific user.
        
        Args:
            user_id: User ID
            days_back: Number of days to look back
            
        Returns:
            User conversation patterns
        """
        try:
            if not self.supabase_client:
                logger.warning("Supabase client not initialized")
                return {}
            
            cutoff_time = datetime.utcnow() - timedelta(days=days_back)
            
            response = self.supabase_client.table("ConversationIntelligence").select(
                "*"
            ).eq("userId", user_id).gte(
                "createdAt", cutoff_time.isoformat()
            ).order("createdAt", desc=False).execute()
            
            if not response.data:
                return {"message": "No conversation data found for this user"}
            
            # Analyze user patterns
            patterns = self._analyze_user_patterns(response.data)
            
            return {
                "user_id": user_id,
                "patterns": patterns,
                "conversation_count": len(set(record["conversationId"] for record in response.data)),
                "analysis_period_days": days_back
            }
            
        except Exception as e:
            logger.error(f"Error getting user conversation patterns: {e}")
            return {"error": str(e)}
    
    def _calculate_context_understanding(
        self,
        context: ConversationContext,
        conversation_history: List[Dict[str, Any]]
    ) -> float:
        """Calculate how well the system understands the conversation context."""
        score = 0.5  # Base score
        
        # High intent clarity increases understanding
        score += context.user_intent_clarity * 0.3
        
        # Low confusion indicators increase understanding
        if not context.confusion_indicators:
            score += 0.2
        else:
            score -= len(context.confusion_indicators) * 0.1
        
        # Conversation continuity increases understanding
        if context.message_count > 1:
            score += min(0.2, context.message_count * 0.05)
        
        # Positive sentiment trend indicates good understanding
        if context.sentiment_trend:
            avg_sentiment = sum(context.sentiment_trend) / len(context.sentiment_trend)
            if avg_sentiment > 0:
                score += avg_sentiment * 0.2
        
        return max(0.0, min(1.0, score))
    
    def _calculate_proactive_score(
        self,
        context: ConversationContext,
        conversation_history: List[Dict[str, Any]]
    ) -> float:
        """Calculate opportunities for proactive assistance."""
        score = 0.3  # Base score
        
        # High engagement indicates proactive opportunities
        score += context.engagement_score * 0.4
        
        # Knowledge gaps present opportunities
        if context.knowledge_gaps:
            score += min(0.3, len(context.knowledge_gaps) * 0.1)
        
        # Question context indicates proactive opportunities
        if context.context_type.value in ["question", "request"]:
            score += 0.2
        
        # Multiple messages indicate ongoing conversation
        if context.message_count > 2:
            score += 0.1
        
        return max(0.0, min(1.0, score))
    
    def _calculate_helpfulness_score(
        self,
        context: ConversationContext,
        conversation_history: List[Dict[str, Any]]
    ) -> float:
        """Calculate predicted helpfulness of responses."""
        score = 0.6  # Base score
        
        # Clear intent leads to more helpful responses
        score += context.user_intent_clarity * 0.2
        
        # Satisfaction indicators suggest helpful responses
        if context.satisfaction_indicators:
            score += min(0.2, len(context.satisfaction_indicators) * 0.1)
        
        # Confusion indicators suggest less helpful responses
        if context.confusion_indicators:
            score -= min(0.3, len(context.confusion_indicators) * 0.1)
        
        # Last response helpfulness affects current score
        if context.last_response_helpful is True:
            score += 0.2
        elif context.last_response_helpful is False:
            score -= 0.2
        
        return max(0.0, min(1.0, score))
    
    def _calculate_conversation_flow_score(
        self,
        conversation_history: List[Dict[str, Any]]
    ) -> float:
        """Calculate the quality of conversation flow."""
        if not conversation_history:
            return 0.5
        
        score = 0.5  # Base score
        
        # Consistent message lengths indicate good flow
        user_messages = [msg for msg in conversation_history if msg.role == "user"]
        if len(user_messages) > 1:
            lengths = [len(msg.content) for msg in user_messages]
            avg_length = sum(lengths) / len(lengths)
            if avg_length > 20:  # Substantial messages
                score += 0.2
        
        # Question-answer patterns indicate good flow
        qa_pairs = 0
        for i in range(len(conversation_history) - 1):
            if (conversation_history[i].role == "user" and 
                "?" in conversation_history[i].content and
                conversation_history[i + 1].role == "assistant"):
                qa_pairs += 1
        
        if qa_pairs > 0:
            score += min(0.3, qa_pairs * 0.1)
        
        return max(0.0, min(1.0, score))
    
    def _predict_user_satisfaction(
        self,
        context: ConversationContext,
        conversation_history: List[Dict[str, Any]]
    ) -> float:
        """Predict user satisfaction based on conversation patterns."""
        score = 0.5  # Base score
        
        # Positive sentiment indicates satisfaction
        if context.sentiment_score > 0:
            score += context.sentiment_score * 0.3
        
        # Satisfaction indicators
        if context.satisfaction_indicators:
            score += min(0.3, len(context.satisfaction_indicators) * 0.15)
        
        # Engagement indicates satisfaction
        score += context.engagement_score * 0.2
        
        # Confusion decreases satisfaction
        if context.confusion_indicators:
            score -= min(0.4, len(context.confusion_indicators) * 0.1)
        
        # Last response helpfulness affects satisfaction
        if context.last_response_helpful is True:
            score += 0.2
        elif context.last_response_helpful is False:
            score -= 0.3
        
        return max(0.0, min(1.0, score))
    
    def _calculate_escalation_risk(
        self,
        context: ConversationContext,
        conversation_history: List[Dict[str, Any]]
    ) -> float:
        """Calculate the risk of needing escalation."""
        risk = 0.1  # Base risk
        
        # Negative sentiment increases risk
        if context.sentiment_score < -0.3:
            risk += abs(context.sentiment_score) * 0.4
        
        # Confusion indicators increase risk
        if context.confusion_indicators:
            risk += min(0.3, len(context.confusion_indicators) * 0.1)
        
        # Multiple topic changes might indicate frustration
        if context.topic_changes > 2:
            risk += 0.2
        
        # Declining sentiment trend increases risk
        if len(context.sentiment_trend) > 2:
            recent_trend = context.sentiment_trend[-3:]
            if all(recent_trend[i] <= recent_trend[i-1] for i in range(1, len(recent_trend))):
                risk += 0.2
        
        return max(0.0, min(1.0, risk))
    
    def _calculate_lead_potential(
        self,
        context: ConversationContext,
        conversation_history: List[Dict[str, Any]],
        current_message: str
    ) -> float:
        """Calculate potential for lead conversion."""
        potential = 0.2  # Base potential
        
        # Engagement indicates lead potential
        potential += context.engagement_score * 0.3
        
        # Specific business-related keywords
        business_keywords = ["price", "cost", "buy", "purchase", "plan", "subscription", "demo", "trial"]
        message_lower = current_message.lower()
        keyword_matches = sum(1 for keyword in business_keywords if keyword in message_lower)
        potential += min(0.4, keyword_matches * 0.1)
        
        # Multiple messages indicate serious interest
        if context.message_count > 3:
            potential += 0.2
        
        # Positive sentiment indicates interest
        if context.sentiment_score > 0.3:
            potential += 0.2
        
        return max(0.0, min(1.0, potential))
    
    def _extract_topics_covered(
        self,
        conversation_history: List[Dict[str, Any]],
        current_message: str
    ) -> List[str]:
        """Extract topics covered in the conversation."""
        topics = set()
        
        # Combine all messages
        all_content = current_message + " "
        for msg in conversation_history:
            if msg.role == "user":
                all_content += msg.content + " "
        
        content_lower = all_content.lower()
        
        # Topic detection based on keywords
        topic_keywords = {
            "pricing": ["price", "cost", "pricing", "plan", "subscription", "fee"],
            "features": ["feature", "functionality", "capability", "what does", "how does"],
            "support": ["support", "help", "assistance", "customer service"],
            "integration": ["integrate", "api", "connect", "setup", "install"],
            "security": ["security", "secure", "privacy", "data protection"],
            "performance": ["performance", "speed", "fast", "slow", "optimization"],
            "demo": ["demo", "demonstration", "show me", "trial", "test"]
        }
        
        for topic, keywords in topic_keywords.items():
            if any(keyword in content_lower for keyword in keywords):
                topics.add(topic)
        
        return list(topics)
    
    def _identify_user_goals(
        self,
        conversation_history: List[Dict[str, Any]],
        current_message: str
    ) -> List[str]:
        """Identify user goals from conversation."""
        goals = set()
        
        # Combine all user messages
        user_content = current_message + " "
        for msg in conversation_history:
            if msg.role == "user":
                user_content += msg.content + " "
        
        content_lower = user_content.lower()
        
        # Goal detection based on patterns
        goal_patterns = {
            "evaluate_product": ["evaluate", "compare", "consider", "looking at", "researching"],
            "solve_problem": ["problem", "issue", "trouble", "fix", "solve"],
            "learn_more": ["learn", "understand", "know more", "information", "details"],
            "make_purchase": ["buy", "purchase", "get started", "sign up", "subscribe"],
            "get_support": ["help", "support", "assistance", "stuck", "need help"],
            "integrate_system": ["integrate", "connect", "setup", "implement", "install"]
        }
        
        for goal, patterns in goal_patterns.items():
            if any(pattern in content_lower for pattern in patterns):
                goals.add(goal)
        
        return list(goals)
    
    def _detect_flow_patterns(self, message_content: str, message_role: str) -> List[str]:
        """Detect conversation flow patterns."""
        patterns = []
        content_lower = message_content.lower()
        
        if message_role == "user":
            # User patterns
            if "?" in message_content:
                patterns.append("question_asked")
            
            if any(word in content_lower for word in ["thank", "thanks", "great", "perfect"]):
                patterns.append("satisfaction_expressed")
            
            if any(word in content_lower for word in ["confused", "don't understand", "unclear"]):
                patterns.append("confusion_expressed")
            
            if len(message_content) > 100:
                patterns.append("detailed_message")
            elif len(message_content) < 20:
                patterns.append("short_response")
        
        else:  # assistant
            # Assistant patterns
            if "?" in message_content:
                patterns.append("followup_question")
            
            if any(phrase in content_lower for phrase in ["let me help", "i can assist", "here's how"]):
                patterns.append("proactive_assistance")
        
        return patterns
    
    async def _store_intelligence_data(self, intelligence: ConversationIntelligence):
        """Store conversation intelligence data."""
        try:
            if not self.supabase_client:
                logger.warning("Supabase client not initialized, skipping intelligence storage")
                return
            
            # Skip storage for temporary conversation IDs
            if intelligence.conversation_id.startswith("temp_"):
                logger.debug(f"Skipping intelligence storage for temporary conversation ID: {intelligence.conversation_id}")
                return
            
            # Check if conversation exists first
            conversation_check = self.supabase_client.table("Conversation").select("id").eq("id", intelligence.conversation_id).execute()
            
            if not conversation_check.data:
                logger.warning(f"Conversation {intelligence.conversation_id} does not exist, skipping intelligence storage")
                return
            
            # Check if intelligence record already exists for this conversation
            existing_record = self.supabase_client.table("ConversationIntelligence").select("id").eq("conversationId", intelligence.conversation_id).execute()
            
            intelligence_data = {
                "conversationId": intelligence.conversation_id,
                "userId": intelligence.user_id,
                "chatbotId": intelligence.chatbot_id,
                "intelligenceData": {
                    "contextUnderstanding": intelligence.context_understanding,
                    "proactiveScore": intelligence.proactive_score,
                    "helpfulnessScore": intelligence.helpfulness_score,
                    "conversationFlowScore": intelligence.conversation_flow_score,
                    "userSatisfactionPrediction": intelligence.user_satisfaction_prediction,
                    "escalationRisk": intelligence.escalation_risk,
                    "leadPotential": intelligence.lead_potential,
                    "topicsCovered": intelligence.topics_covered,
                    "userGoalsIdentified": intelligence.user_goals_identified,
                    "knowledgeGapsFound": intelligence.knowledge_gaps_found
                },
                "contextUnderstanding": intelligence.context_understanding,
                "proactiveScore": intelligence.proactive_score,
                "helpfulnessScore": intelligence.helpfulness_score,
                "updatedAt": datetime.utcnow().isoformat()
            }
            
            if existing_record.data:
                # Update existing record
                response = self.supabase_client.table("ConversationIntelligence").update(
                    intelligence_data
                ).eq("conversationId", intelligence.conversation_id).execute()
                logger.debug(f"Updated intelligence data for conversation {intelligence.conversation_id}")
            else:
                # Insert new record
                intelligence_data["id"] = str(uuid.uuid4())
                intelligence_data["createdAt"] = intelligence.created_at.isoformat()
                response = self.supabase_client.table("ConversationIntelligence").insert(
                    intelligence_data
                ).execute()
                logger.debug(f"Inserted new intelligence data for conversation {intelligence.conversation_id}")
            
            if not response.data:
                logger.warning(f"Failed to store/update intelligence data: {response}")
                
        except Exception as e:
            logger.error(f"Error storing intelligence data: {e}")
    
    async def _store_flow_data(self, flow_data: Dict[str, Any]):
        """Store conversation flow data."""
        try:
            # For now, we'll log the flow data
            # In a production system, you might store this in a separate table
            logger.debug(f"Conversation flow data: {flow_data}")
            
        except Exception as e:
            logger.error(f"Error storing flow data: {e}")
    
    def _analyze_intelligence_trends(self, intelligence_records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze trends in intelligence data."""
        if not intelligence_records:
            return {}
        
        # Calculate averages
        metrics = ["contextUnderstanding", "proactiveScore", "helpfulnessScore"]
        trends = {}
        
        for metric in metrics:
            values = [record.get(metric, 0) for record in intelligence_records]
            trends[metric] = {
                "average": sum(values) / len(values),
                "trend": "improving" if len(values) > 1 and values[-1] > values[0] else "stable"
            }
        
        return trends
    
    def _analyze_user_patterns(self, intelligence_records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze user conversation patterns."""
        if not intelligence_records:
            return {}
        
        # Extract patterns
        patterns = {
            "average_satisfaction": sum(record.get("intelligenceData", {}).get("userSatisfactionPrediction", 0.5) 
                                    for record in intelligence_records) / len(intelligence_records),
            "escalation_frequency": sum(1 for record in intelligence_records 
                                      if record.get("intelligenceData", {}).get("escalationRisk", 0) > 0.7),
            "common_topics": [],
            "engagement_trend": "stable"
        }
        
        # Extract common topics
        all_topics = []
        for record in intelligence_records:
            topics = record.get("intelligenceData", {}).get("topicsCovered", [])
            all_topics.extend(topics)
        
        # Count topic frequency
        topic_counts = {}
        for topic in all_topics:
            topic_counts[topic] = topic_counts.get(topic, 0) + 1
        
        # Get most common topics
        patterns["common_topics"] = sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        
        return patterns
    
    def is_ready(self) -> bool:
        """Check if the conversation intelligence service is ready."""
        return self.supabase_client is not None
    
    def get_service_info(self) -> Dict[str, Any]:
        """Get information about the conversation intelligence service configuration."""
        return {
            "supabase_client_ready": self.supabase_client is not None,
            "has_supabase_url": bool(settings.SUPABASE_URL),
            "has_supabase_key": bool(settings.SUPABASE_KEY),
            "service_ready": self.is_ready()
        }


# Global conversation intelligence service instance
conversation_intelligence_service: Optional[ConversationIntelligenceService] = None


def get_conversation_intelligence_service() -> ConversationIntelligenceService:
    """Get the global conversation intelligence service instance."""
    global conversation_intelligence_service
    if conversation_intelligence_service is None:
        conversation_intelligence_service = ConversationIntelligenceService()
    return conversation_intelligence_service