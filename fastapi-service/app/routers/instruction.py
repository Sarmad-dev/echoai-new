"""
Router for training instruction management endpoints.
"""
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.models.instruction import (
    InstructionType,
    TrainingInstructionCreate,
    TrainingInstructionUpdate,
    TrainingInstructionResponse,
    InstructionListResponse,
    InstructionBulkImportRequest,
    InstructionBulkImportResponse,
    InstructionTestRequest,
    InstructionTestResponse,
    EnhancedTrainRequest,
    EnhancedTrainResponse
)
from app.services.instruction_service import get_instruction_service
from app.services.document_ingestion_service import get_document_ingestion_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/instructions", response_model=TrainingInstructionResponse, status_code=status.HTTP_201_CREATED)
async def create_instruction(instruction_data: TrainingInstructionCreate):
    """
    Create a new training instruction with automatic embedding generation.
    
    The instruction content will be embedded using the same model as documents
    to ensure compatibility during retrieval operations.
    """
    logger.info(f"Creating instruction '{instruction_data.title}' for chatbot {instruction_data.chatbot_id}")
    
    try:
        instruction_service = get_instruction_service()
        result = await instruction_service.create_instruction(instruction_data)
        
        logger.info(f"Successfully created instruction {result.id}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating instruction: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create instruction: {str(e)}"
        )


@router.get("/instructions/{instruction_id}", response_model=TrainingInstructionResponse)
async def get_instruction(instruction_id: str):
    """
    Retrieve a specific training instruction by ID.
    """
    logger.debug(f"Retrieving instruction {instruction_id}")
    
    try:
        instruction_service = get_instruction_service()
        return await instruction_service.get_instruction(instruction_id)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving instruction {instruction_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve instruction: {str(e)}"
        )


