"""
Image analysis database service for storing and retrieving analysis results.
"""
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
import uuid

from supabase import create_client, Client
from ..config import settings
from ..models.vision import ImageAnalysisRecord

logger = logging.getLogger(__name__)


class ImageAnalysisService:
    """Service for managing image analysis records in the database."""
    
    def __init__(self):
        """Initialize the image analysis service with Supabase client."""
        self.supabase_client: Optional[Client] = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Supabase client for database operations."""
        try:
            if settings.SUPABASE_URL and settings.SUPABASE_KEY:
                self.supabase_client = create_client(
                    settings.SUPABASE_URL,
                    settings.SUPABASE_KEY
                )
                logger.info("Image analysis service Supabase client initialized successfully")
                
                # Test the connection
                try:
                    # Check if ImageAnalysis table exists
                    test_response = self.supabase_client.table("ImageAnalysis").select("id").limit(1).execute()
                    logger.info("ImageAnalysis table connection test successful")
                except Exception as test_error:
                    logger.warning(f"ImageAnalysis table test failed (table may not exist yet): {test_error}")
                    # Don't raise here as the table might not be created yet
                    
            else:
                logger.error("Supabase credentials not provided for image analysis service")
                raise ValueError("SUPABASE_URL and SUPABASE_KEY are required")
        except Exception as e:
            logger.error(f"Failed to initialize image analysis service: {e}")
            logger.warning("Image analysis service will operate without database connection")
            self.supabase_client = None
    
    async def store_analysis_result(
        self,
        image_url: str,
        analysis_type: str,
        prompt: str,
        analysis_result: Dict[str, Any],
        processing_time: int,
        message_id: Optional[str] = None,
        confidence_score: Optional[float] = None
    ) -> Optional[str]:
        """
        Store image analysis result in the database.
        
        Args:
            image_url: URL of the analyzed image
            analysis_type: Type of analysis performed
            prompt: Prompt used for analysis
            analysis_result: Structured analysis results
            processing_time: Processing time in milliseconds
            message_id: Associated message ID if from chat
            confidence_score: Overall confidence score
            
        Returns:
            Analysis record ID if successful, None if failed
        """
        try:
            if not self.supabase_client:
                logger.warning("Database not available, skipping analysis storage")
                return None
            
            analysis_id = str(uuid.uuid4())
            created_at = datetime.utcnow().isoformat() + "Z"
            
            record_data = {
                "id": analysis_id,
                "messageId": message_id,
                "imageUrl": image_url,
                "analysisType": analysis_type,
                "prompt": prompt,
                "analysisResult": analysis_result,
                "processingTime": processing_time,
                "confidenceScore": confidence_score,
                "createdAt": created_at
            }
            
            response = self.supabase_client.table("ImageAnalysis").insert(record_data).execute()
            
            if response.data:
                logger.info(f"Analysis result stored successfully: {analysis_id}")
                return analysis_id
            else:
                logger.error("Failed to store analysis result: no data returned")
                return None
                
        except Exception as e:
            logger.error(f"Error storing analysis result: {e}")
            return None
    
    async def get_analysis_by_id(self, analysis_id: str) -> Optional[ImageAnalysisRecord]:
        """
        Retrieve image analysis record by ID.
        
        Args:
            analysis_id: The analysis record ID
            
        Returns:
            ImageAnalysisRecord if found, None if not found
        """
        try:
            if not self.supabase_client:
                logger.warning("Database not available")
                return None
            
            response = self.supabase_client.table("ImageAnalysis").select("*").eq("id", analysis_id).execute()
            
            if response.data and len(response.data) > 0:
                data = response.data[0]
                return ImageAnalysisRecord(
                    id=data["id"],
                    message_id=data.get("messageId"),
                    image_url=data["imageUrl"],
                    analysis_type=data["analysisType"],
                    prompt=data["prompt"],
                    analysis_result=data["analysisResult"],
                    processing_time=data["processingTime"],
                    confidence_score=data.get("confidenceScore"),
                    created_at=data["createdAt"]
                )
            else:
                logger.warning(f"Analysis record not found: {analysis_id}")
                return None
                
        except Exception as e:
            logger.error(f"Error retrieving analysis record: {e}")
            return None
    
    async def get_analyses_by_message_id(self, message_id: str) -> List[ImageAnalysisRecord]:
        """
        Retrieve all image analysis records for a specific message.
        
        Args:
            message_id: The message ID
            
        Returns:
            List of ImageAnalysisRecord objects
        """
        try:
            if not self.supabase_client:
                logger.warning("Database not available")
                return []
            
            response = self.supabase_client.table("ImageAnalysis").select("*").eq("messageId", message_id).execute()
            
            records = []
            if response.data:
                for data in response.data:
                    records.append(ImageAnalysisRecord(
                        id=data["id"],
                        message_id=data.get("messageId"),
                        image_url=data["imageUrl"],
                        analysis_type=data["analysisType"],
                        prompt=data["prompt"],
                        analysis_result=data["analysisResult"],
                        processing_time=data["processingTime"],
                        confidence_score=data.get("confidenceScore"),
                        created_at=data["createdAt"]
                    ))
            
            return records
            
        except Exception as e:
            logger.error(f"Error retrieving analysis records for message: {e}")
            return []
    
    async def get_recent_analyses(
        self, 
        limit: int = 50, 
        analysis_type: Optional[str] = None
    ) -> List[ImageAnalysisRecord]:
        """
        Retrieve recent image analysis records.
        
        Args:
            limit: Maximum number of records to return
            analysis_type: Filter by analysis type (optional)
            
        Returns:
            List of ImageAnalysisRecord objects
        """
        try:
            if not self.supabase_client:
                logger.warning("Database not available")
                return []
            
            query = self.supabase_client.table("ImageAnalysis").select("*")
            
            if analysis_type:
                query = query.eq("analysisType", analysis_type)
            
            response = query.order("createdAt", desc=True).limit(limit).execute()
            
            records = []
            if response.data:
                for data in response.data:
                    records.append(ImageAnalysisRecord(
                        id=data["id"],
                        message_id=data.get("messageId"),
                        image_url=data["imageUrl"],
                        analysis_type=data["analysisType"],
                        prompt=data["prompt"],
                        analysis_result=data["analysisResult"],
                        processing_time=data["processingTime"],
                        confidence_score=data.get("confidenceScore"),
                        created_at=data["createdAt"]
                    ))
            
            return records
            
        except Exception as e:
            logger.error(f"Error retrieving recent analysis records: {e}")
            return []
    
    async def delete_analysis(self, analysis_id: str) -> bool:
        """
        Delete an image analysis record.
        
        Args:
            analysis_id: The analysis record ID to delete
            
        Returns:
            True if successful, False if failed
        """
        try:
            if not self.supabase_client:
                logger.warning("Database not available")
                return False
            
            response = self.supabase_client.table("ImageAnalysis").delete().eq("id", analysis_id).execute()
            
            if response.data:
                logger.info(f"Analysis record deleted successfully: {analysis_id}")
                return True
            else:
                logger.warning(f"Analysis record not found for deletion: {analysis_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error deleting analysis record: {e}")
            return False
    
    def is_ready(self) -> bool:
        """Check if the image analysis service is ready."""
        return self.supabase_client is not None
    
    def get_service_info(self) -> Dict[str, Any]:
        """Get information about the image analysis service configuration."""
        return {
            "supabase_client_ready": self.supabase_client is not None,
            "has_supabase_url": bool(settings.SUPABASE_URL),
            "has_supabase_key": bool(settings.SUPABASE_KEY),
            "service_ready": self.is_ready()
        }


# Global service instance
image_analysis_service: Optional[ImageAnalysisService] = None


def get_image_analysis_service() -> ImageAnalysisService:
    """Get the global image analysis service instance."""
    global image_analysis_service
    if image_analysis_service is None:
        image_analysis_service = ImageAnalysisService()
    return image_analysis_service