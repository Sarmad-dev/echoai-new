"""
Enhanced lead qualification and data collection service with sophisticated conversation analysis.
"""
import logging
import re
import json
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum

from .lead_analyzer import get_intent_analyzer, LeadPriority, LeadType, ConversationContext
from .conversation_intelligence import get_conversation_intelligence_service
from .sentiment_service import get_sentiment_service

logger = logging.getLogger(__name__)


class CollectionStrategy(Enum):
    """Lead data collection strategies."""
    DIRECT = "direct"
    CONVERSATIONAL = "conversational"
    PROGRESSIVE = "progressive"


class QualificationStage(Enum):
    """Lead qualification stages."""
    INITIAL_INTEREST = "initial_interest"
    NEED_ASSESSMENT = "need_assessment"
    BUDGET_QUALIFICATION = "budget_qualification"
    AUTHORITY_CONFIRMATION = "authority_confirmation"
    TIMELINE_DISCUSSION = "timeline_discussion"
    FINAL_QUALIFICATION = "final_qualification"


@dataclass
class LeadSignal:
    """Individual lead signal detected in conversation."""
    signal_type: str
    confidence: float
    evidence: str
    context: str
    timestamp: datetime


@dataclass
class QualificationQuestion:
    """Generated qualification question."""
    question: str
    question_type: str
    stage: QualificationStage
    priority: int
    context_dependent: bool
    follow_up_questions: List[str]


@dataclass
class ConversationAnalysis:
    """Comprehensive conversation analysis for lead qualification."""
    lead_signals: List[LeadSignal]
    engagement_level: float
    conversation_stage: QualificationStage
    data_completeness: float
    next_best_action: str
    suggested_questions: List[QualificationQuestion]
    collection_strategy: CollectionStrategy
    urgency_score: float
    buying_intent_score: float


@dataclass
class EnhancedLeadData:
    """Enhanced lead data with progressive collection tracking."""
    # Contact Information
    email: Optional[str] = None
    phone: Optional[str] = None
    name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    
    # Qualification Data (BANT)
    budget: Optional[str] = None
    authority: Optional[str] = None
    need: Optional[str] = None
    timeline: Optional[str] = None
    
    # Company Information
    company_size: Optional[str] = None
    industry: Optional[str] = None
    current_solution: Optional[str] = None
    pain_points: List[str] = None
    
    # Behavioral Data
    engagement_score: float = 0.0
    response_time_avg: float = 0.0
    question_asking_frequency: float = 0.0
    technical_depth: str = "basic"
    
    # Collection Metadata
    data_sources: Dict[str, str] = None
    collection_timestamps: Dict[str, datetime] = None
    confidence_scores: Dict[str, float] = None
    validation_status: Dict[str, bool] = None
    
    def __post_init__(self):
        if self.pain_points is None:
            self.pain_points = []
        if self.data_sources is None:
            self.data_sources = {}
        if self.collection_timestamps is None:
            self.collection_timestamps = {}
        if self.confidence_scores is None:
            self.confidence_scores = {}
        if self.validation_status is None:
            self.validation_status = {}


