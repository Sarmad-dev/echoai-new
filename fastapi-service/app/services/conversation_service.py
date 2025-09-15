"""
Conversation service for managing chat conversations and message history.
"""
import logging
import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime
from supabase import create_client, Client
from app.config import settings
from app.models.chat import ConversationMessage

logger = logging.getLogger(__name__)


class ConversationService:
    """Service for managing conversations and message history."""
    
    def __init__(self):
        """Initialize the conversation service with Supabase client."""
        self.supabase_client: Optional[Client] = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Supabase client for conversation operations."""
        try:
            if settings.SUPABASE_URL and settings.SUPABASE_KEY:
                self.supabase_client = create_client(
                    settings.SUPABASE_URL,
                    settings.SUPABASE_KEY
                )
                logger.info("Conversation service Supabase client initialized successfully")
            else:
                logger.error("Supabase credentials not provided for conversation service")
                raise ValueError("SUPABASE_URL and SUPABASE_KEY are required")
        except Exception as e:
            logger.error(f"Failed to initialize conversation service: {e}")
            raise
    
    async def create_conversation(self, user_id: str, external_user_email: str = None, customer_email: str = None) -> str:
        """
        Create a new conversation for a user.
        
        Args:
            user_id: The user ID
            external_user_email: Optional external user email for widget conversations
            customer_email: Optional customer email for the conversation
            
        Returns:
            Conversation ID
        """
        try:
            if not self.supabase_client:
                logger.error("Supabase client not initialized")
                raise RuntimeError("Conversation service not properly initialized")
            
            conversation_id = f"conv_{uuid.uuid4()}"
            
            # Handle external user if email provided
            external_user_id = None
            if external_user_email:
                external_user_id = await self._get_or_create_external_user(external_user_email)
            
            # Prepare conversation data
            conversation_data = {
                "id": conversation_id,
                "userId": user_id,
                "memoryBuffer": None,  # Initialize empty memory buffer
                "createdAt": datetime.utcnow().isoformat(),
                "updatedAt": datetime.utcnow().isoformat()
            }
            
            # Add external user ID if provided
            if external_user_id:
                conversation_data["externalUserId"] = external_user_id
            
            # Add customer email if provided
            if customer_email:
                conversation_data["customerEmail"] = customer_email
            
            # Insert new conversation
            response = self.supabase_client.table("Conversation").insert(conversation_data).execute()
            
            if response.data:
                logger.info(f"Created conversation {conversation_id} for user {user_id}")
                return conversation_id
            else:
                logger.error(f"Failed to create conversation: {response}")
                raise RuntimeError("Failed to create conversation")
                
        except Exception as e:
            logger.error(f"Error creating conversation: {e}")
            # Return a temporary conversation ID as fallback
            return f"temp_conv_{uuid.uuid4()}"
    
    async def create_conversation_with_id(self, conversation_id: str, user_id: str, chatbot_id: str = None, external_user_email: str = None, customer_email: str = None) -> str:
        """
        Create a new conversation with a specific ID for a user.
        
        Args:
            conversation_id: The specific conversation ID to use
            user_id: The user ID
            chatbot_id: Optional chatbot ID for widget conversations
            external_user_email: Optional external user email for widget conversations
            customer_email: Optional customer email for the conversation
            
        Returns:
            Conversation ID
        """
        try:
            if not self.supabase_client:
                logger.error("Supabase client not initialized")
                raise RuntimeError("Conversation service not properly initialized")
            
            # Handle external user if email provided
            external_user_id = None
            if external_user_email:
                external_user_id = await self._get_or_create_external_user(external_user_email)
            
            # Insert new conversation with specific ID
            conversation_data = {
                "id": conversation_id,
                "userId": user_id,
                "memoryBuffer": None,  # Initialize empty memory buffer
                "createdAt": datetime.utcnow().isoformat(),
                "updatedAt": datetime.utcnow().isoformat()
            }
            
            # Add chatbot_id if provided
            if chatbot_id:
                conversation_data["chatbotId"] = chatbot_id
            
            # Add external user ID if provided
            if external_user_id:
                conversation_data["externalUserId"] = external_user_id
            
            # Add customer email if provided
            if customer_email:
                conversation_data["customerEmail"] = customer_email
                
            response = self.supabase_client.table("Conversation").insert(conversation_data).execute()
            
            if response.data:
                logger.info(f"Created conversation {conversation_id} for user {user_id}")
                return conversation_id
            else:
                logger.error(f"Failed to create conversation with ID {conversation_id}: {response}")
                raise RuntimeError(f"Failed to create conversation with ID {conversation_id}")
                
        except Exception as e:
            logger.error(f"Error creating conversation with ID {conversation_id}: {e}")
            raise
    
    async def message_exists(
        self,
        conversation_id: str,
        role: str,
        content: str
    ) -> bool:
        """
        Check if a message with the same content and role already exists in the conversation.
        
        Args:
            conversation_id: The conversation ID
            role: Message role ('user' or 'assistant')
            content: Message content
            
        Returns:
            True if message already exists
        """
        try:
            if not self.supabase_client:
                return False
            
            response = self.supabase_client.table("Message").select(
                "id"
            ).eq("conversationId", conversation_id).eq("role", role).eq("content", content).execute()
            
            exists = response.data and len(response.data) > 0
            if exists:
                logger.debug(f"Message already exists in conversation {conversation_id}: {content[:50]}...")
            return exists
            
        except Exception as e:
            logger.error(f"Error checking message existence: {e}")
            return False

    async def save_message(
        self, 
        conversation_id: str, 
        role: str, 
        content: str, 
        sentiment: Optional[str] = None,
        sentiment_score: Optional[float] = None,
        triggers_detected: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = None
    ) -> Optional[str]:
        """
        Save a message to the conversation.
        
        Args:
            conversation_id: The conversation ID
            role: Message role ('user' or 'assistant')
            content: Message content
            sentiment: Optional sentiment analysis result
            sentiment_score: Optional sentiment score (-1.0 to 1.0)
            triggers_detected: Optional list of automation triggers detected
            metadata: Optional message metadata
            session_id: Optional session ID for memory persistence
            
        Returns:
            Message ID if successful, None if failed
        """
        try:
            if not self.supabase_client:
                logger.warning("Supabase client not initialized, skipping message save")
                return None
            
            # Check if message already exists to prevent duplicates
            if await self.message_exists(conversation_id, role, content):
                logger.debug(f"Message already exists, skipping save: {content[:50]}...")
                return None
            
            message_id = f"msg_{uuid.uuid4()}"
            
            # Prepare metadata with triggers if provided
            message_metadata = metadata or {}
            if triggers_detected:
                message_metadata["triggers_detected"] = triggers_detected
            
            # Insert message
            message_data = {
                "id": message_id,
                "conversationId": conversation_id,
                "content": content,
                "role": role,
                "sentiment": sentiment,
                "sentimentScore": sentiment_score,
                "metadata": message_metadata if message_metadata else None,
                "createdAt": datetime.utcnow().isoformat()
            }
            
            # Add session_id if provided
            if session_id:
                message_data["sessionId"] = session_id
                
            response = self.supabase_client.table("Message").insert(message_data).execute()
            
            if response.data:
                logger.debug(f"Saved message {message_id} to conversation {conversation_id}")
                return message_id
            else:
                logger.warning(f"Failed to save message: {response}")
                return None
                
        except Exception as e:
            logger.error(f"Error saving message: {e}")
            return None
    
    async def get_conversation_history(
        self, 
        conversation_id: str, 
        limit: int = 10
    ) -> List[ConversationMessage]:
        """
        Get conversation history.
        
        Args:
            conversation_id: The conversation ID
            limit: Maximum number of messages to retrieve
            
        Returns:
            List of conversation messages
        """
        try:
            if not self.supabase_client:
                logger.warning("Supabase client not initialized, returning empty history")
                return []
            
            # Get messages for the conversation
            response = self.supabase_client.table("Message").select(
                "id, conversationId, content, role, sentiment, createdAt"
            ).eq("conversationId", conversation_id).order(
                "createdAt", desc=False
            ).limit(limit).execute()
            
            if response.data:
                messages = []
                for msg_data in response.data:
                    message = ConversationMessage(
                        id=msg_data["id"],
                        conversation_id=msg_data["conversationId"],
                        role=msg_data["role"],
                        content=msg_data["content"],
                        sentiment=msg_data.get("sentiment"),
                        metadata={"timestamp": msg_data["createdAt"]}
                    )
                    messages.append(message)
                
                logger.debug(f"Retrieved {len(messages)} messages for conversation {conversation_id}")
                return messages
            else:
                logger.debug(f"No messages found for conversation {conversation_id}")
                return []
                
        except Exception as e:
            logger.error(f"Error getting conversation history: {e}")
            return []
    
    async def conversation_exists(self, conversation_id: str, user_id: str) -> bool:
        """
        Check if a conversation exists and belongs to the user.
        
        Args:
            conversation_id: The conversation ID
            user_id: The user ID
            
        Returns:
            True if conversation exists and belongs to user
        """
        try:
            if not self.supabase_client:
                logger.warning("Supabase client not initialized")
                return False
            
            response = self.supabase_client.table("Conversation").select(
                "id"
            ).eq("id", conversation_id).eq("userId", user_id).execute()
            
            exists = response.data and len(response.data) > 0
            logger.debug(f"Conversation {conversation_id} exists for user {user_id}: {exists}")
            return exists
            
        except Exception as e:
            logger.error(f"Error checking conversation existence: {e}")
            return False
    
    def is_ready(self) -> bool:
        """Check if the conversation service is ready."""
        return self.supabase_client is not None
    
    async def get_memory_buffer(self, conversation_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the memory buffer for a conversation.
        
        Args:
            conversation_id: The conversation ID
            
        Returns:
            Memory buffer data or None if not found
        """
        try:
            if not self.supabase_client:
                logger.warning("Supabase client not initialized")
                return None
            
            response = self.supabase_client.table("Conversation").select(
                "memoryBuffer"
            ).eq("id", conversation_id).execute()
            
            if response.data and len(response.data) > 0:
                return response.data[0].get("memoryBuffer")
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting memory buffer: {e}")
            return None
    
    async def update_memory_buffer(self, conversation_id: str, memory_buffer: Dict[str, Any]) -> bool:
        """
        Update the memory buffer for a conversation.
        
        Args:
            conversation_id: The conversation ID
            memory_buffer: The memory buffer data to store
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if not self.supabase_client:
                logger.warning("Supabase client not initialized")
                return False
            
            response = self.supabase_client.table("Conversation").update({
                "memoryBuffer": memory_buffer,
                "updatedAt": datetime.utcnow().isoformat()
            }).eq("id", conversation_id).execute()
            
            if response.data:
                logger.debug(f"Updated memory buffer for conversation {conversation_id}")
                return True
            else:
                logger.warning(f"Failed to update memory buffer: {response}")
                return False
                
        except Exception as e:
            logger.error(f"Error updating memory buffer: {e}")
            return False

    async def _get_or_create_external_user(self, email: str) -> Optional[str]:
        """
        Get or create an external user by email.
        
        Args:
            email: External user email
            
        Returns:
            External user ID if successful, None otherwise
        """
        try:
            if not self.supabase_client:
                logger.warning("Supabase client not initialized")
                return None
            
            # Try to find existing external user
            response = self.supabase_client.table("ExternalUser").select(
                "id"
            ).eq("email", email).execute()
            
            if response.data and len(response.data) > 0:
                return response.data[0]["id"]
            
            # Create new external user
            create_response = self.supabase_client.table("ExternalUser").insert({
                "email": email,
                "createdAt": datetime.utcnow().isoformat(),
                "updatedAt": datetime.utcnow().isoformat()
            }).execute()
            
            if create_response.data and len(create_response.data) > 0:
                logger.info(f"Created new external user: {email}")
                return create_response.data[0]["id"]
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting or creating external user: {e}")
            return None

    def get_service_info(self) -> Dict[str, Any]:
        """Get information about the conversation service configuration."""
        return {
            "supabase_client_ready": self.supabase_client is not None,
            "has_supabase_url": bool(settings.SUPABASE_URL),
            "has_supabase_key": bool(settings.SUPABASE_KEY),
            "service_ready": self.is_ready()
        }


# Global conversation service instance
conversation_service: Optional[ConversationService] = None


def get_conversation_service() -> ConversationService:
    """Get the global conversation service instance."""
    global conversation_service
    if conversation_service is None:
        conversation_service = ConversationService()
    return conversation_service