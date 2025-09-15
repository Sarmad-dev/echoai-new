"""
Enhanced memory-aware conversational context service.
Provides sophisticated memory management, conversation summarization, 
user profile building, and contextual fact extraction.
"""
import logging
import json
import hashlib
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import redis
from supabase import create_client, Client

from app.config import settings

logger = logging.getLogger(__name__)


class MemoryType(str, Enum):
    """Types of memory storage."""
    SHORT_TERM = "short_term"
    LONG_TERM = "long_term"
    USER_PROFILE = "user_profile"
    CONTEXTUAL_FACTS = "contextual_facts"
    TOPIC_HISTORY = "topic_history"


@dataclass
class ConversationSummary:
    """Model for conversation summary."""
    conversation_id: str
    summary_text: str
    key_topics: List[str]
    user_goals: List[str]
    sentiment_trend: str
    message_count: int
    start_time: datetime
    end_time: datetime
    importance_score: float


@dataclass
class UserProfile:
    """Model for user profile built from conversation history."""
    user_id: str
    preferences: Dict[str, Any]
    communication_style: str
    technical_level: str
    common_questions: List[str]
    satisfaction_history: List[float]
    interaction_patterns: Dict[str, Any]
    last_updated: datetime


@dataclass
class ContextualFact:
    """Model for contextual facts extracted from conversations."""
    fact_id: str
    conversation_id: str
    fact_text: str
    fact_type: str  # 'preference', 'requirement', 'constraint', 'goal'
    confidence_score: float
    extracted_at: datetime
    relevance_score: float


@dataclass
class TopicTransition:
    """Model for topic transition tracking."""
    from_topic: Optional[str]
    to_topic: str
    transition_time: datetime
    transition_type: str  # 'natural', 'abrupt', 'clarification'
    context_maintained: bool


@dataclass
class ConversationMemory:
    """Comprehensive conversation memory model."""
    conversation_id: str
    short_term_memory: List[Dict[str, Any]]
    long_term_memory: List[ConversationSummary]
    user_profile: Optional[UserProfile]
    contextual_facts: List[ContextualFact]
    topic_history: List[TopicTransition]
    last_updated: datetime