class EnhancedLeadAnalyzer:
    """
    Enhanced lead analyzer with sophisticated conversation analysis and natural data collection.
    
    This service provides:
    - Deep conversation analysis for lead signals
    - Progressive, non-pushy data collection
    - Intelligent qualification question generation
    - Behavioral pattern analysis
    - Automated workflow triggers
    """
    
    def __init__(self):
        """Initialize the enhanced lead analyzer."""
        self.base_analyzer = get_intent_analyzer()
        self.conversation_intelligence = get_conversation_intelligence_service()
        self.sentiment_service = get_sentiment_service()
        
        self._initialize_lead_signals()
        self._initialize_qualification_framework()
        self._initialize_collection_strategies()
        self._is_ready = True
        
        logger.info("Enhanced lead analyzer initialized successfully")
    
    def _initialize_lead_signals(self):
        """Initialize sophisticated lead signal detection patterns."""
        self.lead_signals = {
            "buying_intent": {
                "patterns": [
                    r"(?:looking for|need|want|interested in|shopping for|evaluating|considering)",
                    r"(?:budget|cost|price|pricing|quote|proposal)",
                    r"(?:when can|how soon|timeline|deadline|implementation)",
                    r"(?:demo|trial|test|pilot|proof of concept)",
                    r"(?:decision|choose|select|purchase|buy|invest)"
                ],
                "weight": 0.8,
                "context_required": False
            },
            "authority_indicators": {
                "patterns": [
                    r"(?:i'm the|i am the|my role is|i'm responsible for)",
                    r"(?:ceo|cto|cfo|vp|director|manager|head of|lead)",
                    r"(?:decision maker|authorize|approve|sign off)",
                    r"(?:my team|our department|we need|our company)",
                    r"(?:i decide|i choose|i'm in charge of)"
                ],
                "weight": 0.9,
                "context_required": False
            },
            "urgency_signals": {
                "patterns": [
                    r"(?:urgent|asap|immediately|right away|quickly)",
                    r"(?:deadline|time sensitive|rush|emergency)",
                    r"(?:need it by|must have by|required by)",
                    r"(?:can't wait|running out of time|pressure)",
                    r"(?:yesterday|today|this week|next week)"
                ],
                "weight": 0.7,
                "context_required": True
            },
            "pain_points": {
                "patterns": [
                    r"(?:problem|issue|challenge|difficulty|struggle)",
                    r"(?:frustrated|annoyed|disappointed|unhappy)",
                    r"(?:not working|broken|failing|inefficient)",
                    r"(?:waste|losing|costing|expensive|slow)",
                    r"(?:manual|tedious|time consuming|complicated)"
                ],
                "weight": 0.6,
                "context_required": True
            },
            "company_size_indicators": {
                "patterns": [
                    r"(\d+)\s*(?:employees|staff|people|users|seats)",
                    r"(?:small|medium|large|enterprise|startup|corporation)",
                    r"(?:team of|department of|office of)",
                    r"(?:fortune 500|publicly traded|nasdaq|nyse)",
                    r"(\d+)\s*(?:million|billion)\s*(?:revenue|sales)"
                ],
                "weight": 0.5,
                "context_required": False
            },
            "technical_sophistication": {
                "patterns": [
                    r"(?:api|integration|webhook|database|cloud)",
                    r"(?:technical|developer|engineer|architect)",
                    r"(?:customize|configure|implement|deploy)",
                    r"(?:security|compliance|gdpr|soc|hipaa)",
                    r"(?:scalability|performance|architecture)"
                ],
                "weight": 0.4,
                "context_required": False
            }
        }
    
    def _initialize_qualification_framework(self):
        """Initialize BANT+ qualification framework."""
        self.qualification_questions = {
            QualificationStage.INITIAL_INTEREST: [
                {
                    "question": "What specific challenges are you looking to solve?",
                    "type": "need_assessment",
                    "priority": 1,
                    "follow_ups": [
                        "How are you currently handling this?",
                        "What's the impact of this challenge on your business?"
                    ]
                },
                {
                    "question": "What brought you to look for a solution like this?",
                    "type": "trigger_event",
                    "priority": 2,
                    "follow_ups": [
                        "When did this become a priority?",
                        "What changed in your business?"
                    ]
                }
            ],
            QualificationStage.NEED_ASSESSMENT: [
                {
                    "question": "How many people in your organization would use this?",
                    "type": "scope_sizing",
                    "priority": 1,
                    "follow_ups": [
                        "Which departments would be involved?",
                        "Are there other stakeholders we should consider?"
                    ]
                },
                {
                    "question": "What's your current process for handling this?",
                    "type": "current_state",
                    "priority": 2,
                    "follow_ups": [
                        "What tools are you using now?",
                        "What's working well with your current approach?"
                    ]
                }
            ],
            QualificationStage.BUDGET_QUALIFICATION: [
                {
                    "question": "Have you allocated budget for this type of solution?",
                    "type": "budget_existence",
                    "priority": 1,
                    "follow_ups": [
                        "What range are you considering?",
                        "When does your budget cycle reset?"
                    ]
                },
                {
                    "question": "What's the cost of not solving this problem?",
                    "type": "cost_of_inaction",
                    "priority": 2,
                    "follow_ups": [
                        "How much time does this cost your team?",
                        "What opportunities are you missing?"
                    ]
                }
            ],
            QualificationStage.AUTHORITY_CONFIRMATION: [
                {
                    "question": "Who else would be involved in this decision?",
                    "type": "decision_process",
                    "priority": 1,
                    "follow_ups": [
                        "What's your typical evaluation process?",
                        "Who has final approval authority?"
                    ]
                },
                {
                    "question": "What criteria will you use to make this decision?",
                    "type": "decision_criteria",
                    "priority": 2,
                    "follow_ups": [
                        "What's most important to your team?",
                        "Are there any deal-breakers we should know about?"
                    ]
                }
            ],
            QualificationStage.TIMELINE_DISCUSSION: [
                {
                    "question": "When would you ideally like to have this implemented?",
                    "type": "implementation_timeline",
                    "priority": 1,
                    "follow_ups": [
                        "What's driving that timeline?",
                        "Is there flexibility in the timeline?"
                    ]
                },
                {
                    "question": "When do you need to make a decision by?",
                    "type": "decision_timeline",
                    "priority": 2,
                    "follow_ups": [
                        "What happens if you don't decide by then?",
                        "Are there other priorities competing for attention?"
                    ]
                }
            ]
        }
    
    def _initialize_collection_strategies(self):
        """Initialize data collection strategies."""
        self.collection_strategies = {
            CollectionStrategy.DIRECT: {
                "description": "Direct questions for high-intent leads",
                "triggers": ["high_urgency", "explicit_request", "demo_request"],
                "approach": "straightforward",
                "timing": "immediate"
            },
            CollectionStrategy.CONVERSATIONAL: {
                "description": "Natural conversation flow",
                "triggers": ["medium_engagement", "exploratory_questions"],
                "approach": "contextual",
                "timing": "opportunistic"
            },
            CollectionStrategy.PROGRESSIVE: {
                "description": "Gradual information gathering",
                "triggers": ["low_engagement", "early_stage", "price_sensitive"],
                "approach": "patient",
                "timing": "relationship_building"
            }
        }
    
    async def analyze_conversation_for_leads(
        self, 
        conversation_history: List[Dict[str, Any]],
        current_message: str,
        user_context: Optional[Dict[str, Any]] = None
    ) -> ConversationAnalysis:
        """
        Perform comprehensive conversation analysis for lead qualification.
        
        Args:
            conversation_history: Full conversation history
            current_message: Latest message from user
            user_context: Additional user context if available
            
        Returns:
            ConversationAnalysis with detailed insights
        """
        try:
            # Detect lead signals across conversation
            lead_signals = await self._detect_lead_signals(conversation_history, current_message)
            
            # Analyze engagement patterns
            engagement_level = await self._analyze_engagement_level(conversation_history)
            
            # Determine conversation stage
            conversation_stage = await self._determine_qualification_stage(lead_signals, conversation_history)
            
            # Calculate data completeness
            data_completeness = await self._calculate_data_completeness(conversation_history, user_context)
            
            # Determine collection strategy
            collection_strategy = await self._determine_collection_strategy(
                lead_signals, engagement_level, conversation_stage
            )
            
            # Generate qualification questions
            suggested_questions = await self._generate_qualification_questions(
                conversation_stage, lead_signals, collection_strategy
            )
            
            # Calculate behavioral scores
            urgency_score = await self._calculate_urgency_score(lead_signals, conversation_history)
            buying_intent_score = await self._calculate_buying_intent_score(lead_signals, conversation_history)
            
            # Determine next best action
            next_best_action = await self._determine_next_action(
                conversation_stage, data_completeness, urgency_score, buying_intent_score
            )
            
            return ConversationAnalysis(
                lead_signals=lead_signals,
                engagement_level=engagement_level,
                conversation_stage=conversation_stage,
                data_completeness=data_completeness,
                next_best_action=next_best_action,
                suggested_questions=suggested_questions,
                collection_strategy=collection_strategy,
                urgency_score=urgency_score,
                buying_intent_score=buying_intent_score
            )
            
        except Exception as e:
            logger.error(f"Error analyzing conversation for leads: {e}")
            raise
    
    async def _detect_lead_signals(
        self, 
        conversation_history: List[Dict[str, Any]], 
        current_message: str
    ) -> List[LeadSignal]:
        """Detect lead signals across the conversation."""
        signals = []
        
        # Analyze all messages for signals
        all_messages = [msg.get("content", "") for msg in conversation_history] + [current_message]
        
        for i, message in enumerate(all_messages):
            message_lower = message.lower()
            
            for signal_type, config in self.lead_signals.items():
                for pattern in config["patterns"]:
                    matches = re.finditer(pattern, message_lower, re.IGNORECASE)
                    
                    for match in matches:
                        # Extract context around the match
                        start = max(0, match.start() - 50)
                        end = min(len(message), match.end() + 50)
                        context = message[start:end].strip()
                        
                        # Calculate confidence based on pattern strength and context
                        confidence = config["weight"]
                        
                        # Adjust confidence based on context if required
                        if config["context_required"]:
                            confidence *= self._assess_context_relevance(context, signal_type)
                        
                        signal = LeadSignal(
                            signal_type=signal_type,
                            confidence=confidence,
                            evidence=match.group(),
                            context=context,
                            timestamp=datetime.utcnow()
                        )
                        
                        signals.append(signal)
        
        # Remove duplicate signals and sort by confidence
        unique_signals = self._deduplicate_signals(signals)
        return sorted(unique_signals, key=lambda x: x.confidence, reverse=True)
    
    def _assess_context_relevance(self, context: str, signal_type: str) -> float:
        """Assess the relevance of context for a signal type."""
        context_lower = context.lower()
        
        # Context relevance rules for different signal types
        relevance_keywords = {
            "urgency_signals": ["project", "deadline", "business", "need", "solution"],
            "pain_points": ["current", "existing", "problem", "issue", "challenge"],
            "buying_intent": ["solution", "product", "service", "help", "looking"]
        }
        
        keywords = relevance_keywords.get(signal_type, [])
        matches = sum(1 for keyword in keywords if keyword in context_lower)
        
        return min(1.0, 0.5 + (matches * 0.2))  # Base 0.5, +0.2 per relevant keyword
    
    def _deduplicate_signals(self, signals: List[LeadSignal]) -> List[LeadSignal]:
        """Remove duplicate signals based on type and evidence."""
        seen = set()
        unique_signals = []
        
        for signal in signals:
            key = (signal.signal_type, signal.evidence.lower())
            if key not in seen:
                seen.add(key)
                unique_signals.append(signal)
        
        return unique_signals
    
    async def _analyze_engagement_level(self, conversation_history: List[Dict[str, Any]]) -> float:
        """Analyze user engagement level based on conversation patterns."""
        if not conversation_history:
            return 0.5
        
        engagement_factors = {
            "message_length": 0.0,
            "question_frequency": 0.0,
            "response_time": 0.0,
            "conversation_depth": 0.0,
            "sentiment_trend": 0.0
        }
        
        user_messages = [msg for msg in conversation_history if msg.get("role") == "user"]
        
        if not user_messages:
            return 0.5
        
        # Message length factor
        avg_length = sum(len(msg.get("content", "")) for msg in user_messages) / len(user_messages)
        engagement_factors["message_length"] = min(1.0, avg_length / 100)  # Normalize to 100 chars
        
        # Question frequency factor
        question_count = sum(1 for msg in user_messages if "?" in msg.get("content", ""))
        engagement_factors["question_frequency"] = min(1.0, question_count / len(user_messages))
        
        # Conversation depth factor
        engagement_factors["conversation_depth"] = min(1.0, len(user_messages) / 10)  # Normalize to 10 messages
        
        # Sentiment trend factor (if available)
        try:
            sentiments = []
            for msg in user_messages[-5:]:  # Last 5 messages
                sentiment = await self.sentiment_service.analyze_sentiment(msg.get("content", ""))
                if sentiment and "score" in sentiment:
                    sentiments.append(sentiment["score"])
            
            if sentiments:
                avg_sentiment = sum(sentiments) / len(sentiments)
                engagement_factors["sentiment_trend"] = max(0.0, (avg_sentiment + 1) / 2)  # Convert -1,1 to 0,1
        except Exception:
            engagement_factors["sentiment_trend"] = 0.5  # Neutral if sentiment analysis fails
        
        # Calculate weighted engagement score
        weights = {
            "message_length": 0.2,
            "question_frequency": 0.3,
            "response_time": 0.1,
            "conversation_depth": 0.2,
            "sentiment_trend": 0.2
        }
        
        engagement_score = sum(
            engagement_factors[factor] * weights[factor]
            for factor in engagement_factors
        )
        
        return min(1.0, engagement_score)
    
    async def _determine_qualification_stage(
        self, 
        lead_signals: List[LeadSignal], 
        conversation_history: List[Dict[str, Any]]
    ) -> QualificationStage:
        """Determine the current qualification stage based on signals and conversation."""
        # Count signals by type
        signal_counts = {}
        for signal in lead_signals:
            signal_counts[signal.signal_type] = signal_counts.get(signal.signal_type, 0) + 1
        
        # Analyze conversation content for stage indicators
        conversation_text = " ".join([
            msg.get("content", "") for msg in conversation_history
        ]).lower()
        
        # Stage determination logic
        if any(keyword in conversation_text for keyword in ["demo", "trial", "pricing", "quote"]):
            return QualificationStage.FINAL_QUALIFICATION
        
        if signal_counts.get("authority_indicators", 0) > 0 and signal_counts.get("budget", 0) > 0:
            return QualificationStage.TIMELINE_DISCUSSION
        
        if signal_counts.get("authority_indicators", 0) > 0:
            return QualificationStage.BUDGET_QUALIFICATION
        
        if signal_counts.get("buying_intent", 0) > 0:
            return QualificationStage.AUTHORITY_CONFIRMATION
        
        if signal_counts.get("pain_points", 0) > 0:
            return QualificationStage.NEED_ASSESSMENT
        
        return QualificationStage.INITIAL_INTEREST
    
    async def _calculate_data_completeness(
        self, 
        conversation_history: List[Dict[str, Any]], 
        user_context: Optional[Dict[str, Any]]
    ) -> float:
        """Calculate how complete the lead data is."""
        # Extract available data from conversation and context
        extracted_data = await self.collect_lead_data_naturally(conversation_history, user_context)
        
        # Define required fields and their weights
        required_fields = {
            "email": 0.25,
            "name": 0.15,
            "company": 0.15,
            "need": 0.20,
            "budget": 0.10,
            "authority": 0.10,
            "timeline": 0.05
        }
        
        completeness = 0.0
        for field, weight in required_fields.items():
            if getattr(extracted_data, field, None):
                completeness += weight
        
        return completeness
    
    async def collect_lead_data_naturally(
        self, 
        conversation_history: List[Dict[str, Any]], 
        user_context: Optional[Dict[str, Any]] = None
    ) -> EnhancedLeadData:
        """
        Collect lead data naturally from conversation without being pushy.
        
        Args:
            conversation_history: Full conversation history
            user_context: Additional user context
            
        Returns:
            EnhancedLeadData with collected information
        """
        lead_data = EnhancedLeadData()
        
        # Combine all conversation text
        conversation_text = " ".join([
            msg.get("content", "") for msg in conversation_history
            if msg.get("role") == "user"
        ])
        
        # Extract contact information using patterns
        await self._extract_contact_info(conversation_text, lead_data)
        
        # Extract company information
        await self._extract_company_info(conversation_text, lead_data)
        
        # Extract qualification data (BANT)
        await self._extract_qualification_data(conversation_text, conversation_history, lead_data)
        
        # Extract behavioral data
        await self._extract_behavioral_data(conversation_history, lead_data)
        
        # Add user context if available
        if user_context:
            await self._merge_user_context(user_context, lead_data)
        
        return lead_data
    
    async def _extract_contact_info(self, conversation_text: str, lead_data: EnhancedLeadData):
        """Extract contact information from conversation."""
        # Email extraction
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = re.findall(email_pattern, conversation_text)
        if emails:
            lead_data.email = emails[0]
            lead_data.data_sources["email"] = "conversation"
            lead_data.confidence_scores["email"] = 0.9
        
        # Phone extraction
        phone_pattern = r'\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b'
        phones = re.findall(phone_pattern, conversation_text)
        if phones:
            lead_data.phone = f"({phones[0][0]}) {phones[0][1]}-{phones[0][2]}"
            lead_data.data_sources["phone"] = "conversation"
            lead_data.confidence_scores["phone"] = 0.8
        
        # Name extraction
        name_patterns = [
            r"(?:i'm|i am|my name is|this is|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
            r"([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s+here|\s+from)"
        ]
        
        for pattern in name_patterns:
            names = re.findall(pattern, conversation_text, re.IGNORECASE)
            if names:
                full_name = names[0].strip()
                lead_data.name = full_name
                
                # Split into first and last name
                name_parts = full_name.split()
                if len(name_parts) >= 1:
                    lead_data.first_name = name_parts[0]
                if len(name_parts) >= 2:
                    lead_data.last_name = name_parts[-1]
                
                lead_data.data_sources["name"] = "conversation"
                lead_data.confidence_scores["name"] = 0.7
                break
    
    async def _extract_company_info(self, conversation_text: str, lead_data: EnhancedLeadData):
        """Extract company information from conversation."""
        # Company name extraction
        company_patterns = [
            r"(?:at|from|with|work for|employed by)\s+([A-Z][a-zA-Z\s&.,]+(?:Inc|LLC|Corp|Ltd|Company|Co))",
            r"(?:our company|my company|we are)\s+([A-Z][a-zA-Z\s&.,]+)",
            r"([A-Z][a-zA-Z\s&.,]+(?:Inc|LLC|Corp|Ltd|Company|Co))"
        ]
        
        for pattern in company_patterns:
            companies = re.findall(pattern, conversation_text, re.IGNORECASE)
            if companies:
                lead_data.company = companies[0].strip()
                lead_data.data_sources["company"] = "conversation"
                lead_data.confidence_scores["company"] = 0.6
                break
        
        # Job title extraction
        title_patterns = [
            r"(?:i'm the|i am the|my role is|i'm a|i am a)\s+([a-zA-Z\s]+?)(?:\s+at|\s+for|$)",
            r"(ceo|cto|cfo|vp|director|manager|lead|head of [a-zA-Z\s]+)"
        ]
        
        for pattern in title_patterns:
            titles = re.findall(pattern, conversation_text, re.IGNORECASE)
            if titles:
                lead_data.job_title = titles[0].strip()
                lead_data.data_sources["job_title"] = "conversation"
                lead_data.confidence_scores["job_title"] = 0.7
                break
        
        # Company size extraction
        size_patterns = [
            r"(\d+)\s*(?:employees|staff|people|person team)",
            r"(?:small|medium|large|enterprise)\s*(?:company|business|organization)",
            r"team of\s*(\d+)",
            r"(\d+)\s*person\s*(?:company|team|organization)"
        ]
        
        for pattern in size_patterns:
            sizes = re.findall(pattern, conversation_text, re.IGNORECASE)
            if sizes:
                if sizes[0].isdigit():
                    employee_count = int(sizes[0])
                    if employee_count < 50:
                        lead_data.company_size = "small"
                    elif employee_count < 500:
                        lead_data.company_size = "medium"
                    else:
                        lead_data.company_size = "large"
                else:
                    lead_data.company_size = sizes[0].lower()
                
                lead_data.data_sources["company_size"] = "conversation"
                lead_data.confidence_scores["company_size"] = 0.8
                break
    
    async def _extract_qualification_data(
        self, 
        conversation_text: str, 
        conversation_history: List[Dict[str, Any]], 
        lead_data: EnhancedLeadData
    ):
        """Extract BANT qualification data from conversation."""
        # Budget indicators
        budget_patterns = [
            r"budget.*?(\$[\d,]+|\d+\s*(?:k|thousand|million))",
            r"(?:spend|invest|allocate).*?(\$[\d,]+|\d+\s*(?:k|thousand|million))",
            r"price range.*?(\$[\d,]+|\d+\s*(?:k|thousand|million))"
        ]
        
        for pattern in budget_patterns:
            budgets = re.findall(pattern, conversation_text, re.IGNORECASE)
            if budgets:
                lead_data.budget = budgets[0]
                lead_data.data_sources["budget"] = "conversation"
                lead_data.confidence_scores["budget"] = 0.8
                break
        
        # Authority indicators
        authority_keywords = [
            "decision maker", "authorize", "approve", "sign off", "final say",
            "my decision", "i decide", "i choose", "i'm responsible"
        ]
        
        for keyword in authority_keywords:
            if keyword in conversation_text.lower():
                lead_data.authority = "decision_maker"
                lead_data.data_sources["authority"] = "conversation"
                lead_data.confidence_scores["authority"] = 0.7
                break
        
        # Timeline indicators
        timeline_patterns = [
            r"(?:by|within|in)\s*(\d+\s*(?:days?|weeks?|months?))",
            r"(?:need it|implement|start).*?(?:by|within|in)\s*([a-zA-Z\s]+)",
            r"timeline.*?(\d+\s*(?:days?|weeks?|months?))"
        ]
        
        for pattern in timeline_patterns:
            timelines = re.findall(pattern, conversation_text, re.IGNORECASE)
            if timelines:
                lead_data.timeline = timelines[0]
                lead_data.data_sources["timeline"] = "conversation"
                lead_data.confidence_scores["timeline"] = 0.6
                break
        
        # Need/pain points extraction
        pain_keywords = [
            "problem", "issue", "challenge", "difficulty", "struggle",
            "frustrated", "inefficient", "manual", "time consuming"
        ]
        
        for msg in conversation_history:
            if msg.get("role") == "user":
                content = msg.get("content", "").lower()
                for keyword in pain_keywords:
                    if keyword in content:
                        lead_data.pain_points.append(content[:100])  # First 100 chars
                        break
        
        if lead_data.pain_points:
            lead_data.need = "identified_pain_points"
            lead_data.data_sources["need"] = "conversation"
            lead_data.confidence_scores["need"] = 0.7
    
    async def _extract_behavioral_data(
        self, 
        conversation_history: List[Dict[str, Any]], 
        lead_data: EnhancedLeadData
    ):
        """Extract behavioral data from conversation patterns."""
        user_messages = [msg for msg in conversation_history if msg.get("role") == "user"]
        
        if not user_messages:
            return
        
        # Calculate engagement score
        total_length = sum(len(msg.get("content", "")) for msg in user_messages)
        avg_length = total_length / len(user_messages)
        lead_data.engagement_score = min(1.0, avg_length / 100)  # Normalize to 100 chars
        
        # Question asking frequency
        question_count = sum(1 for msg in user_messages if "?" in msg.get("content", ""))
        lead_data.question_asking_frequency = question_count / len(user_messages)
        
        # Technical depth assessment
        technical_keywords = [
            "api", "integration", "webhook", "database", "cloud", "security",
            "compliance", "scalability", "architecture", "technical"
        ]
        
        technical_mentions = 0
        for msg in user_messages:
            content = msg.get("content", "").lower()
            technical_mentions += sum(1 for keyword in technical_keywords if keyword in content)
        
        if technical_mentions > 3:
            lead_data.technical_depth = "advanced"
        elif technical_mentions > 1:
            lead_data.technical_depth = "intermediate"
        else:
            lead_data.technical_depth = "basic"
    
    async def _merge_user_context(self, user_context: Dict[str, Any], lead_data: EnhancedLeadData):
        """Merge additional user context into lead data."""
        # Map user context fields to lead data
        context_mapping = {
            "email": "email",
            "name": "name",
            "company": "company",
            "phone": "phone",
            "job_title": "job_title"
        }
        
        for context_key, lead_key in context_mapping.items():
            if context_key in user_context and user_context[context_key]:
                if not getattr(lead_data, lead_key):  # Only if not already extracted
                    setattr(lead_data, lead_key, user_context[context_key])
                    lead_data.data_sources[lead_key] = "user_context"
                    lead_data.confidence_scores[lead_key] = 0.9
    
    async def generate_qualification_questions(
        self, 
        conversation_analysis: ConversationAnalysis,
        lead_data: EnhancedLeadData,
        max_questions: int = 3
    ) -> List[QualificationQuestion]:
        """
        Generate contextual qualification questions based on conversation analysis.
        
        Args:
            conversation_analysis: Analysis of the conversation
            lead_data: Current lead data
            max_questions: Maximum number of questions to generate
            
        Returns:
            List of prioritized qualification questions
        """
        try:
            stage = conversation_analysis.conversation_stage
            strategy = conversation_analysis.collection_strategy
            
            # Get base questions for current stage
            base_questions = self.qualification_questions.get(stage, [])
            
            # Filter and prioritize questions based on missing data
            relevant_questions = []
            
            for q_data in base_questions:
                question = QualificationQuestion(
                    question=q_data["question"],
                    question_type=q_data["type"],
                    stage=stage,
                    priority=q_data["priority"],
                    context_dependent=True,
                    follow_up_questions=q_data["follow_ups"]
                )
                
                # Adjust question based on collection strategy
                if strategy == CollectionStrategy.CONVERSATIONAL:
                    question.question = self._make_question_conversational(question.question)
                elif strategy == CollectionStrategy.PROGRESSIVE:
                    question.question = self._make_question_gentle(question.question)
                
                relevant_questions.append(question)
            
            # Add data-specific questions based on what's missing
            missing_data_questions = await self._generate_missing_data_questions(lead_data, strategy)
            relevant_questions.extend(missing_data_questions)
            
            # Sort by priority and return top questions
            relevant_questions.sort(key=lambda x: x.priority)
            return relevant_questions[:max_questions]
            
        except Exception as e:
            logger.error(f"Error generating qualification questions: {e}")
            return []
    
    def _make_question_conversational(self, question: str) -> str:
        """Make a question more conversational and natural."""
        conversational_starters = [
            "I'm curious, ",
            "Can you tell me ",
            "I'd love to understand ",
            "Help me understand "
        ]
        
        # Simple transformation - add conversational starter
        import random
        starter = random.choice(conversational_starters)
        return starter + question.lower()
    
    def _make_question_gentle(self, question: str) -> str:
        """Make a question gentler and less pushy."""
        gentle_modifiers = [
            "If you don't mind me asking, ",
            "When you're ready to share, ",
            "No pressure, but ",
            "If it's helpful to discuss, "
        ]
        
        import random
        modifier = random.choice(gentle_modifiers)
        return modifier + question.lower()
    
    async def _generate_missing_data_questions(
        self, 
        lead_data: EnhancedLeadData, 
        strategy: CollectionStrategy
    ) -> List[QualificationQuestion]:
        """Generate questions to collect missing lead data."""
        questions = []
        
        # Check for missing contact info
        if not lead_data.email and not lead_data.phone:
            if strategy == CollectionStrategy.DIRECT:
                question_text = "What's the best way to follow up with you?"
            else:
                question_text = "If you'd like me to send you some additional information, what's the best way to reach you?"
            
            questions.append(QualificationQuestion(
                question=question_text,
                question_type="contact_collection",
                stage=QualificationStage.INITIAL_INTEREST,
                priority=1,
                context_dependent=False,
                follow_up_questions=["Would email or phone work better for you?"]
            ))
        
        # Check for missing company info
        if not lead_data.company:
            if strategy == CollectionStrategy.PROGRESSIVE:
                question_text = "What kind of organization are you with?"
            else:
                question_text = "What company are you with?"
            
            questions.append(QualificationQuestion(
                question=question_text,
                question_type="company_collection",
                stage=QualificationStage.NEED_ASSESSMENT,
                priority=2,
                context_dependent=False,
                follow_up_questions=["What's your role there?"]
            ))
        
        return questions
    
    async def _determine_collection_strategy(
        self, 
        lead_signals: List[LeadSignal], 
        engagement_level: float, 
        conversation_stage: QualificationStage
    ) -> CollectionStrategy:
        """Determine the best data collection strategy."""
        # High urgency or explicit buying intent -> Direct approach
        urgency_signals = [s for s in lead_signals if s.signal_type == "urgency_signals"]
        buying_signals = [s for s in lead_signals if s.signal_type == "buying_intent"]
        
        if urgency_signals or (buying_signals and engagement_level > 0.7):
            return CollectionStrategy.DIRECT
        
        # Medium engagement and some signals -> Conversational approach
        if engagement_level > 0.5 and len(lead_signals) > 2:
            return CollectionStrategy.CONVERSATIONAL
        
        # Low engagement or early stage -> Progressive approach
        return CollectionStrategy.PROGRESSIVE
    
    async def _calculate_urgency_score(
        self, 
        lead_signals: List[LeadSignal], 
        conversation_history: List[Dict[str, Any]]
    ) -> float:
        """Calculate urgency score based on signals and conversation."""
        urgency_signals = [s for s in lead_signals if s.signal_type == "urgency_signals"]
        
        if not urgency_signals:
            return 0.0
        
        # Base score from signal confidence
        base_score = sum(s.confidence for s in urgency_signals) / len(urgency_signals)
        
        # Boost score if multiple urgency indicators
        multiplier = min(2.0, 1.0 + (len(urgency_signals) - 1) * 0.2)
        
        return min(1.0, base_score * multiplier)
    
    async def _calculate_buying_intent_score(
        self, 
        lead_signals: List[LeadSignal], 
        conversation_history: List[Dict[str, Any]]
    ) -> float:
        """Calculate buying intent score."""
        intent_signals = [s for s in lead_signals if s.signal_type == "buying_intent"]
        authority_signals = [s for s in lead_signals if s.signal_type == "authority_indicators"]
        
        # Base score from buying intent signals
        base_score = 0.0
        if intent_signals:
            base_score = sum(s.confidence for s in intent_signals) / len(intent_signals)
        
        # Boost if authority is present
        if authority_signals:
            authority_boost = sum(s.confidence for s in authority_signals) / len(authority_signals)
            base_score = min(1.0, base_score + (authority_boost * 0.3))
        
        return base_score
    
    async def _determine_next_action(
        self, 
        conversation_stage: QualificationStage, 
        data_completeness: float, 
        urgency_score: float, 
        buying_intent_score: float
    ) -> str:
        """Determine the next best action for lead progression."""
        # High urgency + high intent -> Immediate escalation
        if urgency_score > 0.7 and buying_intent_score > 0.7:
            return "immediate_sales_escalation"
        
        # High intent but missing data -> Qualification focus
        if buying_intent_score > 0.6 and data_completeness < 0.5:
            return "accelerated_qualification"
        
        # Good data completeness -> Move to next stage
        if data_completeness > 0.7:
            stage_progression = {
                QualificationStage.INITIAL_INTEREST: "move_to_need_assessment",
                QualificationStage.NEED_ASSESSMENT: "move_to_budget_qualification",
                QualificationStage.BUDGET_QUALIFICATION: "move_to_authority_confirmation",
                QualificationStage.AUTHORITY_CONFIRMATION: "move_to_timeline_discussion",
                QualificationStage.TIMELINE_DISCUSSION: "move_to_final_qualification",
                QualificationStage.FINAL_QUALIFICATION: "schedule_demo_or_proposal"
            }
            return stage_progression.get(conversation_stage, "continue_nurturing")
        
        # Default -> Continue current stage
        return "continue_current_stage"
    
    async def _generate_qualification_questions(
        self, 
        conversation_stage: QualificationStage, 
        lead_signals: List[LeadSignal], 
        collection_strategy: CollectionStrategy
    ) -> List[QualificationQuestion]:
        """Generate qualification questions for the current stage."""
        # This is a simplified version - the full implementation would be more sophisticated
        base_questions = self.qualification_questions.get(conversation_stage, [])
        
        questions = []
        for q_data in base_questions[:2]:  # Limit to 2 questions
            question = QualificationQuestion(
                question=q_data["question"],
                question_type=q_data["type"],
                stage=conversation_stage,
                priority=q_data["priority"],
                context_dependent=True,
                follow_up_questions=q_data["follow_ups"]
            )
            questions.append(question)
        
        return questions
    
    def is_ready(self) -> bool:
        """Check if the enhanced lead analyzer is ready."""
        return (
            self._is_ready and 
            self.base_analyzer.is_ready() and
            self.conversation_intelligence.is_ready()
        )
    
    def get_service_info(self) -> Dict[str, Any]:
        """Get service information and status."""
        return {
            "service": "EnhancedLeadAnalyzer",
            "version": "1.0.0",
            "ready": self.is_ready(),
            "supported_strategies": [s.value for s in CollectionStrategy],
            "qualification_stages": [s.value for s in QualificationStage],
            "signal_types": list(self.lead_signals.keys()),
            "base_analyzer": self.base_analyzer.get_service_info()
        }


# Global service instance
_enhanced_lead_analyzer = None


def get_enhanced_lead_analyzer() -> EnhancedLeadAnalyzer:
    """
    Get the global enhanced lead analyzer instance.
    
    Returns:
        EnhancedLeadAnalyzer instance
    """
    global _enhanced_lead_analyzer
    
    if _enhanced_lead_analyzer is None:
        _enhanced_lead_analyzer = EnhancedLeadAnalyzer()
    
    return _enhanced_lead_analyzer