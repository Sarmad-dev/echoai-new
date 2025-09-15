"""
Proactive Assistant service for generating follow-up questions and suggestions.
"""
import logging
from typing import List, Optional, Dict, Any, Tuple
import random

from app.models.decision import (
    ConversationContext,
    ConversationContextType,
    ProactiveAction,
    ProactiveActionType,
    ConversationIntelligence
)

logger = logging.getLogger(__name__)


class ProactiveAssistant:
    """
    Service for generating proactive follow-up questions, suggestions, and assistance.
    """
    
    def __init__(self):
        """Initialize the proactive assistant."""
        # Question templates by context type
        self.question_templates = {
            ConversationContextType.QUESTION: [
                "Is there anything specific about {topic} you'd like me to elaborate on?",
                "Would you like to know more about how {topic} works in practice?",
                "Do you have any other questions related to {topic}?",
                "Are there any particular aspects of {topic} that interest you most?"
            ],
            ConversationContextType.REQUEST: [
                "Is there anything else I can help you with regarding {topic}?",
                "Would you like me to provide more details about {topic}?",
                "Are there any specific requirements you have for {topic}?",
                "Would you like to explore other options for {topic}?"
            ],
            ConversationContextType.GREETING: [
                "What can I help you with today?",
                "What would you like to know about our services?",
                "Is there something specific you're looking for?",
                "How can I assist you today?"
            ],
            ConversationContextType.COMPLIMENT: [
                "Is there anything else I can help you with?",
                "What other questions do you have?",
                "Would you like to explore more features?",
                "Is there anything specific you'd like to learn about?"
            ]
        }
        
        # Topic-specific follow-up questions
        self.topic_followups = {
            "pricing": [
                "Would you like to know about our different pricing tiers?",
                "Are you interested in learning about volume discounts?",
                "Would you like to see a pricing comparison?",
                "Do you have a specific budget range in mind?"
            ],
            "features": [
                "Would you like to see a demo of these features?",
                "Are there specific features that are most important to you?",
                "Would you like to know about our advanced capabilities?",
                "How do you plan to use these features?"
            ],
            "support": [
                "Would you like to know about our support options?",
                "Are you interested in our training resources?",
                "Would you like to learn about our implementation process?",
                "Do you have questions about getting started?"
            ],
            "integration": [
                "What systems are you looking to integrate with?",
                "Would you like to know about our API capabilities?",
                "Are you interested in our pre-built integrations?",
                "Do you need help with the technical setup?"
            ],
            "demo": [
                "Would you like to schedule a personalized demo?",
                "Are there specific features you'd like to see in action?",
                "Would you prefer a live demo or a recorded walkthrough?",
                "What's the best time for a demo call?"
            ]
        }
        
        # Suggestion templates
        self.suggestion_templates = {
            "related_topics": [
                "You might also be interested in learning about {topic}.",
                "Many customers also ask about {topic}.",
                "Another popular topic is {topic}.",
                "You might find {topic} relevant to your needs."
            ],
            "next_steps": [
                "The next step would be to {action}.",
                "I'd recommend {action} as your next step.",
                "You might want to consider {action}.",
                "A good next step would be to {action}."
            ],
            "resources": [
                "We have great resources about {topic} that might help.",
                "You might find our {topic} guide useful.",
                "We have detailed documentation on {topic}.",
                "Our {topic} resources could be helpful for you."
            ]
        }
        
        logger.info("Proactive Assistant initialized")
    
    async def generate_followup_questions(
        self,
        context: ConversationContext,
        conversation_history: List[Dict[str, Any]],
        current_message: str,
        rag_response: Optional[str] = None,
        max_questions: int = 3
    ) -> List[str]:
        """
        Generate contextual follow-up questions.
        
        Args:
            context: Analyzed conversation context
            conversation_history: Previous conversation messages
            current_message: Current user message
            rag_response: Generated RAG response for context
            max_questions: Maximum number of questions to generate
            
        Returns:
            List of follow-up questions
        """
        try:
            questions = []
            
            # Generate questions based on context type
            context_questions = self._generate_context_based_questions(context, current_message)
            questions.extend(context_questions)
            
            # Generate topic-specific questions
            topics = self._extract_message_topics(current_message, rag_response)
            for topic in topics:
                topic_questions = self._generate_topic_questions(topic, context)
                questions.extend(topic_questions)
            
            # Generate questions based on knowledge gaps
            gap_questions = self._generate_knowledge_gap_questions(context.knowledge_gaps)
            questions.extend(gap_questions)
            
            # Generate questions based on conversation flow
            flow_questions = self._generate_flow_based_questions(context, conversation_history)
            questions.extend(flow_questions)
            
            # Remove duplicates and prioritize
            unique_questions = list(dict.fromkeys(questions))  # Preserve order while removing duplicates
            prioritized_questions = self._prioritize_questions(unique_questions, context)
            
            return prioritized_questions[:max_questions]
            
        except Exception as e:
            logger.error(f"Error generating follow-up questions: {e}")
            return ["Is there anything else I can help you with?"]
    
    async def generate_topic_suggestions(
        self,
        context: ConversationContext,
        conversation_history: List[Dict[str, Any]],
        current_message: str,
        rag_response: Optional[str] = None,
        max_suggestions: int = 3
    ) -> List[str]:
        """
        Generate related topic suggestions.
        
        Args:
            context: Analyzed conversation context
            conversation_history: Previous conversation messages
            current_message: Current user message
            rag_response: Generated RAG response for context
            max_suggestions: Maximum number of suggestions to generate
            
        Returns:
            List of topic suggestions
        """
        try:
            suggestions = []
            
            # Extract current topics
            current_topics = self._extract_message_topics(current_message, rag_response)
            
            # Generate related topic suggestions
            for topic in current_topics:
                related_topics = self._get_related_topics(topic)
                suggestions.extend(related_topics)
            
            # Generate suggestions based on conversation context
            context_suggestions = self._generate_context_suggestions(context, conversation_history)
            suggestions.extend(context_suggestions)
            
            # Generate suggestions based on user goals
            if hasattr(context, 'user_goals_identified'):
                goal_suggestions = self._generate_goal_based_suggestions(context.user_goals_identified)
                suggestions.extend(goal_suggestions)
            
            # Remove duplicates and prioritize
            unique_suggestions = list(dict.fromkeys(suggestions))
            prioritized_suggestions = self._prioritize_suggestions(unique_suggestions, context)
            
            return prioritized_suggestions[:max_suggestions]
            
        except Exception as e:
            logger.error(f"Error generating topic suggestions: {e}")
            return []
    
    async def generate_proactive_assistance(
        self,
        context: ConversationContext,
        intelligence: ConversationIntelligence,
        conversation_history: List[Dict[str, Any]],
        current_message: str
    ) -> List[ProactiveAction]:
        """
        Generate proactive assistance actions based on conversation analysis.
        
        Args:
            context: Analyzed conversation context
            intelligence: Conversation intelligence analysis
            conversation_history: Previous conversation messages
            current_message: Current user message
            
        Returns:
            List of proactive actions
        """
        try:
            actions = []
            
            # Generate actions based on escalation risk
            if intelligence.escalation_risk > 0.7:
                actions.append(ProactiveAction(
                    action_type=ProactiveActionType.ESCALATE,
                    priority=0.95,
                    content="I want to make sure you get the best help possible. Would you like me to connect you with one of our specialists?",
                    reasoning=f"High escalation risk detected: {intelligence.escalation_risk:.2f}",
                    confidence=0.9,
                    metadata={"escalation_risk": intelligence.escalation_risk}
                ))
            
            # Generate actions based on lead potential
            if intelligence.lead_potential > 0.6:
                actions.append(ProactiveAction(
                    action_type=ProactiveActionType.ASK_FOLLOWUP,
                    priority=0.8,
                    content="It sounds like our solution could be a great fit for your needs. Would you like to schedule a demo to see it in action?",
                    reasoning=f"High lead potential detected: {intelligence.lead_potential:.2f}",
                    confidence=0.8,
                    metadata={"lead_potential": intelligence.lead_potential}
                ))
            
            # Generate actions based on confusion indicators
            if context.confusion_indicators:
                actions.append(ProactiveAction(
                    action_type=ProactiveActionType.CLARIFY_QUESTION,
                    priority=0.85,
                    content="I want to make sure I'm giving you the most helpful information. Could you help me understand what specific aspect you'd like me to clarify?",
                    reasoning=f"Confusion indicators detected: {context.confusion_indicators}",
                    confidence=0.8,
                    metadata={"confusion_indicators": context.confusion_indicators}
                ))
            
            # Generate actions based on knowledge gaps
            if context.knowledge_gaps:
                gap_actions = self._generate_knowledge_gap_actions(context.knowledge_gaps)
                actions.extend(gap_actions)
            
            # Generate actions based on engagement level
            if context.engagement_score > 0.7:
                engagement_actions = self._generate_engagement_actions(context, intelligence)
                actions.extend(engagement_actions)
            
            # Generate actions based on satisfaction prediction
            if intelligence.user_satisfaction_prediction < 0.4:
                actions.append(ProactiveAction(
                    action_type=ProactiveActionType.OFFER_HELP,
                    priority=0.7,
                    content="I want to make sure I'm being as helpful as possible. Is there a different way I can assist you with this?",
                    reasoning=f"Low satisfaction prediction: {intelligence.user_satisfaction_prediction:.2f}",
                    confidence=0.7,
                    metadata={"satisfaction_prediction": intelligence.user_satisfaction_prediction}
                ))
            
            # Sort actions by priority
            actions.sort(key=lambda x: x.priority, reverse=True)
            
            return actions[:5]  # Return top 5 actions
            
        except Exception as e:
            logger.error(f"Error generating proactive assistance: {e}")
            return []
    
    async def should_offer_proactive_help(
        self,
        context: ConversationContext,
        intelligence: ConversationIntelligence
    ) -> Tuple[bool, str]:
        """
        Determine if proactive help should be offered and why.
        
        Args:
            context: Analyzed conversation context
            intelligence: Conversation intelligence analysis
            
        Returns:
            Tuple of (should_offer, reasoning)
        """
        try:
            # High escalation risk
            if intelligence.escalation_risk > 0.7:
                return True, "High escalation risk detected"
            
            # Confusion indicators
            if context.confusion_indicators:
                return True, "User confusion detected"
            
            # Low satisfaction prediction
            if intelligence.user_satisfaction_prediction < 0.4:
                return True, "Low satisfaction predicted"
            
            # Knowledge gaps with low helpfulness
            if context.knowledge_gaps and intelligence.helpfulness_score < 0.5:
                return True, "Knowledge gaps with low helpfulness"
            
            # High engagement with proactive opportunities
            if context.engagement_score > 0.7 and intelligence.proactive_score > 0.6:
                return True, "High engagement with proactive opportunities"
            
            return False, "No proactive help needed"
            
        except Exception as e:
            logger.error(f"Error determining proactive help need: {e}")
            return False, "Error in analysis"
    
    def _generate_context_based_questions(
        self,
        context: ConversationContext,
        current_message: str
    ) -> List[str]:
        """Generate questions based on conversation context type."""
        questions = []
        
        templates = self.question_templates.get(context.context_type, [])
        if templates:
            # Extract topic from message for template filling
            topic = self._extract_primary_topic(current_message)
            
            for template in templates[:2]:  # Use first 2 templates
                if "{topic}" in template and topic:
                    questions.append(template.format(topic=topic))
                elif "{topic}" not in template:
                    questions.append(template)
        
        return questions
    
    def _generate_topic_questions(self, topic: str, context: ConversationContext) -> List[str]:
        """Generate questions specific to a topic."""
        questions = []
        
        topic_questions = self.topic_followups.get(topic, [])
        if topic_questions:
            # Select questions based on context
            if context.engagement_score > 0.7:
                questions.extend(topic_questions[:2])  # More questions for engaged users
            else:
                questions.append(random.choice(topic_questions))  # One question for less engaged users
        
        return questions
    
    def _generate_knowledge_gap_questions(self, knowledge_gaps: List[str]) -> List[str]:
        """Generate questions to address knowledge gaps."""
        questions = []
        
        gap_question_map = {
            "pricing_details": "Would you like to know more about our pricing options?",
            "implementation_process": "Are you interested in learning about our implementation process?",
            "feature_comparison": "Would you like me to compare different features for you?",
            "integration_details": "Do you have questions about how our system integrates with others?",
            "support_options": "Would you like to know about our support and training options?",
            "general_understanding": "Is there a specific aspect you'd like me to explain in more detail?"
        }
        
        for gap in knowledge_gaps:
            if gap in gap_question_map:
                questions.append(gap_question_map[gap])
        
        return questions
    
    def _generate_flow_based_questions(
        self,
        context: ConversationContext,
        conversation_history: List[Dict[str, Any]]
    ) -> List[str]:
        """Generate questions based on conversation flow."""
        questions = []
        
        # If conversation is getting long, offer to summarize or focus
        if context.message_count > 5:
            questions.append("Would you like me to summarize what we've covered so far?")
        
        # If multiple topics have been discussed, offer to focus
        if context.topic_changes > 2:
            questions.append("Would you like to focus on one particular area?")
        
        # If user seems satisfied, offer next steps
        if context.satisfaction_indicators and context.engagement_score > 0.6:
            questions.append("What would you like to explore next?")
        
        return questions
    
    def _extract_message_topics(self, message: str, rag_response: Optional[str] = None) -> List[str]:
        """Extract topics from message and response."""
        topics = []
        content = message.lower()
        
        if rag_response:
            content += " " + rag_response.lower()
        
        # Topic keyword mapping
        topic_keywords = {
            "pricing": ["price", "cost", "pricing", "plan", "subscription", "fee", "budget"],
            "features": ["feature", "functionality", "capability", "what does", "how does"],
            "support": ["support", "help", "assistance", "customer service", "training"],
            "integration": ["integrate", "api", "connect", "setup", "install", "implementation"],
            "demo": ["demo", "demonstration", "show me", "trial", "test", "preview"],
            "security": ["security", "secure", "privacy", "data protection", "compliance"],
            "performance": ["performance", "speed", "fast", "slow", "optimization", "scalability"]
        }
        
        for topic, keywords in topic_keywords.items():
            if any(keyword in content for keyword in keywords):
                topics.append(topic)
        
        return topics
    
    def _extract_primary_topic(self, message: str) -> Optional[str]:
        """Extract the primary topic from a message."""
        topics = self._extract_message_topics(message)
        return topics[0] if topics else None
    
    def _get_related_topics(self, topic: str) -> List[str]:
        """Get topics related to the given topic."""
        related_topics_map = {
            "pricing": ["features", "demo", "support"],
            "features": ["demo", "integration", "pricing"],
            "support": ["training", "implementation", "documentation"],
            "integration": ["api", "setup", "support"],
            "demo": ["features", "pricing", "trial"],
            "security": ["compliance", "data_protection", "privacy"],
            "performance": ["scalability", "optimization", "infrastructure"]
        }
        
        return related_topics_map.get(topic, [])
    
    def _generate_context_suggestions(
        self,
        context: ConversationContext,
        conversation_history: List[Dict[str, Any]]
    ) -> List[str]:
        """Generate suggestions based on conversation context."""
        suggestions = []
        
        # Suggest based on context type
        if context.context_type == ConversationContextType.QUESTION:
            suggestions.extend(["implementation_guide", "best_practices", "case_studies"])
        elif context.context_type == ConversationContextType.REQUEST:
            suggestions.extend(["next_steps", "requirements_checklist", "timeline"])
        
        # Suggest based on engagement
        if context.engagement_score > 0.7:
            suggestions.extend(["advanced_features", "customization_options", "enterprise_solutions"])
        
        return suggestions
    
    def _generate_goal_based_suggestions(self, user_goals: List[str]) -> List[str]:
        """Generate suggestions based on identified user goals."""
        suggestions = []
        
        goal_suggestion_map = {
            "evaluate_product": ["feature_comparison", "competitor_analysis", "roi_calculator"],
            "solve_problem": ["troubleshooting_guide", "solution_examples", "expert_consultation"],
            "learn_more": ["documentation", "tutorials", "webinars"],
            "make_purchase": ["pricing_details", "demo_scheduling", "implementation_planning"],
            "get_support": ["support_channels", "knowledge_base", "community_forum"],
            "integrate_system": ["api_documentation", "integration_examples", "technical_support"]
        }
        
        for goal in user_goals:
            if goal in goal_suggestion_map:
                suggestions.extend(goal_suggestion_map[goal])
        
        return suggestions
    
    def _generate_knowledge_gap_actions(self, knowledge_gaps: List[str]) -> List[ProactiveAction]:
        """Generate proactive actions for knowledge gaps."""
        actions = []
        
        for gap in knowledge_gaps:
            if gap == "pricing_details":
                actions.append(ProactiveAction(
                    action_type=ProactiveActionType.SUGGEST_TOPIC,
                    priority=0.7,
                    content="I can provide detailed information about our pricing plans and help you find the best option for your needs.",
                    reasoning=f"Knowledge gap identified: {gap}",
                    confidence=0.8,
                    metadata={"knowledge_gap": gap}
                ))
            elif gap == "implementation_process":
                actions.append(ProactiveAction(
                    action_type=ProactiveActionType.OFFER_HELP,
                    priority=0.6,
                    content="I can walk you through our implementation process and timeline to help you plan accordingly.",
                    reasoning=f"Knowledge gap identified: {gap}",
                    confidence=0.7,
                    metadata={"knowledge_gap": gap}
                ))
        
        return actions
    
    def _generate_engagement_actions(
        self,
        context: ConversationContext,
        intelligence: ConversationIntelligence
    ) -> List[ProactiveAction]:
        """Generate actions for highly engaged users."""
        actions = []
        
        if intelligence.lead_potential > 0.5:
            actions.append(ProactiveAction(
                action_type=ProactiveActionType.ASK_FOLLOWUP,
                priority=0.75,
                content="Since you're interested in our solution, would you like to discuss how it could specifically benefit your organization?",
                reasoning="High engagement with lead potential",
                confidence=0.8,
                metadata={"engagement_score": context.engagement_score, "lead_potential": intelligence.lead_potential}
            ))
        
        if len(intelligence.topics_covered) > 2:
            actions.append(ProactiveAction(
                action_type=ProactiveActionType.SUGGEST_TOPIC,
                priority=0.6,
                content="We've covered several topics. Would you like me to help you prioritize which areas to focus on first?",
                reasoning="Multiple topics discussed with high engagement",
                confidence=0.7,
                metadata={"topics_covered": intelligence.topics_covered}
            ))
        
        return actions
    
    def _prioritize_questions(self, questions: List[str], context: ConversationContext) -> List[str]:
        """Prioritize questions based on context."""
        # Simple prioritization - in a real system, you'd use more sophisticated scoring
        prioritized = []
        
        # Prioritize questions that address confusion first
        if context.confusion_indicators:
            clarification_questions = [q for q in questions if "clarify" in q.lower() or "explain" in q.lower()]
            prioritized.extend(clarification_questions)
        
        # Then add engagement-based questions
        engagement_questions = [q for q in questions if q not in prioritized]
        prioritized.extend(engagement_questions)
        
        return prioritized
    
    def _prioritize_suggestions(self, suggestions: List[str], context: ConversationContext) -> List[str]:
        """Prioritize suggestions based on context."""
        # Simple prioritization based on engagement and context
        if context.engagement_score > 0.7:
            # Prioritize advanced topics for engaged users
            advanced_topics = ["advanced_features", "enterprise_solutions", "customization_options"]
            prioritized = [s for s in suggestions if s in advanced_topics]
            prioritized.extend([s for s in suggestions if s not in prioritized])
            return prioritized
        
        return suggestions


# Global proactive assistant instance
proactive_assistant: Optional[ProactiveAssistant] = None


def get_proactive_assistant() -> ProactiveAssistant:
    """Get the global proactive assistant instance."""
    global proactive_assistant
    if proactive_assistant is None:
        proactive_assistant = ProactiveAssistant()
    return proactive_assistant