"""
Model service for managing Hugging Face Inference API clients, OpenAI embeddings, and LangChain ChatOpenAI.
"""
import logging
import asyncio
import time
from typing import Optional, Dict, Any, List
import httpx
from huggingface_hub import InferenceClient
from openai import AsyncOpenAI

# LangChain imports with fallback
try:
    from langchain_openai import ChatOpenAI
    from langchain_core.messages import HumanMessage, SystemMessage
    from langchain_core.prompts import ChatPromptTemplate
    LANGCHAIN_AVAILABLE = True
except ImportError:
    try:
        from langchain.chat_models import ChatOpenAI
        from langchain.schema import HumanMessage, SystemMessage
        from langchain.prompts import ChatPromptTemplate
        LANGCHAIN_AVAILABLE = True
    except ImportError:
        LANGCHAIN_AVAILABLE = False
        ChatOpenAI = None
        HumanMessage = None
        SystemMessage = None
        ChatPromptTemplate = None

from app.config import settings

logger = logging.getLogger(__name__)


class ModelService:
    """Service for managing Hugging Face Inference API clients and OpenAI embeddings."""
    
    def __init__(self):
        """Initialize the model service with Inference API clients and LangChain ChatOpenAI."""
        self.openai_client: Optional[AsyncOpenAI] = None
        self.llm_client: Optional[InferenceClient] = None
        self.sentiment_client: Optional[InferenceClient] = None
        self.chat_openai: Optional[ChatOpenAI] = None
        
        logger.info("Initializing ModelService with OpenAI embeddings, LangChain ChatOpenAI, and Hugging Face Inference API")
        self._initialize_clients()
    
    def _initialize_clients(self):
        """Initialize all API clients with error handling."""
        try:
            logger.info("Starting client initialization...")
            self._initialize_openai_client()
            logger.info("OpenAI client initialization completed")
            self._initialize_chat_openai()
            logger.info("LangChain ChatOpenAI initialization completed")
            self._initialize_llm_client()
            logger.info("LLM client initialization completed")
            self._initialize_sentiment_client()
            logger.info("Sentiment client initialization completed")
            logger.info("All API clients initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize API clients: {e}")
            logger.error(f"OpenAI client state: {self.openai_client is not None}")
            logger.error(f"ChatOpenAI state: {self.chat_openai is not None}")
            logger.error(f"LLM client state: {self.llm_client is not None}")
            logger.error(f"Sentiment client state: {self.sentiment_client is not None}")
            raise
    
    def _initialize_openai_client(self):
        """Initialize the OpenAI client for embeddings."""
        try:
            if not settings.OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY is required for OpenAI embeddings")
            
            logger.info(f"Initializing OpenAI client for embedding model: {settings.EMBEDDING_MODEL}")
            
            self.openai_client = AsyncOpenAI(
                api_key=settings.OPENAI_API_KEY
            )
            
            logger.info("OpenAI client initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI client: {e}")
            raise
    
    def _initialize_chat_openai(self):
        """Initialize the LangChain ChatOpenAI client."""
        try:
            if not LANGCHAIN_AVAILABLE:
                logger.warning("LangChain not available - ChatOpenAI will not be initialized")
                self.chat_openai = None
                return
            
            if not settings.OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY is required for ChatOpenAI")
            
            logger.info("Initializing LangChain ChatOpenAI client")
            
            self.chat_openai = ChatOpenAI(
                model="gpt-3.5-turbo",  # Use GPT-3.5-turbo for better responses
                temperature=0.7,
                max_tokens=1024,
                openai_api_key=settings.OPENAI_API_KEY
            )
            
            logger.info("LangChain ChatOpenAI client initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize ChatOpenAI client: {e}")
            logger.warning("ChatOpenAI initialization failed - falling back to Hugging Face models")
            self.chat_openai = None
    
    def _initialize_llm_client(self):
        """Initialize the LLM Inference API client."""
        try:
            if not settings.HUGGINGFACE_API_TOKEN:
                raise ValueError("HUGGINGFACE_API_TOKEN is required for Inference API")
            
            logger.info(f"Initializing LLM client for model: {settings.LLM_MODEL}")
            
            self.llm_client = InferenceClient(
                model=settings.LLM_MODEL,
                token=settings.HUGGINGFACE_API_TOKEN,
                timeout=settings.INFERENCE_API_TIMEOUT
            )
            
            logger.info("LLM Inference API client initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize LLM client: {e}")
            raise
    
    def _initialize_sentiment_client(self):
        """Initialize the sentiment analysis Inference API client."""
        try:
            if not settings.HUGGINGFACE_API_TOKEN:
                raise ValueError("HUGGINGFACE_API_TOKEN is required for Inference API")
            
            logger.info(f"Initializing sentiment client for model: {settings.SENTIMENT_MODEL}")
            
            self.sentiment_client = InferenceClient(
                model=settings.SENTIMENT_MODEL,
                token=settings.HUGGINGFACE_API_TOKEN,
                timeout=settings.INFERENCE_API_TIMEOUT
            )
            
            logger.info("Sentiment Inference API client initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize sentiment client: {e}")
            raise
    
    async def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for text using OpenAI API with retry logic.
        
        Args:
            text: Text to generate embedding for
            
        Returns:
            List of embedding values (1536 dimensions)
        """
        if not self.openai_client:
            logger.error("OpenAI client not initialized! Cannot generate embeddings.")
            logger.error(f"Model service state - OpenAI: {self.openai_client is not None}")
            logger.error(f"Settings - OPENAI_API_KEY: {'SET' if settings.OPENAI_API_KEY else 'NOT_SET'}")
            logger.error(f"Settings - EMBEDDING_MODEL: {settings.EMBEDDING_MODEL}")
            raise RuntimeError("OpenAI client not initialized - check API key and initialization")
        
        logger.debug(f"Generating embedding using OpenAI model: {settings.EMBEDDING_MODEL}")
        
        result = await self._retry_api_call(
            self._generate_embedding_impl,
            text,
            operation="embedding generation"
        )
        
        logger.debug(f"Generated embedding with {len(result)} dimensions")
        return result
    
    async def _generate_embedding_impl(self, text: str) -> List[float]:
        """Implementation of embedding generation using OpenAI."""
        logger.debug(f"Generating embedding for text: {text[:100]}...")
        
        try:
            logger.debug(f"Using OpenAI model: {settings.EMBEDDING_MODEL}")
            
            response = await self.openai_client.embeddings.create(
                model=settings.EMBEDDING_MODEL,
                input=text
            )
            
            # Extract embedding from response
            embedding = response.data[0].embedding
            
            # Validate dimensions
            if len(embedding) != 1536:
                logger.error(f"CRITICAL: Wrong embedding dimensions! Expected 1536, got {len(embedding)}")
                logger.error(f"Model used: {settings.EMBEDDING_MODEL}")
                logger.error(f"This indicates the wrong model is configured or responding")
                raise ValueError(f"Wrong embedding dimensions: {len(embedding)} (expected 1536)")
            
            logger.debug(f"Successfully generated embedding with {len(embedding)} dimensions")
            return embedding
            
        except Exception as e:
            logger.error(f"OpenAI embedding generation failed: {e}")
            logger.error(f"Model: {settings.EMBEDDING_MODEL}")
            logger.error(f"API Key configured: {'YES' if settings.OPENAI_API_KEY else 'NO'}")
            raise
    
    async def generate_text(self, prompt: str, **kwargs) -> str:
        """
        Generate text using Hugging Face Inference API with retry logic.
        
        Args:
            prompt: Input prompt for text generation
            **kwargs: Additional parameters for text generation
            
        Returns:
            Generated text
        """
        if not self.llm_client:
            raise RuntimeError("LLM client not initialized")
        
        return await self._retry_api_call(
            self._generate_text_impl,
            prompt,
            operation="text generation",
            **kwargs
        )
    
    async def generate_text_stream(self, prompt: str, **kwargs):
        """
        Generate text using Hugging Face Inference API with streaming support.
        
        Args:
            prompt: Input prompt for text generation
            **kwargs: Additional parameters for text generation
            
        Yields:
            Streaming text tokens
        """
        if not self.llm_client:
            raise RuntimeError("LLM client not initialized")
        
        # Try streaming first, fallback to non-streaming if not supported
        try:
            async for token in self._generate_text_stream_impl(prompt, **kwargs):
                yield token
        except Exception as e:
            error_str = str(e).lower()
            if any(unsupported_indicator in error_str for unsupported_indicator in [
                "streaming not supported", "not supported", "stream", "endpoint does not support"
            ]):
                logger.warning(f"Streaming not supported for model {settings.LLM_MODEL}, falling back to non-streaming")
                # Fallback to non-streaming generation
                full_response = await self.generate_text(prompt, **kwargs)
                # Simulate streaming by yielding chunks
                chunk_size = 10  # Characters per chunk
                for i in range(0, len(full_response), chunk_size):
                    chunk = full_response[i:i + chunk_size]
                    yield chunk
                    # Small delay to simulate streaming
                    await asyncio.sleep(0.05)
            else:
                raise e
    
    async def _generate_text_stream_impl(self, prompt: str, **kwargs):
        """Implementation of streaming text generation."""
        logger.info(f"🤖 MODEL DEBUG - Generating streaming text")
        logger.info(f"📏 Prompt length: {len(prompt)} characters")
        logger.info(f"📋 Prompt preview: {prompt[:300]}...")
        logger.info(f"📋 Prompt ending: ...{prompt[-200:]}")
        
        generation_params = {
            "max_new_tokens": kwargs.get("max_new_tokens", 1024),  # Increased from 256 to 1024 for more detailed responses
            "temperature": kwargs.get("temperature", 0.7),
            "top_p": kwargs.get("top_p", 0.9),
            "do_sample": kwargs.get("do_sample", True),
            "return_full_text": kwargs.get("return_full_text", False),
            "stream": True  # Enable streaming
        }
        
        logger.info(f"⚙️ Generation parameters: {generation_params}")
        
        try:
            # Use text_generation with streaming
            stream = await asyncio.to_thread(
                self.llm_client.text_generation,
                prompt,
                **generation_params
            )
            
            # Handle streaming response
            token_count = 0
            if hasattr(stream, '__iter__'):
                logger.info(f"🌊 MODEL DEBUG - Starting token streaming")
                for token_data in stream:
                    token_count += 1
                    if isinstance(token_data, dict):
                        if "token" in token_data:
                            token_text = token_data["token"]["text"]
                            if token_count <= 10:  # Log first 10 tokens
                                logger.info(f"🌊 Token {token_count}: {repr(token_text)} (spaces: {token_text.count(' ')})")
                            yield token_text
                        elif "generated_text" in token_data:
                            text = token_data["generated_text"]
                            logger.info(f"🌊 Generated Text: {repr(text)} (spaces: {text.count(' ')})")
                            yield text
                        elif "text" in token_data:
                            text = token_data["text"]
                            if token_count <= 10:
                                logger.info(f"🌊 Text Token {token_count}: {repr(text)} (spaces: {text.count(' ')})")
                            yield text
                    elif isinstance(token_data, str):
                        if token_count <= 10:
                            logger.info(f"🌊 String Token {token_count}: {repr(token_data)} (spaces: {token_data.count(' ')})")
                        yield token_data
                logger.info(f"🌊 MODEL DEBUG - Streaming complete, total tokens: {token_count}")
            else:
                # If not iterable, treat as single response
                if isinstance(stream, str):
                    yield stream
                elif isinstance(stream, dict) and "generated_text" in stream:
                    yield stream["generated_text"]
                else:
                    yield str(stream)
                    
        except Exception as e:
            if "not supported" in str(e).lower() or "stream" in str(e).lower():
                # Re-raise to trigger fallback
                raise e
            else:
                # Try alternative streaming approach
                logger.info("Primary streaming failed, trying alternative approach")
                try:
                    # Remove stream parameter and use regular generation
                    generation_params.pop("stream", None)
                    result = await asyncio.to_thread(
                        self.llm_client.text_generation,
                        prompt,
                        **generation_params
                    )
                    
                    # Simulate streaming by chunking the response
                    if isinstance(result, str):
                        text = result
                    elif isinstance(result, dict) and "generated_text" in result:
                        text = result["generated_text"]
                    else:
                        text = str(result)
                    
                    # Yield in chunks to simulate streaming
                    chunk_size = 5
                    for i in range(0, len(text), chunk_size):
                        chunk = text[i:i + chunk_size]
                        yield chunk
                        await asyncio.sleep(0.03)  # Small delay between chunks
                        
                except Exception as fallback_error:
                    logger.error(f"Alternative streaming approach also failed: {fallback_error}")
                    raise e
    
    async def _generate_text_impl(self, prompt: str, **kwargs) -> str:
        """Implementation of text generation with template-based fallback."""
        logger.debug(f"Generating text for prompt: {prompt[:100]}...")
        
        # Extract context from the prompt for template-based response
        context_start = prompt.find("Information:")
        if context_start == -1:
            context_start = prompt.find("Context:")
        question_start = prompt.find("Question:")
        
        if context_start != -1 and question_start != -1:
            # Adjust for different prompt formats
            context_prefix_len = 12 if "Information:" in prompt else 8
            context = prompt[context_start + context_prefix_len:question_start].strip()
            question = prompt[question_start + 9:].strip()
            
            # If we have context, create a template-based response
            if context and len(context) > 50:
                logger.info(f"Using template-based response due to model issues. Context length: {len(context)}")
                return self._create_template_response(question, context)
        
        try:
            # Try the LLM first
            def sync_generate():
                try:
                    return self.llm_client.text_generation(
                        prompt,
                        max_new_tokens=kwargs.get("max_new_tokens", 1024),  # Increased from 100 to 1024 for more detailed responses
                        temperature=kwargs.get("temperature", 0.8),
                        top_p=kwargs.get("top_p", 0.9),
                        do_sample=kwargs.get("do_sample", True),
                        return_full_text=False
                    )
                except StopIteration:
                    return None  # Signal to use template
                except Exception as e:
                    logger.warning(f"Text generation failed: {e}")
                    return None  # Signal to use template
            
            # Run the synchronous function in a thread
            result = await asyncio.to_thread(sync_generate)
            
            if result is None:
                # Use template-based response
                if context_start != -1 and question_start != -1:
                    # Adjust for different prompt formats
                    context_prefix_len = 12 if "Information:" in prompt else 8
                    context = prompt[context_start + context_prefix_len:question_start].strip()
                    question = prompt[question_start + 9:].strip()
                    logger.info(f"Template fallback - Context length: {len(context)}, Question: {question[:50]}...")
                    return self._create_template_response(question, context)
                else:
                    return "I can help you with that. Please provide more details about what you'd like to know."
            
            # Handle different response formats
            if isinstance(result, str):
                # Debug logging for AI response
                logger.info(f"🤖 AI Response Debug - Raw result: {repr(result)}")
                logger.info(f"🤖 AI Response Debug - Has spaces: {' ' in result}")
                logger.info(f"🤖 AI Response Debug - Space count: {result.count(' ')}")
                stripped_result = result.strip()
                logger.info(f"🤖 AI Response Debug - After strip: {repr(stripped_result)}")
                logger.info(f"🤖 AI Response Debug - After strip spaces: {stripped_result.count(' ')}")
                return stripped_result
            elif isinstance(result, dict) and "generated_text" in result:
                # Debug logging for AI response
                logger.info(f"🤖 AI Response Debug - Raw generated_text: {repr(result['generated_text'])}")
                logger.info(f"🤖 AI Response Debug - Has spaces: {' ' in result['generated_text']}")
                logger.info(f"🤖 AI Response Debug - Space count: {result['generated_text'].count(' ')}")
                stripped_result = result["generated_text"].strip()
                logger.info(f"🤖 AI Response Debug - After strip: {repr(stripped_result)}")
                logger.info(f"🤖 AI Response Debug - After strip spaces: {stripped_result.count(' ')}")
                return stripped_result
            else:
                logger.warning(f"Unexpected LLM response format: {type(result)}")
                return str(result).strip()
                
        except Exception as e:
            logger.error(f"Text generation failed completely: {e}")
            # Fallback to template if we have context
            if context_start != -1 and question_start != -1:
                # Adjust for different prompt formats
                context_prefix_len = 12 if "Information:" in prompt else 8
                context = prompt[context_start + context_prefix_len:question_start].strip()
                question = prompt[question_start + 9:].strip()
                logger.info(f"Exception fallback - Context length: {len(context)}, Question: {question[:50]}...")
                return self._create_template_response(question, context)
            else:
                return "I can help you with that. Please let me know what specific details you need."
    
    def _create_template_response(self, question: str, context: str) -> str:
        """Create a template-based response using the retrieved context."""
        # Simple keyword matching for common questions
        question_lower = question.lower()
        
        # Clean up the context by removing any remaining source references
        clean_context = context.replace("Source (", "").replace("Content:", "").replace("---", "").replace("Knowledge Base:", "").strip()
        
        if any(word in question_lower for word in ["rules", "conduct", "behavior", "policy"]):
            if "conduct" in context.lower() or "rules" in context.lower() or "policy" in context.lower():
                return f"Here are the key points about company rules and conduct:\n\n{clean_context[:1000]}"
        
        elif any(word in question_lower for word in ["remote", "work", "home", "office"]):
            if any(word in context.lower() for word in ["remote", "work", "home", "office", "policy"]):
                return f"Regarding work policies:\n\n{clean_context[:1000]}"
        
        elif any(word in question_lower for word in ["benefits", "vacation", "leave", "time off"]):
            if any(word in context.lower() for word in ["benefits", "vacation", "leave", "time"]):
                return f"Here's information about employee benefits and policies:\n\n{clean_context[:1000]}"
        
        elif any(word in question_lower for word in ["training", "development", "learning"]):
            if any(word in context.lower() for word in ["training", "development", "learning"]):
                return f"Here's information about training and development:\n\n{clean_context[:1000]}"
        
        # Generic response with context - use more of the context for detailed responses
        if len(clean_context) > 100:
            return f"Here's the relevant information for your question:\n\n{clean_context[:1000]}"
        else:
            return "I can help you with that. Please provide more details about what you'd like to know."
    
    async def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """
        Analyze sentiment using Hugging Face Inference API with retry logic.
        
        Args:
            text: Text to analyze sentiment for
            
        Returns:
            Dictionary with sentiment analysis results
        """
        if not self.sentiment_client:
            raise RuntimeError("Sentiment client not initialized")
        
        return await self._retry_api_call(
            self._analyze_sentiment_impl,
            text,
            operation="sentiment analysis"
        )
    
    async def _analyze_sentiment_impl(self, text: str) -> Dict[str, Any]:
        """Implementation of sentiment analysis."""
        logger.debug(f"Analyzing sentiment for text: {text[:100]}...")
        
        # Analyze sentiment using Inference API
        result = await asyncio.to_thread(
            self.sentiment_client.text_classification,
            text
        )
        
        # Handle different response formats
        if isinstance(result, list) and len(result) > 0:
            sentiment_result = result[0]
            label = sentiment_result.get("label", "NEUTRAL").lower()
            score = sentiment_result.get("score", 0.5)
            
            # Map different model outputs to standard labels
            if label in ["positive", "pos", "label_2"]:
                normalized_label = "positive"
            elif label in ["negative", "neg", "label_0"]:
                normalized_label = "negative"
            else:
                normalized_label = "neutral"
            
            return {
                "label": normalized_label,
                "score": score,
                "raw_label": sentiment_result.get("label", "NEUTRAL")
            }
        else:
            logger.warning(f"Unexpected sentiment response format: {type(result)}")
            return {"label": "neutral", "score": 0.5, "raw_label": "NEUTRAL"}
    
    async def _retry_api_call(self, func, *args, operation: str = "API call", **kwargs):
        """
        Retry API calls with exponential backoff and rate limit handling.
        
        Args:
            func: The function to call
            *args: Arguments for the function
            operation: Description of the operation for logging
            **kwargs: Keyword arguments for the function
            
        Returns:
            Result of the function call
        """
        for attempt in range(settings.INFERENCE_API_MAX_RETRIES):
            try:
                return await func(*args, **kwargs)
                
            except Exception as e:
                error_str = str(e).lower()
                
                # Check for rate limiting errors
                if any(rate_limit_indicator in error_str for rate_limit_indicator in [
                    "rate limit", "too many requests", "quota", "429", "503"
                ]):
                    logger.warning(f"{operation} rate limited on attempt {attempt + 1}: {e}")
                    
                    if attempt < settings.INFERENCE_API_MAX_RETRIES - 1:
                        # Longer delay for rate limits
                        delay = settings.INFERENCE_API_RETRY_DELAY * (3 ** attempt) + 5
                        logger.info(f"Rate limit detected, waiting {delay:.1f}s before retry")
                        await asyncio.sleep(delay)
                        continue
                
                # Check for temporary service errors
                elif any(temp_error in error_str for temp_error in [
                    "service unavailable", "internal server error", "timeout", "502", "504"
                ]):
                    logger.warning(f"{operation} temporary error on attempt {attempt + 1}: {e}")
                    
                    if attempt < settings.INFERENCE_API_MAX_RETRIES - 1:
                        # Standard exponential backoff for temporary errors
                        delay = settings.INFERENCE_API_RETRY_DELAY * (2 ** attempt)
                        await asyncio.sleep(delay)
                        continue
                
                # For other errors, log and retry with standard backoff
                else:
                    logger.warning(f"{operation} attempt {attempt + 1} failed: {e}")
                    
                    if attempt < settings.INFERENCE_API_MAX_RETRIES - 1:
                        delay = settings.INFERENCE_API_RETRY_DELAY * (2 ** attempt)
                        await asyncio.sleep(delay)
                        continue
                
                # If we reach here on the last attempt, raise the error
                if attempt == settings.INFERENCE_API_MAX_RETRIES - 1:
                    logger.error(f"All {operation} attempts failed: {e}")
                    raise
    
    async def generate_rag_response(
        self, 
        user_message: str, 
        retrieved_context: str, 
        system_instruction: str
    ) -> str:
        """
        Generate a comprehensive response using ChatOpenAI with retrieved documents and system instruction.
        
        Args:
            user_message: The user's original message
            retrieved_context: Context from retrieved documents
            system_instruction: System instruction from chatbot configuration
            
        Returns:
            Generated response text
        """
        if not self.chat_openai or not LANGCHAIN_AVAILABLE:
            logger.warning("ChatOpenAI not available, falling back to Hugging Face model")
            return await self._generate_fallback_response(user_message, retrieved_context, system_instruction)
        
        try:
            logger.info(f"🤖 CHATGPT DEBUG - Generating response with ChatOpenAI")
            logger.info(f"📝 User message: {user_message[:100]}...")
            logger.info(f"📚 Context length: {len(retrieved_context)} characters")
            logger.info(f"🎯 System instruction: {system_instruction[:100]}...")
            
            # Create the prompt template
            if retrieved_context.strip():
                # Use context-based prompt
                prompt_template = ChatPromptTemplate.from_messages([
                    ("system", f"""{system_instruction}

