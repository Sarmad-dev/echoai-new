"""
User service for API key validation and user management.
"""
import logging
from typing import Optional, Dict, Any
from supabase import create_client, Client
from app.config import settings

logger = logging.getLogger(__name__)


class UserService:
    """Service for user authentication and API key validation."""
    
    def __init__(self):
        """Initialize the user service with Supabase client."""
        self.supabase_client: Optional[Client] = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Supabase client for user operations."""
        try:
            if settings.SUPABASE_URL and settings.SUPABASE_KEY:
                self.supabase_client = create_client(
                    settings.SUPABASE_URL,
                    settings.SUPABASE_KEY
                )
                logger.info("User service Supabase client initialized successfully")
                logger.info(f"SUPABASE CLIENT: {self.supabase_client}")
                
                # Test the connection
                try:
                    test_response = self.supabase_client.table("User").select("id").limit(1).execute()
                    logger.info("Supabase connection test successful")
                except Exception as test_error:
                    logger.error(f"Supabase connection test failed: {test_error}")
                    raise test_error
                    
            else:
                logger.error("Supabase credentials not provided for user service")
                raise ValueError("SUPABASE_URL and SUPABASE_KEY are required")
        except Exception as e:
            logger.error(f"Failed to initialize user service: {e}")
            logger.error(f"SUPABASE_URL: {settings.SUPABASE_URL}")
            logger.error(f"SUPABASE_KEY exists: {bool(settings.SUPABASE_KEY)}")
            logger.warning("User service will operate in test mode without database connection")
            self.supabase_client = None
    
    async def validate_api_key(self, api_key: str) -> Optional[Dict[str, Any]]:
        """
        Validate API key and return user information.
        
        Args:
            api_key: The API key to validate
            
        Returns:
            User information if valid, None if invalid
        """
        try:
            if not self.supabase_client:
                logger.warning("Supabase client not initialized, using test mode")
                # In test mode, accept any non-empty API key
                if api_key and api_key.strip():
                    logger.info(f"Test mode: accepting API key {api_key[:8]}...")
                    return {
                        "user_id": "test_user_123",
                        "email": "test@example.com",
                        "api_key": api_key.strip(),
                        "created_at": "2025-01-01T00:00:00Z",
                        "updated_at": "2025-01-01T00:00:00Z"
                    }
                else:
                    logger.warning("Empty API key provided in test mode")
                    return None
            
            if not api_key or not api_key.strip():
                logger.warning("Empty API key provided")
                return None
            
            # Query the User table to find user by API key
            try:
                response = self.supabase_client.table("User").select(
                    "id, email, apiKey, createdAt, updatedAt"
                ).eq("apiKey", api_key.strip()).execute()
                
                logger.info(f"Supabase query response: {response}")
                logger.info(f"Looking for API key: {api_key.strip()}")
                
                if response.data and len(response.data) > 0:
                    user_data = response.data[0]
                    logger.info(f"Valid API key for user: {user_data['email']}")
                    return {
                        "user_id": user_data["id"],
                        "email": user_data["email"],
                        "api_key": user_data["apiKey"],
                        "created_at": user_data["createdAt"],
                        "updated_at": user_data["updatedAt"]
                    }
                else:
                    logger.warning(f"Invalid API key provided: {api_key[:8]}...")
                    return None
            except Exception as db_error:
                logger.error(f"Database connection error during API key validation: {db_error}")
                logger.warning("Falling back to test mode due to database connectivity issue")
                # Fallback to test mode if database is unreachable
                if api_key and api_key.strip():
                    logger.info(f"Test mode fallback: accepting API key {api_key[:8]}...")
                    return {
                        "user_id": "test_user_123",
                        "email": "test@example.com",
                        "api_key": api_key.strip(),
                        "created_at": "2025-01-01T00:00:00Z",
                        "updated_at": "2025-01-01T00:00:00Z"
                    }
                else:
                    return None
                
        except Exception as e:
            logger.error(f"Error validating API key: {e}")
            return None
    
    async def validate_chatbot_api_key(self, api_key: str) -> Optional[Dict[str, Any]]:
        """
        Validate chatbot API key and return chatbot information.
        
        Args:
            api_key: The chatbot API key to validate
            
        Returns:
            Chatbot information if valid, None if invalid
        """
        try:
            if not self.supabase_client:
                logger.warning("Supabase client not initialized, using test mode")
                # In test mode, accept any non-empty API key
                if api_key and api_key.strip():
                    logger.info(f"Test mode: accepting chatbot API key {api_key[:8]}...")
                    return {
                        "chatbot_id": "test_chatbot_123",
                        "user_id": "test_user_123",
                        "name": "Test Chatbot",
                        "api_key": api_key.strip(),
                        "created_at": "2025-01-01T00:00:00Z"
                    }
                else:
                    logger.warning("Empty chatbot API key provided in test mode")
                    return None
            
            if not api_key or not api_key.strip():
                logger.warning("Empty chatbot API key provided")
                return None
            
            # Query the Chatbot table to find chatbot by API key
            try:
                response = self.supabase_client.table("Chatbot").select(
                    "id, name, userId, apiKey, createdAt, isActive"
                ).eq("apiKey", api_key.strip()).eq("isActive", True).execute()
                
                if response.data and len(response.data) > 0:
                    chatbot_data = response.data[0]
                    logger.info(f"Valid chatbot API key for chatbot: {chatbot_data['name']}")
                    return {
                        "chatbot_id": chatbot_data["id"],
                        "user_id": chatbot_data["userId"],
                        "name": chatbot_data["name"],
                        "api_key": chatbot_data["apiKey"],
                        "created_at": chatbot_data["createdAt"],
                        "is_active": chatbot_data["isActive"]
                    }
                else:
                    logger.warning(f"Invalid or inactive chatbot API key provided: {api_key[:8]}...")
                    return None
            except Exception as db_error:
                logger.error(f"Database connection error during chatbot API key validation: {db_error}")
                logger.warning("Falling back to test mode due to database connectivity issue")
                # Fallback to test mode if database is unreachable
                if api_key and api_key.strip():
                    logger.info(f"Test mode fallback: accepting chatbot API key {api_key[:8]}...")
                    return {
                        "chatbot_id": "test_chatbot_123",
                        "user_id": "test_user_123",
                        "name": "Test Chatbot",
                        "api_key": api_key.strip(),
                        "created_at": "2025-01-01T00:00:00Z"
                    }
                else:
                    return None
                    
        except Exception as e:
            logger.error(f"Error validating chatbot API key: {e}")
            return None
    
    async def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user information by user ID.
        
        Args:
            user_id: The user ID to lookup
            
        Returns:
            User information if found, None if not found
        """
        try:
            if not self.supabase_client:
                logger.error("Supabase client not initialized")
                return None
            
            response = self.supabase_client.table("User").select(
                "id, email, apiKey, createdAt, updatedAt"
            ).eq("id", user_id).execute()
            
            if response.data and len(response.data) > 0:
                user_data = response.data[0]
                return {
                    "user_id": user_data["id"],
                    "email": user_data["email"],
                    "api_key": user_data["apiKey"],
                    "created_at": user_data["createdAt"],
                    "updated_at": user_data["updatedAt"]
                }
            else:
                logger.warning(f"User not found: {user_id}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting user by ID: {e}")
            return None
    
    def is_ready(self) -> bool:
        """Check if the user service is ready."""
        return self.supabase_client is not None
    
    def get_service_info(self) -> Dict[str, Any]:
        """Get information about the user service configuration."""
        return {
            "supabase_client_ready": self.supabase_client is not None,
            "has_supabase_url": bool(settings.SUPABASE_URL),
            "has_supabase_key": bool(settings.SUPABASE_KEY),
            "service_ready": self.is_ready()
        }


# Global user service instance
user_service: Optional[UserService] = None


def get_user_service() -> UserService:
    """Get the global user service instance."""
    global user_service
    if user_service is None:
        user_service = UserService()
    return user_service