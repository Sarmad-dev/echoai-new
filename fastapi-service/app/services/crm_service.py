"""
CRM integration service for automated lead creation and management.
"""
import logging
import asyncio
from typing import Dict, Any, Optional, List, Protocol
from datetime import datetime
from abc import ABC, abstractmethod
from enum import Enum

logger = logging.getLogger(__name__)


class CRMProvider(Enum):
    """Supported CRM providers."""
    HUBSPOT = "hubspot"
    SALESFORCE = "salesforce"
    PIPEDRIVE = "pipedrive"
    MOCK = "mock"  # For testing


class LeadPriority(Enum):
    """Lead priority levels for CRM."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class CRMIntegrationError(Exception):
    """Exception raised for CRM integration errors."""
    pass


class CRMProvider(Protocol):
    """Protocol for CRM provider implementations."""
    
    async def create_contact(self, contact_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a contact in the CRM."""
        ...
    
    async def create_deal(self, deal_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a deal/opportunity in the CRM."""
        ...
    
    async def update_contact(self, contact_id: str, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing contact."""
        ...
    
    async def search_contacts(self, search_criteria: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Search for existing contacts."""
        ...
    
    async def test_connection(self) -> bool:
        """Test the CRM connection."""
        ...


class BaseCRMProvider(ABC):
    """Base class for CRM provider implementations."""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize the CRM provider with configuration."""
        self.config = config
        self.provider_name = self.__class__.__name__
        self._is_ready = False
        logger.info(f"Initializing {self.provider_name} CRM provider")
    
    @abstractmethod
    async def create_contact(self, contact_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a contact in the CRM."""
        pass
    
    @abstractmethod
    async def create_deal(self, deal_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a deal/opportunity in the CRM."""
        pass
    
    @abstractmethod
    async def update_contact(self, contact_id: str, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing contact."""
        pass
    
    @abstractmethod
    async def search_contacts(self, search_criteria: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Search for existing contacts."""
        pass
    
    @abstractmethod
    async def test_connection(self) -> bool:
        """Test the CRM connection."""
        pass
    
    def is_ready(self) -> bool:
        """Check if the provider is ready."""
        return self._is_ready
    
    def get_provider_info(self) -> Dict[str, Any]:
        """Get provider information."""
        return {
            "provider": self.provider_name,
            "ready": self._is_ready,
            "config_keys": list(self.config.keys()) if self.config else []
        }


class MockCRMProvider(BaseCRMProvider):
    """Mock CRM provider for testing and development."""
    
    def __init__(self, config: Dict[str, Any] = None):
        """Initialize mock CRM provider."""
        super().__init__(config or {})
        self.contacts = {}
        self.deals = {}
        self.next_contact_id = 1
        self.next_deal_id = 1
        self._is_ready = True
        logger.info("Mock CRM provider initialized")
    
    async def create_contact(self, contact_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a mock contact."""
        try:
            contact_id = f"contact_{self.next_contact_id}"
            self.next_contact_id += 1
            
            contact = {
                "id": contact_id,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
                **contact_data
            }
            
            self.contacts[contact_id] = contact
            
            logger.info(f"Mock contact created: {contact_id}")
            return contact
            
        except Exception as e:
            logger.error(f"Error creating mock contact: {e}")
            raise CRMIntegrationError(f"Failed to create contact: {e}")
    
    async def create_deal(self, deal_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a mock deal."""
        try:
            deal_id = f"deal_{self.next_deal_id}"
            self.next_deal_id += 1
            
            deal = {
                "id": deal_id,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
                "stage": "new",
                **deal_data
            }
            
            self.deals[deal_id] = deal
            
            logger.info(f"Mock deal created: {deal_id}")
            return deal
            
        except Exception as e:
            logger.error(f"Error creating mock deal: {e}")
            raise CRMIntegrationError(f"Failed to create deal: {e}")
    
    async def update_contact(self, contact_id: str, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update a mock contact."""
        try:
            if contact_id not in self.contacts:
                raise CRMIntegrationError(f"Contact {contact_id} not found")
            
            self.contacts[contact_id].update(update_data)
            self.contacts[contact_id]["updated_at"] = datetime.utcnow().isoformat()
            
            logger.info(f"Mock contact updated: {contact_id}")
            return self.contacts[contact_id]
            
        except Exception as e:
            logger.error(f"Error updating mock contact: {e}")
            raise CRMIntegrationError(f"Failed to update contact: {e}")
    
    async def search_contacts(self, search_criteria: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Search mock contacts."""
        try:
            results = []
            
            for contact in self.contacts.values():
                match = True
                for key, value in search_criteria.items():
                    if key in contact and contact[key] != value:
                        match = False
                        break
                
                if match:
                    results.append(contact)
            
            logger.info(f"Mock contact search returned {len(results)} results")
            return results
            
        except Exception as e:
            logger.error(f"Error searching mock contacts: {e}")
            raise CRMIntegrationError(f"Failed to search contacts: {e}")
    
    async def test_connection(self) -> bool:
        """Test mock connection (always succeeds)."""
        return True


class HubSpotCRMProvider(BaseCRMProvider):
    """HubSpot CRM provider implementation."""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize HubSpot CRM provider."""
        super().__init__(config)
        self.api_key = config.get("api_key")
        self.base_url = "https://api.hubapi.com"
        
        if not self.api_key:
            logger.error("HubSpot API key not provided")
            return
        
        self._is_ready = True
        logger.info("HubSpot CRM provider initialized")
    
    async def create_contact(self, contact_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a contact in HubSpot."""
        try:
            import httpx
            
            # Map our contact data to HubSpot format
            hubspot_data = self._map_contact_to_hubspot(contact_data)
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/crm/v3/objects/contacts",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={"properties": hubspot_data}
                )
                
                if response.status_code == 201:
                    result = response.json()
                    logger.info(f"HubSpot contact created: {result.get('id')}")
                    return self._map_hubspot_to_contact(result)
                else:
                    logger.error(f"HubSpot contact creation failed: {response.status_code} - {response.text}")
                    raise CRMIntegrationError(f"HubSpot API error: {response.status_code}")
                    
        except ImportError:
            logger.error("httpx not available for HubSpot integration")
            raise CRMIntegrationError("HTTP client not available")
        except Exception as e:
            logger.error(f"Error creating HubSpot contact: {e}")
            raise CRMIntegrationError(f"Failed to create HubSpot contact: {e}")
    
    async def create_deal(self, deal_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a deal in HubSpot."""
        try:
            import httpx
            
            # Map our deal data to HubSpot format
            hubspot_data = self._map_deal_to_hubspot(deal_data)
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/crm/v3/objects/deals",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={"properties": hubspot_data}
                )
                
                if response.status_code == 201:
                    result = response.json()
                    logger.info(f"HubSpot deal created: {result.get('id')}")
                    return self._map_hubspot_to_deal(result)
                else:
                    logger.error(f"HubSpot deal creation failed: {response.status_code} - {response.text}")
                    raise CRMIntegrationError(f"HubSpot API error: {response.status_code}")
                    
        except ImportError:
            logger.error("httpx not available for HubSpot integration")
            raise CRMIntegrationError("HTTP client not available")
        except Exception as e:
            logger.error(f"Error creating HubSpot deal: {e}")
            raise CRMIntegrationError(f"Failed to create HubSpot deal: {e}")
    
    async def update_contact(self, contact_id: str, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update a contact in HubSpot."""
        try:
            import httpx
            
            hubspot_data = self._map_contact_to_hubspot(update_data)
            
            async with httpx.AsyncClient() as client:
                response = await client.patch(
                    f"{self.base_url}/crm/v3/objects/contacts/{contact_id}",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={"properties": hubspot_data}
                )
                
                if response.status_code == 200:
                    result = response.json()
                    logger.info(f"HubSpot contact updated: {contact_id}")
                    return self._map_hubspot_to_contact(result)
                else:
                    logger.error(f"HubSpot contact update failed: {response.status_code} - {response.text}")
                    raise CRMIntegrationError(f"HubSpot API error: {response.status_code}")
                    
        except ImportError:
            logger.error("httpx not available for HubSpot integration")
            raise CRMIntegrationError("HTTP client not available")
        except Exception as e:
            logger.error(f"Error updating HubSpot contact: {e}")
            raise CRMIntegrationError(f"Failed to update HubSpot contact: {e}")
    
    async def search_contacts(self, search_criteria: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Search contacts in HubSpot."""
        try:
            import httpx
            
            # Build HubSpot search query
            search_query = self._build_hubspot_search_query(search_criteria)
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/crm/v3/objects/contacts/search",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json=search_query
                )
                
                if response.status_code == 200:
                    result = response.json()
                    contacts = [self._map_hubspot_to_contact(contact) for contact in result.get("results", [])]
                    logger.info(f"HubSpot contact search returned {len(contacts)} results")
                    return contacts
                else:
                    logger.error(f"HubSpot contact search failed: {response.status_code} - {response.text}")
                    raise CRMIntegrationError(f"HubSpot API error: {response.status_code}")
                    
        except ImportError:
            logger.error("httpx not available for HubSpot integration")
            raise CRMIntegrationError("HTTP client not available")
        except Exception as e:
            logger.error(f"Error searching HubSpot contacts: {e}")
            raise CRMIntegrationError(f"Failed to search HubSpot contacts: {e}")
    
    async def test_connection(self) -> bool:
        """Test HubSpot connection."""
        try:
            import httpx
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/crm/v3/objects/contacts",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    params={"limit": 1}
                )
                
                return response.status_code == 200
                
        except Exception as e:
            logger.error(f"HubSpot connection test failed: {e}")
            return False
    
    def _map_contact_to_hubspot(self, contact_data: Dict[str, Any]) -> Dict[str, Any]:
        """Map our contact data format to HubSpot format."""
        mapping = {
            "email": "email",
            "name": "firstname",
            "first_name": "firstname",
            "last_name": "lastname",
            "company": "company",
            "phone": "phone",
            "lead_score": "hs_lead_score",
            "lead_source": "hs_analytics_source",
            "lead_priority": "lead_priority",
            "original_message": "notes_last_contacted"
        }
        
        hubspot_data = {}
        for our_field, hubspot_field in mapping.items():
            if our_field in contact_data and contact_data[our_field]:
                hubspot_data[hubspot_field] = str(contact_data[our_field])
        
        return hubspot_data
    
    def _map_deal_to_hubspot(self, deal_data: Dict[str, Any]) -> Dict[str, Any]:
        """Map our deal data format to HubSpot format."""
        mapping = {
            "deal_name": "dealname",
            "amount": "amount",
            "stage": "dealstage",
            "priority": "priority",
            "lead_type": "deal_type",
            "close_date": "closedate"
        }
        
        hubspot_data = {}
        for our_field, hubspot_field in mapping.items():
            if our_field in deal_data and deal_data[our_field]:
                hubspot_data[hubspot_field] = str(deal_data[our_field])
        
        return hubspot_data
    
    def _map_hubspot_to_contact(self, hubspot_contact: Dict[str, Any]) -> Dict[str, Any]:
        """Map HubSpot contact format to our format."""
        properties = hubspot_contact.get("properties", {})
        
        return {
            "id": hubspot_contact.get("id"),
            "email": properties.get("email"),
            "first_name": properties.get("firstname"),
            "last_name": properties.get("lastname"),
            "company": properties.get("company"),
            "phone": properties.get("phone"),
            "created_at": hubspot_contact.get("createdAt"),
            "updated_at": hubspot_contact.get("updatedAt")
        }
    
    def _map_hubspot_to_deal(self, hubspot_deal: Dict[str, Any]) -> Dict[str, Any]:
        """Map HubSpot deal format to our format."""
        properties = hubspot_deal.get("properties", {})
        
        return {
            "id": hubspot_deal.get("id"),
            "deal_name": properties.get("dealname"),
            "amount": properties.get("amount"),
            "stage": properties.get("dealstage"),
            "created_at": hubspot_deal.get("createdAt"),
            "updated_at": hubspot_deal.get("updatedAt")
        }
    
    def _build_hubspot_search_query(self, search_criteria: Dict[str, Any]) -> Dict[str, Any]:
        """Build HubSpot search query from criteria."""
        filters = []
        
        for field, value in search_criteria.items():
            if field == "email":
                filters.append({
                    "propertyName": "email",
                    "operator": "EQ",
                    "value": value
                })
            elif field == "company":
                filters.append({
                    "propertyName": "company",
                    "operator": "EQ",
                    "value": value
                })
        
        return {
            "filterGroups": [{"filters": filters}] if filters else [],
            "properties": ["email", "firstname", "lastname", "company", "phone"],
            "limit": 100
        }


class CRMService:
    """Main CRM service for managing multiple CRM providers."""
    
    def __init__(self):
        """Initialize CRM service."""
        self.providers: Dict[str, BaseCRMProvider] = {}
        self.default_provider = None
        self._initialize_providers()
        logger.info("CRM service initialized")
    
    def _initialize_providers(self):
        """Initialize available CRM providers."""
        # Initialize mock provider for testing
        self.providers["mock"] = MockCRMProvider()
        self.default_provider = "mock"
        
        # TODO: Initialize other providers based on configuration
        # This would typically read from environment variables or config files
        
        logger.info(f"Initialized {len(self.providers)} CRM providers")
    
    def add_provider(self, name: str, provider: BaseCRMProvider):
        """Add a CRM provider."""
        self.providers[name] = provider
        if self.default_provider is None:
            self.default_provider = name
        logger.info(f"Added CRM provider: {name}")
    
    def get_provider(self, provider_name: Optional[str] = None) -> BaseCRMProvider:
        """Get a CRM provider by name."""
        name = provider_name or self.default_provider
        
        if name not in self.providers:
            raise CRMIntegrationError(f"CRM provider '{name}' not found")
        
        provider = self.providers[name]
        if not provider.is_ready():
            raise CRMIntegrationError(f"CRM provider '{name}' is not ready")
        
        return provider
    
    async def create_lead(
        self, 
        lead_data: Dict[str, Any], 
        provider_name: Optional[str] = None,
        create_deal: bool = True
    ) -> Dict[str, Any]:
        """
        Create a lead (contact + optional deal) in the CRM.
        
        Args:
            lead_data: Lead information
            provider_name: CRM provider to use
            create_deal: Whether to create a deal/opportunity
            
        Returns:
            Dictionary with created contact and deal information
        """
        try:
            provider = self.get_provider(provider_name)
            
            # Check for duplicate contacts first
            existing_contacts = []
            if lead_data.get("email"):
                existing_contacts = await provider.search_contacts({"email": lead_data["email"]})
            
            contact = None
            if existing_contacts:
                # Update existing contact
                contact = existing_contacts[0]
                contact = await provider.update_contact(contact["id"], lead_data)
                logger.info(f"Updated existing contact: {contact['id']}")
            else:
                # Create new contact
                contact = await provider.create_contact(lead_data)
                logger.info(f"Created new contact: {contact['id']}")
            
            result = {"contact": contact}
            
            # Create deal if requested
            if create_deal:
                deal_data = self._prepare_deal_data(lead_data, contact)
                deal = await provider.create_deal(deal_data)
                result["deal"] = deal
                logger.info(f"Created deal: {deal['id']}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error creating lead: {e}")
            raise CRMIntegrationError(f"Failed to create lead: {e}")
    
    def _prepare_deal_data(self, lead_data: Dict[str, Any], contact: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare deal data from lead information."""
        deal_name = f"Lead from {contact.get('email', 'Unknown')}"
        
        # Determine deal stage based on lead type
        stage_mapping = {
            "demo_request": "demo_scheduled",
            "enterprise_inquiry": "qualification",
            "bulk_order": "proposal",
            "pricing_inquiry": "qualification"
        }
        
        lead_type = lead_data.get("lead_type", "general_inquiry")
        stage = stage_mapping.get(lead_type, "new")
        
        # Estimate deal amount based on lead type and company size
        amount = self._estimate_deal_amount(lead_data)
        
        return {
            "deal_name": deal_name,
            "amount": amount,
            "stage": stage,
            "priority": lead_data.get("lead_priority", "medium"),
            "lead_type": lead_type,
            "contact_id": contact.get("id"),
            "source": "chatbot_lead_qualification"
        }
    
    def _estimate_deal_amount(self, lead_data: Dict[str, Any]) -> int:
        """Estimate deal amount based on lead characteristics."""
        base_amount = 5000  # Base deal amount
        
        # Adjust based on lead type
        type_multipliers = {
            "enterprise_inquiry": 5.0,
            "bulk_order": 3.0,
            "demo_request": 2.0,
            "pricing_inquiry": 1.5
        }
        
        lead_type = lead_data.get("lead_type", "general_inquiry")
        multiplier = type_multipliers.get(lead_type, 1.0)
        
        # Adjust based on priority
        priority_multipliers = {
            "urgent": 1.5,
            "high": 1.3,
            "medium": 1.0,
            "low": 0.8
        }
        
        priority = lead_data.get("lead_priority", "medium")
        priority_mult = priority_multipliers.get(priority, 1.0)
        
        # Adjust based on lead score
        score = lead_data.get("lead_score", 0.5)
        score_mult = 1.0 + score  # Score between 0-1, so multiplier 1.0-2.0
        
        estimated_amount = int(base_amount * multiplier * priority_mult * score_mult)
        
        return estimated_amount
    
    async def notify_sales_team(
        self, 
        lead_data: Dict[str, Any], 
        crm_result: Dict[str, Any]
    ) -> bool:
        """
        Notify sales team about high-priority leads.
        
        Args:
            lead_data: Original lead data
            crm_result: Result from CRM lead creation
            
        Returns:
            True if notification was sent successfully
        """
        try:
            # Check if this is a high-priority lead that needs immediate attention
            priority = lead_data.get("lead_priority", "low")
            lead_type = lead_data.get("lead_type", "general_inquiry")
            
            high_priority_types = ["demo_request", "enterprise_inquiry", "bulk_order"]
            urgent_priorities = ["urgent", "high"]
            
            if priority in urgent_priorities or lead_type in high_priority_types:
                # TODO: Implement actual notification system (Slack, email, etc.)
                # For now, just log the notification
                
                contact = crm_result.get("contact", {})
                deal = crm_result.get("deal", {})
                
                notification_message = f"""
🚨 High-Priority Lead Alert 🚨

Lead Type: {lead_type}
Priority: {priority}
Contact: {contact.get('email', 'Unknown')}
Company: {contact.get('company', 'Unknown')}
Deal Amount: ${deal.get('amount', 0):,}
CRM Contact ID: {contact.get('id')}
CRM Deal ID: {deal.get('id', 'N/A')}

Original Message: {lead_data.get('original_message', 'N/A')[:200]}...

Action Required: Follow up within 1 hour for urgent leads, 4 hours for high priority.
                """
                
                logger.info(f"Sales team notification: {notification_message}")
                
                # TODO: Send to Slack, email, or other notification channels
                # await self._send_slack_notification(notification_message)
                # await self._send_email_notification(notification_message)
                
                return True
            
            return False  # No notification needed for low-priority leads
            
        except Exception as e:
            logger.error(f"Error sending sales team notification: {e}")
            return False
    
    def get_service_info(self) -> Dict[str, Any]:
        """Get CRM service information."""
        provider_info = {}
        for name, provider in self.providers.items():
            provider_info[name] = provider.get_provider_info()
        
        return {
            "service": "CRMService",
            "version": "1.0.0",
            "default_provider": self.default_provider,
            "providers": provider_info,
            "total_providers": len(self.providers)
        }
    
    def is_ready(self) -> bool:
        """Check if CRM service is ready."""
        return len(self.providers) > 0 and any(p.is_ready() for p in self.providers.values())


# Global service instance
_crm_service = None


def get_crm_service() -> CRMService:
    """
    Get the global CRM service instance.
    
    Returns:
        CRMService instance
    """
    global _crm_service
    
    if _crm_service is None:
        _crm_service = CRMService()
    
    return _crm_service