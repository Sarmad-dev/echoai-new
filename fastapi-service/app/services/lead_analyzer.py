"""
Lead qualification and scoring service for identifying high-value prospects.
"""
import logging
import re
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime
from dataclasses import dataclass
from enum import Enum

from .intent_service import get_intent_detector

logger = logging.getLogger(__name__)


class LeadPriority(Enum):
    """Lead priority levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class LeadType(Enum):
    """Types of leads based on detected intent."""
    DEMO_REQUEST = "demo_request"
    ENTERPRISE_INQUIRY = "enterprise_inquiry"
    BULK_ORDER = "bulk_order"
    PRICING_INQUIRY = "pricing_inquiry"
    SUPPORT_ESCALATION = "support_escalation"
    FEATURE_REQUEST = "feature_request"
    GENERAL_INQUIRY = "general_inquiry"


@dataclass
class LeadScore:
    """Lead scoring result."""
    total_score: float
    priority: LeadPriority
    lead_type: LeadType
    confidence: float
    factors: Dict[str, float]
    extracted_data: Dict[str, Any]


@dataclass
class ConversationContext:
    """Context information for lead scoring."""
    message_count: int
    conversation_length: int
    engagement_score: float
    sentiment_history: List[float]
    previous_intents: List[str]


class IntentAnalyzer:
    """
    Advanced intent analyzer for lead qualification and scoring.
    
    This service provides:
    - High-value keyword detection for enterprise inquiries
    - Lead scoring based on conversation patterns
    - Lead qualification triggers
    - Data extraction for CRM population
    """
    
    def __init__(self):
        """Initialize the intent analyzer."""
        self.intent_detector = get_intent_detector()
        self._initialize_lead_patterns()
        self._initialize_scoring_weights()
        self._is_ready = True
        logger.info("IntentAnalyzer initialized successfully")
    
    def _initialize_lead_patterns(self):
        """Initialize high-value lead detection patterns."""
        self.high_value_keywords = {
            "enterprise": {
                "keywords": [
                    "enterprise", "corporation", "company", "organization", 
                    "business", "team", "department", "employees", "staff",
                    "enterprise solution", "business plan", "corporate license"
                ],
                "weight": 0.4
            },
            "demo_request": {
                "keywords": [
                    "demo", "demonstration", "trial", "preview", "walkthrough",
                    "show me", "see it in action", "test drive", "pilot"
                ],
                "weight": 0.3
            },
            "bulk_order": {
                "keywords": [
                    "bulk", "volume", "quantity", "multiple", "licenses",
                    "seats", "users", "wholesale", "bulk purchase", "volume discount"
                ],
                "weight": 0.35
            },
            "urgency": {
                "keywords": [
                    "urgent", "asap", "immediately", "right away", "quickly",
                    "deadline", "time sensitive", "rush", "emergency"
                ],
                "weight": 0.25
            },
            "budget_indicators": {
                "keywords": [
                    "budget", "investment", "cost", "pricing", "quote",
                    "proposal", "contract", "purchase", "buy", "procurement"
                ],
                "weight": 0.2
            },
            "decision_maker": {
                "keywords": [
                    "ceo", "cto", "manager", "director", "vp", "president",
                    "head of", "lead", "supervisor", "decision maker", "authorize"
                ],
                "weight": 0.3
            }
        }
        
        self.company_size_indicators = {
            "large": {
                "patterns": [
                    r"\b(\d+)\s*(?:thousand|k)\s*(?:employees|staff|people)",
                    r"\b(\d+)\s*million\s*(?:revenue|sales|turnover)",
                    r"fortune\s*(?:500|1000)",
                    r"publicly\s*traded",
                    r"nasdaq|nyse"
                ],
                "multiplier": 1.5
            },
            "medium": {
                "patterns": [
                    r"\b(\d+)\s*(?:hundred|employees|staff)",
                    r"growing\s*(?:company|business)",
                    r"expanding\s*(?:team|operations)"
                ],
                "multiplier": 1.2
            }
        }
        
        self.contact_extraction_patterns = {
            "email": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
            "phone": r"\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b",
            "company": r"(?:at|from|with)\s+([A-Z][a-zA-Z\s&.,]+(?:Inc|LLC|Corp|Ltd|Company))",
            "name": r"(?:i'm|i am|my name is|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)"
        }
    
    def _initialize_scoring_weights(self):
        """Initialize scoring algorithm weights."""
        self.scoring_weights = {
            "intent_confidence": 0.25,
            "keyword_density": 0.20,
            "conversation_engagement": 0.15,
            "urgency_indicators": 0.15,
            "company_size": 0.10,
            "decision_maker": 0.10,
            "contact_completeness": 0.05
        }
    
    async def analyze_lead_potential(
        self, 
        message: str, 
        conversation_context: Optional[ConversationContext] = None
    ) -> LeadScore:
        """
        Analyze a message for lead potential and scoring.
        
        Args:
            message: The message text to analyze
            conversation_context: Optional context about the conversation
            
        Returns:
            LeadScore object with scoring results
            
        Raises:
            ValueError: If message is empty or invalid
        """
        if not message or not message.strip():
            raise ValueError("Message cannot be empty")
        
        try:
            # Get basic intent detection
            intent_result = await self.intent_detector.detect_intent(message)
            
            # Calculate lead scoring factors
            factors = {}
            
            # 1. Intent confidence factor
            factors["intent_confidence"] = self._calculate_intent_factor(intent_result)
            
            # 2. High-value keyword density
            factors["keyword_density"] = self._calculate_keyword_density(message)
            
            # 3. Conversation engagement (if context provided)
            factors["conversation_engagement"] = self._calculate_engagement_factor(conversation_context)
            
            # 4. Urgency indicators
            factors["urgency_indicators"] = self._calculate_urgency_factor(message)
            
            # 5. Company size indicators
            factors["company_size"] = self._calculate_company_size_factor(message)
            
            # 6. Decision maker indicators
            factors["decision_maker"] = self._calculate_decision_maker_factor(message)
            
            # 7. Contact information completeness
            extracted_data = self._extract_contact_data(message)
            factors["contact_completeness"] = self._calculate_contact_completeness(extracted_data)
            
            # Calculate total weighted score
            total_score = sum(
                factors[factor] * self.scoring_weights[factor]
                for factor in factors
            )
            
            # Determine lead type and priority
            lead_type = self._determine_lead_type(intent_result, factors, message)
            priority = self._determine_priority(total_score, factors)
            
            # Calculate overall confidence
            confidence = self._calculate_confidence(intent_result, factors)
            
            return LeadScore(
                total_score=round(total_score, 3),
                priority=priority,
                lead_type=lead_type,
                confidence=round(confidence, 3),
                factors=factors,
                extracted_data=extracted_data
            )
            
        except Exception as e:
            logger.error(f"Error analyzing lead potential: {e}")
            raise RuntimeError(f"Lead analysis failed: {e}")
    
    def _calculate_intent_factor(self, intent_result: Dict[str, Any]) -> float:
        """Calculate scoring factor based on detected intent."""
        intent = intent_result.get("intent")
        confidence = intent_result.get("confidence", 0.0)
        
        # High-value intents get higher scores
        high_value_intents = {
            "demo_request": 0.9,
            "enterprise_inquiry": 1.0,
            "pricing_inquiry": 0.7,
            "integration_question": 0.6
        }
        
        if intent in high_value_intents:
            return confidence * high_value_intents[intent]
        
        return confidence * 0.3  # Lower score for other intents
    
    def _calculate_keyword_density(self, message: str) -> float:
        """Calculate high-value keyword density in message."""
        message_lower = message.lower()
        total_keywords = 0
        matched_keywords = 0
        
        for category, data in self.high_value_keywords.items():
            keywords = data["keywords"]
            weight = data["weight"]
            
            for keyword in keywords:
                total_keywords += 1
                if keyword.lower() in message_lower:
                    matched_keywords += weight
        
        if total_keywords == 0:
            return 0.0
        
        return min(matched_keywords / len(self.high_value_keywords), 1.0)
    
    def _calculate_engagement_factor(self, context: Optional[ConversationContext]) -> float:
        """Calculate engagement factor based on conversation context."""
        if not context:
            return 0.5  # Neutral score if no context
        
        # Use the provided engagement score as base, then add other factors
        engagement_score = context.engagement_score * 0.5  # Base from provided score
        
        # Message count factor (more messages = higher engagement)
        if context.message_count > 10:
            engagement_score += 0.3
        elif context.message_count > 5:
            engagement_score += 0.2
        elif context.message_count > 2:
            engagement_score += 0.1
        
        # Conversation length factor
        if context.conversation_length > 1000:
            engagement_score += 0.2
        elif context.conversation_length > 500:
            engagement_score += 0.1
        
        # Sentiment factor (positive sentiment = higher engagement)
        if context.sentiment_history:
            avg_sentiment = sum(context.sentiment_history) / len(context.sentiment_history)
            engagement_score += max(0, avg_sentiment) * 0.2
        
        return min(engagement_score, 1.0)
    
    def _calculate_urgency_factor(self, message: str) -> float:
        """Calculate urgency factor based on urgency keywords."""
        urgency_keywords = self.high_value_keywords["urgency"]["keywords"]
        message_lower = message.lower()
        
        urgency_score = 0.0
        for keyword in urgency_keywords:
            if keyword in message_lower:
                urgency_score += 0.2
        
        return min(urgency_score, 1.0)
    
    def _calculate_company_size_factor(self, message: str) -> float:
        """Calculate company size factor based on size indicators."""
        message_lower = message.lower()
        
        for size_category, data in self.company_size_indicators.items():
            for pattern in data["patterns"]:
                if re.search(pattern, message_lower, re.IGNORECASE):
                    return data["multiplier"] - 1.0  # Convert multiplier to 0-1 score
        
        return 0.0
    
    def _calculate_decision_maker_factor(self, message: str) -> float:
        """Calculate decision maker factor based on title indicators."""
        decision_keywords = self.high_value_keywords["decision_maker"]["keywords"]
        message_lower = message.lower()
        
        for keyword in decision_keywords:
            if keyword in message_lower:
                return 0.8
        
        return 0.0
    
    def _calculate_contact_completeness(self, extracted_data: Dict[str, Any]) -> float:
        """Calculate contact completeness score."""
        completeness = 0.0
        
        if extracted_data.get("email"):
            completeness += 0.4
        if extracted_data.get("phone"):
            completeness += 0.3
        if extracted_data.get("name"):
            completeness += 0.2
        if extracted_data.get("company"):
            completeness += 0.1
        
        return completeness
    
    def _extract_contact_data(self, message: str) -> Dict[str, Any]:
        """Extract contact information from message."""
        extracted = {}
        
        for field, pattern in self.contact_extraction_patterns.items():
            matches = re.findall(pattern, message, re.IGNORECASE)
            if matches:
                if field == "phone":
                    # Format phone number
                    if len(matches[0]) == 3:  # Tuple from phone regex
                        extracted[field] = f"({matches[0][0]}) {matches[0][1]}-{matches[0][2]}"
                    else:
                        extracted[field] = matches[0]
                else:
                    extracted[field] = matches[0].strip()
        
        return extracted
    
    def _determine_lead_type(self, intent_result: Dict[str, Any], factors: Dict[str, float], message: str) -> LeadType:
        """Determine lead type based on intent and factors."""
        intent = intent_result.get("intent")
        matched_keywords = intent_result.get("matched_keywords", [])
        message_lower = message.lower()
        
        # Check for specific high-priority patterns first
        
        # Demo request - look for demo keywords in original message and matched keywords
        demo_keywords = ["demo", "demonstration", "trial", "preview", "walkthrough"]
        if (any(keyword in str(matched_keywords).lower() for keyword in demo_keywords) or
            any(keyword in message_lower for keyword in demo_keywords)):
            return LeadType.DEMO_REQUEST
        
        # Bulk order - look for bulk/volume keywords
        bulk_keywords = ["bulk", "volume", "quantity", "multiple", "licenses", "seats"]
        if (any(keyword in str(matched_keywords).lower() for keyword in bulk_keywords) or
            any(keyword in message_lower for keyword in bulk_keywords)):
            return LeadType.BULK_ORDER
        
        # Support escalation - look for complaint/problem keywords
        complaint_keywords = ["frustrated", "angry", "refund", "money back", "not working", "broken"]
        if (any(keyword in str(matched_keywords).lower() for keyword in complaint_keywords) or
            any(keyword in message_lower for keyword in complaint_keywords)):
            return LeadType.SUPPORT_ESCALATION
        
        # Map remaining intents to lead types
        intent_mapping = {
            "demo_request": LeadType.DEMO_REQUEST,
            "enterprise_inquiry": LeadType.ENTERPRISE_INQUIRY,
            "pricing_inquiry": LeadType.PRICING_INQUIRY,
            "support_request": LeadType.SUPPORT_ESCALATION,
            "complaint": LeadType.SUPPORT_ESCALATION,
            "feature_request": LeadType.FEATURE_REQUEST
        }
        
        if intent in intent_mapping:
            return intent_mapping[intent]
        
        return LeadType.GENERAL_INQUIRY
    
    def _determine_priority(self, total_score: float, factors: Dict[str, float]) -> LeadPriority:
        """Determine lead priority based on total score and factors."""
        # Urgent priority for high urgency indicators
        if factors.get("urgency_indicators", 0) > 0.3:
            return LeadPriority.URGENT
        
        # High priority for decision makers or high company size
        if factors.get("decision_maker", 0) > 0.5 or factors.get("company_size", 0) > 0.5:
            return LeadPriority.HIGH
        
        # High priority thresholds based on score
        if total_score > 0.7:
            return LeadPriority.HIGH
        elif total_score > 0.5:
            return LeadPriority.HIGH
        elif total_score > 0.3:
            return LeadPriority.MEDIUM
        else:
            return LeadPriority.LOW
    
    def _calculate_confidence(self, intent_result: Dict[str, Any], factors: Dict[str, float]) -> float:
        """Calculate overall confidence in lead scoring."""
        intent_confidence = intent_result.get("confidence", 0.0)
        
        # Average of intent confidence and factor scores
        factor_scores = [score for score in factors.values() if score > 0]
        if factor_scores:
            avg_factor_score = sum(factor_scores) / len(factor_scores)
            return (intent_confidence + avg_factor_score) / 2
        
        return intent_confidence
    
    def should_trigger_lead_qualification(self, lead_score: LeadScore, threshold: float = 0.5) -> bool:
        """
        Determine if lead scoring should trigger qualification workflow.
        
        Args:
            lead_score: Lead scoring result
            threshold: Minimum score threshold for triggering
            
        Returns:
            True if lead qualification should be triggered
        """
        try:
            # Always trigger for urgent and high priority leads
            if lead_score.priority in [LeadPriority.URGENT, LeadPriority.HIGH]:
                return True
            
            # Trigger for specific high-value lead types
            high_value_types = [
                LeadType.DEMO_REQUEST,
                LeadType.ENTERPRISE_INQUIRY,
                LeadType.BULK_ORDER
            ]
            
            if lead_score.lead_type in high_value_types and lead_score.total_score > 0.2:
                return True
            
            # General threshold check
            return lead_score.total_score >= threshold
            
        except Exception as e:
            logger.error(f"Error checking lead qualification trigger: {e}")
            return False
    
    def get_crm_data_mapping(self, lead_score: LeadScore, message: str) -> Dict[str, Any]:
        """
        Generate CRM data mapping for lead creation.
        
        Args:
            lead_score: Lead scoring result
            message: Original message for additional context
            
        Returns:
            Dictionary with CRM field mappings
        """
        try:
            crm_data = {
                "lead_source": "chatbot",
                "lead_score": lead_score.total_score,
                "lead_priority": lead_score.priority.value,
                "lead_type": lead_score.lead_type.value,
                "confidence": lead_score.confidence,
                "qualification_date": datetime.utcnow().isoformat(),
                "original_message": message[:500],  # Truncate for CRM
                "scoring_factors": lead_score.factors
            }
            
            # Add extracted contact data
            crm_data.update(lead_score.extracted_data)
            
            # Add lead-specific fields
            if lead_score.lead_type == LeadType.DEMO_REQUEST:
                crm_data["demo_requested"] = True
                crm_data["follow_up_action"] = "schedule_demo"
            elif lead_score.lead_type == LeadType.ENTERPRISE_INQUIRY:
                crm_data["enterprise_inquiry"] = True
                crm_data["follow_up_action"] = "enterprise_sales_contact"
            elif lead_score.lead_type == LeadType.BULK_ORDER:
                crm_data["bulk_order_inquiry"] = True
                crm_data["follow_up_action"] = "volume_pricing_quote"
            
            return crm_data
            
        except Exception as e:
            logger.error(f"Error generating CRM data mapping: {e}")
            return {"error": str(e)}
    
    def is_ready(self) -> bool:
        """Check if the intent analyzer is ready."""
        return self._is_ready and self.intent_detector.is_ready()
    
    def get_service_info(self) -> Dict[str, Any]:
        """Get service information and status."""
        return {
            "service": "IntentAnalyzer",
            "version": "1.0.0",
            "ready": self._is_ready,
            "supported_lead_types": [lt.value for lt in LeadType],
            "priority_levels": [lp.value for lp in LeadPriority],
            "scoring_factors": list(self.scoring_weights.keys()),
            "high_value_categories": list(self.high_value_keywords.keys())
        }


# Global service instance
_intent_analyzer = None


def get_intent_analyzer() -> IntentAnalyzer:
    """
    Get the global intent analyzer instance.
    
    Returns:
        IntentAnalyzer instance
    """
    global _intent_analyzer
    
    if _intent_analyzer is None:
        _intent_analyzer = IntentAnalyzer()
    
    return _intent_analyzer