class EnhancedMemoryService:
    """
    Enhanced memory service with sophisticated conversation context management.
    """
    
    def __init__(self):
        """Initialize the enhanced memory service."""
        self.redis_client: Optional[redis.Redis] = None
        self.supabase_client: Optional[Client] = None
        self._initialize_clients()
        
        # Memory configuration
        self.memory_window_size = settings.MEMORY_WINDOW_SIZE
        self.summary_threshold = settings.CONVERSATION_SUMMARY_THRESHOLD
        self.profile_retention_days = settings.USER_PROFILE_RETENTION_DAYS
        
        # Topic detection keywords
        self.topic_keywords = {
            "pricing": ["price", "cost", "pricing", "plan", "subscription", "fee", "payment"],
            "features": ["feature", "functionality", "capability", "what does", "how does", "can it"],
            "support": ["support", "help", "assistance", "customer service", "problem", "issue"],
            "integration": ["integrate", "api", "connect", "setup", "install", "configure"],
            "security": ["security", "secure", "privacy", "data protection", "encryption"],
            "performance": ["performance", "speed", "fast", "slow", "optimization", "latency"],
            "demo": ["demo", "demonstration", "show me", "trial", "test", "example"],
            "technical": ["technical", "code", "development", "programming", "implementation"],
            "business": ["business", "company", "organization", "team", "enterprise"],
            "general": ["general", "overview", "about", "information", "details"]
        }
        
        logger.info("Enhanced Memory service initialized")
    
    def _initialize_clients(self):
        """Initialize Redis and Supabase clients."""
        try:
            # Initialize Redis client
            if settings.REDIS_URL:
                self.redis_client = redis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5
                )
            else:
                self.redis_client = redis.Redis(
                    host=settings.REDIS_HOST,
                    port=settings.REDIS_PORT,
                    db=settings.REDIS_DB,
                    password=settings.REDIS_PASSWORD,
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5
                )
            
            # Test Redis connection
            self.redis_client.ping()
            logger.info("Redis client initialized successfully")
            
        except Exception as e:
            logger.warning(f"Failed to initialize Redis client: {e}")
            self.redis_client = None
        
        try:
            # Initialize Supabase client
            if settings.SUPABASE_URL and settings.SUPABASE_KEY:
                self.supabase_client = create_client(
                    settings.SUPABASE_URL,
                    settings.SUPABASE_KEY
                )
                logger.info("Enhanced Memory Supabase client initialized successfully")
            else:
                logger.warning("Supabase credentials not provided for enhanced memory service")
        except Exception as e:
            logger.error(f"Failed to initialize enhanced memory service: {e}")
    
    async def maintain_conversation_context(
        self,
        conversation_id: str,
        user_id: str,
        new_message: Dict[str, Any],
        ai_response: Dict[str, Any]
    ) -> ConversationMemory:
        """
        Maintain comprehensive conversation context with new message exchange.
        
        Args:
            conversation_id: Conversation ID
            user_id: User ID
            new_message: New user message data
            ai_response: AI response data
            
        Returns:
            Updated conversation memory
        """
        try:
            # Load existing memory
            memory = await self.load_conversation_memory(conversation_id, user_id)
            
            # Add new messages to short-term memory
            memory.short_term_memory.append({
                "role": "user",
                "content": new_message.get("content", ""),
                "timestamp": datetime.utcnow().isoformat(),
                "metadata": new_message.get("metadata", {})
            })
            
            memory.short_term_memory.append({
                "role": "assistant", 
                "content": ai_response.get("content", ""),
                "timestamp": datetime.utcnow().isoformat(),
                "metadata": ai_response.get("metadata", {})
            })
            
            # Maintain memory window size
            if len(memory.short_term_memory) > self.memory_window_size * 2:  # *2 for user+assistant pairs
                # Summarize older messages if threshold reached
                if len(memory.short_term_memory) > self.summary_threshold:
                    summary = await self.summarize_conversation_segment(
                        memory.short_term_memory[:self.memory_window_size]
                    )
                    memory.long_term_memory.append(summary)
                
                # Keep only recent messages in short-term memory
                memory.short_term_memory = memory.short_term_memory[-self.memory_window_size:]
            
            # Extract contextual facts from new messages
            new_facts = await self.extract_contextual_facts(
                conversation_id, new_message.get("content", ""), ai_response.get("content", "")
            )
            memory.contextual_facts.extend(new_facts)
            
            # Track topic transitions
            current_topic = await self.detect_current_topic(new_message.get("content", ""))
            if memory.topic_history:
                last_topic = memory.topic_history[-1].to_topic
                if current_topic != last_topic:
                    transition = TopicTransition(
                        from_topic=last_topic,
                        to_topic=current_topic,
                        transition_time=datetime.utcnow(),
                        transition_type=await self.classify_transition_type(last_topic, current_topic),
                        context_maintained=await self.assess_context_maintenance(
                            memory.short_term_memory[-4:] if len(memory.short_term_memory) >= 4 else memory.short_term_memory
                        )
                    )
                    memory.topic_history.append(transition)
            else:
                # First topic
                transition = TopicTransition(
                    from_topic=None,
                    to_topic=current_topic,
                    transition_time=datetime.utcnow(),
                    transition_type="initial",
                    context_maintained=True
                )
                memory.topic_history.append(transition)
            
            # Update user profile
            memory.user_profile = await self.update_user_profile(
                user_id, new_message, ai_response, memory.user_profile
            )
            
            # Update timestamp
            memory.last_updated = datetime.utcnow()
            
            # Store updated memory
            await self.store_conversation_memory(memory)
            
            return memory
            
        except Exception as e:
            logger.error(f"Error maintaining conversation context: {e}")
            # Return basic memory on error
            return ConversationMemory(
                conversation_id=conversation_id,
                short_term_memory=[],
                long_term_memory=[],
                user_profile=None,
                contextual_facts=[],
                topic_history=[],
                last_updated=datetime.utcnow()
            )
    
    async def load_conversation_memory(
        self,
        conversation_id: str,
        user_id: str
    ) -> ConversationMemory:
        """
        Load comprehensive conversation memory from storage.
        
        Args:
            conversation_id: Conversation ID
            user_id: User ID
            
        Returns:
            Conversation memory
        """
        try:
            # Try to load from Redis first (fast access)
            if self.redis_client:
                memory_key = f"conversation_memory:{conversation_id}"
                memory_data = self.redis_client.get(memory_key)
                
                if memory_data:
                    memory_dict = json.loads(memory_data)
                    return self._deserialize_memory(memory_dict)
            
            # Fallback to database
            if self.supabase_client:
                # Load conversation data
                response = self.supabase_client.table("Conversation").select(
                    "memoryBuffer"
                ).eq("id", conversation_id).execute()
                
                if response.data and response.data[0].get("memoryBuffer"):
                    memory_buffer = response.data[0]["memoryBuffer"]
                    return self._convert_legacy_memory(memory_buffer, conversation_id, user_id)
            
            # Return empty memory if nothing found
            return ConversationMemory(
                conversation_id=conversation_id,
                short_term_memory=[],
                long_term_memory=[],
                user_profile=await self.load_user_profile(user_id),
                contextual_facts=[],
                topic_history=[],
                last_updated=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Error loading conversation memory: {e}")
            return ConversationMemory(
                conversation_id=conversation_id,
                short_term_memory=[],
                long_term_memory=[],
                user_profile=None,
                contextual_facts=[],
                topic_history=[],
                last_updated=datetime.utcnow()
            )
    
    async def store_conversation_memory(self, memory: ConversationMemory):
        """
        Store conversation memory to Redis and database.
        
        Args:
            memory: Conversation memory to store
        """
        try:
            memory_dict = self._serialize_memory(memory)
            
            # Store in Redis for fast access
            if self.redis_client:
                memory_key = f"conversation_memory:{memory.conversation_id}"
                self.redis_client.setex(
                    memory_key,
                    timedelta(hours=24),  # 24-hour expiry
                    json.dumps(memory_dict, default=str)
                )
            
            # Store in database for persistence
            if self.supabase_client:
                # Update conversation session with enhanced memory
                enhanced_memory_buffer = {
                    "short_term_memory": memory.short_term_memory,
                    "summary_count": len(memory.long_term_memory),
                    "facts_count": len(memory.contextual_facts),
                    "topics_count": len(memory.topic_history),
                    "last_updated": memory.last_updated.isoformat()
                }
                
                self.supabase_client.table("Conversation").update({
                    "memoryBuffer": enhanced_memory_buffer,
                    "updatedAt": datetime.utcnow().isoformat()
                }).eq("id", memory.conversation_id).execute()
                
                # Store detailed memory components separately
                await self._store_memory_components(memory)
            
        except Exception as e:
            logger.error(f"Error storing conversation memory: {e}")
    
    async def summarize_conversation_segment(
        self,
        messages: List[Dict[str, Any]]
    ) -> ConversationSummary:
        """
        Summarize a segment of conversation for long-term memory.
        
        Args:
            messages: List of messages to summarize
            
        Returns:
            Conversation summary
        """
        try:
            if not messages:
                return ConversationSummary(
                    conversation_id="",
                    summary_text="Empty conversation segment",
                    key_topics=[],
                    user_goals=[],
                    sentiment_trend="neutral",
                    message_count=0,
                    start_time=datetime.utcnow(),
                    end_time=datetime.utcnow(),
                    importance_score=0.0
                )
            
            # Extract key information
            user_messages = [msg for msg in messages if msg.get("role") == "user"]
            assistant_messages = [msg for msg in messages if msg.get("role") == "assistant"]
            
            # Generate summary text
            summary_parts = []
            if user_messages:
                summary_parts.append(f"User discussed: {', '.join([msg['content'][:50] + '...' if len(msg['content']) > 50 else msg['content'] for msg in user_messages[:3]])}")
            
            if assistant_messages:
                summary_parts.append(f"Assistant provided information about: {', '.join([self._extract_key_phrases(msg['content']) for msg in assistant_messages[:3]])}")
            
            summary_text = " | ".join(summary_parts)
            
            # Extract topics and goals
            all_content = " ".join([msg.get("content", "") for msg in messages])
            key_topics = await self.extract_topics_from_text(all_content)
            user_goals = await self.extract_user_goals_from_text(all_content)
            
            # Analyze sentiment trend
            sentiment_trend = await self.analyze_sentiment_trend(messages)
            
            # Calculate importance score
            importance_score = await self.calculate_importance_score(messages, key_topics, user_goals)
            
            return ConversationSummary(
                conversation_id=messages[0].get("conversation_id", ""),
                summary_text=summary_text,
                key_topics=key_topics,
                user_goals=user_goals,
                sentiment_trend=sentiment_trend,
                message_count=len(messages),
                start_time=datetime.fromisoformat(messages[0].get("timestamp", datetime.utcnow().isoformat())),
                end_time=datetime.fromisoformat(messages[-1].get("timestamp", datetime.utcnow().isoformat())),
                importance_score=importance_score
            )
            
        except Exception as e:
            logger.error(f"Error summarizing conversation segment: {e}")
            return ConversationSummary(
                conversation_id="",
                summary_text="Error generating summary",
                key_topics=[],
                user_goals=[],
                sentiment_trend="neutral",
                message_count=len(messages),
                start_time=datetime.utcnow(),
                end_time=datetime.utcnow(),
                importance_score=0.0
            )
    
    async def load_user_profile(self, user_id: str) -> Optional[UserProfile]:
        """
        Load user profile from storage.
        
        Args:
            user_id: User ID
            
        Returns:
            User profile if found
        """
        try:
            # Try Redis first
            if self.redis_client:
                profile_key = f"user_profile:{user_id}"
                profile_data = self.redis_client.get(profile_key)
                
                if profile_data:
                    profile_dict = json.loads(profile_data)
                    return UserProfile(**profile_dict)
            
            # Fallback to database
            if self.supabase_client:
                # In a real implementation, you'd have a user_profiles table
                # For now, return a basic profile
                pass
            
            return None
            
        except Exception as e:
            logger.error(f"Error loading user profile: {e}")
            return None
    
    async def update_user_profile(
        self,
        user_id: str,
        user_message: Dict[str, Any],
        ai_response: Dict[str, Any],
        existing_profile: Optional[UserProfile]
    ) -> UserProfile:
        """
        Update user profile based on conversation data.
        
        Args:
            user_id: User ID
            user_message: User message data
            ai_response: AI response data
            existing_profile: Existing user profile
            
        Returns:
            Updated user profile
        """
        try:
            if existing_profile:
                profile = existing_profile
            else:
                profile = UserProfile(
                    user_id=user_id,
                    preferences={},
                    communication_style="neutral",
                    technical_level="intermediate",
                    common_questions=[],
                    satisfaction_history=[],
                    interaction_patterns={},
                    last_updated=datetime.utcnow()
                )
            
            # Update communication style
            message_content = user_message.get("content", "")
            profile.communication_style = await self.analyze_communication_style(message_content)
            
            # Update technical level
            profile.technical_level = await self.assess_technical_level(message_content)
            
            # Track common questions
            if "?" in message_content:
                question = message_content.strip()
                if question not in profile.common_questions:
                    profile.common_questions.append(question)
                    # Keep only recent questions
                    profile.common_questions = profile.common_questions[-10:]
            
            # Update satisfaction based on response metadata
            if ai_response.get("metadata", {}).get("sentiment_score"):
                satisfaction = max(0.0, min(1.0, (ai_response["metadata"]["sentiment_score"] + 1) / 2))
                profile.satisfaction_history.append(satisfaction)
                profile.satisfaction_history = profile.satisfaction_history[-20:]  # Keep recent history
            
            # Update interaction patterns
            current_hour = datetime.utcnow().hour
            profile.interaction_patterns["preferred_hours"] = profile.interaction_patterns.get("preferred_hours", {})
            profile.interaction_patterns["preferred_hours"][str(current_hour)] = profile.interaction_patterns["preferred_hours"].get(str(current_hour), 0) + 1
            
            # Update timestamp
            profile.last_updated = datetime.utcnow()
            
            # Store updated profile
            await self.store_user_profile(profile)
            
            return profile
            
        except Exception as e:
            logger.error(f"Error updating user profile: {e}")
            return existing_profile or UserProfile(
                user_id=user_id,
                preferences={},
                communication_style="neutral",
                technical_level="intermediate",
                common_questions=[],
                satisfaction_history=[],
                interaction_patterns={},
                last_updated=datetime.utcnow()
            )
    
    async def store_user_profile(self, profile: UserProfile):
        """
        Store user profile to Redis and database.
        
        Args:
            profile: User profile to store
        """
        try:
            profile_dict = asdict(profile)
            
            # Store in Redis
            if self.redis_client:
                profile_key = f"user_profile:{profile.user_id}"
                self.redis_client.setex(
                    profile_key,
                    timedelta(days=self.profile_retention_days),
                    json.dumps(profile_dict, default=str)
                )
            
            # Store in database (would need user_profiles table in real implementation)
            # For now, we'll just log it
            logger.debug(f"User profile updated for user {profile.user_id}")
            
        except Exception as e:
            logger.error(f"Error storing user profile: {e}")
    
    async def extract_contextual_facts(
        self,
        conversation_id: str,
        user_message: str,
        ai_response: str
    ) -> List[ContextualFact]:
        """
        Extract contextual facts from conversation messages.
        
        Args:
            conversation_id: Conversation ID
            user_message: User message content
            ai_response: AI response content
            
        Returns:
            List of extracted contextual facts
        """
        try:
            facts = []
            
            # Extract preferences
            preference_indicators = ["prefer", "like", "want", "need", "don't like", "avoid"]
            for indicator in preference_indicators:
                if indicator in user_message.lower():
                    fact = ContextualFact(
                        fact_id=self._generate_fact_id(conversation_id, user_message),
                        conversation_id=conversation_id,
                        fact_text=user_message,
                        fact_type="preference",
                        confidence_score=0.8,
                        extracted_at=datetime.utcnow(),
                        relevance_score=0.7
                    )
                    facts.append(fact)
            
            # Extract requirements
            requirement_indicators = ["must", "required", "need to", "have to", "essential"]
            for indicator in requirement_indicators:
                if indicator in user_message.lower():
                    fact = ContextualFact(
                        fact_id=self._generate_fact_id(conversation_id, user_message),
                        conversation_id=conversation_id,
                        fact_text=user_message,
                        fact_type="requirement",
                        confidence_score=0.9,
                        extracted_at=datetime.utcnow(),
                        relevance_score=0.8
                    )
                    facts.append(fact)
            
            # Extract goals
            goal_indicators = ["goal", "objective", "trying to", "want to achieve", "looking for"]
            for indicator in goal_indicators:
                if indicator in user_message.lower():
                    fact = ContextualFact(
                        fact_id=self._generate_fact_id(conversation_id, user_message),
                        conversation_id=conversation_id,
                        fact_text=user_message,
                        fact_type="goal",
                        confidence_score=0.8,
                        extracted_at=datetime.utcnow(),
                        relevance_score=0.9
                    )
                    facts.append(fact)
            
            return facts
            
        except Exception as e:
            logger.error(f"Error extracting contextual facts: {e}")
            return []
    
    async def retrieve_relevant_history(
        self,
        current_message: str,
        user_id: str,
        conversation_id: str,
        max_items: int = 5
    ) -> Dict[str, Any]:
        """
        Retrieve relevant conversation history for current message.
        
        Args:
            current_message: Current user message
            user_id: User ID
            conversation_id: Conversation ID
            max_items: Maximum number of items to retrieve
            
        Returns:
            Relevant history data
        """
        try:
            memory = await self.load_conversation_memory(conversation_id, user_id)
            
            # Get current topic
            current_topic = await self.detect_current_topic(current_message)
            
            # Find relevant facts
            relevant_facts = []
            for fact in memory.contextual_facts:
                if current_topic in fact.fact_text.lower() or any(
                    keyword in fact.fact_text.lower() 
                    for keyword in current_message.lower().split()[:5]
                ):
                    relevant_facts.append(fact)
            
            # Sort by relevance and recency
            relevant_facts.sort(key=lambda x: (x.relevance_score, x.extracted_at), reverse=True)
            relevant_facts = relevant_facts[:max_items]
            
            # Find relevant summaries
            relevant_summaries = []
            for summary in memory.long_term_memory:
                if current_topic in summary.key_topics or any(
                    keyword in summary.summary_text.lower()
                    for keyword in current_message.lower().split()[:5]
                ):
                    relevant_summaries.append(summary)
            
            relevant_summaries.sort(key=lambda x: x.importance_score, reverse=True)
            relevant_summaries = relevant_summaries[:max_items]
            
            # Get recent context
            recent_context = memory.short_term_memory[-10:] if memory.short_term_memory else []
            
            return {
                "recent_context": recent_context,
                "relevant_facts": [asdict(fact) for fact in relevant_facts],
                "relevant_summaries": [asdict(summary) for summary in relevant_summaries],
                "user_profile": asdict(memory.user_profile) if memory.user_profile else None,
                "current_topic": current_topic,
                "topic_history": [asdict(transition) for transition in memory.topic_history[-5:]]
            }
            
        except Exception as e:
            logger.error(f"Error retrieving relevant history: {e}")
            return {
                "recent_context": [],
                "relevant_facts": [],
                "relevant_summaries": [],
                "user_profile": None,
                "current_topic": "general",
                "topic_history": []
            }
    
    async def get_context_for_llm(
        self,
        conversation_id: str,
        user_id: str,
        current_message: str
    ) -> str:
        """
        Format conversation context for LLM consumption.
        
        Args:
            conversation_id: Conversation ID
            user_id: User ID
            current_message: Current user message
            
        Returns:
            Formatted context string
        """
        try:
            relevant_history = await self.retrieve_relevant_history(
                current_message, user_id, conversation_id
            )
            
            context_parts = []
            
            # Add user profile context
            if relevant_history["user_profile"]:
                profile = relevant_history["user_profile"]
                context_parts.append(f"User Profile: Communication style: {profile['communication_style']}, Technical level: {profile['technical_level']}")
            
            # Add relevant facts
            if relevant_history["relevant_facts"]:
                facts_text = "; ".join([fact["fact_text"][:100] for fact in relevant_history["relevant_facts"][:3]])
                context_parts.append(f"User Context: {facts_text}")
            
            # Add recent conversation
            if relevant_history["recent_context"]:
                recent_messages = []
                for msg in relevant_history["recent_context"][-6:]:
                    role = "User" if msg["role"] == "user" else "Assistant"
                    recent_messages.append(f"{role}: {msg['content'][:100]}")
                context_parts.append(f"Recent Conversation:\n{chr(10).join(recent_messages)}")
            
            # Add relevant summaries
            if relevant_history["relevant_summaries"]:
                summary_text = "; ".join([summary["summary_text"][:100] for summary in relevant_history["relevant_summaries"][:2]])
                context_parts.append(f"Previous Discussion: {summary_text}")
            
            return "\n\n".join(context_parts)
            
        except Exception as e:
            logger.error(f"Error formatting context for LLM: {e}")
            return ""
    
    # Helper methods
    
    async def detect_current_topic(self, message: str) -> str:
        """Detect the current topic from message content."""
        message_lower = message.lower()
        
        for topic, keywords in self.topic_keywords.items():
            if any(keyword in message_lower for keyword in keywords):
                return topic
        
        return "general"
    
    async def classify_transition_type(self, from_topic: str, to_topic: str) -> str:
        """Classify the type of topic transition."""
        if not from_topic:
            return "initial"
        
        # Related topics have natural transitions
        related_topics = {
            "pricing": ["features", "demo", "business"],
            "features": ["pricing", "technical", "demo"],
            "support": ["technical", "general"],
            "integration": ["technical", "features"],
            "demo": ["pricing", "features", "business"]
        }
        
        if to_topic in related_topics.get(from_topic, []):
            return "natural"
        elif to_topic == from_topic:
            return "clarification"
        else:
            return "abrupt"
    
    async def assess_context_maintenance(self, recent_messages: List[Dict[str, Any]]) -> bool:
        """Assess whether context is maintained across topic transition."""
        if len(recent_messages) < 2:
            return True
        
        # Simple heuristic: if messages reference previous content, context is maintained
        for i in range(1, len(recent_messages)):
            current_content = recent_messages[i].get("content", "").lower()
            previous_content = recent_messages[i-1].get("content", "").lower()
            
            # Check for reference words
            reference_words = ["that", "this", "it", "also", "additionally", "furthermore"]
            if any(word in current_content for word in reference_words):
                return True
        
        return False
    
    async def analyze_communication_style(self, message: str) -> str:
        """Analyze user's communication style."""
        message_lower = message.lower()
        
        if any(word in message_lower for word in ["please", "thank", "appreciate", "kindly"]):
            return "polite"
        elif any(word in message_lower for word in ["quick", "fast", "urgent", "asap"]):
            return "direct"
        elif len(message) > 200:
            return "detailed"
        elif "?" in message and len(message.split("?")) > 2:
            return "inquisitive"
        else:
            return "neutral"
    
    async def assess_technical_level(self, message: str) -> str:
        """Assess user's technical level from message content."""
        message_lower = message.lower()
        
        technical_terms = ["api", "integration", "code", "development", "programming", "database", "server"]
        business_terms = ["roi", "implementation", "deployment", "enterprise", "scalability"]
        basic_terms = ["how to", "what is", "can you", "help me", "simple"]
        
        technical_count = sum(1 for term in technical_terms if term in message_lower)
        business_count = sum(1 for term in business_terms if term in message_lower)
        basic_count = sum(1 for term in basic_terms if term in message_lower)
        
        if technical_count >= 2:
            return "advanced"
        elif business_count >= 1:
            return "business"
        elif basic_count >= 1:
            return "beginner"
        else:
            return "intermediate"
    
    async def extract_topics_from_text(self, text: str) -> List[str]:
        """Extract topics from text content."""
        text_lower = text.lower()
        topics = []
        
        for topic, keywords in self.topic_keywords.items():
            if any(keyword in text_lower for keyword in keywords):
                topics.append(topic)
        
        return list(set(topics))
    
    async def extract_user_goals_from_text(self, text: str) -> List[str]:
        """Extract user goals from text content."""
        text_lower = text.lower()
        goals = []
        
        goal_patterns = {
            "evaluate_solution": ["evaluate", "compare", "assess", "review"],
            "solve_problem": ["solve", "fix", "resolve", "address"],
            "learn_more": ["learn", "understand", "know", "information"],
            "make_decision": ["decide", "choose", "select", "pick"],
            "implement": ["implement", "deploy", "setup", "install"],
            "get_support": ["help", "support", "assistance", "guidance"]
        }
        
        for goal, patterns in goal_patterns.items():
            if any(pattern in text_lower for pattern in patterns):
                goals.append(goal)
        
        return list(set(goals))
    
    async def analyze_sentiment_trend(self, messages: List[Dict[str, Any]]) -> str:
        """Analyze sentiment trend across messages."""
        # Simple sentiment analysis based on keywords
        positive_words = ["good", "great", "excellent", "perfect", "thanks", "helpful"]
        negative_words = ["bad", "terrible", "awful", "frustrated", "confused", "problem"]
        
        sentiment_scores = []
        for msg in messages:
            if msg.get("role") == "user":
                content = msg.get("content", "").lower()
                positive_count = sum(1 for word in positive_words if word in content)
                negative_count = sum(1 for word in negative_words if word in content)
                
                if positive_count > negative_count:
                    sentiment_scores.append(1)
                elif negative_count > positive_count:
                    sentiment_scores.append(-1)
                else:
                    sentiment_scores.append(0)
        
        if not sentiment_scores:
            return "neutral"
        
        avg_sentiment = sum(sentiment_scores) / len(sentiment_scores)
        
        if avg_sentiment > 0.3:
            return "positive"
        elif avg_sentiment < -0.3:
            return "negative"
        else:
            return "neutral"
    
    async def calculate_importance_score(
        self,
        messages: List[Dict[str, Any]],
        topics: List[str],
        goals: List[str]
    ) -> float:
        """Calculate importance score for conversation segment."""
        score = 0.5  # Base score
        
        # More messages = higher importance
        score += min(0.2, len(messages) * 0.02)
        
        # Business-related topics increase importance
        business_topics = ["pricing", "demo", "business", "integration"]
        if any(topic in business_topics for topic in topics):
            score += 0.3
        
        # Clear goals increase importance
        if goals:
            score += min(0.2, len(goals) * 0.1)
        
        # Questions increase importance
        question_count = sum(1 for msg in messages if "?" in msg.get("content", ""))
        score += min(0.1, question_count * 0.02)
        
        return max(0.0, min(1.0, score))
    
    def _extract_key_phrases(self, text: str) -> str:
        """Extract key phrases from text."""
        # Simple extraction of first few words
        words = text.split()[:5]
        return " ".join(words) + ("..." if len(text.split()) > 5 else "")
    
    def _generate_fact_id(self, conversation_id: str, content: str) -> str:
        """Generate unique fact ID."""
        content_hash = hashlib.md5(content.encode()).hexdigest()[:8]
        return f"{conversation_id}_{content_hash}"
    
    def _serialize_memory(self, memory: ConversationMemory) -> Dict[str, Any]:
        """Serialize memory object to dictionary."""
        return {
            "conversation_id": memory.conversation_id,
            "short_term_memory": memory.short_term_memory,
            "long_term_memory": [asdict(summary) for summary in memory.long_term_memory],
            "user_profile": asdict(memory.user_profile) if memory.user_profile else None,
            "contextual_facts": [asdict(fact) for fact in memory.contextual_facts],
            "topic_history": [asdict(transition) for transition in memory.topic_history],
            "last_updated": memory.last_updated.isoformat()
        }
    
    def _deserialize_memory(self, memory_dict: Dict[str, Any]) -> ConversationMemory:
        """Deserialize dictionary to memory object."""
        return ConversationMemory(
            conversation_id=memory_dict["conversation_id"],
            short_term_memory=memory_dict["short_term_memory"],
            long_term_memory=[
                ConversationSummary(**summary) for summary in memory_dict["long_term_memory"]
            ],
            user_profile=UserProfile(**memory_dict["user_profile"]) if memory_dict["user_profile"] else None,
            contextual_facts=[
                ContextualFact(**fact) for fact in memory_dict["contextual_facts"]
            ],
            topic_history=[
                TopicTransition(**transition) for transition in memory_dict["topic_history"]
            ],
            last_updated=datetime.fromisoformat(memory_dict["last_updated"])
        )
    
    def _convert_legacy_memory(
        self,
        legacy_buffer: Dict[str, Any],
        conversation_id: str,
        user_id: str
    ) -> ConversationMemory:
        """Convert legacy memory buffer to enhanced memory format."""
        short_term_memory = []
        
        if "messages" in legacy_buffer:
            for msg in legacy_buffer["messages"]:
                short_term_memory.append({
                    "role": "user" if msg["type"] == "human" else "assistant",
                    "content": msg["content"],
                    "timestamp": datetime.utcnow().isoformat(),
                    "metadata": {}
                })
        
        return ConversationMemory(
            conversation_id=conversation_id,
            short_term_memory=short_term_memory,
            long_term_memory=[],
            user_profile=None,
            contextual_facts=[],
            topic_history=[],
            last_updated=datetime.utcnow()
        )
    
    async def _store_memory_components(self, memory: ConversationMemory):
        """Store detailed memory components to database."""
        try:
            # In a real implementation, you would store these in separate tables
            # For now, we'll just log the storage
            logger.debug(f"Storing memory components for conversation {memory.conversation_id}")
            logger.debug(f"- {len(memory.long_term_memory)} summaries")
            logger.debug(f"- {len(memory.contextual_facts)} facts")
            logger.debug(f"- {len(memory.topic_history)} topic transitions")
            
        except Exception as e:
            logger.error(f"Error storing memory components: {e}")
    
    def is_ready(self) -> bool:
        """Check if the enhanced memory service is ready."""
        return self.redis_client is not None or self.supabase_client is not None
    
    def get_service_info(self) -> Dict[str, Any]:
        """Get information about the enhanced memory service configuration."""
        return {
            "redis_client_ready": self.redis_client is not None,
            "supabase_client_ready": self.supabase_client is not None,
            "memory_window_size": self.memory_window_size,
            "summary_threshold": self.summary_threshold,
            "profile_retention_days": self.profile_retention_days,
            "service_ready": self.is_ready()
        }


# Global enhanced memory service instance
enhanced_memory_service: Optional[EnhancedMemoryService] = None


def get_enhanced_memory_service() -> EnhancedMemoryService:
    """Get the global enhanced memory service instance."""
    global enhanced_memory_service
    if enhanced_memory_service is None:
        enhanced_memory_service = EnhancedMemoryService()
    return enhanced_memory_service