@router.get("/instructions", response_model=InstructionListResponse)
async def list_instructions(
    chatbot_id: str = Query(..., description="Chatbot ID to filter instructions"),
    instruction_type: Optional[InstructionType] = Query(None, description="Filter by instruction type"),
    active_only: bool = Query(True, description="Return only active instructions"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of instructions to return"),
    offset: int = Query(0, ge=0, description="Number of instructions to skip")
):
    """
    List training instructions for a chatbot with filtering and pagination options.
    
    Supports filtering by:
    - Instruction type (behavior, knowledge, tone, escalation)
    - Active status
    - Pagination with limit and offset
    """
    logger.info(f"Listing instructions for chatbot {chatbot_id}")
    
    try:
        instruction_service = get_instruction_service()
        return await instruction_service.list_instructions(
            chatbot_id=chatbot_id,
            instruction_type=instruction_type,
            active_only=active_only,
            limit=limit,
            offset=offset
        )
        
    except Exception as e:
        logger.error(f"Error listing instructions: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list instructions: {str(e)}"
        )


@router.put("/instructions/{instruction_id}", response_model=TrainingInstructionResponse)
async def update_instruction(instruction_id: str, update_data: TrainingInstructionUpdate):
    """
    Update an existing training instruction.
    
    If the content is updated, a new embedding will be automatically generated
    to maintain retrieval accuracy.
    """
    logger.info(f"Updating instruction {instruction_id}")
    
    try:
        instruction_service = get_instruction_service()
        return await instruction_service.update_instruction(instruction_id, update_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating instruction {instruction_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update instruction: {str(e)}"
        )


@router.delete("/instructions/{instruction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_instruction(instruction_id: str):
    """
    Delete a training instruction.
    
    This will permanently remove the instruction and its embedding from the system.
    """
    logger.info(f"Deleting instruction {instruction_id}")
    
    try:
        instruction_service = get_instruction_service()
        await instruction_service.delete_instruction(instruction_id)
        
        logger.info(f"Successfully deleted instruction {instruction_id}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting instruction {instruction_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete instruction: {str(e)}"
        )


@router.post("/instructions/bulk-import", response_model=InstructionBulkImportResponse)
async def bulk_import_instructions(import_request: InstructionBulkImportRequest):
    """
    Bulk import multiple training instructions.
    
    Supports:
    - Importing up to 100 instructions at once
    - Optional replacement of existing instructions
    - Detailed error reporting for failed imports
    """
    logger.info(f"Bulk importing {len(import_request.instructions)} instructions for chatbot {import_request.chatbot_id}")
    
    try:
        instruction_service = get_instruction_service()
        result = await instruction_service.bulk_import_instructions(
            chatbot_id=import_request.chatbot_id,
            instructions=import_request.instructions,
            replace_existing=import_request.replace_existing
        )
        
        return InstructionBulkImportResponse(**result)
        
    except Exception as e:
        logger.error(f"Error in bulk import: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Bulk import failed: {str(e)}"
        )


@router.post("/instructions/{instruction_id}/test", response_model=InstructionTestResponse)
async def test_instruction(instruction_id: str, test_request: InstructionTestRequest):
    """
    Test how relevant an instruction is for a given query.
    
    This endpoint helps evaluate instruction effectiveness by:
    - Calculating similarity between instruction content and test query
    - Determining if the instruction would be retrieved for the query
    - Providing detailed explanation of the results
    """
    logger.info(f"Testing instruction {instruction_id} with query: {test_request.test_query[:50]}...")
    
    try:
        instruction_service = get_instruction_service()
        return await instruction_service.test_instruction_relevance(
            instruction_id=instruction_id,
            test_query=test_request.test_query
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing instruction: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to test instruction: {str(e)}"
        )


@router.post("/train/enhanced", response_model=EnhancedTrainResponse)
async def enhanced_train(train_request: EnhancedTrainRequest):
    """
    Enhanced training endpoint that supports both documents and custom instructions.
    
    This endpoint combines traditional document ingestion with custom instruction training:
    - Processes document URLs using existing document ingestion pipeline
    - Creates and embeds custom training instructions
    - Provides unified training statistics
    
    Both documents and instructions are stored with embeddings for retrieval during chat.
    """
    logger.info(f"Enhanced training for chatbot {train_request.chatbot_id}")
    
    try:
        start_time = time.time()
        documents_processed = 0
        instructions_processed = 0
        embeddings_generated = 0
        
        # Process documents if provided
        if train_request.documents:
            logger.info(f"Processing {len(train_request.documents)} documents")
            
            # Use existing document ingestion service
            ingestion_service = get_document_ingestion_service()
            
            # Process URLs (convert to the format expected by ingestion service)
            processed_docs = await ingestion_service.process_mixed_sources(
                urls=train_request.documents,
                files=None,
                user_id=train_request.chatbot_id,  # Use chatbot_id as user_id for widget documents
                chatbot_id=train_request.chatbot_id
            )
            
            documents_processed = len(set(doc.metadata.get('source', '') for doc in processed_docs))
            embeddings_generated += len(processed_docs)
        
        # Process instructions if provided
        if train_request.instructions:
            logger.info(f"Processing {len(train_request.instructions)} instructions")
            
            instruction_service = get_instruction_service()
            
            # Replace existing instructions if requested
            if train_request.replace_existing:
                await instruction_service._delete_chatbot_instructions(train_request.chatbot_id)
            
            # Create instructions
            for instruction_data in train_request.instructions:
                # Ensure chatbot_id matches
                instruction_data.chatbot_id = train_request.chatbot_id
                
                # Filter by instruction types if specified
                if train_request.instruction_types and instruction_data.type not in train_request.instruction_types:
                    continue
                
                await instruction_service.create_instruction(instruction_data)
                instructions_processed += 1
                embeddings_generated += 1
        
        processing_time_ms = (time.time() - start_time) * 1000
        
        success_message = []
        if documents_processed > 0:
            success_message.append(f"{documents_processed} documents")
        if instructions_processed > 0:
            success_message.append(f"{instructions_processed} instructions")
        
        message = f"Successfully processed {' and '.join(success_message)}"
        
        logger.info(f"Enhanced training completed: {message}")
        
        return EnhancedTrainResponse(
            success=True,
            message=message,
            documents_processed=documents_processed,
            instructions_processed=instructions_processed,
            embeddings_generated=embeddings_generated,
            processing_time_ms=processing_time_ms
        )
        
    except Exception as e:
        logger.error(f"Error in enhanced training: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Enhanced training failed: {str(e)}"
        )


# Import time for enhanced_train endpoint
import time