You are provided with relevant information from the knowledge base. Use this information to provide accurate, helpful, and detailed responses to user questions.

Knowledge Base Information:
{retrieved_context}

Instructions:
- Use the provided information to answer the user's question comprehensively
- If the information directly answers the question, provide a detailed response
- If the information is related but doesn't fully answer the question, use what's relevant and acknowledge any limitations
- Maintain a professional and helpful tone
- Do not mention that you're using a knowledge base or retrieved documents
- Provide specific details when available in the context"""),
                    ("human", "{user_message}")
                ])
            else:
                # Use fallback prompt without context
                prompt_template = ChatPromptTemplate.from_messages([
                    ("system", f"""{system_instruction}

Provide helpful and professional responses to user questions. If you don't have specific information about a topic, acknowledge this and offer to help in other ways or suggest contacting support for detailed information."""),
                    ("human", "{user_message}")
                ])
            
            # Format the prompt
            formatted_prompt = prompt_template.format_messages(user_message=user_message)
            
            logger.info(f"🚀 Sending request to ChatOpenAI...")
            
            # Generate response
            response = await asyncio.to_thread(
                self.chat_openai.invoke,
                formatted_prompt
            )
            
            # Extract content from response
            if hasattr(response, 'content'):
                response_text = response.content
            else:
                response_text = str(response)
            
            logger.info(f"✅ ChatOpenAI response generated successfully")
            logger.info(f"📄 Response length: {len(response_text)} characters")
            logger.info(f"📝 Response preview: {response_text[:200]}...")
            
            return response_text.strip()
            
        except Exception as e:
            logger.error(f"Error generating ChatOpenAI response: {e}")
            logger.warning("Falling back to Hugging Face model")
            return await self._generate_fallback_response(user_message, retrieved_context, system_instruction)
    
    async def _generate_fallback_response(
        self, 
        user_message: str, 
        retrieved_context: str, 
        system_instruction: str
    ) -> str:
        """
        Generate a fallback response using the existing Hugging Face model.
        
        Args:
            user_message: The user's original message
            retrieved_context: Context from retrieved documents
            system_instruction: System instruction from chatbot configuration
            
        Returns:
            Generated response text
        """
        try:
            # Create a comprehensive prompt similar to what we used before
            if retrieved_context.strip():
                prompt = f"""{system_instruction}

Based on the following information, provide a helpful and detailed answer to the user's question.

Information: {retrieved_context}

Question: {user_message}
Answer:"""
            else:
                prompt = f"""{system_instruction}

Question: {user_message}
Answer:"""
            
            logger.info(f"🔄 Using fallback Hugging Face model for response generation")
            
            # Use the existing text generation method
            response = await self.generate_text(
                prompt,
                max_new_tokens=1024,
                temperature=0.7,
                top_p=0.9,
                do_sample=True
            )
            
            return response.strip()
            
        except Exception as e:
            logger.error(f"Fallback response generation failed: {e}")
            # Final fallback with template response
            if retrieved_context.strip():
                return self._create_template_response(user_message, retrieved_context)
            else:
                return "I can help you with that. Please provide more details about what you'd like to know."

    def is_ready(self) -> bool:
        """Check if all API clients are ready."""
        return all([
            self.openai_client is not None,
            self.llm_client is not None,
            self.sentiment_client is not None
        ])
    
    def has_chat_openai(self) -> bool:
        """Check if ChatOpenAI is available and ready."""
        return self.chat_openai is not None and LANGCHAIN_AVAILABLE
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the model service configuration."""
        return {
            "embedding_model": settings.EMBEDDING_MODEL,
            "llm_model": settings.LLM_MODEL,
            "sentiment_model": settings.SENTIMENT_MODEL,
            "chat_openai_available": self.has_chat_openai(),
            "langchain_available": LANGCHAIN_AVAILABLE,
            "inference_api_timeout": settings.INFERENCE_API_TIMEOUT,
            "max_retries": settings.INFERENCE_API_MAX_RETRIES,
            "retry_delay": settings.INFERENCE_API_RETRY_DELAY,
            "clients_ready": self.is_ready(),
            "has_hf_api_token": bool(settings.HUGGINGFACE_API_TOKEN),
            "has_openai_api_key": bool(settings.OPENAI_API_KEY)
        }


# Global model service instance
model_service: Optional[ModelService] = None


def get_model_service() -> ModelService:
    """Get the global model service instance."""
    global model_service
    if model_service is None:
        model_service = ModelService()
    return model_service