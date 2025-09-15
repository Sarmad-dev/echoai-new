"""
Lead automation service for automated CRM lead creation and management.
"""
import logging
import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import uuid

from .crm_service import get_crm_service, CRMIntegrationError
from .lead_analyzer import get_intent_analyzer

logger = logging.getLogger(__name__)


class LeadAutomationService:
    """
    Service for automating lead qualification and CRM integration.
    
    This service handles:
    - Automated lead creation in CRM systems
    - Lead prioritization and assignment
    - Sales team notifications
    - Duplicate detection and management
    - Lead validation and data enrichment
    """
    
    def __init__(self):
        """Initialize lead automation service."""
        self.crm_service = get_crm_service()
        self.intent_analyzer = get_intent_analyzer()
        self.lead_queue = []
        self.processing_stats = {
            "total_processed": 0,
            "successful_creations": 0,
            "failed_creations": 0,
            "duplicates_found": 0,
            "notifications_sent": 0
        }
        self._is_ready = True
        logger.info("Lead automation service initialized")
    
    async def process_qualified_lead(
        self, 
        lead_analysis: Dict[str, Any], 
        conversation_id: str,
        user_email: Optional[str] = None,
        chatbot_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process a qualified lead and create it in the CRM.
        
        Args:
            lead_analysis: Lead analysis results from IntentAnalyzer
            conversation_id: Associated conversation ID
            user_email: User email if available
            chatbot_id: Chatbot ID if from widget
            
        Returns:
            Dictionary with processing results
        """
        try:
            self.processing_stats["total_processed"] += 1
            
            logger.info(f"Processing qualified lead for conversation {conversation_id}")
            
            # Prepare lead data for CRM
            crm_lead_data = await self._prepare_crm_lead_data(
                lead_analysis, conversation_id, user_email, chatbot_id
            )
            
            # Validate lead data
            validation_result = await self._validate_lead_data(crm_lead_data)
            if not validation_result["valid"]:
                logger.warning(f"Lead validation failed: {validation_result['errors']}")
                return {
                    "success": False,
                    "error": "Lead validation failed",
                    "validation_errors": validation_result["errors"]
                }
            
            # Check for duplicates and determine action
            duplicate_action = await self._check_duplicate_strategy(crm_lead_data)
            
            # Create or update lead in CRM
            crm_result = await self._create_or_update_crm_lead(crm_lead_data, duplicate_action)
            
            if crm_result["success"]:
                self.processing_stats["successful_creations"] += 1
                
                # Determine if sales team notification is needed
                notification_sent = await self._handle_sales_notification(crm_lead_data, crm_result)
                if notification_sent:
                    self.processing_stats["notifications_sent"] += 1
                
                # Log lead creation for analytics
                await self._log_lead_creation(crm_lead_data, crm_result)
                
                logger.info(f"Successfully processed lead: {crm_result.get('contact', {}).get('id')}")
                
                return {
                    "success": True,
                    "crm_result": crm_result,
                    "notification_sent": notification_sent,
                    "duplicate_action": duplicate_action["action"],
                    "processing_time": datetime.utcnow().isoformat()
                }
            else:
                self.processing_stats["failed_creations"] += 1
                logger.error(f"Failed to create lead in CRM: {crm_result.get('error')}")
                
                return {
                    "success": False,
                    "error": crm_result.get("error"),
                    "crm_provider": crm_result.get("provider")
                }
                
        except Exception as e:
            self.processing_stats["failed_creations"] += 1
            logger.error(f"Error processing qualified lead: {e}")
            return {
                "success": False,
                "error": str(e),
                "exception_type": type(e).__name__
            }
    
    async def _prepare_crm_lead_data(
        self, 
        lead_analysis: Dict[str, Any], 
        conversation_id: str,
        user_email: Optional[str] = None,
        chatbot_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Prepare lead data for CRM creation."""
        try:
            # Extract base data from lead analysis
            crm_mapping = lead_analysis.get("crm_mapping", {})
            extracted_data = lead_analysis.get("extracted_data", {})
            
            # Build comprehensive lead data
            lead_data = {
                # Contact information
                "email": user_email or extracted_data.get("email"),
                "name": extracted_data.get("name"),
                "first_name": self._extract_first_name(extracted_data.get("name")),
                "last_name": self._extract_last_name(extracted_data.get("name")),
                "company": extracted_data.get("company"),
                "phone": extracted_data.get("phone"),
                
                # Lead scoring and classification
                "lead_score": lead_analysis.get("lead_score", 0),
                "lead_priority": lead_analysis.get("priority", "low"),
                "lead_type": lead_analysis.get("lead_type", "general_inquiry"),
                "confidence": lead_analysis.get("confidence", 0),
                
                # Source and tracking
                "lead_source": "chatbot_automation",
                "conversation_id": conversation_id,
                "chatbot_id": chatbot_id,
                "qualification_date": datetime.utcnow().isoformat(),
                
                # Original context
                "original_message": crm_mapping.get("original_message", ""),
                "scoring_factors": lead_analysis.get("factors", {}),
                
                # Follow-up actions
                "follow_up_action": crm_mapping.get("follow_up_action"),
                "demo_requested": crm_mapping.get("demo_requested", False),
                "enterprise_inquiry": crm_mapping.get("enterprise_inquiry", False),
                "bulk_order_inquiry": crm_mapping.get("bulk_order_inquiry", False),
                
                # Additional metadata
                "automation_version": "1.0.0",
                "processed_at": datetime.utcnow().isoformat()
            }
            
            # Remove None values
            lead_data = {k: v for k, v in lead_data.items() if v is not None}
            
            return lead_data
            
        except Exception as e:
            logger.error(f"Error preparing CRM lead data: {e}")
            raise
    
    def _extract_first_name(self, full_name: Optional[str]) -> Optional[str]:
        """Extract first name from full name."""
        if not full_name:
            return None
        
        # Simple extraction - take first word
        parts = full_name.strip().split()
        return parts[0] if parts else None
    
    def _extract_last_name(self, full_name: Optional[str]) -> Optional[str]:
        """Extract last name from full name."""
        if not full_name:
            return None
        
        # Simple extraction - take last word if more than one word
        parts = full_name.strip().split()
        return parts[-1] if len(parts) > 1 else None
    
    async def _validate_lead_data(self, lead_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate lead data before CRM creation."""
        errors = []
        
        # Check required fields
        if not lead_data.get("email") and not lead_data.get("phone"):
            errors.append("Either email or phone is required")
        
        # Validate email format if provided
        if lead_data.get("email"):
            email = lead_data["email"]
            if "@" not in email or "." not in email.split("@")[-1]:
                errors.append("Invalid email format")
        
        # Validate phone format if provided
        if lead_data.get("phone"):
            phone = lead_data["phone"]
            # Remove non-digits and check length
            digits = ''.join(filter(str.isdigit, phone))
            if len(digits) < 10:
                errors.append("Phone number must have at least 10 digits")
        
        # Validate lead score
        lead_score = lead_data.get("lead_score", 0)
        if not isinstance(lead_score, (int, float)) or lead_score < 0 or lead_score > 1:
            errors.append("Lead score must be between 0 and 1")
        
        # Validate priority
        valid_priorities = ["low", "medium", "high", "urgent"]
        if lead_data.get("lead_priority") not in valid_priorities:
            errors.append(f"Lead priority must be one of: {valid_priorities}")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors
        }
    
    async def _check_duplicate_strategy(self, lead_data: Dict[str, Any]) -> Dict[str, Any]:
        """Check for duplicate leads and determine action strategy."""
        try:
            # Search for existing contacts by email
            existing_contacts = []
            if lead_data.get("email"):
                provider = self.crm_service.get_provider()
                existing_contacts = await provider.search_contacts({"email": lead_data["email"]})
            
            if existing_contacts:
                self.processing_stats["duplicates_found"] += 1
                
                # Analyze existing contact to determine best action
                existing_contact = existing_contacts[0]
                
                # Check if this is a recent duplicate (within 24 hours)
                created_at = existing_contact.get("created_at")
                if created_at:
                    try:
                        created_time = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                        if datetime.utcnow() - created_time.replace(tzinfo=None) < timedelta(hours=24):
                            return {
                                "action": "skip",
                                "reason": "Recent duplicate found",
                                "existing_contact": existing_contact
                            }
                    except Exception:
                        pass  # Continue with update if date parsing fails
                
                # Update existing contact with new information
                return {
                    "action": "update",
                    "reason": "Existing contact found, updating with new lead data",
                    "existing_contact": existing_contact
                }
            
            # No duplicates found, create new contact
            return {
                "action": "create",
                "reason": "No existing contact found"
            }
            
        except Exception as e:
            logger.error(f"Error checking duplicate strategy: {e}")
            # Default to create if duplicate check fails
            return {
                "action": "create",
                "reason": "Duplicate check failed, proceeding with creation"
            }
    
    async def _create_or_update_crm_lead(
        self, 
        lead_data: Dict[str, Any], 
        duplicate_action: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create or update lead in CRM based on duplicate strategy."""
        try:
            action = duplicate_action["action"]
            
            if action == "skip":
                logger.info("Skipping lead creation due to recent duplicate")
                return {
                    "success": True,
                    "action": "skipped",
                    "contact": duplicate_action["existing_contact"],
                    "reason": duplicate_action["reason"]
                }
            
            # Determine if we should create a deal
            create_deal = self._should_create_deal(lead_data)
            
            # Create or update lead in CRM
            crm_result = await self.crm_service.create_lead(
                lead_data=lead_data,
                create_deal=create_deal
            )
            
            return {
                "success": True,
                "action": action,
                "contact": crm_result.get("contact"),
                "deal": crm_result.get("deal"),
                "provider": self.crm_service.default_provider
            }
            
        except CRMIntegrationError as e:
            logger.error(f"CRM integration error: {e}")
            return {
                "success": False,
                "error": str(e),
                "provider": self.crm_service.default_provider
            }
        except Exception as e:
            logger.error(f"Unexpected error creating CRM lead: {e}")
            return {
                "success": False,
                "error": str(e),
                "exception_type": type(e).__name__
            }
    
    def _should_create_deal(self, lead_data: Dict[str, Any]) -> bool:
        """Determine if a deal should be created for this lead."""
        # Create deals for high-value lead types
        high_value_types = ["demo_request", "enterprise_inquiry", "bulk_order"]
        lead_type = lead_data.get("lead_type", "general_inquiry")
        
        # Create deals for high priority leads
        high_priorities = ["high", "urgent"]
        priority = lead_data.get("lead_priority", "low")
        
        # Create deals for high-scoring leads
        lead_score = lead_data.get("lead_score", 0)
        
        return (
            lead_type in high_value_types or 
            priority in high_priorities or 
            lead_score > 0.6
        )
    
    async def _handle_sales_notification(
        self, 
        lead_data: Dict[str, Any], 
        crm_result: Dict[str, Any]
    ) -> bool:
        """Handle sales team notification for high-priority leads."""
        try:
            # Use CRM service notification system
            return await self.crm_service.notify_sales_team(lead_data, crm_result)
            
        except Exception as e:
            logger.error(f"Error handling sales notification: {e}")
            return False
    
    async def _log_lead_creation(
        self, 
        lead_data: Dict[str, Any], 
        crm_result: Dict[str, Any]
    ):
        """Log lead creation for analytics and auditing."""
        try:
            log_entry = {
                "timestamp": datetime.utcnow().isoformat(),
                "conversation_id": lead_data.get("conversation_id"),
                "lead_type": lead_data.get("lead_type"),
                "lead_priority": lead_data.get("lead_priority"),
                "lead_score": lead_data.get("lead_score"),
                "crm_contact_id": crm_result.get("contact", {}).get("id"),
                "crm_deal_id": crm_result.get("deal", {}).get("id"),
                "crm_provider": crm_result.get("provider"),
                "action_taken": crm_result.get("action"),
                "success": crm_result.get("success", False)
            }
            
            # TODO: Store in analytics database or send to analytics service
            logger.info(f"Lead creation logged: {log_entry}")
            
        except Exception as e:
            logger.error(f"Error logging lead creation: {e}")
    
    async def get_lead_statistics(self, days: int = 30) -> Dict[str, Any]:
        """Get lead processing statistics."""
        try:
            # TODO: Implement actual statistics from database
            # For now, return current session stats
            
            return {
                "period_days": days,
                "total_processed": self.processing_stats["total_processed"],
                "successful_creations": self.processing_stats["successful_creations"],
                "failed_creations": self.processing_stats["failed_creations"],
                "duplicates_found": self.processing_stats["duplicates_found"],
                "notifications_sent": self.processing_stats["notifications_sent"],
                "success_rate": (
                    self.processing_stats["successful_creations"] / 
                    max(self.processing_stats["total_processed"], 1)
                ) * 100,
                "duplicate_rate": (
                    self.processing_stats["duplicates_found"] / 
                    max(self.processing_stats["total_processed"], 1)
                ) * 100,
                "generated_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting lead statistics: {e}")
            return {"error": str(e)}
    
    def is_ready(self) -> bool:
        """Check if lead automation service is ready."""
        return (
            self._is_ready and 
            self.crm_service.is_ready() and 
            self.intent_analyzer.is_ready()
        )
    
    def get_service_info(self) -> Dict[str, Any]:
        """Get service information and status."""
        return {
            "service": "LeadAutomationService",
            "version": "1.0.0",
            "ready": self.is_ready(),
            "processing_stats": self.processing_stats,
            "crm_service": self.crm_service.get_service_info(),
            "intent_analyzer": self.intent_analyzer.get_service_info()
        }


# Global service instance
_lead_automation_service = None


def get_lead_automation_service() -> LeadAutomationService:
    """
    Get the global lead automation service instance.
    
    Returns:
        LeadAutomationService instance
    """
    global _lead_automation_service
    
    if _lead_automation_service is None:
        _lead_automation_service = LeadAutomationService()
    
    return _lead_automation_service