"""
Simplified instruction service that stores instructions directly in the Chatbot table.
"""
import logging
from typing import Optional
from datetime import datetime

# Database imports
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

# FastAPI imports
from fastapi import HTTPException

# Local imports
from app.config import settings

logger = logging.getLogger(__name__)


class SimpleInstructionService:
    """Simplified service for managing chatbot instructions stored in the Chatbot table."""
    
    def __init__(self):
        """Initialize the simple instruction service."""
        self.supabase_client: Optional[Client] = None
        self._initialize_connections()
    
    def _initialize_connections(self):
        """Initialize database connections."""
        try:
            # Initialize Supabase client
            if SUPABASE_AVAILABLE and settings.SUPABASE_URL and settings.SUPABASE_KEY:
                self.supabase_client = create_client(
                    settings.SUPABASE_URL,
                    settings.SUPABASE_KEY
                )
                logger.info("SimpleInstructionService: Supabase client initialized")
            else:
                logger.warning("SimpleInstructionService: Supabase credentials not available")
                
        except Exception as e:
            logger.error(f"Failed to initialize simple instruction service connections: {e}")
            logger.warning("SimpleInstructionService will operate in limited mode")
    
    async def get_chatbot_instruction(self, chatbot_id: str) -> str:
        """
        Get the instruction for a specific chatbot.
        
        Args:
            chatbot_id: ID of the chatbot
            
        Returns:
            The chatbot's instruction text
        """
        try:
            logger.debug(f"Retrieving instruction for chatbot {chatbot_id}")
            
            if not self.supabase_client:
                raise ValueError("No database connection available")
            
            result = self.supabase_client.table('Chatbot').select('instructions').eq('id', chatbot_id).execute()
            
            if result.data and len(result.data) > 0:
                instruction = result.data[0].get('instructions', '')
                if not instruction:
                    # Return default instruction if empty
                    instruction = 'You are a helpful AI assistant. Provide accurate, helpful, and professional responses to user questions.'
                logger.debug(f"Retrieved instruction for chatbot {chatbot_id}: {instruction[:100]}...")
                return instruction
            else:
                logger.warning(f"Chatbot {chatbot_id} not found")
                # Return default instruction
                return 'You are a helpful AI assistant. Provide accurate, helpful, and professional responses to user questions.'
                
        except Exception as e:
            logger.error(f"Error retrieving instruction for chatbot {chatbot_id}: {e}")
            # Return default instruction for graceful degradation
            return 'You are a helpful AI assistant. Provide accurate, helpful, and professional responses to user questions.'
    
    async def update_chatbot_instruction(self, chatbot_id: str, instruction: str) -> bool:
        """
        Update the instruction for a specific chatbot.
        
        Args:
            chatbot_id: ID of the chatbot
            instruction: New instruction text
            
        Returns:
            True if updated successfully
        """
        try:
            logger.info(f"Updating instruction for chatbot {chatbot_id}")
            
            if not self.supabase_client:
                raise ValueError("No database connection available")
            
            # Validate instruction
            if not instruction or not instruction.strip():
                raise ValueError("Instruction cannot be empty")
            
            # Update the chatbot instruction
            result = self.supabase_client.table('Chatbot').update({
                'instructions': instruction.strip(),
                'updatedAt': datetime.utcnow().isoformat()
            }).eq('id', chatbot_id).execute()
            
            if result.data and len(result.data) > 0:
                logger.info(f"Successfully updated instruction for chatbot {chatbot_id}")
                return True
            else:
                logger.warning(f"Chatbot {chatbot_id} not found for instruction update")
                return False
                
        except Exception as e:
            logger.error(f"Error updating instruction for chatbot {chatbot_id}: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to update instruction: {str(e)}"
            )
    
    async def get_chatbot_with_instruction(self, chatbot_id: str) -> dict:
        """
        Get chatbot details including instruction.
        
        Args:
            chatbot_id: ID of the chatbot
            
        Returns:
            Chatbot data with instruction
        """
        try:
            logger.debug(f"Retrieving chatbot with instruction: {chatbot_id}")
            
            if not self.supabase_client:
                raise ValueError("No database connection available")
            
            result = self.supabase_client.table('Chatbot').select('*').eq('id', chatbot_id).execute()
            
            if result.data and len(result.data) > 0:
                chatbot = result.data[0]
                # Ensure instruction has a default value
                if not chatbot.get('instructions'):
                    chatbot['instructions'] = 'You are a helpful AI assistant. Provide accurate, helpful, and professional responses to user questions.'
                return chatbot
            else:
                raise HTTPException(status_code=404, detail="Chatbot not found")
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error retrieving chatbot {chatbot_id}: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to retrieve chatbot: {str(e)}"
            )


# Global service instance
_simple_instruction_service: Optional[SimpleInstructionService] = None


def get_simple_instruction_service() -> SimpleInstructionService:
    """Get the global simple instruction service instance."""
    global _simple_instruction_service
    if _simple_instruction_service is None:
        _simple_instruction_service = SimpleInstructionService()
    return _simple_instruction_service