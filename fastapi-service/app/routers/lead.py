"""
API endpoints for lead qualification and scoring.
"""
import logging
from typing import Dict, Any
from datetime import datetime
import uuid

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse

from ..models.lead import (
    LeadAnalysisRequest,
    LeadScoreResponse,
    LeadQualificationTrigger,
    ConversationContextRequest
)
from ..services.lead_analyzer import (
    get_intent_analyzer,
    ConversationContext,
    LeadScore
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/lead", tags=["lead"])


@router.post("/analyze", response_model=LeadScoreResponse)
async def analyze_lead_potential(request: LeadAnalysisRequest):
    """
    Analyze a message for lead potential and scoring.
    
    This endpoint evaluates messages for high-value lead indicators including:
    - Enterprise inquiries and demo requests
    - Bulk order intentions
    - Decision maker language
    - Urgency indicators
    - Contact information extraction
    
    Returns comprehensive lead scoring with CRM-ready data mapping.
    """
    try:
        analyzer = get_intent_analyzer()
        
        if not analyzer.is_ready():
            raise HTTPException(
                status_code=503,
                detail="Lead analyzer service is not ready"
            )
        
        # Convert request context to service context
        conversation_context = None
        if request.conversation_context:
            conversation_context = ConversationContext(
                message_count=request.conversation_context.message_count,
                conversation_length=request.conversation_context.conversation_length,
                engagement_score=request.conversation_context.engagement_score,
                sentiment_history=request.conversation_context.sentiment_history,
                previous_intents=request.conversation_context.previous_intents
            )
        
        # Analyze lead potential
        lead_score = await analyzer.analyze_lead_potential(
            message=request.message,
            conversation_context=conversation_context
        )
        
        # Check if should trigger qualification
        should_qualify = analyzer.should_trigger_lead_qualification(lead_score)
        
        # Generate CRM mapping
        crm_mapping = analyzer.get_crm_data_mapping(lead_score, request.message)
        
        # Build response
        response = LeadScoreResponse(
            total_score=lead_score.total_score,
            priority=lead_score.priority,
            lead_type=lead_score.lead_type,
            confidence=lead_score.confidence,
            should_qualify=should_qualify,
            factors=lead_score.factors,
            extracted_data=lead_score.extracted_data,
            crm_mapping=crm_mapping,
            analyzed_at=datetime.utcnow().isoformat()
        )
        
        logger.info(f"Lead analysis completed - Score: {lead_score.total_score}, Priority: {lead_score.priority.value}")
        
        return response
        
    except ValueError as e:
        logger.warning(f"Invalid lead analysis request: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in lead analysis: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during lead analysis")


@router.post("/qualification-trigger", response_model=LeadQualificationTrigger)
async def create_qualification_trigger(
    lead_score: LeadScoreResponse,
    conversation_id: str,
    message_id: str,
    user_email: str = None,
    chatbot_id: str = None
):
    """
    Create a lead qualification trigger event.
    
    This endpoint creates trigger events for automation workflows when
    high-value leads are detected. The trigger includes all necessary
    data for CRM integration and sales team notification.
    """
    try:
        # Generate unique trigger ID
        trigger_id = f"trig_{str(uuid.uuid4())}"
        
        # Build metadata
        metadata = {
            "source": "lead_analyzer",
            "analysis_version": "1.0.0"
        }
        
        if chatbot_id:
            metadata["chatbot_id"] = chatbot_id
        
        # Create trigger event
        trigger = LeadQualificationTrigger(
            trigger_id=trigger_id,
            lead_score=lead_score,
            conversation_id=conversation_id,
            user_email=user_email,
            message_id=message_id,
            trigger_type="lead_qualification",
            metadata=metadata,
            created_at=datetime.utcnow().isoformat()
        )
        
        logger.info(f"Lead qualification trigger created: {trigger_id} for conversation {conversation_id}")
        
        # TODO: In a real implementation, this would emit an event to the automation system
        # For now, we just return the trigger data
        
        return trigger
        
    except Exception as e:
        logger.error(f"Error creating qualification trigger: {e}")
        raise HTTPException(status_code=500, detail="Failed to create qualification trigger")


@router.get("/analyzer/status")
async def get_analyzer_status():
    """
    Get the status and configuration of the lead analyzer service.
    
    Returns information about supported lead types, scoring factors,
    and service readiness.
    """
    try:
        analyzer = get_intent_analyzer()
        
        service_info = analyzer.get_service_info()
        service_info["ready"] = analyzer.is_ready()
        service_info["timestamp"] = datetime.utcnow().isoformat()
        
        return JSONResponse(content=service_info)
        
    except Exception as e:
        logger.error(f"Error getting analyzer status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get analyzer status")


@router.post("/test/keywords")
async def test_keyword_detection(message: str):
    """
    Test endpoint for keyword detection and scoring.
    
    This is a utility endpoint for testing and debugging the
    keyword detection algorithms used in lead scoring.
    """
    try:
        analyzer = get_intent_analyzer()
        
        if not analyzer.is_ready():
            raise HTTPException(
                status_code=503,
                detail="Lead analyzer service is not ready"
            )
        
        # Perform basic analysis without full scoring
        lead_score = await analyzer.analyze_lead_potential(message)
        
        # Return detailed breakdown for testing
        return {
            "message": message,
            "keyword_density": lead_score.factors.get("keyword_density", 0.0),
            "extracted_data": lead_score.extracted_data,
            "high_value_factors": {
                factor: score for factor, score in lead_score.factors.items()
                if score > 0
            },
            "total_score": lead_score.total_score,
            "analyzed_at": datetime.utcnow().isoformat()
        }
        
    except ValueError as e:
        logger.warning(f"Invalid test request: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in keyword test: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during keyword test")


@router.post("/create-crm-lead")
async def create_crm_lead(
    lead_analysis: Dict[str, Any],
    conversation_id: str,
    user_email: str = None,
    chatbot_id: str = None,
    crm_provider: str = None
):
    """
    Create a lead in the CRM system based on lead analysis results.
    
    This endpoint processes qualified leads and creates them in the
    configured CRM system with proper duplicate handling and
    sales team notifications.
    """
    try:
        from ..services.lead_automation_service import get_lead_automation_service
        
        automation_service = get_lead_automation_service()
        
        if not automation_service.is_ready():
            raise HTTPException(
                status_code=503,
                detail="Lead automation service is not ready"
            )
        
        # Process the qualified lead
        result = await automation_service.process_qualified_lead(
            lead_analysis=lead_analysis,
            conversation_id=conversation_id,
            user_email=user_email,
            chatbot_id=chatbot_id
        )
        
        if result["success"]:
            logger.info(f"CRM lead created successfully for conversation {conversation_id}")
            return result
        else:
            logger.error(f"Failed to create CRM lead: {result.get('error')}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create CRM lead: {result.get('error')}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in CRM lead creation: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during CRM lead creation")


@router.get("/automation/status")
async def get_automation_status():
    """
    Get the status of the lead automation service.
    
    Returns information about CRM integrations, processing statistics,
    and service readiness.
    """
    try:
        from ..services.lead_automation_service import get_lead_automation_service
        
        automation_service = get_lead_automation_service()
        service_info = automation_service.get_service_info()
        
        return JSONResponse(content=service_info)
        
    except Exception as e:
        logger.error(f"Error getting automation status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get automation status")


@router.get("/automation/statistics")
async def get_automation_statistics(days: int = 30):
    """
    Get lead processing statistics for the specified period.
    
    Returns metrics about lead processing, success rates, and
    CRM integration performance.
    """
    try:
        from ..services.lead_automation_service import get_lead_automation_service
        
        automation_service = get_lead_automation_service()
        
        if not automation_service.is_ready():
            raise HTTPException(
                status_code=503,
                detail="Lead automation service is not ready"
            )
        
        statistics = await automation_service.get_lead_statistics(days=days)
        
        return statistics
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting automation statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get automation statistics")


@router.post("/crm/test-connection")
async def test_crm_connection(provider: str = "mock"):
    """
    Test connection to a CRM provider.
    
    This endpoint tests the connection to the specified CRM provider
    and returns the connection status.
    """
    try:
        from ..services.crm_service import get_crm_service
        
        crm_service = get_crm_service()
        
        try:
            crm_provider = crm_service.get_provider(provider)
            connection_ok = await crm_provider.test_connection()
            
            return {
                "provider": provider,
                "connection_status": "connected" if connection_ok else "failed",
                "provider_info": crm_provider.get_provider_info(),
                "tested_at": datetime.utcnow().isoformat()
            }
            
        except Exception as provider_error:
            return {
                "provider": provider,
                "connection_status": "error",
                "error": str(provider_error),
                "tested_at": datetime.utcnow().isoformat()
            }
        
    except Exception as e:
        logger.error(f"Error testing CRM connection: {e}")
        raise HTTPException(status_code=500, detail="Failed to test CRM connection")