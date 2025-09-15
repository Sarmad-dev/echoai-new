"""
Vision analysis API endpoints for image processing and analysis.
"""
import logging
from typing import Dict, Any
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import JSONResponse

from ..models.vision import (
    VisionAnalysisRequest,
    VisionAnalysisResponse,
    AnalysisType,
    ProductCondition,
    InvoiceData,
    InventoryCount,
    VisionError,
    ImageAnalysisRecord
)
from ..services.vision_service import get_vision_service
from ..services.image_analysis_service import get_image_analysis_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vision", tags=["vision"])


@router.post("/analyze", response_model=VisionAnalysisResponse)
async def analyze_image(request: VisionAnalysisRequest):
    """
    Analyze an image using OpenAI GPT-4-Vision API.
    
    Supports multiple analysis types:
    - product_condition: Assess product condition for returns
    - invoice_extraction: Extract structured data from invoices
    - inventory_count: Count items in inventory images
    - custom: Use custom analysis prompt
    
    Args:
        request: Vision analysis request with image URL and analysis type
        
    Returns:
        VisionAnalysisResponse with analysis results
        
    Raises:
        HTTPException: If analysis fails or invalid parameters
    """
    try:
        logger.info(f"Starting vision analysis: {request.analysis_type} for {request.image_url}")
        
        # Perform the analysis
        vision_service = get_vision_service()
        result = await vision_service.analyze_image(
            image_url=request.image_url,
            analysis_type=request.analysis_type,
            custom_prompt=request.custom_prompt
        )
        
        # Store analysis result in database
        image_analysis_service = get_image_analysis_service()
        confidence_score = None
        if isinstance(result["result"], dict) and "confidence" in result["result"]:
            confidence_score = result["result"]["confidence"]
        
        analysis_id = await image_analysis_service.store_analysis_result(
            image_url=request.image_url,
            analysis_type=result["analysis_type"],
            prompt=result["prompt"],
            analysis_result=result["result"],
            processing_time=int(result["processing_time_ms"]),
            confidence_score=confidence_score
        )
        
        # Create response
        response = VisionAnalysisResponse(
            analysis_type=request.analysis_type,
            image_url=request.image_url,
            result=result["result"],
            processing_time_ms=result["processing_time_ms"],
            created_at=datetime.utcnow().isoformat() + "Z"
        )
        
        # Set the analysis_id if storage was successful
        if analysis_id:
            response.analysis_id = analysis_id
        
        logger.info(f"Vision analysis completed successfully: {response.analysis_id}")
        return response
        
    except VisionError as e:
        logger.error(f"Vision analysis error: {e.error_message}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_type": e.error_type,
                "error_message": e.error_message,
                "image_url": e.image_url
            }
        )
    except ValueError as e:
        logger.error(f"Invalid request parameters: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid request parameters: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error in vision analysis: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during vision analysis"
        )


@router.post("/analyze/product-condition", response_model=ProductCondition)
async def analyze_product_condition(image_url: str):
    """
    Analyze product condition for return eligibility.
    
    Args:
        image_url: URL of the product image to analyze
        
    Returns:
        ProductCondition with detailed condition assessment
        
    Raises:
        HTTPException: If analysis fails
    """
    try:
        logger.info(f"Analyzing product condition for: {image_url}")
        
        vision_service = get_vision_service()
        result = await vision_service.analyze_product_condition(image_url)
        
        logger.info(f"Product condition analysis completed: {result.condition}")
        return result
        
    except VisionError as e:
        logger.error(f"Product condition analysis error: {e.error_message}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_type": e.error_type,
                "error_message": e.error_message,
                "image_url": e.image_url
            }
        )
    except Exception as e:
        logger.error(f"Unexpected error in product condition analysis: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during product condition analysis"
        )


@router.post("/analyze/invoice", response_model=InvoiceData)
async def extract_invoice_data(image_url: str):
    """
    Extract structured data from invoice images.
    
    Args:
        image_url: URL of the invoice image to analyze
        
    Returns:
        InvoiceData with extracted invoice information
        
    Raises:
        HTTPException: If extraction fails
    """
    try:
        logger.info(f"Extracting invoice data from: {image_url}")
        
        vision_service = get_vision_service()
        result = await vision_service.extract_invoice_data(image_url)
        
        logger.info(f"Invoice data extraction completed: {result.invoice_number}")
        return result
        
    except VisionError as e:
        logger.error(f"Invoice extraction error: {e.error_message}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_type": e.error_type,
                "error_message": e.error_message,
                "image_url": e.image_url
            }
        )
    except Exception as e:
        logger.error(f"Unexpected error in invoice extraction: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during invoice extraction"
        )


@router.post("/analyze/inventory", response_model=InventoryCount)
async def count_inventory(image_url: str):
    """
    Count items in inventory images.
    
    Args:
        image_url: URL of the inventory image to analyze
        
    Returns:
        InventoryCount with item counting results
        
    Raises:
        HTTPException: If counting fails
    """
    try:
        logger.info(f"Counting inventory items in: {image_url}")
        
        vision_service = get_vision_service()
        result = await vision_service.count_inventory(image_url)
        
        logger.info(f"Inventory counting completed: {result.total_items} items")
        return result
        
    except VisionError as e:
        logger.error(f"Inventory counting error: {e.error_message}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_type": e.error_type,
                "error_message": e.error_message,
                "image_url": e.image_url
            }
        )
    except Exception as e:
        logger.error(f"Unexpected error in inventory counting: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during inventory counting"
        )


@router.get("/health")
async def health_check():
    """
    Health check endpoint for vision service.
    
    Returns:
        Service health status
    """
    try:
        # Basic health check - verify OpenAI client is configured
        vision_service = get_vision_service()
        if not vision_service.client:
            raise Exception("Vision service not properly initialized")
        
        return {
            "status": "healthy",
            "service": "vision_analysis",
            "model": vision_service.model,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        
    except Exception as e:
        logger.error(f"Vision service health check failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Vision service is not available"
        )