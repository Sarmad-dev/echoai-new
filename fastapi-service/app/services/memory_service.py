"""
Conversation memory service using LangChain for persistent conversation context.
"""
import logging
import json
from typing import Optional, List, Dict, Any
from datetime import datetime
from langchain.memory import ConversationBufferWindowMemory
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from supabase import create_client, Client
from app.config import settings

logger = logging.getLogger(__name__)


class ConversationMemoryManager:
    """
    Manages conversation memory using LangChain ConversationBufferWindowMemory
    with persistence to/from database using the ConversationSession table.
    """
    
    def __init__(self, session_id: str, k: int = 10):
        """
        Initialize the memory manager for a specific conversation session.
        
        Args:
            session_id: The conversation session ID
            k: Number of message exchanges to keep in memory window
        """
        self.session_id = session_id
        self.k = k
        self.memory = ConversationBufferWindowMemory(
            k=k,
            return_messages=True,
            memory_key="chat_history"
        )
        self.supabase_client: Optional[Client] = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Supabase client for memory persistence."""
        try:
            if settings.SUPABASE_URL and settings.SUPABASE_KEY:
                self.supabase_client = create_client(
                    settings.SUPABASE_URL,
                    settings.SUPABASE_KEY
                )
                logger.debug(f"Memory manager initialized for session {self.session_id}")
            else:
                logger.error("Supabase credentials not provided for memory service")
                raise ValueError("SUPABASE_URL and SUPABASE_KEY are required")
        except Exception as e:
            logger.error(f"Failed to initialize memory manager: {e}")
            raise
    
    async def load_memory(self) -> List[BaseMessage]:
        """
        Load conversation memory from database and populate LangChain memory.
        
        Returns:
            List of loaded messages
        """
        try:
            if not self.supabase_client:
                logger.warning("Supabase client not initialized, returning empty memory")
                return []
            
            # Get the conversation session and its memory buffer
            response = self.supabase_client.table("ConversationSession").select(
                "memoryBuffer"
            ).eq("id", self.session_id).execute()
            
            if not response.data:
                logger.debug(f"No memory buffer found for session {self.session_id}")
                return []
            
            memory_buffer = response.data[0].get("memoryBuffer")
            if not memory_buffer:
                logger.debug(f"Empty memory buffer for session {self.session_id}")
                return []
            
            # Reconstruct messages from memory buffer
            messages = []
            if "messages" in memory_buffer:
                for msg_data in memory_buffer["messages"]:
                    if msg_data["type"] == "human":
                        message = HumanMessage(content=msg_data["content"])
                    elif msg_data["type"] == "ai":
                        message = AIMessage(content=msg_data["content"])
                    else:
                        continue
                    messages.append(message)
            
            # Populate LangChain memory with loaded messages
            for i in range(0, len(messages), 2):
                if i + 1 < len(messages):
                    human_msg = messages[i]
                    ai_msg = messages[i + 1]
                    if isinstance(human_msg, HumanMessage) and isinstance(ai_msg, AIMessage):
                        self.memory.save_context(
                            {"input": human_msg.content},
                            {"output": ai_msg.content}
                        )
            
            logger.debug(f"Loaded {len(messages)} messages for session {self.session_id}")
            return messages
            
        except Exception as e:
            logger.error(f"Error loading memory for session {self.session_id}: {e}")
            return []
    
    async def save_memory(self, human_message: str, ai_message: str):
        """
        Update memory with new message exchange and persist to database.
        
        Args:
            human_message: The user's message
            ai_message: The AI's response
        """
        try:
            # Update LangChain memory
            self.memory.save_context(
                {"input": human_message},
                {"output": ai_message}
            )
            
            # Persist to database
            await self._persist_memory_to_db()
            
            logger.debug(f"Saved memory exchange for session {self.session_id}")
            
        except Exception as e:
            logger.error(f"Error saving memory for session {self.session_id}: {e}")
    
    async def _persist_memory_to_db(self):
        """Persist current memory state to database."""
        try:
            if not self.supabase_client:
                logger.warning("Supabase client not initialized, skipping memory persistence")
                return
            
            # Get current messages from memory
            messages = self.memory.chat_memory.messages
            
            # Convert messages to serializable format
            memory_buffer = {
                "messages": [],
                "updated_at": datetime.utcnow().isoformat()
            }
            
            for message in messages:
                if isinstance(message, HumanMessage):
                    memory_buffer["messages"].append({
                        "type": "human",
                        "content": message.content
                    })
                elif isinstance(message, AIMessage):
                    memory_buffer["messages"].append({
                        "type": "ai",
                        "content": message.content
                    })
            
            # Update the conversation session with new memory buffer
            response = self.supabase_client.table("ConversationSession").update({
                "memoryBuffer": memory_buffer,
                "updatedAt": datetime.utcnow().isoformat()
            }).eq("id", self.session_id).execute()
            
            if not response.data:
                logger.warning(f"Failed to persist memory for session {self.session_id}")
            
        except Exception as e:
            logger.error(f"Error persisting memory to database: {e}")
    
    def get_context_for_llm(self) -> str:
        """
        Format memory context for LLM consumption.
        
        Returns:
            Formatted conversation history string
        """
        try:
            messages = self.memory.chat_memory.messages
            if not messages:
                return ""
            
            context_parts = []
            for message in messages:
                if isinstance(message, HumanMessage):
                    context_parts.append(f"Human: {message.content}")
                elif isinstance(message, AIMessage):
                    context_parts.append(f"Assistant: {message.content}")
            
            return "\n".join(context_parts)
            
        except Exception as e:
            logger.error(f"Error formatting context for LLM: {e}")
            return ""
    
    def get_memory_variables(self) -> Dict[str, Any]:
        """
        Get memory variables for LangChain chain integration.
        
        Returns:
            Dictionary with memory variables
        """
        try:
            return self.memory.load_memory_variables({})
        except Exception as e:
            logger.error(f"Error getting memory variables: {e}")
            return {}
    
    def clear_memory(self):
        """Clear the conversation memory."""
        try:
            self.memory.clear()
            logger.debug(f"Cleared memory for session {self.session_id}")
        except Exception as e:
            logger.error(f"Error clearing memory: {e}")


class SessionManager:
    """
    Manages conversation sessions for external users.
    """
    
    def __init__(self):
        """Initialize the session manager."""
        self.supabase_client: Optional[Client] = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Supabase client."""
        try:
            if settings.SUPABASE_URL and settings.SUPABASE_KEY:
                self.supabase_client = create_client(
                    settings.SUPABASE_URL,
                    settings.SUPABASE_KEY
                )
                logger.info("Session manager initialized successfully")
            else:
                logger.error("Supabase credentials not provided for session manager")
                raise ValueError("SUPABASE_URL and SUPABASE_KEY are required")
        except Exception as e:
            logger.error(f"Failed to initialize session manager: {e}")
            raise
    
    async def get_or_create_external_user(self, email: str) -> Optional[str]:
        """
        Get or create an external user by email.
        
        Args:
            email: User's email address
            
        Returns:
            External user ID if successful, None otherwise
        """
        try:
            if not self.supabase_client:
                logger.error("Supabase client not initialized")
                return None
            
            # Try to get existing user
            response = self.supabase_client.table("ExternalUser").select(
                "id"
            ).eq("email", email).execute()
            
            if response.data:
                user_id = response.data[0]["id"]
                logger.debug(f"Found existing external user {user_id} for email {email}")
                return user_id
            
            # Create new external user
            response = self.supabase_client.table("ExternalUser").insert({
                "email": email,
                "createdAt": datetime.utcnow().isoformat(),
                "updatedAt": datetime.utcnow().isoformat()
            }).execute()
            
            if response.data:
                user_id = response.data[0]["id"]
                logger.info(f"Created new external user {user_id} for email {email}")
                return user_id
            
            logger.error(f"Failed to create external user for email {email}")
            return None
            
        except Exception as e:
            logger.error(f"Error getting/creating external user for {email}: {e}")
            return None
    
    async def get_or_create_session(
        self, 
        external_user_id: str, 
        chatbot_id: str
    ) -> Optional[str]:
        """
        Get or create a conversation session for an external user and chatbot.
        
        Args:
            external_user_id: The external user ID
            chatbot_id: The chatbot ID
            
        Returns:
            Session ID if successful, None otherwise
        """
        try:
            if not self.supabase_client:
                logger.error("Supabase client not initialized")
                return None
            
            # Try to get existing active session
            response = self.supabase_client.table("ConversationSession").select(
                "id"
            ).eq("externalUserId", external_user_id).eq(
                "chatbotId", chatbot_id
            ).eq("isActive", True).execute()
            
            if response.data:
                session_id = response.data[0]["id"]
                logger.debug(f"Found existing session {session_id}")
                return session_id
            
            # Create new session
            response = self.supabase_client.table("ConversationSession").insert({
                "externalUserId": external_user_id,
                "chatbotId": chatbot_id,
                "isActive": True,
                "createdAt": datetime.utcnow().isoformat(),
                "updatedAt": datetime.utcnow().isoformat()
            }).execute()
            
            if response.data:
                session_id = response.data[0]["id"]
                logger.info(f"Created new session {session_id}")
                return session_id
            
            logger.error("Failed to create conversation session")
            return None
            
        except Exception as e:
            logger.error(f"Error getting/creating session: {e}")
            return None


# Global instances
session_manager: Optional[SessionManager] = None


def get_session_manager() -> SessionManager:
    """Get the global session manager instance."""
    global session_manager
    if session_manager is None:
        session_manager = SessionManager()
    return session_manager


def create_memory_manager(session_id: str, k: int = 10) -> ConversationMemoryManager:
    """
    Create a new memory manager for a session.
    
    Args:
        session_id: The conversation session ID
        k: Number of message exchanges to keep in memory window
        
    Returns:
        ConversationMemoryManager instance
    """
    return ConversationMemoryManager(session_id, k)