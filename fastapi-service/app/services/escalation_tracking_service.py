"""
Escalation tracking and resolution monitoring service.
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import json

from ..models.escalation import (
    EscalationRequest, EscalationStatus, EscalationType, UrgencyLevel,
    EscalationMetrics, NotificationResult
)
from ..config import Settings

logger = logging.getLogger(__name__)
settings = Settings()


class EscalationTrackingService:
    """
    Service for tracking escalation requests and monitoring resolution progress.
    """
    
    def __init__(self):
        # In a real implementation, this would use a database
        # For now, we'll use in-memory storage for demonstration
        self.escalations: Dict[str, EscalationRequest] = {}
        self.resolution_times: List[float] = []
        
    async def create_escalation_request(
        self,
        conversation_id: str,
        chatbot_id: str,
        escalation_type: EscalationType,
        trigger_reason: Optional[str] = None,
        escalation_data: Optional[Dict[str, Any]] = None,
        urgency_level: UrgencyLevel = UrgencyLevel.MEDIUM,
        customer_sentiment: Optional[str] = None,
        conversation_context: Optional[Dict[str, Any]] = None
    ) -> EscalationRequest:
        """
        Create a new escalation request.
        
        Args:
            conversation_id: ID of the conversation being escalated
            chatbot_id: ID of the chatbot
            escalation_type: Type of escalation
            trigger_reason: Reason for escalation
            escalation_data: Additional escalation data
            urgency_level: Urgency level of the escalation
            customer_sentiment: Customer's emotional state
            conversation_context: Relevant conversation context
            
        Returns:
            Created escalation request
        """
        escalation_id = f"esc_{conversation_id}_{int(datetime.utcnow().timestamp())}"
        
        escalation = EscalationRequest(
            id=escalation_id,
            conversation_id=conversation_id,
            chatbot_id=chatbot_id,
            escalation_type=escalation_type,
            trigger_reason=trigger_reason,
            escalation_data=escalation_data or {},
            status=EscalationStatus.PENDING,
            urgency_level=urgency_level,
            customer_sentiment=customer_sentiment,
            conversation_context=conversation_context or {},
            created_at=datetime.utcnow()
        )
        
        # Store escalation (in real implementation, this would be in database)
        self.escalations[escalation_id] = escalation
        
        logger.info(f"Created escalation request {escalation_id} for conversation {conversation_id}")
        
        return escalation
    
    async def assign_escalation(
        self,
        escalation_id: str,
        agent_id: str
    ) -> Optional[EscalationRequest]:
        """
        Assign an escalation to a human agent.
        
        Args:
            escalation_id: ID of the escalation to assign
            agent_id: ID of the agent to assign to
            
        Returns:
            Updated escalation request or None if not found
        """
        escalation = self.escalations.get(escalation_id)
        if not escalation:
            logger.warning(f"Escalation {escalation_id} not found for assignment")
            return None
        
        escalation.assigned_agent_id = agent_id
        escalation.status = EscalationStatus.ASSIGNED
        escalation.updated_at = datetime.utcnow()
        
        logger.info(f"Assigned escalation {escalation_id} to agent {agent_id}")
        
        return escalation
    
    async def update_escalation_status(
        self,
        escalation_id: str,
        status: EscalationStatus,
        resolution_notes: Optional[str] = None
    ) -> Optional[EscalationRequest]:
        """
        Update the status of an escalation request.
        
        Args:
            escalation_id: ID of the escalation to update
            status: New status
            resolution_notes: Notes about resolution (if resolved)
            
        Returns:
            Updated escalation request or None if not found
        """
        escalation = self.escalations.get(escalation_id)
        if not escalation:
            logger.warning(f"Escalation {escalation_id} not found for status update")
            return None
        
        old_status = escalation.status
        escalation.status = status
        escalation.updated_at = datetime.utcnow()
        
        if status == EscalationStatus.RESOLVED:
            escalation.resolved_at = datetime.utcnow()
            escalation.resolution_notes = resolution_notes
            
            # Track resolution time for metrics
            if escalation.created_at:
                resolution_time = (escalation.resolved_at - escalation.created_at).total_seconds() / 3600  # hours
                self.resolution_times.append(resolution_time)
        
        logger.info(f"Updated escalation {escalation_id} status from {old_status} to {status}")
        
        return escalation
    
    async def get_escalation(self, escalation_id: str) -> Optional[EscalationRequest]:
        """
        Get an escalation request by ID.
        
        Args:
            escalation_id: ID of the escalation
            
        Returns:
            Escalation request or None if not found
        """
        return self.escalations.get(escalation_id)
    
    async def get_escalations_by_conversation(self, conversation_id: str) -> List[EscalationRequest]:
        """
        Get all escalations for a specific conversation.
        
        Args:
            conversation_id: ID of the conversation
            
        Returns:
            List of escalation requests for the conversation
        """
        return [
            escalation for escalation in self.escalations.values()
            if escalation.conversation_id == conversation_id
        ]
    
    async def get_escalations_by_chatbot(
        self,
        chatbot_id: str,
        status: Optional[EscalationStatus] = None,
        limit: int = 100
    ) -> List[EscalationRequest]:
        """
        Get escalations for a specific chatbot.
        
        Args:
            chatbot_id: ID of the chatbot
            status: Optional status filter
            limit: Maximum number of escalations to return
            
        Returns:
            List of escalation requests
        """
        escalations = [
            escalation for escalation in self.escalations.values()
            if escalation.chatbot_id == chatbot_id
        ]
        
        if status:
            escalations = [e for e in escalations if e.status == status]
        
        # Sort by creation date (newest first)
        escalations.sort(key=lambda x: x.created_at or datetime.min, reverse=True)
        
        return escalations[:limit]
    
    async def get_pending_escalations(
        self,
        urgency_level: Optional[UrgencyLevel] = None
    ) -> List[EscalationRequest]:
        """
        Get all pending escalations, optionally filtered by urgency.
        
        Args:
            urgency_level: Optional urgency level filter
            
        Returns:
            List of pending escalation requests
        """
        pending = [
            escalation for escalation in self.escalations.values()
            if escalation.status == EscalationStatus.PENDING
        ]
        
        if urgency_level:
            pending = [e for e in pending if e.urgency_level == urgency_level]
        
        # Sort by urgency and creation date
        urgency_order = {
            UrgencyLevel.CRITICAL: 4,
            UrgencyLevel.HIGH: 3,
            UrgencyLevel.MEDIUM: 2,
            UrgencyLevel.LOW: 1
        }
        
        pending.sort(
            key=lambda x: (
                urgency_order.get(x.urgency_level, 0),
                x.created_at or datetime.min
            ),
            reverse=True
        )
        
        return pending
    
    async def get_escalation_metrics(
        self,
        chatbot_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> EscalationMetrics:
        """
        Get escalation metrics for analysis.
        
        Args:
            chatbot_id: Optional chatbot ID filter
            start_date: Optional start date filter
            end_date: Optional end date filter
            
        Returns:
            Escalation metrics
        """
        # Filter escalations based on criteria
        filtered_escalations = list(self.escalations.values())
        
        if chatbot_id:
            filtered_escalations = [e for e in filtered_escalations if e.chatbot_id == chatbot_id]
        
        if start_date:
            filtered_escalations = [
                e for e in filtered_escalations
                if e.created_at and e.created_at >= start_date
            ]
        
        if end_date:
            filtered_escalations = [
                e for e in filtered_escalations
                if e.created_at and e.created_at <= end_date
            ]
        
        # Calculate metrics
        total_escalations = len(filtered_escalations)
        
        # Count by type
        escalations_by_type = {}
        for escalation_type in EscalationType:
            escalations_by_type[escalation_type] = len([
                e for e in filtered_escalations if e.escalation_type == escalation_type
            ])
        
        # Count by urgency
        escalations_by_urgency = {}
        for urgency_level in UrgencyLevel:
            escalations_by_urgency[urgency_level] = len([
                e for e in filtered_escalations if e.urgency_level == urgency_level
            ])
        
        # Calculate resolution metrics
        resolved_escalations = [
            e for e in filtered_escalations if e.status == EscalationStatus.RESOLVED
        ]
        
        resolution_rate = len(resolved_escalations) / total_escalations if total_escalations > 0 else 0.0
        
        # Calculate average resolution time
        resolution_times = []
        for escalation in resolved_escalations:
            if escalation.created_at and escalation.resolved_at:
                resolution_time = (escalation.resolved_at - escalation.created_at).total_seconds() / 3600
                resolution_times.append(resolution_time)
        
        average_resolution_time = sum(resolution_times) / len(resolution_times) if resolution_times else None
        
        return EscalationMetrics(
            total_escalations=total_escalations,
            escalations_by_type=escalations_by_type,
            escalations_by_urgency=escalations_by_urgency,
            average_resolution_time=average_resolution_time,
            resolution_rate=resolution_rate
        )
    
    async def monitor_escalation_sla(self) -> List[Dict[str, Any]]:
        """
        Monitor escalations for SLA violations.
        
        Returns:
            List of escalations that may be violating SLA
        """
        sla_thresholds = {
            UrgencyLevel.CRITICAL: 1,  # 1 hour
            UrgencyLevel.HIGH: 4,      # 4 hours
            UrgencyLevel.MEDIUM: 24,   # 24 hours
            UrgencyLevel.LOW: 72       # 72 hours
        }
        
        violations = []
        current_time = datetime.utcnow()
        
        for escalation in self.escalations.values():
            if escalation.status in [EscalationStatus.RESOLVED, EscalationStatus.CANCELLED]:
                continue
            
            if not escalation.created_at:
                continue
            
            threshold_hours = sla_thresholds.get(escalation.urgency_level, 24)
            threshold_time = escalation.created_at + timedelta(hours=threshold_hours)
            
            if current_time > threshold_time:
                hours_overdue = (current_time - threshold_time).total_seconds() / 3600
                violations.append({
                    "escalation_id": escalation.id,
                    "conversation_id": escalation.conversation_id,
                    "urgency_level": escalation.urgency_level.value,
                    "hours_overdue": round(hours_overdue, 2),
                    "assigned_agent": escalation.assigned_agent_id,
                    "status": escalation.status.value
                })
        
        return violations
    
    async def get_agent_workload(self, agent_id: str) -> Dict[str, Any]:
        """
        Get workload information for a specific agent.
        
        Args:
            agent_id: ID of the agent
            
        Returns:
            Agent workload information
        """
        agent_escalations = [
            escalation for escalation in self.escalations.values()
            if escalation.assigned_agent_id == agent_id
            and escalation.status not in [EscalationStatus.RESOLVED, EscalationStatus.CANCELLED]
        ]
        
        # Count by urgency
        workload_by_urgency = {}
        for urgency_level in UrgencyLevel:
            workload_by_urgency[urgency_level.value] = len([
                e for e in agent_escalations if e.urgency_level == urgency_level
            ])
        
        # Calculate average age of open escalations
        current_time = datetime.utcnow()
        ages = []
        for escalation in agent_escalations:
            if escalation.created_at:
                age_hours = (current_time - escalation.created_at).total_seconds() / 3600
                ages.append(age_hours)
        
        average_age = sum(ages) / len(ages) if ages else 0.0
        
        return {
            "agent_id": agent_id,
            "total_active_escalations": len(agent_escalations),
            "workload_by_urgency": workload_by_urgency,
            "average_escalation_age_hours": round(average_age, 2),
            "oldest_escalation_hours": max(ages) if ages else 0.0
        }
    
    async def auto_escalate_overdue(self) -> List[str]:
        """
        Automatically escalate overdue escalations to higher urgency.
        
        Returns:
            List of escalation IDs that were auto-escalated
        """
        auto_escalated = []
        violations = await self.monitor_escalation_sla()
        
        for violation in violations:
            escalation_id = violation["escalation_id"]
            escalation = self.escalations.get(escalation_id)
            
            if not escalation:
                continue
            
            # Auto-escalate urgency if significantly overdue
            hours_overdue = violation["hours_overdue"]
            
            if hours_overdue > 24 and escalation.urgency_level != UrgencyLevel.CRITICAL:
                # Escalate to next urgency level
                if escalation.urgency_level == UrgencyLevel.LOW:
                    escalation.urgency_level = UrgencyLevel.MEDIUM
                elif escalation.urgency_level == UrgencyLevel.MEDIUM:
                    escalation.urgency_level = UrgencyLevel.HIGH
                elif escalation.urgency_level == UrgencyLevel.HIGH:
                    escalation.urgency_level = UrgencyLevel.CRITICAL
                
                escalation.updated_at = datetime.utcnow()
                auto_escalated.append(escalation_id)
                
                logger.warning(f"Auto-escalated {escalation_id} to {escalation.urgency_level.value} due to SLA violation")
        
        return auto_escalated
    
    async def cleanup_old_escalations(self, days_old: int = 90) -> int:
        """
        Clean up old resolved escalations.
        
        Args:
            days_old: Number of days old for cleanup threshold
            
        Returns:
            Number of escalations cleaned up
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days_old)
        cleaned_count = 0
        
        escalations_to_remove = []
        for escalation_id, escalation in self.escalations.items():
            if (escalation.status == EscalationStatus.RESOLVED and
                escalation.resolved_at and
                escalation.resolved_at < cutoff_date):
                escalations_to_remove.append(escalation_id)
        
        for escalation_id in escalations_to_remove:
            del self.escalations[escalation_id]
            cleaned_count += 1
        
        logger.info(f"Cleaned up {cleaned_count} old escalations")
        return cleaned_count