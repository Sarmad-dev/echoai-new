"""
Simplified API router for managing chatbot instructions.
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any

from app.models.simple_instruction import (
    ChatbotInstructionUpdate,
    ChatbotInstructionResponse,
    ChatbotWithInstructionResponse
)
from app.services.simple_instruction_service import get_simple_instruction_service
from app.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/instructions", tags=["Simple Instructions"])


@router.get("/{chatbot_id}", response_model=ChatbotInstructionResponse)
async def get_chatbot_instruction(
    chatbot_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get the instruction for a specific chatbot.
    
    Args:
        chatbot_id: ID of the chatbot
        current_user: Current authenticated user
        
    Returns:
        Chatbot instruction
    """
    try:
        logger.info(f"Getting instruction for chatbot {chatbot_id}")
        
        instruction_service = get_simple_instruction_service()
        instruction = await instruction_service.get_chatbot_instruction(chatbot_id)
        
        return ChatbotInstructionResponse(
            chatbot_id=chatbot_id,
            instructions=instruction
        )
        
    except Exception as e:
        logger.error(f"Error getting chatbot instruction: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get chatbot instruction: {str(e)}"
        )


@router.put("/{chatbot_id}", response_model=ChatbotInstructionResponse)
async def update_chatbot_instruction(
    chatbot_id: str,
    instruction_data: ChatbotInstructionUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Update the instruction for a specific chatbot.
    
    Args:
        chatbot_id: ID of the chatbot
        instruction_data: New instruction data
        current_user: Current authenticated user
        
    Returns:
        Updated chatbot instruction
    """
    try:
        logger.info(f"Updating instruction for chatbot {chatbot_id}")
        
        instruction_service = get_simple_instruction_service()
        success = await instruction_service.update_chatbot_instruction(
            chatbot_id, 
            instruction_data.instructions
        )
        
        if not success:
            raise HTTPException(
                status_code=404,
                detail="Chatbot not found"
            )
        
        return ChatbotInstructionResponse(
            chatbot_id=chatbot_id,
            instructions=instruction_data.instructions
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating chatbot instruction: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update chatbot instruction: {str(e)}"
        )


@router.get("/{chatbot_id}/details", response_model=ChatbotWithInstructionResponse)
async def get_chatbot_with_instruction(
    chatbot_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get full chatbot details including instruction.
    
    Args:
        chatbot_id: ID of the chatbot
        current_user: Current authenticated user
        
    Returns:
        Complete chatbot data with instruction
    """
    try:
        logger.info(f"Getting chatbot details with instruction for {chatbot_id}")
        
        instruction_service = get_simple_instruction_service()
        chatbot_data = await instruction_service.get_chatbot_with_instruction(chatbot_id)
        
        return ChatbotWithInstructionResponse(**chatbot_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting chatbot with instruction: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get chatbot details: {str(e)}"
        )