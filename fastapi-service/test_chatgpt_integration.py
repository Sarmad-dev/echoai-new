#!/usr/bin/env python3
"""
Test script to verify ChatGPT integration with RAG service.
"""
import asyncio
import logging
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from app.services.model_service import get_model_service

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_chatgpt_integration():
    """Test the ChatGPT integration."""
    try:
        # Initialize model service
        model_service = get_model_service()
        
        # Check if ChatOpenAI is available
        logger.info(f"ChatOpenAI available: {model_service.has_chat_openai()}")
        logger.info(f"Model service info: {model_service.get_model_info()}")
        
        if not model_service.has_chat_openai():
            logger.error("ChatOpenAI is not available. Check your OpenAI API key and LangChain installation.")
            return
        
        # Test with sample data
        user_message = "What are the company rules about remote work?"
        retrieved_context = """
        Remote Work Policy:
        - Employees can work remotely up to 3 days per week
        - Must maintain regular communication with team
        - Home office setup must meet security requirements
        - All remote work must be approved by manager
        - Core hours are 9 AM to 3 PM in company timezone
        """
        system_instruction = "You are a helpful HR assistant. Provide clear and accurate information about company policies."
        
        logger.info("Testing ChatGPT response generation...")
        logger.info(f"User message: {user_message}")
        logger.info(f"Context length: {len(retrieved_context)} characters")
        
        # Generate response
        response = await model_service.generate_rag_response(
            user_message=user_message,
            retrieved_context=retrieved_context,
            system_instruction=system_instruction
        )
        
        logger.info("=" * 50)
        logger.info("CHATGPT RESPONSE:")
        logger.info("=" * 50)
        logger.info(response)
        logger.info("=" * 50)
        
        # Test without context
        logger.info("\nTesting without context...")
        response_no_context = await model_service.generate_rag_response(
            user_message="What is the weather like today?",
            retrieved_context="",
            system_instruction=system_instruction
        )
        
        logger.info("=" * 50)
        logger.info("CHATGPT RESPONSE (NO CONTEXT):")
        logger.info("=" * 50)
        logger.info(response_no_context)
        logger.info("=" * 50)
        
        logger.info("✅ ChatGPT integration test completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ ChatGPT integration test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Check if OpenAI API key is set
    if not os.getenv("OPENAI_API_KEY"):
        logger.error("OPENAI_API_KEY environment variable is not set!")
        exit(1)
    
    asyncio.run(test_chatgpt_integration())