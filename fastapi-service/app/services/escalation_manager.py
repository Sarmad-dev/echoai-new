"""
Escalation Manager service for detecting and managing conversation escalations.
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import re
import json

from ..models.escalation import (
    EscalationType, EscalationStatus, UrgencyLevel,
    EscalationTrigger, EscalationSignals, EscalationResponse,
    EscalationRequest, NotificationResult, EscalationAnalysis,
    ConversationContext, AgentNotification
)
# Message model not needed - using Dict[str, Any] for conversation history
from ..services.sentiment_service import SentimentAnalyzer
from ..config import Settings

logger = logging.getLogger(__name__)
settings = Settings()


class EscalationManager:
    """
    Manages conversation escalation detection, analysis, and response generation.
    """
    
    def __init__(self):
        self.sentiment_service = SentimentAnalyzer()
        
        # Escalation trigger patterns
        self.frustration_patterns = [
            r"this is ridiculous",
            r"this doesn't work",
            r"i'm frustrated",
            r"this is stupid",
            r"waste of time",
            r"terrible service",
            r"not helpful",
            r"useless",
            r"fed up",
            r"angry",
            r"annoyed"
        ]
        
        self.technical_patterns = [
            r"error code",
            r"doesn't work",
            r"broken",
            r"bug",
            r"technical issue",
            r"system error",
            r"not functioning",
            r"malfunction",
            r"crash",
            r"freeze",
            r"integration problem"
        ]
        
        self.complexity_patterns = [
            r"complicated",
            r"complex setup",
            r"multiple steps",
            r"don't understand",
            r"confused",
            r"too difficult",
            r"overwhelming",
            r"need help with",
            r"step by step",
            r"walk me through"
        ]
        
        self.human_request_patterns = [
            r"speak to someone",
            r"talk to a person",
            r"human agent",
            r"real person",
            r"customer service",
            r"support team",
            r"escalate",
            r"manager",
            r"supervisor"
        ]
        
        # Escalation thresholds
        self.escalation_thresholds = {
            "frustration_sentiment": -0.6,
            "technical_confidence": 0.7,
            "complexity_score": 0.8,
            "message_count": 10,
            "unresolved_issues": 3
        }

    async def detect_escalation_triggers(
        self, 
        message: str, 
        context: ConversationContext
    ) -> EscalationSignals:
        """
        Detect escalation triggers in the current message and conversation context.
        
        Args:
            message: Current user message
            context: Conversation context and history
            
        Returns:
            EscalationSignals with detected triggers and confidence scores
        """
        triggers = []
        
        # Analyze sentiment
        sentiment_result = await self.sentiment_service.analyze_sentiment(message)
        sentiment_score = sentiment_result.get("score", 0.0)
        
        # Check for frustration indicators
        frustration_triggers = self._detect_frustration_triggers(message, sentiment_score)
        triggers.extend(frustration_triggers)
        
        # Check for technical issue indicators
        technical_triggers = self._detect_technical_triggers(message, context)
        triggers.extend(technical_triggers)
        
        # Check for complexity indicators
        complexity_triggers = self._detect_complexity_triggers(message, context)
        triggers.extend(complexity_triggers)
        
        # Check for explicit human requests
        human_request_triggers = self._detect_human_request_triggers(message)
        triggers.extend(human_request_triggers)
        
        # Check conversation-level indicators
        conversation_triggers = self._detect_conversation_level_triggers(context)
        triggers.extend(conversation_triggers)
        
        # Calculate overall confidence
        overall_confidence = self._calculate_overall_confidence(triggers)
        
        return EscalationSignals(
            triggers=triggers,
            overall_confidence=overall_confidence,
            sentiment_score=sentiment_score,
            frustration_indicators=self._extract_frustration_indicators(message),
            complexity_indicators=self._extract_complexity_indicators(message),
            technical_indicators=self._extract_technical_indicators(message)
        )

    def _detect_frustration_triggers(self, message: str, sentiment_score: float) -> List[EscalationTrigger]:
        """Detect frustration-based escalation triggers."""
        triggers = []
        message_lower = message.lower()
        
        # Sentiment-based frustration
        if sentiment_score < self.escalation_thresholds["frustration_sentiment"]:
            triggers.append(EscalationTrigger(
                trigger_type="negative_sentiment",
                confidence=abs(sentiment_score),
                reason=f"Negative sentiment detected (score: {sentiment_score:.2f})",
                context={"sentiment_score": sentiment_score}
            ))
        
        # Pattern-based frustration detection
        for pattern in self.frustration_patterns:
            if re.search(pattern, message_lower):
                triggers.append(EscalationTrigger(
                    trigger_type="frustration_language",
                    confidence=0.8,
                    reason=f"Frustration language detected: '{pattern}'",
                    context={"matched_pattern": pattern}
                ))
        
        return triggers

    def _detect_technical_triggers(self, message: str, context: ConversationContext) -> List[EscalationTrigger]:
        """Detect technical issue escalation triggers."""
        triggers = []
        message_lower = message.lower()
        
        # Pattern-based technical issue detection
        for pattern in self.technical_patterns:
            if re.search(pattern, message_lower):
                confidence = 0.7 if context.technical_complexity_score > 0.5 else 0.6
                triggers.append(EscalationTrigger(
                    trigger_type="technical_issue",
                    confidence=confidence,
                    reason=f"Technical issue language detected: '{pattern}'",
                    context={
                        "matched_pattern": pattern,
                        "complexity_score": context.technical_complexity_score
                    }
                ))
        
        return triggers

    def _detect_complexity_triggers(self, message: str, context: ConversationContext) -> List[EscalationTrigger]:
        """Detect complexity-based escalation triggers."""
        triggers = []
        message_lower = message.lower()
        
        # Pattern-based complexity detection
        for pattern in self.complexity_patterns:
            if re.search(pattern, message_lower):
                triggers.append(EscalationTrigger(
                    trigger_type="complexity_issue",
                    confidence=0.6,
                    reason=f"Complexity language detected: '{pattern}'",
                    context={"matched_pattern": pattern}
                ))
        
        # High technical complexity score
        if context.technical_complexity_score > self.escalation_thresholds["complexity_score"]:
            triggers.append(EscalationTrigger(
                trigger_type="high_complexity",
                confidence=context.technical_complexity_score,
                reason=f"High technical complexity score: {context.technical_complexity_score:.2f}",
                context={"complexity_score": context.technical_complexity_score}
            ))
        
        return triggers

    def _detect_human_request_triggers(self, message: str) -> List[EscalationTrigger]:
        """Detect explicit requests for human assistance."""
        triggers = []
        message_lower = message.lower()
        
        for pattern in self.human_request_patterns:
            if re.search(pattern, message_lower):
                triggers.append(EscalationTrigger(
                    trigger_type="human_request",
                    confidence=0.9,
                    reason=f"Explicit human assistance request: '{pattern}'",
                    context={"matched_pattern": pattern}
                ))
        
        return triggers

    def _detect_conversation_level_triggers(self, context: ConversationContext) -> List[EscalationTrigger]:
        """Detect escalation triggers based on conversation-level metrics."""
        triggers = []
        
        # Long conversation without resolution
        if context.message_count > self.escalation_thresholds["message_count"]:
            triggers.append(EscalationTrigger(
                trigger_type="long_conversation",
                confidence=0.6,
                reason=f"Long conversation ({context.message_count} messages) may indicate unresolved issues",
                context={"message_count": context.message_count}
            ))
        
        # Multiple unresolved issues
        if len(context.unresolved_issues) >= self.escalation_thresholds["unresolved_issues"]:
            triggers.append(EscalationTrigger(
                trigger_type="multiple_unresolved_issues",
                confidence=0.7,
                reason=f"Multiple unresolved issues detected: {len(context.unresolved_issues)}",
                context={"unresolved_issues": context.unresolved_issues}
            ))
        
        # Declining sentiment trend
        if len(context.sentiment_history) >= 3:
            recent_sentiment = sum(context.sentiment_history[-3:]) / 3
            if recent_sentiment < -0.3:
                triggers.append(EscalationTrigger(
                    trigger_type="declining_sentiment",
                    confidence=0.5,
                    reason=f"Declining sentiment trend detected: {recent_sentiment:.2f}",
                    context={"recent_sentiment": recent_sentiment}
                ))
        
        return triggers

    def _calculate_overall_confidence(self, triggers: List[EscalationTrigger]) -> float:
        """Calculate overall escalation confidence from individual triggers."""
        if not triggers:
            return 0.0
        
        # Weight different trigger types
        weights = {
            "human_request": 1.0,
            "negative_sentiment": 0.8,
            "frustration_language": 0.9,
            "technical_issue": 0.7,
            "complexity_issue": 0.6,
            "high_complexity": 0.7,
            "long_conversation": 0.4,
            "multiple_unresolved_issues": 0.6,
            "declining_sentiment": 0.5
        }
        
        weighted_sum = sum(
            trigger.confidence * weights.get(trigger.trigger_type, 0.5)
            for trigger in triggers
        )
        
        # Normalize by number of triggers and apply ceiling
        confidence = min(weighted_sum / len(triggers), 1.0)
        
        return confidence

    async def determine_escalation_type(self, signals: EscalationSignals) -> EscalationType:
        """
        Determine the primary escalation type based on detected signals.
        
        Args:
            signals: Detected escalation signals
            
        Returns:
            Primary escalation type
        """
        type_scores = {
            EscalationType.TECHNICAL: 0.0,
            EscalationType.FRUSTRATION: 0.0,
            EscalationType.COMPLEXITY: 0.0,
            EscalationType.COMPLAINT: 0.0,
            EscalationType.REQUEST: 0.0
        }
        
        # Score based on trigger types
        for trigger in signals.triggers:
            if trigger.trigger_type in ["technical_issue"]:
                type_scores[EscalationType.TECHNICAL] += trigger.confidence
            elif trigger.trigger_type in ["frustration_language", "negative_sentiment", "declining_sentiment"]:
                type_scores[EscalationType.FRUSTRATION] += trigger.confidence
            elif trigger.trigger_type in ["complexity_issue", "high_complexity"]:
                type_scores[EscalationType.COMPLEXITY] += trigger.confidence
            elif trigger.trigger_type in ["human_request"]:
                type_scores[EscalationType.REQUEST] += trigger.confidence
        
        # Additional scoring based on sentiment
        if signals.sentiment_score and signals.sentiment_score < -0.7:
            type_scores[EscalationType.COMPLAINT] += abs(signals.sentiment_score)
        
        # Return the type with highest score
        return max(type_scores, key=type_scores.get)

    async def generate_escalation_response(self, escalation_type: EscalationType, signals: EscalationSignals) -> EscalationResponse:
        """
        Generate appropriate escalation response based on type and signals.
        
        Args:
            escalation_type: Type of escalation
            signals: Detected escalation signals
            
        Returns:
            Generated escalation response
        """
        urgency_level = self._determine_urgency_level(signals)
        
        response_templates = {
            EscalationType.TECHNICAL: {
                "message": "I understand you're experiencing a technical issue. Let me connect you with our technical support team who can provide specialized assistance with this problem.",
                "actions": [
                    "Connect with technical support specialist",
                    "Provide detailed error information to agent",
                    "Schedule technical consultation if needed"
                ]
            },
            EscalationType.FRUSTRATION: {
                "message": "I can sense your frustration, and I sincerely apologize for any inconvenience. Let me connect you with one of our customer service representatives who can provide personalized assistance.",
                "actions": [
                    "Connect with customer service representative",
                    "Provide conversation history for context",
                    "Prioritize resolution of customer concerns"
                ]
            },
            EscalationType.COMPLEXITY: {
                "message": "This seems like a complex situation that would benefit from personalized guidance. I'll connect you with a specialist who can walk you through this step by step.",
                "actions": [
                    "Connect with product specialist",
                    "Provide detailed walkthrough assistance",
                    "Offer screen sharing or guided setup if available"
                ]
            },
            EscalationType.COMPLAINT: {
                "message": "I understand your concerns and want to ensure they're addressed properly. Let me connect you with our customer service manager who can help resolve this issue.",
                "actions": [
                    "Connect with customer service manager",
                    "Document complaint details for follow-up",
                    "Ensure proper resolution and follow-up"
                ]
            },
            EscalationType.REQUEST: {
                "message": "Of course! I'll connect you with one of our team members right away. They'll be able to provide the personalized assistance you're looking for.",
                "actions": [
                    "Connect with available agent",
                    "Provide conversation context",
                    "Ensure smooth transition to human support"
                ]
            }
        }
        
        template = response_templates.get(escalation_type, response_templates[EscalationType.REQUEST])
        
        # Generate agent context
        agent_context = {
            "escalation_type": escalation_type.value,
            "urgency_level": urgency_level.value,
            "triggers": [trigger.dict() for trigger in signals.triggers],
            "sentiment_score": signals.sentiment_score,
            "frustration_indicators": signals.frustration_indicators,
            "technical_indicators": signals.technical_indicators,
            "complexity_indicators": signals.complexity_indicators
        }
        
        return EscalationResponse(
            message=template["message"],
            escalation_type=escalation_type,
            urgency_level=urgency_level,
            suggested_actions=template["actions"],
            agent_context=agent_context,
            should_escalate=True
        )

    def _determine_urgency_level(self, signals: EscalationSignals) -> UrgencyLevel:
        """Determine urgency level based on escalation signals."""
        # High urgency conditions
        if signals.overall_confidence > 0.8:
            return UrgencyLevel.HIGH
        
        if signals.sentiment_score and signals.sentiment_score < -0.8:
            return UrgencyLevel.HIGH
        
        # Check for critical keywords
        critical_indicators = any(
            "urgent" in indicator.lower() or "emergency" in indicator.lower()
            for indicator in signals.frustration_indicators + signals.technical_indicators
        )
        
        if critical_indicators:
            return UrgencyLevel.CRITICAL
        
        # Medium urgency conditions
        if signals.overall_confidence > 0.6:
            return UrgencyLevel.MEDIUM
        
        # Default to low urgency
        return UrgencyLevel.LOW

    async def notify_human_agents(self, escalation: EscalationRequest) -> NotificationResult:
        """
        Notify human agents about escalation request.
        
        Args:
            escalation: Escalation request to notify about
            
        Returns:
            Result of notification attempt
        """
        try:
            # Create agent notification
            notification = AgentNotification(
                escalation_id=escalation.id or "unknown",
                notification_type="immediate" if escalation.urgency_level in [UrgencyLevel.HIGH, UrgencyLevel.CRITICAL] else "queued",
                priority=escalation.urgency_level,
                message=f"New {escalation.escalation_type.value.lower()} escalation requires attention",
                conversation_summary=escalation.trigger_reason or "Customer needs assistance",
                customer_context=escalation.conversation_context or {},
                estimated_complexity=self._estimate_complexity(escalation),
                required_skills=self._determine_required_skills(escalation)
            )
            
            # In a real implementation, this would integrate with:
            # - Email notification system
            # - Slack/Teams integration
            # - Agent dashboard notifications
            # - SMS for critical escalations
            # - Webhook notifications to external systems
            
            # For now, we'll simulate successful notification
            logger.info(f"Escalation notification sent for conversation {escalation.conversation_id}")
            
            return NotificationResult(
                success=True,
                notification_id=f"notif_{escalation.id}",
                agent_id=escalation.assigned_agent_id,
                message="Agent notification sent successfully",
                delivery_method="system_notification",
                timestamp=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Failed to notify agents for escalation {escalation.id}: {str(e)}")
            return NotificationResult(
                success=False,
                message=f"Failed to send notification: {str(e)}",
                delivery_method="system_notification",
                timestamp=datetime.utcnow()
            )

    def _estimate_complexity(self, escalation: EscalationRequest) -> str:
        """Estimate the complexity of the escalation."""
        if escalation.escalation_type == EscalationType.TECHNICAL:
            return "complex"
        elif escalation.escalation_type == EscalationType.COMPLEXITY:
            return "moderate"
        else:
            return "simple"

    def _determine_required_skills(self, escalation: EscalationRequest) -> List[str]:
        """Determine required skills for handling the escalation."""
        skills = ["customer_service"]
        
        if escalation.escalation_type == EscalationType.TECHNICAL:
            skills.extend(["technical_support", "troubleshooting"])
        elif escalation.escalation_type == EscalationType.COMPLEXITY:
            skills.extend(["product_expertise", "training"])
        elif escalation.escalation_type == EscalationType.COMPLAINT:
            skills.extend(["conflict_resolution", "management"])
        
        return skills

    def _extract_frustration_indicators(self, message: str) -> List[str]:
        """Extract specific frustration indicators from message."""
        indicators = []
        message_lower = message.lower()
        
        for pattern in self.frustration_patterns:
            if re.search(pattern, message_lower):
                indicators.append(pattern)
        
        return indicators

    def _extract_complexity_indicators(self, message: str) -> List[str]:
        """Extract specific complexity indicators from message."""
        indicators = []
        message_lower = message.lower()
        
        for pattern in self.complexity_patterns:
            if re.search(pattern, message_lower):
                indicators.append(pattern)
        
        return indicators

    def _extract_technical_indicators(self, message: str) -> List[str]:
        """Extract specific technical indicators from message."""
        indicators = []
        message_lower = message.lower()
        
        for pattern in self.technical_patterns:
            if re.search(pattern, message_lower):
                indicators.append(pattern)
        
        return indicators

    async def analyze_conversation_for_escalation(
        self, 
        message: str, 
        conversation_history: List[Dict[str, Any]]
    ) -> EscalationAnalysis:
        """
        Analyze conversation for escalation needs.
        
        Args:
            message: Current user message
            conversation_history: List of previous messages
            
        Returns:
            Complete escalation analysis
        """
        # Build conversation context
        context = self._build_conversation_context(message, conversation_history)
        
        # Detect escalation signals
        signals = await self.detect_escalation_triggers(message, context)
        
        # Determine if escalation is needed
        should_escalate = signals.overall_confidence > 0.5
        
        if should_escalate:
            escalation_type = await self.determine_escalation_type(signals)
            escalation_response = await self.generate_escalation_response(escalation_type, signals)
            
            return EscalationAnalysis(
                should_escalate=True,
                escalation_type=escalation_type,
                urgency_level=escalation_response.urgency_level,
                confidence=signals.overall_confidence,
                triggers=signals.triggers,
                recommended_response=escalation_response.message,
                agent_context=escalation_response.agent_context
            )
        else:
            return EscalationAnalysis(
                should_escalate=False,
                confidence=signals.overall_confidence,
                triggers=signals.triggers
            )

    def _build_conversation_context(
        self, 
        current_message: str, 
        conversation_history: List[Dict[str, Any]]
    ) -> ConversationContext:
        """Build conversation context from history."""
        user_messages = []
        assistant_messages = []
        sentiment_history = []
        
        for msg in conversation_history:
            if msg.role == "user":
                user_messages.append(msg.content)
                # Add sentiment if available
                if hasattr(msg, 'sentiment_score') and msg.sentiment_score is not None:
                    sentiment_history.append(msg.sentiment_score)
            elif msg.role == "assistant":
                assistant_messages.append(msg.content)
        
        # Add current message
        user_messages.append(current_message)
        
        # Calculate technical complexity score (simplified)
        technical_complexity = self._calculate_technical_complexity(user_messages)
        
        # Identify unresolved issues (simplified)
        unresolved_issues = self._identify_unresolved_issues(user_messages, assistant_messages)
        
        return ConversationContext(
            conversation_id="current",  # This would be provided by the caller
            message_count=len(conversation_history) + 1,
            user_messages=user_messages,
            assistant_messages=assistant_messages,
            sentiment_history=sentiment_history,
            technical_complexity_score=technical_complexity,
            unresolved_issues=unresolved_issues
        )

    def _calculate_technical_complexity(self, user_messages: List[str]) -> float:
        """Calculate technical complexity score from user messages."""
        technical_terms = [
            "api", "integration", "webhook", "database", "server", "error", "code",
            "configuration", "setup", "install", "deploy", "authentication", "ssl",
            "domain", "dns", "firewall", "security", "encryption"
        ]
        
        total_words = 0
        technical_words = 0
        
        for message in user_messages:
            words = message.lower().split()
            total_words += len(words)
            technical_words += sum(1 for word in words if word in technical_terms)
        
        if total_words == 0:
            return 0.0
        
        return min(technical_words / total_words * 5, 1.0)  # Scale to 0-1

    def _identify_unresolved_issues(
        self, 
        user_messages: List[str], 
        assistant_messages: List[str]
    ) -> List[str]:
        """Identify unresolved issues from conversation."""
        # This is a simplified implementation
        # In practice, this would use more sophisticated NLP
        
        issue_indicators = [
            "still not working", "still having trouble", "doesn't work",
            "not resolved", "same problem", "still broken"
        ]
        
        unresolved = []
        for message in user_messages[-3:]:  # Check recent messages
            message_lower = message.lower()
            for indicator in issue_indicators:
                if indicator in message_lower:
                    unresolved.append(f"Issue mentioned: {indicator}")
        
        return unresolved