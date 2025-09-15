"""
Service for managing custom training instructions with embedding generation and storage.
"""
import logging
import time
import uuid
import asyncio
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime

# Database imports
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

# FastAPI imports
from fastapi import HTTPException

# Local imports
from app.models.instruction import (
    InstructionType, 
    TrainingInstructionCreate, 
    TrainingInstructionUpdate,
    TrainingInstructionResponse,
    InstructionListResponse,
    InstructionTestResponse
)
from app.services.model_service import get_model_service
from app.config import settings

logger = logging.getLogger(__name__)


class InstructionService:
    """Service for managing custom training instructions with vector embeddings."""
    
    def __init__(self):
        """Initialize the instruction service."""
        self.supabase_client: Optional[Client] = None
        self.pg_connection: Optional[Any] = None
        self.model_service = get_model_service()
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
                logger.info("InstructionService: Supabase client initialized")
            else:
                logger.warning("InstructionService: Supabase credentials not available")
                
        except Exception as e:
            logger.error(f"Failed to initialize instruction service connections: {e}")
            logger.warning("InstructionService will operate in limited mode")
    
    async def create_instruction(
        self, 
        instruction_data: TrainingInstructionCreate
    ) -> TrainingInstructionResponse:
        """
        Create a new training instruction with embedding generation.
        
        Args:
            instruction_data: Instruction creation data
            
        Returns:
            Created instruction with metadata
        """
        try:
            logger.info(f"Creating instruction '{instruction_data.title}' for chatbot {instruction_data.chatbot_id}")
            
            # Generate embedding for the instruction content
            embedding = await self.model_service.generate_embedding(instruction_data.content)
            
            
            # Generate unique instruction ID
            instruction_id = self._generate_instruction_id()
            
            # Prepare instruction data for database
            db_data = {
                'id': instruction_id,
                'chatbotId': instruction_data.chatbot_id,
                'type': instruction_data.type.value.upper(),  # Convert to enum format
                'title': instruction_data.title,
                'content': instruction_data.content,
                'priority': instruction_data.priority,
                'isActive': instruction_data.is_active,
                'embedding': embedding if isinstance(embedding, list) else embedding.tolist(),
                'createdAt': datetime.utcnow().isoformat(),
                'updatedAt': datetime.utcnow().isoformat()
            }
            
            # Store in database
            if self.supabase_client:
                result = await self._create_instruction_supabase(db_data)
            else:
                raise ValueError("No database connection available")
            
            logger.info(f"Successfully created instruction {instruction_id}")
            return result
            
        except Exception as e:
            logger.error(f"Error creating instruction: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create instruction: {str(e)}"
            )
    
    async def _create_instruction_supabase(self, db_data: Dict[str, Any]) -> TrainingInstructionResponse:
        """Create instruction using Supabase client."""
        try:
            result = self.supabase_client.table('TrainingInstruction').insert(db_data).execute()
            
            if result.data and len(result.data) > 0:
                instruction = result.data[0]
                response = self._map_db_to_response(instruction)
                
                # Add embedding to response for debugging purposes
                if 'embedding' in instruction:
                    embedding = instruction['embedding']
                    embedding_length = len(embedding) if isinstance(embedding, list) else 0
                    logger.info(f"Created instruction with embedding length: {embedding_length}")
                    # Store embedding in response for debugging (add as custom attribute)
                    response.embedding = embedding
                    response.embedding_length = embedding_length
                
                return response
            else:
                raise ValueError(f"Failed to create instruction: {result}")
                
        except Exception as e:
            logger.error(f"Error in Supabase instruction creation: {e}")
            raise
    
    async def get_instruction(self, instruction_id: str) -> TrainingInstructionResponse:
        """
        Retrieve a specific training instruction by ID.
        
        Args:
            instruction_id: ID of the instruction to retrieve
            
        Returns:
            Instruction data
        """
        try:
            logger.debug(f"Retrieving instruction {instruction_id}")
            
            if self.supabase_client:
                result = self.supabase_client.table('TrainingInstruction').select('*').eq('id', instruction_id).execute()
                
                if result.data and len(result.data) > 0:
                    return self._map_db_to_response(result.data[0])
                else:
                    raise HTTPException(status_code=404, detail="Instruction not found")
            else:
                raise ValueError("No database connection available")
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error retrieving instruction {instruction_id}: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to retrieve instruction: {str(e)}"
            )
    
    async def list_instructions(
        self, 
        chatbot_id: str,
        instruction_type: Optional[InstructionType] = None,
        active_only: bool = True,
        limit: int = 100,
        offset: int = 0
    ) -> InstructionListResponse:
        """
        List training instructions for a chatbot with filtering options.
        
        Args:
            chatbot_id: Chatbot ID to filter instructions
            instruction_type: Optional type filter
            active_only: Whether to return only active instructions
            limit: Maximum number of instructions to return
            offset: Number of instructions to skip
            
        Returns:
            List of instructions with metadata
        """
        try:
            logger.info(f"Listing instructions for chatbot {chatbot_id}")
            
            if self.supabase_client:
                # Build query
                query = self.supabase_client.table('TrainingInstruction').select('*').eq('chatbotId', chatbot_id)
                
                if instruction_type:
                    query = query.eq('type', instruction_type.value.upper())
                
                if active_only:
                    query = query.eq('isActive', True)
                
                # Execute query with pagination
                result = query.order('priority', desc=True).order('createdAt', desc=True).range(offset, offset + limit - 1).execute()
                
                # Get total count for metadata
                count_query = self.supabase_client.table('TrainingInstruction').select('id', count='exact').eq('chatbotId', chatbot_id)
                if active_only:
                    count_query = count_query.eq('isActive', True)
                count_result = count_query.execute()
                
                # Map results
                instructions = [self._map_db_to_response(row) for row in result.data]
                
                # Calculate metadata
                total_count = count_result.count if hasattr(count_result, 'count') else len(result.data)
                active_count = len([i for i in instructions if i.is_active])
                type_breakdown = self._calculate_type_breakdown(instructions)
                
                return InstructionListResponse(
                    instructions=instructions,
                    total_count=total_count,
                    active_count=active_count,
                    type_breakdown=type_breakdown
                )
            else:
                raise ValueError("No database connection available")
                
        except Exception as e:
            logger.error(f"Error listing instructions for chatbot {chatbot_id}: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to list instructions: {str(e)}"
            )
    
    async def update_instruction(
        self, 
        instruction_id: str, 
        update_data: TrainingInstructionUpdate
    ) -> TrainingInstructionResponse:
        """
        Update an existing training instruction.
        
        Args:
            instruction_id: ID of the instruction to update
            update_data: Updated instruction data
            
        Returns:
            Updated instruction data
        """
        try:
            logger.info(f"Updating instruction {instruction_id}")
            
            # Prepare update data
            db_update = {'updatedAt': datetime.utcnow().isoformat()}
            
            # Add fields that are being updated
            if update_data.type is not None:
                db_update['type'] = update_data.type.value.upper()
            if update_data.title is not None:
                db_update['title'] = update_data.title
            if update_data.content is not None:
                db_update['content'] = update_data.content
                # Regenerate embedding if content changed
                embedding = await self.model_service.generate_embedding(update_data.content)
                db_update['embedding'] = embedding if isinstance(embedding, list) else embedding.tolist()
            if update_data.priority is not None:
                db_update['priority'] = update_data.priority
            if update_data.is_active is not None:
                db_update['isActive'] = update_data.is_active
            
            # Update in database
            if self.supabase_client:
                result = self.supabase_client.table('TrainingInstruction').update(db_update).eq('id', instruction_id).execute()
                
                if result.data and len(result.data) > 0:
                    return self._map_db_to_response(result.data[0])
                else:
                    raise HTTPException(status_code=404, detail="Instruction not found")
            else:
                raise ValueError("No database connection available")
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating instruction {instruction_id}: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to update instruction: {str(e)}"
            )
    
    async def delete_instruction(self, instruction_id: str) -> bool:
        """
        Delete a training instruction.
        
        Args:
            instruction_id: ID of the instruction to delete
            
        Returns:
            True if deleted successfully
        """
        try:
            logger.info(f"Deleting instruction {instruction_id}")
            
            if self.supabase_client:
                result = self.supabase_client.table('TrainingInstruction').delete().eq('id', instruction_id).execute()
                
                if result.data and len(result.data) > 0:
                    logger.info(f"Successfully deleted instruction {instruction_id}")
                    return True
                else:
                    raise HTTPException(status_code=404, detail="Instruction not found")
            else:
                raise ValueError("No database connection available")
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting instruction {instruction_id}: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to delete instruction: {str(e)}"
            )
    
    async def retrieve_relevant_instructions(
        self, 
        query: str, 
        chatbot_id: str,
        instruction_types: Optional[List[InstructionType]] = None,
        k: int = 5,
        score_threshold: float = 0.7
    ) -> List[Tuple[TrainingInstructionResponse, float]]:
        """
        Retrieve relevant instructions using similarity search.
        
        Args:
            query: Query text to find relevant instructions
            chatbot_id: Chatbot ID to filter instructions
            instruction_types: Optional list of instruction types to filter
            k: Number of instructions to retrieve
            score_threshold: Minimum similarity score threshold
            
        Returns:
            List of tuples containing (instruction, similarity_score)
        """
        try:
            logger.debug(f"Retrieving relevant instructions for query: {query[:100]}...")
            
            # Generate query embedding
            query_embedding = await self.model_service.generate_embedding(query)
            
            if self.supabase_client:
                try:
                    # Use RPC function for similarity search
                    rpc_params = {
                        'query_embedding': query_embedding if isinstance(query_embedding, list) else query_embedding.tolist(),
                        'match_threshold': score_threshold,
                        'match_count': k,
                        'chatbot_id': chatbot_id
                    }
                    
                    # Add instruction type filter if provided
                    if instruction_types:
                        rpc_params['instruction_types'] = [t.value.upper() for t in instruction_types]
                    
                    result = self.supabase_client.rpc('match_training_instructions', rpc_params).execute()
                    
                    instruction_results = []
                    if result.data:
                        for row in result.data:
                            instruction = self._map_db_to_response(row)
                            similarity_score = row.get('similarity', 0.0)
                            instruction_results.append((instruction, similarity_score))
                    
                    logger.info(f"Retrieved {len(instruction_results)} relevant instructions")
                    return instruction_results
                    
                except Exception as rpc_error:
                    logger.warning(f"RPC function 'match_training_instructions' failed: {rpc_error}")
                    logger.info("Falling back to basic instruction retrieval...")
                    
                    # Fallback: Get all instructions for the chatbot and do basic filtering
                    try:
                        query_result = self.supabase_client.table('TrainingInstruction').select('*').eq('chatbotId', chatbot_id).eq('isActive', True).execute()
                        
                        instruction_results = []
                        if query_result.data:
                            for row in query_result.data:
                                instruction = self._map_db_to_response(row)
                                # Simple relevance scoring based on keyword matching
                                relevance_score = self._calculate_simple_relevance(query.lower(), instruction.content.lower())
                                if relevance_score >= score_threshold:
                                    instruction_results.append((instruction, relevance_score))
                        
                        # Sort by relevance score
                        instruction_results.sort(key=lambda x: x[1], reverse=True)
                        instruction_results = instruction_results[:k]
                        
                        logger.info(f"Retrieved {len(instruction_results)} relevant instructions using fallback method")
                        return instruction_results
                        
                    except Exception as fallback_error:
                        logger.error(f"Fallback instruction retrieval also failed: {fallback_error}")
                        return []
            else:
                raise ValueError("No database connection available")
                
        except Exception as e:
            logger.error(f"Error retrieving relevant instructions: {e}")
            # Return empty list for graceful degradation
            logger.warning("Returning empty instruction list due to retrieval error")
            return []
    
    async def test_instruction_relevance(
        self, 
        instruction_id: str, 
        test_query: str
    ) -> InstructionTestResponse:
        """
        Test how relevant an instruction is for a given query.
        
        Args:
            instruction_id: ID of the instruction to test
            test_query: Query to test against the instruction
            
        Returns:
            Test results with relevance scores
        """
        try:
            logger.info(f"Testing instruction {instruction_id} with query: {test_query[:50]}...")
            
            # Get the instruction
            instruction = await self.get_instruction(instruction_id)
            
            # Generate embeddings for both instruction content and test query
            instruction_embedding = await self.model_service.generate_embedding(instruction.content)
            query_embedding = await self.model_service.generate_embedding(test_query)
            
            # Calculate similarity score
            similarity_score = self._calculate_cosine_similarity(instruction_embedding, query_embedding)
            
            # Determine if it would be retrieved (above threshold)
            threshold = 0.7  # Default threshold
            would_be_retrieved = similarity_score >= threshold
            
            # Generate explanation
            explanation = self._generate_test_explanation(
                instruction, test_query, similarity_score, would_be_retrieved
            )
            
            return InstructionTestResponse(
                instruction_id=instruction_id,
                test_query=test_query,
                relevance_score=similarity_score,
                similarity_score=similarity_score,
                would_be_retrieved=would_be_retrieved,
                explanation=explanation
            )
            
        except Exception as e:
            logger.error(f"Error testing instruction relevance: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to test instruction: {str(e)}"
            )
    
    async def bulk_import_instructions(
        self, 
        chatbot_id: str, 
        instructions: List[TrainingInstructionCreate],
        replace_existing: bool = False
    ) -> Dict[str, Any]:
        """
        Bulk import multiple training instructions.
        
        Args:
            chatbot_id: Chatbot ID for all instructions
            instructions: List of instructions to import
            replace_existing: Whether to replace existing instructions
            
        Returns:
            Import results with statistics
        """
        try:
            logger.info(f"Bulk importing {len(instructions)} instructions for chatbot {chatbot_id}")
            
            # Replace existing instructions if requested
            if replace_existing:
                await self._delete_chatbot_instructions(chatbot_id)
            
            imported_count = 0
            skipped_count = 0
            error_count = 0
            errors = []
            
            for instruction_data in instructions:
                try:
                    # Ensure chatbot_id matches
                    instruction_data.chatbot_id = chatbot_id
                    
                    # Create the instruction
                    await self.create_instruction(instruction_data)
                    imported_count += 1
                    
                except Exception as e:
                    error_count += 1
                    error_msg = f"Failed to import '{instruction_data.title}': {str(e)}"
                    errors.append(error_msg)
                    logger.warning(error_msg)
            
            success = error_count == 0
            message = f"Imported {imported_count} instructions"
            if error_count > 0:
                message += f", {error_count} failed"
            
            return {
                "success": success,
                "message": message,
                "imported_count": imported_count,
                "skipped_count": skipped_count,
                "error_count": error_count,
                "errors": errors
            }
            
        except Exception as e:
            logger.error(f"Error in bulk import: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Bulk import failed: {str(e)}"
            )
    
    def _generate_instruction_id(self) -> str:
        """Generate a unique instruction ID."""
        import time
        import random
        import string
        
        timestamp = str(int(time.time() * 1000))[-10:]
        random_part = ''.join(random.choices(string.ascii_lowercase + string.digits, k=15))
        return f"ti{timestamp}{random_part}"  # ti = training instruction
    
    def _map_db_to_response(self, db_row: Dict[str, Any]) -> TrainingInstructionResponse:
        """Map database row to response model."""
        return TrainingInstructionResponse(
            id=db_row['id'],
            chatbot_id=db_row['chatbotId'],
            type=InstructionType(db_row['type'].lower()),
            title=db_row['title'],
            content=db_row['content'],
            priority=db_row['priority'],
            is_active=db_row['isActive'],
            created_at=datetime.fromisoformat(db_row['createdAt'].replace('Z', '+00:00')),
            updated_at=datetime.fromisoformat(db_row['updatedAt'].replace('Z', '+00:00'))
        )
    
    def _calculate_type_breakdown(self, instructions: List[TrainingInstructionResponse]) -> Dict[str, int]:
        """Calculate breakdown of instructions by type."""
        breakdown = {t.value: 0 for t in InstructionType}
        for instruction in instructions:
            breakdown[instruction.type.value] += 1
        return breakdown
    
    def _calculate_cosine_similarity(self, embedding1: List[float], embedding2: List[float]) -> float:
        """Calculate cosine similarity between two embeddings."""
        import numpy as np
        
        # Convert to numpy arrays
        vec1 = np.array(embedding1)
        vec2 = np.array(embedding2)
        
        # Calculate cosine similarity
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        similarity = dot_product / (norm1 * norm2)
        return float(similarity)
    
    def _calculate_simple_relevance(self, query: str, content: str) -> float:
        """
        Calculate simple relevance score based on keyword matching.
        This is a fallback when vector similarity search is not available.
        """
        query_words = set(query.lower().split())
        content_words = set(content.lower().split())
        
        if not query_words:
            return 0.0
        
        # Calculate Jaccard similarity
        intersection = query_words.intersection(content_words)
        union = query_words.union(content_words)
        
        if not union:
            return 0.0
        
        return len(intersection) / len(union)
    
    def _generate_test_explanation(
        self, 
        instruction: TrainingInstructionResponse, 
        test_query: str, 
        similarity_score: float,
        would_be_retrieved: bool
    ) -> str:
        """Generate explanation for instruction test results."""
        explanation_parts = []
        
        # Similarity assessment
        if similarity_score >= 0.8:
            explanation_parts.append("High similarity - instruction is very relevant")
        elif similarity_score >= 0.6:
            explanation_parts.append("Moderate similarity - instruction is somewhat relevant")
        else:
            explanation_parts.append("Low similarity - instruction may not be relevant")
        
        # Retrieval assessment
        if would_be_retrieved:
            explanation_parts.append("This instruction would be retrieved and used in responses")
        else:
            explanation_parts.append("This instruction would not be retrieved (below threshold)")
        
        # Type-specific context
        type_context = {
            InstructionType.BEHAVIOR: "for behavioral guidance",
            InstructionType.KNOWLEDGE: "for knowledge-based responses", 
            InstructionType.TONE: "for communication style",
            InstructionType.ESCALATION: "for escalation scenarios"
        }
        
        if instruction.type in type_context:
            explanation_parts.append(f"This {instruction.type.value} instruction is designed {type_context[instruction.type]}")
        
        return ". ".join(explanation_parts) + "."
    
    async def _delete_chatbot_instructions(self, chatbot_id: str) -> int:
        """Delete all instructions for a chatbot."""
        try:
            if self.supabase_client:
                result = self.supabase_client.table('TrainingInstruction').delete().eq('chatbotId', chatbot_id).execute()
                deleted_count = len(result.data) if result.data else 0
                logger.info(f"Deleted {deleted_count} existing instructions for chatbot {chatbot_id}")
                return deleted_count
            else:
                raise ValueError("No database connection available")
                
        except Exception as e:
            logger.error(f"Error deleting chatbot instructions: {e}")
            raise


# Global service instance
_instruction_service: Optional[InstructionService] = None


def get_instruction_service() -> InstructionService:
    """Get the global instruction service instance."""
    global _instruction_service
    if _instruction_service is None:
        _instruction_service = InstructionService()
    return _instruction_service