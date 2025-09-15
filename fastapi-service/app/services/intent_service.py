"""
Intent detection service for identifying user intents in conversations.
"""
import logging
import re
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)


class IntentDetector:
    """
    Service for detecting user intents in conversation messages.
    
    This service provides:
    - Keyword-based intent detection
    - Confidence scoring for detected intents
    - Support for common business intents
    """
    
    def __init__(self):
        """Initialize the intent detector with predefined patterns."""
        self._initialize_intent_patterns()
        self._is_ready = True
        logger.info("IntentDetector initialized successfully")
    
    def _initialize_intent_patterns(self):
        """Initialize intent detection patterns."""
        self.intent_patterns = {
            "demo_request": {
                "keywords": ["demo", "demonstration", "show me", "trial", "preview", "walkthrough"],
                "phrases": [
                    r"can\s+i\s+see\s+a\s+demo",
                    r"show\s+me\s+how\s+it\s+works",
                    r"i\s+want\s+a\s+demo",
                    r"schedule\s+a\s+demo",
                    r"book\s+a\s+demo"
                ],
                "confidence_boost": 0.3
            },
            "pricing_inquiry": {
                "keywords": ["price", "cost", "pricing", "expensive", "cheap", "budget", "fee", "payment"],
                "phrases": [
                    r"how\s+much\s+does\s+it\s+cost",
                    r"what\s+is\s+the\s+price",
                    r"pricing\s+information",
                    r"how\s+much\s+is\s+it"
                ],
                "confidence_boost": 0.2
            },
            "support_request": {
                "keywords": ["help", "support", "problem", "issue", "bug", "error", "broken", "not working"],
                "phrases": [
                    r"i\s+need\s+help",
                    r"having\s+trouble",
                    r"not\s+working",
                    r"can\s+you\s+help",
                    r"support\s+ticket"
                ],
                "confidence_boost": 0.2
            },
            "enterprise_inquiry": {
                "keywords": ["enterprise", "business", "company", "organization", "team", "bulk", "volume"],
                "phrases": [
                    r"enterprise\s+solution",
                    r"for\s+my\s+company",
                    r"business\s+plan",
                    r"team\s+license",
                    r"bulk\s+purchase"
                ],
                "confidence_boost": 0.4
            },
            "integration_question": {
                "keywords": ["integrate", "api", "webhook", "connect", "sync", "import", "export"],
                "phrases": [
                    r"does\s+it\s+integrate",
                    r"api\s+available",
                    r"connect\s+with",
                    r"sync\s+data"
                ],
                "confidence_boost": 0.3
            },
            "complaint": {
                "keywords": ["complaint", "disappointed", "unsatisfied", "refund", "cancel", "terrible", "awful"],
                "phrases": [
                    r"i\s+want\s+to\s+cancel",
                    r"this\s+is\s+terrible",
                    r"very\s+disappointed",
                    r"want\s+my\s+money\s+back"
                ],
                "confidence_boost": 0.4
            },
            "feature_request": {
                "keywords": ["feature", "functionality", "capability", "can it", "does it support"],
                "phrases": [
                    r"does\s+it\s+have",
                    r"can\s+it\s+do",
                    r"feature\s+request",
                    r"add\s+a\s+feature"
                ],
                "confidence_boost": 0.2
            }
        }
    
    async def detect_intent(self, message: str) -> Dict[str, Any]:
        """
        Detect intent in a message.
        
        Args:
            message: The message text to analyze
            
        Returns:
            Dictionary containing intent detection results:
            - intent: Detected intent name or None
            - confidence: Confidence score (0.0 to 1.0)
            - matched_keywords: List of matched keywords
            - matched_phrases: List of matched phrases
            
        Raises:
            ValueError: If message is empty or invalid
        """
        if not message or not message.strip():
            raise ValueError("Message cannot be empty")
        
        try:
            message_lower = message.lower().strip()
            
            intent_scores = {}
            
            for intent_name, pattern_data in self.intent_patterns.items():
                score = 0.0
                matched_keywords = []
                matched_phrases = []
                
                # Check keyword matches
                keywords = pattern_data.get("keywords", [])
                for keyword in keywords:
                    if keyword.lower() in message_lower:
                        score += 0.1
                        matched_keywords.append(keyword)
                
                # Check phrase matches (regex patterns)
                phrases = pattern_data.get("phrases", [])
                for phrase_pattern in phrases:
                    if re.search(phrase_pattern, message_lower):
                        score += 0.2
                        matched_phrases.append(phrase_pattern)
                
                # Apply confidence boost if matches found
                if matched_keywords or matched_phrases:
                    confidence_boost = pattern_data.get("confidence_boost", 0.0)
                    score += confidence_boost
                
                # Store results if any matches found
                if score > 0:
                    intent_scores[intent_name] = {
                        "score": min(score, 1.0),  # Cap at 1.0
                        "matched_keywords": matched_keywords,
                        "matched_phrases": matched_phrases
                    }
            
            # Find the highest scoring intent
            if intent_scores:
                best_intent = max(intent_scores.items(), key=lambda x: x[1]["score"])
                intent_name, intent_data = best_intent
                
                return {
                    "intent": intent_name,
                    "confidence": round(intent_data["score"], 3),
                    "matched_keywords": intent_data["matched_keywords"],
                    "matched_phrases": intent_data["matched_phrases"],
                    "all_scores": {k: v["score"] for k, v in intent_scores.items()},
                    "analyzed_at": datetime.utcnow().isoformat()
                }
            else:
                return {
                    "intent": None,
                    "confidence": 0.0,
                    "matched_keywords": [],
                    "matched_phrases": [],
                    "all_scores": {},
                    "analyzed_at": datetime.utcnow().isoformat()
                }
                
        except Exception as e:
            logger.error(f"Error detecting intent: {e}")
            raise RuntimeError(f"Intent detection failed: {e}")
    
    def should_trigger_intent_event(self, intent_result: Dict[str, Any], threshold: float = 0.3) -> bool:
        """
        Determine if an intent detection should trigger an automation event.
        
        Args:
            intent_result: Result from detect_intent()
            threshold: Minimum confidence threshold for triggering
            
        Returns:
            True if intent should trigger an event
        """
        try:
            intent = intent_result.get("intent")
            confidence = intent_result.get("confidence", 0.0)
            
            # High-value intents that should always trigger if detected
            high_value_intents = ["demo_request", "enterprise_inquiry", "complaint"]
            
            if intent in high_value_intents and confidence > 0.2:
                return True
            
            # Other intents need higher confidence
            return intent is not None and confidence >= threshold
            
        except Exception as e:
            logger.error(f"Error checking intent trigger: {e}")
            return False
    
    def is_ready(self) -> bool:
        """Check if the intent detector is ready."""
        return self._is_ready
    
    def get_service_info(self) -> Dict[str, Any]:
        """Get service information and status."""
        return {
            "service": "IntentDetector",
            "version": "1.0.0",
            "ready": self._is_ready,
            "supported_intents": list(self.intent_patterns.keys()),
            "detection_method": "keyword_and_pattern_matching",
            "confidence_range": [0.0, 1.0]
        }


# Global service instance
_intent_detector = None


def get_intent_detector() -> IntentDetector:
    """
    Get the global intent detector instance.
    
    Returns:
        IntentDetector instance
    """
    global _intent_detector
    
    if _intent_detector is None:
        _intent_detector = IntentDetector()
    
    return _intent_detector