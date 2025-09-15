"""
API router for escalation management endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Dict, Any
from datetime import datetime

from ..models.escalation import (
    EscalationType, EscalationStatus, UrgencyLevel,
    EscalationRequest, EscalationAnalysis, EscalationMetrics
)
from ..services.escalation_manager import EscalationManager
from ..services.escalation_tracking_service import EscalationTrackingService
from ..services.conversation_service import ConversationService

router = APIRouter(prefix="/api/escalation", tags=["escalation"])

# Initialize services
escalation_manager = EscalationManager()
escalation_tracking = EscalationTrackingService()
conversation_service = ConversationService()


@router.post("/analyze", response_model=EscalationAnalysis)
async def analyze_conversation_for_escalation(
    message: str,
    conversation_id: str,
    chatbot_id: str
):
    """
    Analyze a conversation message for escalation needs.
    
    Args:
        message: Current user message to analyze
        conversation_id: ID of the conversation
        chatbot_id: ID of the chatbot
        
    Returns:
        Escalation analysis result
    """
    try:
        # Get conversation history
        conversation_history = await conversation_service.get_conversation_history(conversation_id)
        
        # Convert to the format expected by escalation manager
        history_messages = []
        for msg in conversation_history:
            history_messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", ""),
                "sentiment_score": msg.get("sentiment_score")
            })
        
        # Analyze for escalation
        analysis = await escalation_manager.analyze_conversation_for_escalation(
            message, history_messages
        )
        
        return analysis
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze conversation: {str(e)}")


@router.post("/create", response_model=EscalationRequest)
async def create_escalation_request(
    conversation_id: str,
    chatbot_id: str,
    escalation_type: EscalationType,
    trigger_reason: Optional[str] = None,
    urgency_level: UrgencyLevel = UrgencyLevel.MEDIUM,
    customer_sentiment: Optional[str] = None,
    conversation_context: Optional[Dict[str, Any]] = None
):
    """
    Create a new escalation request.
    
    Args:
        conversation_id: ID of the conversation to escalate
        chatbot_id: ID of the chatbot
        escalation_type: Type of escalation
        trigger_reason: Reason for escalation
        urgency_level: Urgency level
        customer_sentiment: Customer's emotional state
        conversation_context: Additional context
        
    Returns:
        Created escalation request
    """
    try:
        escalation = await escalation_tracking.create_escalation_request(
            conversation_id=conversation_id,
            chatbot_id=chatbot_id,
            escalation_type=escalation_type,
            trigger_reason=trigger_reason,
            urgency_level=urgency_level,
            customer_sentiment=customer_sentiment,
            conversation_context=conversation_context
        )
        
        # Notify agents
        await escalation_manager.notify_human_agents(escalation)
        
        return escalation
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create escalation: {str(e)}")


@router.put("/{escalation_id}/assign")
async def assign_escalation(
    escalation_id: str,
    agent_id: str
):
    """
    Assign an escalation to a human agent.
    
    Args:
        escalation_id: ID of the escalation
        agent_id: ID of the agent to assign
        
    Returns:
        Updated escalation request
    """
    try:
        escalation = await escalation_tracking.assign_escalation(escalation_id, agent_id)
        
        if not escalation:
            raise HTTPException(status_code=404, detail="Escalation not found")
        
        return escalation
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to assign escalation: {str(e)}")


@router.put("/{escalation_id}/status")
async def update_escalation_status(
    escalation_id: str,
    status: EscalationStatus,
    resolution_notes: Optional[str] = None
):
    """
    Update the status of an escalation request.
    
    Args:
        escalation_id: ID of the escalation
        status: New status
        resolution_notes: Notes about resolution (if resolved)
        
    Returns:
        Updated escalation request
    """
    try:
        escalation = await escalation_tracking.update_escalation_status(
            escalation_id, status, resolution_notes
        )
        
        if not escalation:
            raise HTTPException(status_code=404, detail="Escalation not found")
        
        return escalation
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update escalation status: {str(e)}")


@router.get("/{escalation_id}", response_model=EscalationRequest)
async def get_escalation(escalation_id: str):
    """
    Get an escalation request by ID.
    
    Args:
        escalation_id: ID of the escalation
        
    Returns:
        Escalation request
    """
    try:
        escalation = await escalation_tracking.get_escalation(escalation_id)
        
        if not escalation:
            raise HTTPException(status_code=404, detail="Escalation not found")
        
        return escalation
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get escalation: {str(e)}")


@router.get("/conversation/{conversation_id}", response_model=List[EscalationRequest])
async def get_escalations_by_conversation(conversation_id: str):
    """
    Get all escalations for a specific conversation.
    
    Args:
        conversation_id: ID of the conversation
        
    Returns:
        List of escalation requests
    """
    try:
        escalations = await escalation_tracking.get_escalations_by_conversation(conversation_id)
        return escalations
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get escalations: {str(e)}")


@router.get("/chatbot/{chatbot_id}", response_model=List[EscalationRequest])
async def get_escalations_by_chatbot(
    chatbot_id: str,
    status: Optional[EscalationStatus] = Query(None),
    limit: int = Query(100, ge=1, le=1000)
):
    """
    Get escalations for a specific chatbot.
    
    Args:
        chatbot_id: ID of the chatbot
        status: Optional status filter
        limit: Maximum number of escalations to return
        
    Returns:
        List of escalation requests
    """
    try:
        escalations = await escalation_tracking.get_escalations_by_chatbot(
            chatbot_id, status, limit
        )
        return escalations
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get escalations: {str(e)}")


@router.get("/pending", response_model=List[EscalationRequest])
async def get_pending_escalations(
    urgency_level: Optional[UrgencyLevel] = Query(None)
):
    """
    Get all pending escalations, optionally filtered by urgency.
    
    Args:
        urgency_level: Optional urgency level filter
        
    Returns:
        List of pending escalation requests
    """
    try:
        escalations = await escalation_tracking.get_pending_escalations(urgency_level)
        return escalations
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get pending escalations: {str(e)}")


@router.get("/metrics", response_model=EscalationMetrics)
async def get_escalation_metrics(
    chatbot_id: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None)
):
    """
    Get escalation metrics for analysis.
    
    Args:
        chatbot_id: Optional chatbot ID filter
        start_date: Optional start date filter
        end_date: Optional end date filter
        
    Returns:
        Escalation metrics
    """
    try:
        metrics = await escalation_tracking.get_escalation_metrics(
            chatbot_id, start_date, end_date
        )
        return metrics
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get escalation metrics: {str(e)}")


@router.get("/sla/violations")
async def get_sla_violations():
    """
    Get escalations that may be violating SLA.
    
    Returns:
        List of SLA violations
    """
    try:
        violations = await escalation_tracking.monitor_escalation_sla()
        return {"violations": violations}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get SLA violations: {str(e)}")


@router.get("/agent/{agent_id}/workload")
async def get_agent_workload(agent_id: str):
    """
    Get workload information for a specific agent.
    
    Args:
        agent_id: ID of the agent
        
    Returns:
        Agent workload information
    """
    try:
        workload = await escalation_tracking.get_agent_workload(agent_id)
        return workload
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get agent workload: {str(e)}")


@router.post("/auto-escalate")
async def auto_escalate_overdue():
    """
    Automatically escalate overdue escalations to higher urgency.
    
    Returns:
        List of escalation IDs that were auto-escalated
    """
    try:
        auto_escalated = await escalation_tracking.auto_escalate_overdue()
        return {"auto_escalated": auto_escalated}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to auto-escalate: {str(e)}")


@router.delete("/cleanup")
async def cleanup_old_escalations(days_old: int = Query(90, ge=1)):
    """
    Clean up old resolved escalations.
    
    Args:
        days_old: Number of days old for cleanup threshold
        
    Returns:
        Number of escalations cleaned up
    """
    try:
        cleaned_count = await escalation_tracking.cleanup_old_escalations(days_old)
        return {"cleaned_count": cleaned_count}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cleanup escalations: {str(e)}")


@router.post("/test/trigger-detection")
async def test_trigger_detection(
    message: str,
    conversation_history: Optional[List[Dict[str, Any]]] = None
):
    """
    Test escalation trigger detection for a message.
    This is a utility endpoint for testing and debugging.
    
    Args:
        message: Message to test
        conversation_history: Optional conversation history
        
    Returns:
        Detected escalation signals
    """
    try:
        # Build conversation context
        context = escalation_manager._build_conversation_context(
            message, conversation_history or []
        )
        
        # Detect triggers
        signals = await escalation_manager.detect_escalation_triggers(message, context)
        
        return {
            "signals": signals.dict(),
            "context": context.dict()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to test trigger detection: {str(e)}")