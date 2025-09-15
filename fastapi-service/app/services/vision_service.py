"""
Vision analysis service using OpenAI GPT-4-Vision API.
Provides structured analysis for product condition, invoice extraction, and inventory counting.
"""
import json
import time
from typing import Dict, Any, Optional, Union
from datetime import datetime
import logging

from openai import AsyncOpenAI
from ..config import settings
from ..models.vision import (
    AnalysisType, 
    ProductCondition, 
    InvoiceData, 
    InventoryCount,
    VisionError
)

logger = logging.getLogger(__name__)


class VisionService:
    """Service for analyzing images using OpenAI GPT-4-Vision API."""
    
    def __init__(self):
        """Initialize the vision service with OpenAI client."""
        if not settings.OPENAI_API_KEY:
            raise ValueError("OpenAI API key is required for vision analysis")
        
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = "gpt-4-vision-preview"
        
        # Analysis prompts for different types
        self.prompts = {
            AnalysisType.PRODUCT_CONDITION: self._get_product_condition_prompt(),
            AnalysisType.INVOICE_EXTRACTION: self._get_invoice_extraction_prompt(),
            AnalysisType.INVENTORY_COUNT: self._get_inventory_count_prompt()
        }
    
    async def analyze_image(
        self, 
        image_url: str, 
        analysis_type: AnalysisType,
        custom_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze an image using the specified analysis type.
        
        Args:
            image_url: URL of the image to analyze
            analysis_type: Type of analysis to perform
            custom_prompt: Custom prompt for analysis (used with CUSTOM type)
            
        Returns:
            Dictionary containing analysis results
            
        Raises:
            VisionError: If analysis fails
        """
        start_time = time.time()
        
        try:
            # Get the appropriate prompt
            if analysis_type == AnalysisType.CUSTOM:
                if not custom_prompt:
                    raise ValueError("Custom prompt is required for custom analysis type")
                prompt = custom_prompt
            else:
                prompt = self.prompts.get(analysis_type)
                if not prompt:
                    raise ValueError(f"Unsupported analysis type: {analysis_type}")
            
            # Make API call to OpenAI
            response = await self._call_openai_vision(image_url, prompt)
            
            # Parse the response based on analysis type
            if analysis_type == AnalysisType.PRODUCT_CONDITION:
                result = self._parse_product_condition(response)
            elif analysis_type == AnalysisType.INVOICE_EXTRACTION:
                result = self._parse_invoice_data(response)
            elif analysis_type == AnalysisType.INVENTORY_COUNT:
                result = self._parse_inventory_count(response)
            else:  # CUSTOM
                result = {"analysis": response, "confidence": 0.8}
            
            processing_time = (time.time() - start_time) * 1000
            
            return {
                "analysis_type": analysis_type.value,
                "result": result,
                "processing_time_ms": processing_time,
                "image_url": image_url,
                "prompt": prompt,
                "raw_response": response
            }
            
        except Exception as e:
            logger.error(f"Vision analysis failed for {image_url}: {str(e)}")
            raise VisionError(
                error_type="analysis_failed",
                error_message=str(e),
                image_url=image_url
            )
    
    async def analyze_product_condition(self, image_url: str) -> ProductCondition:
        """
        Analyze product condition for return eligibility.
        
        Args:
            image_url: URL of the product image
            
        Returns:
            ProductCondition object with analysis results
        """
        result = await self.analyze_image(image_url, AnalysisType.PRODUCT_CONDITION)
        return ProductCondition(**result["result"])
    
    async def extract_invoice_data(self, image_url: str) -> InvoiceData:
        """
        Extract structured data from invoice images.
        
        Args:
            image_url: URL of the invoice image
            
        Returns:
            InvoiceData object with extracted information
        """
        result = await self.analyze_image(image_url, AnalysisType.INVOICE_EXTRACTION)
        return InvoiceData(**result["result"])
    
    async def count_inventory(self, image_url: str) -> InventoryCount:
        """
        Count items in inventory images.
        
        Args:
            image_url: URL of the inventory image
            
        Returns:
            InventoryCount object with counting results
        """
        result = await self.analyze_image(image_url, AnalysisType.INVENTORY_COUNT)
        return InventoryCount(**result["result"])
    
    async def _call_openai_vision(self, image_url: str, prompt: str) -> str:
        """
        Make API call to OpenAI Vision API.
        
        Args:
            image_url: URL of the image to analyze
            prompt: Analysis prompt
            
        Returns:
            Raw response from OpenAI API
        """
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": image_url}
                            }
                        ]
                    }
                ],
                max_tokens=1000,
                temperature=0.1  # Low temperature for consistent results
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"OpenAI API call failed: {str(e)}")
            raise
    
    def _get_product_condition_prompt(self) -> str:
        """Get prompt for product condition analysis."""
        return """
        Analyze this product image and assess its condition for return eligibility. 
        
        Please provide your analysis in the following JSON format:
        {
            "condition": "excellent|good|fair|poor",
            "condition_score": 0.0-1.0,
            "damage_detected": true|false,
            "damage_description": "description of any damage or null",
            "return_eligible": true|false,
            "confidence": 0.0-1.0
        }
        
        Consider factors like:
        - Visible wear and tear
        - Scratches, dents, or damage
        - Missing parts or components
        - Overall appearance and functionality
        - Packaging condition if visible
        
        Return only the JSON response, no additional text.
        """
    
    def _get_invoice_extraction_prompt(self) -> str:
        """Get prompt for invoice data extraction."""
        return """
        Extract structured data from this invoice image.
        
        Please provide the extracted information in the following JSON format:
        {
            "vendor_name": "vendor name or null",
            "invoice_number": "invoice number or null",
            "invoice_date": "YYYY-MM-DD or null",
            "due_date": "YYYY-MM-DD or null",
            "total_amount": numeric_value_or_null,
            "currency": "currency code or null",
            "line_items": [
                {
                    "description": "item description",
                    "quantity": numeric_quantity,
                    "unit_price": numeric_price,
                    "total": numeric_total
                }
            ],
            "confidence": 0.0-1.0
        }
        
        Extract all visible line items with their quantities, prices, and totals.
        If information is not clearly visible, use null values.
        
        Return only the JSON response, no additional text.
        """
    
    def _get_inventory_count_prompt(self) -> str:
        """Get prompt for inventory counting."""
        return """
        Count and categorize all visible items in this inventory image.
        
        Please provide the count in the following JSON format:
        {
            "total_items": numeric_count,
            "item_categories": {
                "category_name": count,
                "another_category": count
            },
            "confidence": 0.0-1.0,
            "notes": "any relevant observations or null"
        }
        
        Try to identify different types of items (boxes, pallets, products, etc.) and count them separately.
        If items are partially obscured or difficult to count, note this in the confidence score and notes.
        
        Return only the JSON response, no additional text.
        """
    
    def _parse_product_condition(self, response: str) -> Dict[str, Any]:
        """Parse product condition analysis response."""
        try:
            data = json.loads(response.strip())
            
            # Validate required fields
            required_fields = ["condition", "condition_score", "damage_detected", "return_eligible", "confidence"]
            for field in required_fields:
                if field not in data:
                    raise ValueError(f"Missing required field: {field}")
            
            # Validate condition value
            valid_conditions = ["excellent", "good", "fair", "poor"]
            if data["condition"] not in valid_conditions:
                data["condition"] = "fair"  # Default fallback
            
            # Ensure numeric fields are in valid ranges
            data["condition_score"] = max(0.0, min(1.0, float(data["condition_score"])))
            data["confidence"] = max(0.0, min(1.0, float(data["confidence"])))
            
            return data
            
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            logger.warning(f"Failed to parse product condition response: {e}")
            # Return fallback response
            return {
                "condition": "fair",
                "condition_score": 0.5,
                "damage_detected": False,
                "damage_description": None,
                "return_eligible": True,
                "confidence": 0.3
            }
    
    def _parse_invoice_data(self, response: str) -> Dict[str, Any]:
        """Parse invoice extraction response."""
        try:
            data = json.loads(response.strip())
            
            # Ensure line_items is a list
            if "line_items" not in data:
                data["line_items"] = []
            elif not isinstance(data["line_items"], list):
                data["line_items"] = []
            
            # Ensure confidence is set
            if "confidence" not in data:
                data["confidence"] = 0.5
            else:
                data["confidence"] = max(0.0, min(1.0, float(data["confidence"])))
            
            return data
            
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"Failed to parse invoice response: {e}")
            # Return fallback response
            return {
                "vendor_name": None,
                "invoice_number": None,
                "invoice_date": None,
                "due_date": None,
                "total_amount": None,
                "currency": None,
                "line_items": [],
                "confidence": 0.3
            }
    
    def _parse_inventory_count(self, response: str) -> Dict[str, Any]:
        """Parse inventory count response."""
        try:
            data = json.loads(response.strip())
            
            # Validate required fields
            if "total_items" not in data:
                data["total_items"] = 0
            else:
                data["total_items"] = max(0, int(data["total_items"]))
            
            if "item_categories" not in data:
                data["item_categories"] = {}
            elif not isinstance(data["item_categories"], dict):
                data["item_categories"] = {}
            
            if "confidence" not in data:
                data["confidence"] = 0.5
            else:
                data["confidence"] = max(0.0, min(1.0, float(data["confidence"])))
            
            return data
            
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"Failed to parse inventory count response: {e}")
            # Return fallback response
            return {
                "total_items": 0,
                "item_categories": {},
                "confidence": 0.3,
                "notes": "Analysis failed, manual count required"
            }


# Global service instance - initialized lazily
vision_service: Optional[VisionService] = None


def get_vision_service() -> VisionService:
    """Get the global vision service instance, creating it if needed."""
    global vision_service
    if vision_service is None:
        vision_service = VisionService()
    return vision_service