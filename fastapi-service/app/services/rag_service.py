"""
RAG (Retrieval-Augmented Generation) service for chat responses using Hugging Face Inference API.
Handles similarity search, context construction, and response generation.
"""
import logging
import time
import uuid
import asyncio
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime

# LangChain imports
try:
    from langchain_core.documents import Document
    from langchain_core.prompts import PromptTemplate
    LANGCHAIN_AVAILABLE = True
except ImportError:
    try:
        from langchain.schema import Document
        from langchain.prompts import PromptTemplate
        LANGCHAIN_AVAILABLE = True
    except ImportError:
        # Fallback Document class
        class Document:
            def __init__(self, page_content: str, metadata: Dict[str, Any] = None):
                self.page_content = page_content
                self.metadata = metadata or {}
        
        # Fallback PromptTemplate class
        class PromptTemplate:
            def __init__(self, template: str, input_variables: List[str]):
                self.template = template
                self.input_variables = input_variables
            
            def format(self, **kwargs) -> str:
                return self.template.format(**kwargs)
        
        LANGCHAIN_AVAILABLE = False

# FastAPI imports
from fastapi import HTTPException

# Local imports
from app.models.chat import (
    ChatRequest, 
    ChatResponse, 
    RetrievedDocument, 
    RAGContext,
    ConversationMessage
)
from app.services.lead_analyzer import ConversationContext
from app.services.model_service import get_model_service
from app.services.vector_storage_service import get_vector_storage_service
from app.services.conversation_service import get_conversation_service
from app.services.event_service import get_event_service
from app.services.intent_service import get_intent_detector
from app.config import settings

logger = logging.getLogger(__name__)


class RAGService:
    """
    Service for Retrieval-Augmented Generation (RAG) chat responses using Hugging Face Inference API.
    
    Handles the complete RAG pipeline:
    1. Query embedding generation via BAAI/bge-base-en-v1.5 Inference API
    2. Document similarity search using generated embeddings
    3. Context construction with retrieved documents
    4. Response generation with HuggingFaceH4/zephyr-7b-beta via Inference Endpoints
    5. Sentiment analysis and conversation management
    """    
 
    def __init__(self):
        """Initialize the RAG service with Hugging Face Inference API clients."""
        self.model_service = get_model_service()
        self.vector_storage_service = get_vector_storage_service()
        self.conversation_service = get_conversation_service()
        self.event_service = get_event_service()
        self.intent_detector = get_intent_detector()
        
        # Initialize simple instruction service for chatbot instructions
        try:
            from app.services.simple_instruction_service import get_simple_instruction_service
            self.simple_instruction_service = get_simple_instruction_service()
            logger.info("Simple instruction service initialized for RAG")
        except ImportError:
            self.simple_instruction_service = None
            logger.warning("Simple instruction service not available - using document-only RAG")
        
        # Initialize prompt templates
        self._initialize_prompt_templates()
        
        # Configuration
        self.max_context_length = 8000  # Maximum context length for LLM
        self.similarity_threshold = 0.2  # Minimum similarity score for document retrieval (lowered from 0.7)
        self.max_retrieved_docs = 15  # Maximum number of documents to retrieve
        
        # Conversation management
        self.conversations: Dict[str, List[ConversationMessage]] = {}
        
        logger.info("RAG service initialized with Hugging Face Inference API")
    
    def _initialize_prompt_templates(self):
        """Initialize prompt templates for different conversation scenarios."""
        
        # Simple RAG prompt template with system instruction and context
        self.simple_rag_prompt_template = PromptTemplate(
            template="""{system_instruction}

Based on the following information, provide a helpful and detailed answer to the user's question.

Information: {context}

Question: {question}
Answer:""",
            input_variables=["system_instruction", "context", "question"]
        )
        
        # Main RAG prompt template with context - simplified for DialoGPT
        self.rag_prompt_template = PromptTemplate(
            template="""Based on the following information, provide a helpful and detailed answer to the user's question. Answer directly without mentioning sources or documentation.

Information: {context}

Question: {question}
Answer:""",
            input_variables=["context", "question"]
        )
        
        # Fallback prompt template when no context is available - simplified
        self.fallback_prompt_template = PromptTemplate(
            template="""Question: {question}
Answer: I don't have specific information about that topic. Please contact our support team for more detailed assistance.""",
            input_variables=["question"]
        )
        
        # Conversation continuation prompt
        self.conversation_prompt_template = PromptTemplate(
            template="""You are a helpful AI assistant for a business. Continue this conversation naturally based on the available information and conversation history.

Available information:
{context}

Previous conversation:
{conversation_history}

Current question: {question}

Please provide a helpful and detailed response that takes into account the conversation history and available information. Answer directly without mentioning sources.""",
            input_variables=["context", "conversation_history", "question"]
        )
    
    async def generate_response_stream(self, request: ChatRequest):
        """
        Generate a streaming response using the RAG pipeline.
        
        Args:
            request: Chat request with user message and metadata
            
        Yields:
            StreamChatResponse objects with tokens and metadata
        """
        start_time = time.time()
        
        try:
            logger.info(f"Generating streaming response for user {request.user_id}: {request.message[:100]}...")
            
            # Generate conversation ID if not provided
            conversation_id = request.conversation_id or self._generate_conversation_id()
            
            # Send conversation metadata early so frontend can save conversation ID
            from app.models.chat import StreamChatResponse
            yield StreamChatResponse(
                type="metadata",
                content=None,
                conversation_id=conversation_id,
                sentiment="neutral",  # Default sentiment until analysis is complete
                metadata={
                    "timestamp": time.time()
                }
            )
            
            # Step 1: Generate query embedding and retrieve relevant documents and instructions
            retrieval_start = time.time()
            # Use chatbot_id if available (for widget requests), otherwise fall back to user_id
            search_id = request.chatbot_id or request.user_id
            retrieved_docs, query_embedding_success = await self._retrieve_relevant_documents(
                request.message, search_id
            )
            
            # Step 1.5: Get chatbot system instruction
            logger.debug(f"Retrieving system instruction for chatbot: {search_id}")
            system_instruction = await self._get_chatbot_instruction(search_id)
            logger.info(f"🤖 RAG DEBUG - Retrieved system instruction for chatbot {search_id}")
            logger.info(f"📋 System instruction: {system_instruction}")
            retrieval_time = (time.time() - retrieval_start) * 1000
            
            # Step 2: Construct context from documents only
            context, context_length = self._construct_context(retrieved_docs)
            logger.info(f"🔍 RAG DEBUG - Context construction complete")
            logger.info(f"📚 Retrieved documents count: {len(retrieved_docs)}")
            logger.info(f"📏 Context length: {context_length} characters")
            if retrieved_docs:
                logger.info(f"📄 First document preview: {retrieved_docs[0].get('content', '')[:100]}...")
            logger.info(f"📝 Constructed context preview: {context[:200]}...")
            
            # Step 3: Analyze sentiment and intent of user message (in parallel with generation)
            sentiment_task = asyncio.create_task(self._analyze_sentiment(request.message))
            intent_task = asyncio.create_task(self._detect_intent(request.message))
            
            # Step 4: Generate streaming response using LLM with system instruction
            generation_start = time.time()
            full_response = ""
            
            async for token in self._generate_llm_response_stream(
                request.message, context, system_instruction, conversation_id
            ):
                full_response += token
                # Yield token
                from app.models.chat import StreamChatResponse
                yield StreamChatResponse(
                    type="token",
                    content=token,
                    metadata=None
                )
            
            generation_time = (time.time() - generation_start) * 1000
            
            # Wait for sentiment and intent analysis to complete
            sentiment_analysis = await sentiment_task
            intent_analysis = await intent_task
            
            # Step 5: Calculate confidence score
            confidence_score = self._calculate_confidence_score(
                retrieved_docs, context_length, len(full_response)
            )
            
            # Step 6: Save conversation messages
            message_ids = await self._save_conversation_messages(
                conversation_id, request.user_id, request.message, full_response, sentiment_analysis, request.chatbot_id, None, None, getattr(request, 'user_email', None)
            )
            
            # Step 6.5: Emit automation events
            await self._emit_conversation_events(
                conversation_id, request.user_id, request.message, full_response,
                sentiment_analysis, intent_analysis, message_ids, request.chatbot_id,
                getattr(request, 'user_email', None), None, getattr(request, 'image_url', None)
            )
            
            # Step 7: Send final metadata
            total_time = (time.time() - start_time) * 1000
            
            from app.models.chat import StreamChatResponse
            yield StreamChatResponse(
                type="metadata",
                content=None,
                metadata={
                    "sentiment": sentiment_analysis.get("label", "neutral"),
                    "sentiment_score": sentiment_analysis.get("score", 0.0),
                    "sentiment_confidence": sentiment_analysis.get("confidence", 0.0),
                    "triggers_detected": sentiment_analysis.get("triggers", []),
                    "conversation_id": conversation_id,
                    "context_used": len(retrieved_docs) > 0,
                    "sources_count": len(retrieved_docs),
                    "confidence_score": confidence_score,
                    "processing_time_ms": total_time,
                    "retrieval_time_ms": retrieval_time,
                    "generation_time_ms": generation_time
                }
            )
            
            # Send completion signal
            yield StreamChatResponse(
                type="done",
                content=None,
                metadata=None
            )
            
            logger.info(f"Streaming response completed in {total_time:.2f}ms")
            
        except Exception as e:
            logger.error(f"Error generating streaming response: {e}")
            # Send error metadata
            from app.models.chat import StreamChatResponse
            yield StreamChatResponse(
                type="metadata",
                content=None,
                metadata={
                    "error": str(e),
                    "conversation_id": conversation_id if 'conversation_id' in locals() else None
                }
            )
            yield StreamChatResponse(
                type="done",
                content=None,
                metadata=None
            )
    
    async def _generate_llm_response_stream(
        self, question: str, context: str, system_instruction: str, conversation_id: str
    ):
        """
        Generate streaming response using the LLM with system instruction and context.
        
        Args:
            question: User's question
            context: Context from retrieved documents
            system_instruction: System instruction for the chatbot
            conversation_id: Conversation ID for potential history lookup
            
        Yields:
            Text tokens from the LLM
        """
        try:
            # Choose appropriate prompt template based on available context
            if context.strip():
                prompt = self.simple_rag_prompt_template.format(
                    system_instruction=system_instruction,
                    context=context,
                    question=question
                )
                logger.info(f"🔍 RAG DEBUG - Using context-based prompt")
                logger.info(f"📝 Context length: {len(context)} characters")
                logger.info(f"📝 Context preview: {context[:200]}...")
                logger.info(f"🤖 System instruction: {system_instruction}")
                logger.info(f"❓ Question: {question}")
                logger.info(f"📋 Full prompt preview: {prompt[:500]}...")
            else:
                # Use system instruction with fallback template
                prompt = f"{system_instruction}\n\nQuestion: {question}\nAnswer:"
                logger.warning(f"⚠️ RAG DEBUG - No context available, using fallback prompt")
                logger.info(f"🤖 System instruction: {system_instruction}")
                logger.info(f"❓ Question: {question}")
                logger.info(f"📋 Fallback prompt: {prompt}")
            
            logger.info(f"🚀 Sending prompt to LLM model...")
            
            # Use ChatOpenAI if available, otherwise fallback to Hugging Face streaming
            if self.model_service.has_chat_openai():
                logger.info(f"✨ Using ChatOpenAI for streaming response generation")
                
                # Generate full response with ChatOpenAI
                full_response = await self.model_service.generate_rag_response(
                    user_message=question,
                    retrieved_context=context,
                    system_instruction=system_instruction
                )
                
                # Simulate streaming by yielding chunks
                chunk_size = 5  # Characters per chunk for smooth streaming
                token_count = 0
                for i in range(0, len(full_response), chunk_size):
                    chunk = full_response[i:i + chunk_size]
                    token_count += 1
                    if token_count <= 5:  # Log first 5 chunks
                        logger.info(f"🌊 Chunk {token_count}: {repr(chunk)}")
                    yield chunk
                    await asyncio.sleep(0.03)  # Small delay for realistic streaming effect
                
                logger.info(f"✅ ChatOpenAI streaming complete - Total chunks: {token_count}")
                logger.info(f"📄 Full response preview: {full_response[:200]}...")
                logger.info(f"📊 Response length: {len(full_response)} characters")
            else:
                logger.info(f"🔄 ChatOpenAI not available, using Hugging Face streaming")
                
                # Generate streaming response using Hugging Face Inference API
                token_count = 0
                full_response_debug = ""
                async for token in self.model_service.generate_text_stream(
                    prompt,
                    max_new_tokens=1024,  # Increased from 256 to 1024 for more detailed responses
                    temperature=0.7,
                    top_p=0.9,
                    do_sample=True,
                    return_full_text=False
                ):
                    token_count += 1
                    full_response_debug += token
                    if token_count <= 5:  # Log first 5 tokens
                        logger.info(f"🌊 Token {token_count}: {repr(token)}")
                    yield token
                
                logger.info(f"✅ HF streaming complete - Total tokens: {token_count}")
                logger.info(f"📄 Full response preview: {full_response_debug[:200]}...")
                logger.info(f"📊 Response length: {len(full_response_debug)} characters")
                
        except Exception as e:
            logger.error(f"Error generating streaming LLM response: {e}")
            # Yield fallback response in chunks
            if context.strip():
                fallback = "I have relevant information but I'm having trouble processing it right now. Please try rephrasing your question or contact support for assistance."
            else:
                fallback = "I don't have specific information about that topic. Please contact our support team for more detailed assistance."
            
            # Yield fallback response in chunks
            chunk_size = 10
            for i in range(0, len(fallback), chunk_size):
                chunk = fallback[i:i + chunk_size]
                yield chunk
                await asyncio.sleep(0.05)

    async def generate_response(self, request: ChatRequest) -> ChatResponse:
        """
        Generate a response using the RAG pipeline with memory integration.
        
        Args:
            request: Chat request with user message and metadata
            
        Returns:
            ChatResponse with AI-generated response and metadata
        """
        start_time = time.time()
        
        try:
            logger.info(f"Generating response for user {request.user_id}: {request.message[:100]}...")
            
            # Generate conversation ID if not provided
            conversation_id = request.conversation_id or self._generate_conversation_id()
            
            # Step 1: Handle session management for external users (widget requests)
            session_id = None
            memory_context = ""
            if hasattr(request, 'user_email') and request.user_email and request.chatbot_id:
                session_id, memory_context = await self._handle_session_memory(
                    request.user_email, request.chatbot_id, getattr(request, 'session_id', None)
                )
            
            # Step 2: Generate query embedding and retrieve relevant documents and instructions
            retrieval_start = time.time()
            # Use chatbot_id if available (for widget requests), otherwise fall back to user_id
            search_id = request.chatbot_id or request.user_id
            retrieved_docs, query_embedding_success = await self._retrieve_relevant_documents(
                request.message, search_id
            )
            
            # Step 2.5: Get chatbot system instruction
            logger.debug(f"Retrieving system instruction for chatbot: {search_id}")
            system_instruction = await self._get_chatbot_instruction(search_id)
            logger.info(f"Retrieved system instruction for chatbot {search_id}")
            retrieval_time = (time.time() - retrieval_start) * 1000
            
            # Step 3: Construct context from documents only
            context, context_length = self._construct_context(retrieved_docs)
            
            # Step 4: Generate response using LLM with system instruction and memory context
            generation_start = time.time()
            ai_response = await self._generate_llm_response_with_memory(
                request.message, context, system_instruction, memory_context, conversation_id
            )
            generation_time = (time.time() - generation_start) * 1000
            
            # Step 5: Analyze image if provided
            image_analysis_result = None
            if hasattr(request, 'image_url') and request.image_url:
                image_analysis_result = await self._analyze_image(request.image_url, request.message)
                
                # If image analysis was successful, incorporate it into the context
                if image_analysis_result:
                    image_context = f"\n\nImage Analysis Results:\n{image_analysis_result.get('summary', '')}"
                    context += image_context
            
            # Step 6: Analyze sentiment of user message
            sentiment_analysis = await self._analyze_sentiment(request.message)
            
            # Step 6.5: Detect intent in user message
            intent_analysis = await self._detect_intent(request.message)
            
            # Step 6.6: Analyze lead potential
            lead_analysis_result = await self._analyze_lead_potential(
                request.message, conversation_id, getattr(request, 'user_email', None)
            )
            
            # Step 7: Calculate confidence score
            confidence_score = self._calculate_confidence_score(
                retrieved_docs, context_length, len(ai_response)
            )
            
            # Step 8: Save conversation messages and update memory
            message_ids = await self._save_conversation_messages(
                conversation_id, request.user_id, request.message, ai_response, 
                sentiment_analysis, request.chatbot_id, session_id, 
                getattr(request, 'image_url', None), getattr(request, 'user_email', None)
            )
            
            # Step 9: Process lead automation if qualified
            if lead_analysis_result and lead_analysis_result.get("lead_qualified"):
                await self._process_lead_automation(
                    lead_analysis_result, conversation_id, getattr(request, 'user_email', None), request.chatbot_id
                )
            
            # Step 10: Emit automation events (including image upload trigger if applicable)
            await self._emit_conversation_events(
                conversation_id, request.user_id, request.message, ai_response,
                sentiment_analysis, intent_analysis, message_ids, request.chatbot_id, 
                getattr(request, 'user_email', None), image_analysis_result, getattr(request, 'image_url', None)
            )
            
            # Update memory if session exists
            if session_id:
                await self._update_session_memory(session_id, request.message, ai_response)
            
            # Create response
            response = ChatResponse(
                response=ai_response,
                sentiment=sentiment_analysis.get("label", "neutral"),
                sentiment_score=sentiment_analysis.get("score", 0.0),
                sentiment_confidence=sentiment_analysis.get("confidence", 0.0),
                triggers_detected=sentiment_analysis.get("triggers", []),
                conversation_id=conversation_id,
                session_id=session_id,
                context_used=len(retrieved_docs) > 0,
                sources_count=len(retrieved_docs),
                confidence_score=confidence_score,
                image_analysis=image_analysis_result,
                lead_analysis=lead_analysis_result
            )
            
            total_time = (time.time() - start_time) * 1000
            logger.info(f"Response generated in {total_time:.2f}ms (retrieval: {retrieval_time:.2f}ms, generation: {generation_time:.2f}ms)")
            
            return response
            
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate response: {str(e)}"
            )
    
    async def _retrieve_relevant_documents(
        self, query: str, chatbot_id: str
    ) -> Tuple[List[Tuple[Document, float]], bool]:
        """
        Retrieve relevant documents using similarity search with Hugging Face Inference API embeddings.
        
        Args:
            query: User's query text
            chatbot_id: Chatbot ID for document filtering
            
        Returns:
            Tuple of (retrieved documents with scores, embedding_success)
        """
        try:
            # Generate query embedding using Hugging Face Inference API
            logger.debug(f"Generating query embedding for: {query[:100]}...")
            query_embedding = await self.model_service.generate_embedding(query)
            
            # Perform similarity search using the generated embedding
            retrieved_docs = await self.vector_storage_service.similarity_search_by_vector(
                embedding=query_embedding,
                chatbot_id=chatbot_id,
                k=self.max_retrieved_docs,
                score_threshold=self.similarity_threshold
            )
            
            logger.info(f"Retrieved {len(retrieved_docs)} relevant documents using Inference API embedding")
            return retrieved_docs, True
            
        except Exception as e:
            logger.error(f"Error retrieving documents with Inference API: {e}")
            # Try fallback similarity search without custom embedding
            try:
                retrieved_docs = await self.vector_storage_service.similarity_search(
                    query=query,
                    chatbot_id=chatbot_id,
                    k=self.max_retrieved_docs,
                    score_threshold=self.similarity_threshold
                )
                logger.info(f"Retrieved {len(retrieved_docs)} documents using fallback search")
                return retrieved_docs, False
            except Exception as fallback_error:
                logger.error(f"Fallback document retrieval also failed: {fallback_error}")
                return [], False
    
    async def _get_chatbot_instruction(self, chatbot_id: str) -> str:
        """
        Get the system instruction for a chatbot.
        
        Args:
            chatbot_id: Chatbot ID
            
        Returns:
            System instruction text
        """
        try:
            if not self.simple_instruction_service:
                logger.debug("Simple instruction service not available - using default instruction")
                return "You are a helpful AI assistant. Provide accurate, helpful, and professional responses to user questions."
            
            logger.debug(f"Retrieving system instruction for chatbot: {chatbot_id}")
            
            # Get the chatbot's system instruction
            instruction = await self.simple_instruction_service.get_chatbot_instruction(chatbot_id)
            
            logger.debug(f"Retrieved system instruction: {instruction[:100]}...")
            return instruction
            
        except Exception as e:
            logger.error(f"Error retrieving chatbot instruction: {e}")
            # Return default instruction for graceful degradation
            logger.warning("Returning default instruction due to retrieval error")
            return "You are a helpful AI assistant. Provide accurate, helpful, and professional responses to user questions."
    
    def _construct_context(self, retrieved_docs: List[Tuple[Document, float]]) -> Tuple[str, int]:
        """
        Construct context string from retrieved documents.
        
        Args:
            retrieved_docs: List of (Document, similarity_score) tuples
            
        Returns:
            Tuple of (context_string, context_length)
        """
        if not retrieved_docs:
            return "", 0
        
        context_parts = []
        total_length = 0
        
        # Sort documents by similarity score (highest first)
        sorted_docs = sorted(retrieved_docs, key=lambda x: x[1], reverse=True)
        
        for doc, score in sorted_docs:
            # Add only document content without source information for cleaner responses
            doc_context = f"{doc.page_content}\n"
            
            # Check if adding this document would exceed max context length
            if total_length + len(doc_context) > self.max_context_length:
                # Try to add a truncated version
                remaining_space = self.max_context_length - total_length - 100  # Leave some buffer
                if remaining_space > 200:  # Only add if we have reasonable space
                    truncated_content = doc.page_content[:remaining_space] + "..."
                    doc_context = f"{truncated_content}\n"
                    context_parts.append(doc_context)
                    total_length += len(doc_context)
                break
            
            context_parts.append(doc_context)
            total_length += len(doc_context)
        
        context = "\n---\n".join(context_parts)
        
        logger.info(f"Constructed context with {len(context_parts)} documents, {total_length} characters and context {context}")
        return context, total_length
    

    
    async def _generate_llm_response(
        self, question: str, context: str, conversation_id: str
    ) -> str:
        """
        Generate response using ChatOpenAI with enhanced context including instructions.
        
        Args:
            question: User's question
            context: Enhanced context from retrieved documents and instructions
            conversation_id: Conversation ID for potential history lookup
            
        Returns:
            Generated response text
        """
        try:
            # Get system instruction (default if not available)
            system_instruction = "You are a helpful AI assistant. Provide accurate, helpful, and professional responses to user questions."
            
            # Use ChatOpenAI if available
            if self.model_service.has_chat_openai():
                logger.info(f"✨ Using ChatOpenAI for response generation")
                response = await self.model_service.generate_rag_response(
                    user_message=question,
                    retrieved_context=context,
                    system_instruction=system_instruction
                )
            else:
                logger.info(f"🔄 ChatOpenAI not available, using fallback method")
                # Fallback to existing Hugging Face method
                if context.strip():
                    # Check if context contains instructions
                    if "Training Instructions:" in context:
                        # Split context into instructions and knowledge base
                        context_parts = context.split("Knowledge Base:\n", 1)
                        instructions = context_parts[0].replace("Training Instructions:\n", "").strip()
                        knowledge_context = context_parts[1] if len(context_parts) > 1 else ""
                        
                        prompt = self.enhanced_rag_prompt_template.format(
                            instructions=instructions,
                            context=knowledge_context,
                            question=question
                        )
                    else:
                        prompt = self.rag_prompt_template.format(
                            context=context,
                            question=question
                        )
                else:
                    prompt = self.fallback_prompt_template.format(
                        question=question
                    )
                
                # Generate response using Hugging Face Inference API
                response = await self.model_service.generate_text(
                    prompt,
                    max_new_tokens=1024,  # Increased from 256 to 1024 for more detailed responses
                    temperature=0.7,
                    top_p=0.9,
                    do_sample=True,
                    return_full_text=False
                )
            
            # Ensure response is not empty
            if not response or not response.strip():
                if context.strip():
                    response = "I have relevant information but couldn't generate a proper response. Please try rephrasing your question."
                else:
                    response = "I don't have information about that topic. Please contact our support team for assistance."
            
            # Debug logging for RAG response
            logger.info(f"🔍 RAG Response Debug - Before strip: {repr(response)}")
            logger.info(f"🔍 RAG Response Debug - Has spaces: {' ' in response}")
            logger.info(f"🔍 RAG Response Debug - Space count: {response.count(' ')}")
            stripped_response = response.strip()
            logger.info(f"🔍 RAG Response Debug - After strip: {repr(stripped_response)}")
            logger.info(f"🔍 RAG Response Debug - After strip spaces: {stripped_response.count(' ')}")
            
            return stripped_response
            
        except Exception as e:
            logger.error(f"Error generating LLM response: {e}")
            # Return fallback response
            if context.strip():
                return "I have relevant information but I'm having trouble processing it right now. Please try rephrasing your question or contact support for assistance."
            else:
                return "I don't have specific information about that topic. Please contact our support team for more detailed assistance."
    
    async def _analyze_sentiment(self, message: str) -> Dict[str, Any]:
        """
        Analyze sentiment of user message using the SentimentAnalyzer service.
        
        Args:
            message: User's message text
            
        Returns:
            Dictionary with sentiment analysis results including triggers
        """
        try:
            from app.services.sentiment_service import get_sentiment_analyzer
            
            sentiment_analyzer = get_sentiment_analyzer()
            
            if not sentiment_analyzer.is_ready():
                logger.warning("SentimentAnalyzer is not ready, using fallback")
                return {
                    "label": "neutral",
                    "score": 0.0,
                    "confidence": 0.0,
                    "triggers": []
                }
            
            # Analyze sentiment
            sentiment_result = await sentiment_analyzer.analyze_sentiment(message)
            
            # Detect automation triggers
            triggers = sentiment_analyzer.detect_triggers(sentiment_result, message)
            
            return {
                "label": sentiment_result.get("label", "neutral"),
                "score": sentiment_result.get("score", 0.0),
                "confidence": sentiment_result.get("confidence", 0.0),
                "subjectivity": sentiment_result.get("subjectivity", 0.0),
                "triggers": triggers
            }
            
        except Exception as e:
            logger.error(f"Error analyzing sentiment: {e}")
            return {
                "label": "neutral",
                "score": 0.0,
                "confidence": 0.0,
                "triggers": []
            }
    
    async def _detect_intent(self, message: str) -> Dict[str, Any]:
        """
        Detect intent in user message using the IntentDetector service.
        
        Args:
            message: User's message text
            
        Returns:
            Dictionary with intent detection results
        """
        try:
            if not self.intent_detector.is_ready():
                logger.warning("IntentDetector is not ready, using fallback")
                return {
                    "intent": None,
                    "confidence": 0.0,
                    "matched_keywords": [],
                    "matched_phrases": []
                }
            
            # Detect intent
            intent_result = await self.intent_detector.detect_intent(message)
            
            logger.debug(f"Intent detection completed for message: {message[:50]}...")
            return intent_result
            
        except Exception as e:
            logger.error(f"Error detecting intent: {e}")
            return {
                "intent": None,
                "confidence": 0.0,
                "matched_keywords": [],
                "matched_phrases": []
            }
    
    async def _analyze_image(self, image_url: str, message: str) -> Optional[Dict[str, Any]]:
        """
        Analyze uploaded image using the Vision service.
        
        Args:
            image_url: URL or data URL of the image to analyze
            message: User's message for context
            
        Returns:
            Dictionary with image analysis results or None if analysis fails
        """
        try:
            from app.services.vision_service import get_vision_service
            from app.services.image_analysis_service import get_image_analysis_service
            from app.models.vision import AnalysisType
            
            logger.info(f"Starting image analysis for message: {message[:50]}...")
            
            vision_service = get_vision_service()
            image_analysis_service = get_image_analysis_service()
            
            # Determine analysis type based on message content
            analysis_type = self._determine_analysis_type(message)
            
            # Perform image analysis
            analysis_result = await vision_service.analyze_image(
                image_url=image_url,
                analysis_type=analysis_type,
                custom_prompt=self._create_custom_prompt(message) if analysis_type == AnalysisType.CUSTOM else None
            )
            
            # Store analysis result in database
            if analysis_result and image_analysis_service.is_ready():
                await image_analysis_service.store_analysis_result(
                    image_url=image_url,
                    analysis_type=analysis_result["analysis_type"],
                    prompt=analysis_result["prompt"],
                    analysis_result=analysis_result["result"],
                    processing_time=int(analysis_result["processing_time_ms"]),
                    confidence_score=analysis_result["result"].get("confidence", 0.0) if isinstance(analysis_result["result"], dict) else None
                )
            
            # Create summary for context integration
            summary = self._create_analysis_summary(analysis_result, analysis_type)
            
            logger.info(f"Image analysis completed successfully: {analysis_type}")
            
            return {
                "type": analysis_type.value,
                "result": analysis_result["result"],
                "confidence": analysis_result["result"].get("confidence", 0.0) if isinstance(analysis_result["result"], dict) else 0.0,
                "processing_time_ms": analysis_result["processing_time_ms"],
                "summary": summary
            }
            
        except Exception as e:
            logger.error(f"Error analyzing image: {e}")
            return None
    
    def _determine_analysis_type(self, message: str) -> 'AnalysisType':
        """
        Determine the appropriate analysis type based on the user's message.
        
        Args:
            message: User's message text
            
        Returns:
            AnalysisType enum value
        """
        from app.models.vision import AnalysisType
        
        message_lower = message.lower()
        
        # Check for product condition keywords
        product_keywords = ["condition", "return", "refund", "damage", "broken", "defective", "quality"]
        if any(keyword in message_lower for keyword in product_keywords):
            return AnalysisType.PRODUCT_CONDITION
        
        # Check for invoice keywords
        invoice_keywords = ["invoice", "receipt", "bill", "payment", "total", "amount", "vendor"]
        if any(keyword in message_lower for keyword in invoice_keywords):
            return AnalysisType.INVOICE_EXTRACTION
        
        # Check for inventory keywords
        inventory_keywords = ["count", "inventory", "stock", "items", "quantity", "how many"]
        if any(keyword in message_lower for keyword in inventory_keywords):
            return AnalysisType.INVENTORY_COUNT
        
        # Default to custom analysis
        return AnalysisType.CUSTOM
    
    def _create_custom_prompt(self, message: str) -> str:
        """
        Create a custom analysis prompt based on the user's message.
        
        Args:
            message: User's message text
            
        Returns:
            Custom prompt for image analysis
        """
        return f"""
        Analyze this image in the context of the user's question: "{message}"
        
        Please provide a detailed description of what you see in the image and how it relates to the user's question.
        Focus on relevant details that would help answer their question or provide useful information.
        
        Format your response as a clear, helpful description.
        """
    
    def _create_analysis_summary(self, analysis_result: Dict[str, Any], analysis_type: 'AnalysisType') -> str:
        """
        Create a human-readable summary of the image analysis results.
        
        Args:
            analysis_result: Raw analysis results from vision service
            analysis_type: Type of analysis performed
            
        Returns:
            Human-readable summary string
        """
        from app.models.vision import AnalysisType
        
        if not analysis_result or "result" not in analysis_result:
            return "Image analysis was not available."
        
        result = analysis_result["result"]
        
        if analysis_type == AnalysisType.PRODUCT_CONDITION:
            condition = result.get("condition", "unknown")
            return_eligible = result.get("return_eligible", False)
            damage_detected = result.get("damage_detected", False)
            
            summary = f"Product condition: {condition}"
            if damage_detected:
                damage_desc = result.get("damage_description", "")
                summary += f" (damage detected: {damage_desc})"
            summary += f". Return eligible: {'Yes' if return_eligible else 'No'}"
            
        elif analysis_type == AnalysisType.INVOICE_EXTRACTION:
            vendor = result.get("vendor_name", "Unknown")
            total = result.get("total_amount", "Unknown")
            currency = result.get("currency", "")
            
            summary = f"Invoice from {vendor}"
            if total != "Unknown":
                summary += f", total: {total} {currency}".strip()
            
        elif analysis_type == AnalysisType.INVENTORY_COUNT:
            total_items = result.get("total_items", 0)
            categories = result.get("item_categories", {})
            
            summary = f"Total items counted: {total_items}"
            if categories:
                category_details = ", ".join([f"{count} {category}" for category, count in categories.items()])
                summary += f" ({category_details})"
                
        else:  # CUSTOM
            summary = result.get("analysis", "Custom image analysis completed")
        
        return summary
    
    async def _analyze_lead_potential(
        self, message: str, conversation_id: str, user_email: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Analyze message for lead potential using the IntentAnalyzer service.
        
        Args:
            message: User's message to analyze
            conversation_id: Conversation ID for context
            user_email: Optional user email for lead data
            
        Returns:
            Dictionary with lead analysis results or None if not qualified
        """
        try:
            from app.services.lead_analyzer import get_intent_analyzer, ConversationContext
            
            analyzer = get_intent_analyzer()
            
            if not analyzer.is_ready():
                logger.debug("Lead analyzer not ready, skipping lead analysis")
                return None
            
            # Get conversation context for better scoring
            conversation_context = await self._get_conversation_context_for_lead_analysis(conversation_id)
            
            # Analyze lead potential
            lead_score = await analyzer.analyze_lead_potential(message, conversation_context)
            
            # Check if should trigger qualification
            should_qualify = analyzer.should_trigger_lead_qualification(lead_score)
            
            if should_qualify:
                logger.info(f"Lead qualified - Score: {lead_score.total_score}, Priority: {lead_score.priority.value}, Type: {lead_score.lead_type.value}")
                
                # Generate CRM mapping
                crm_mapping = analyzer.get_crm_data_mapping(lead_score, message)
                
                # Add conversation and user context to CRM mapping
                if conversation_id:
                    crm_mapping["conversation_id"] = conversation_id
                if user_email:
                    crm_mapping["email"] = user_email
                
                return {
                    "lead_qualified": True,
                    "lead_score": lead_score.total_score,
                    "priority": lead_score.priority.value,
                    "lead_type": lead_score.lead_type.value,
                    "confidence": lead_score.confidence,
                    "extracted_data": lead_score.extracted_data,
                    "crm_mapping": crm_mapping,
                    "factors": lead_score.factors,
                    "analyzed_at": datetime.utcnow().isoformat()
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error in lead analysis: {e}")
            return None
    
    async def _get_conversation_context_for_lead_analysis(
        self, conversation_id: str
    ) -> Optional[ConversationContext]:
        """
        Get conversation context for lead analysis scoring.
        
        Args:
            conversation_id: Conversation ID to analyze
            
        Returns:
            ConversationContext object or None if not available
        """
        try:
            # Get conversation messages from conversation service
            messages = await self.conversation_service.get_conversation_history(conversation_id)
            
            if not messages:
                return None
            
            # Calculate context metrics
            message_count = len(messages)
            conversation_length = sum(len(msg.content) for msg in messages)
            
            # Calculate engagement score based on message frequency and length
            engagement_score = min(message_count / 10.0, 1.0)  # Normalize to 0-1
            if conversation_length > 500:
                engagement_score = min(engagement_score + 0.2, 1.0)
            
            # Extract sentiment history
            sentiment_history = []
            previous_intents = []
            
            for msg in messages:
                if msg.sentiment_score is not None:
                    sentiment_history.append(msg.sentiment_score)
                
                # Extract intents from triggers if available
                triggers = msg.triggers_detected or []
                if triggers:
                    previous_intents.extend(triggers)
            
            return ConversationContext(
                message_count=message_count,
                conversation_length=conversation_length,
                engagement_score=engagement_score,
                sentiment_history=sentiment_history,
                previous_intents=list(set(previous_intents))  # Remove duplicates
            )
            
        except Exception as e:
            logger.error(f"Error getting conversation context for lead analysis: {e}")
            return None
    
    async def _process_lead_automation(
        self, 
        lead_analysis: Dict[str, Any], 
        conversation_id: str, 
        user_email: Optional[str] = None,
        chatbot_id: Optional[str] = None
    ):
        """
        Process lead automation for qualified leads.
        
        Args:
            lead_analysis: Lead analysis results
            conversation_id: Conversation ID
            user_email: User email if available
            chatbot_id: Chatbot ID if from widget
        """
        try:
            from .lead_automation_service import get_lead_automation_service
            
            automation_service = get_lead_automation_service()
            
            if not automation_service.is_ready():
                logger.warning("Lead automation service not ready, skipping lead processing")
                return
            
            # Process the qualified lead asynchronously
            asyncio.create_task(
                automation_service.process_qualified_lead(
                    lead_analysis=lead_analysis,
                    conversation_id=conversation_id,
                    user_email=user_email,
                    chatbot_id=chatbot_id
                )
            )
            
            logger.info(f"Lead automation initiated for conversation {conversation_id}")
            
        except Exception as e:
            logger.error(f"Error processing lead automation: {e}")
            # Don't raise exception to avoid breaking the chat flow
    
    def _calculate_confidence_score(
        self, retrieved_docs: List[Tuple[Document, float]], context_length: int, response_length: int
    ) -> float:
        """
        Calculate confidence score for the generated response.
        
        Args:
            retrieved_docs: Retrieved documents with similarity scores
            context_length: Length of constructed context
            response_length: Length of generated response
            
        Returns:
            Confidence score between 0.0 and 1.0
        """
        try:
            if not retrieved_docs:
                return 0.3  # Low confidence when no context available
            
            # Base confidence from document similarity scores
            avg_similarity = sum(score for _, score in retrieved_docs) / len(retrieved_docs)
            
            # Adjust based on number of retrieved documents
            doc_count_factor = min(len(retrieved_docs) / self.max_retrieved_docs, 1.0)
            
            # Adjust based on context utilization
            context_factor = min(context_length / self.max_context_length, 1.0)
            
            # Adjust based on response length (reasonable responses should have some length)
            response_factor = min(response_length / 100, 1.0) if response_length > 0 else 0.1
            
            # Combine factors
            confidence = (
                avg_similarity * 0.2 +
                doc_count_factor * 0.2 +
                context_factor * 0.2 +
                response_factor * 0.2
            )
            
            # Ensure confidence is between 0.0 and 1.0
            confidence = max(0.0, min(1.0, confidence))
            
            return round(confidence, 2)
            
        except Exception as e:
            logger.error(f"Error calculating confidence score: {e}")
            return 0.5  # Default moderate confidence
    
    def _generate_conversation_id(self) -> str:
        """Generate a unique conversation ID."""
        return f"conv_{uuid.uuid4()}"
    
    async def _save_conversation_messages(
        self, 
        conversation_id: str, 
        user_id: str, 
        user_message: str, 
        ai_response: str, 
        sentiment_analysis: Dict[str, Any],
        chatbot_id: str = None,
        session_id: str = None,
        image_url: str = None,
        user_email: str = None
    ) -> Dict[str, Optional[str]]:
        """
        Save user and assistant messages to the conversation.
        
        Args:
            conversation_id: The conversation ID
            user_id: The user ID
            user_message: The user's message
            ai_response: The AI's response
            sentiment_analysis: Sentiment analysis result dictionary
            chatbot_id: Optional chatbot ID for widget conversations
            session_id: Optional session ID for memory persistence
            image_url: Optional image URL if image was uploaded
            user_email: Optional user email for customer identification
            
        Returns:
            Dictionary with user_message_id and assistant_message_id
        """
        message_ids = {"user_message_id": None, "assistant_message_id": None}
        
        try:
            # Check if conversation exists, create if not
            conversation_exists = await self.conversation_service.conversation_exists(conversation_id, user_id)
            is_new_conversation = not conversation_exists
            
            if is_new_conversation:
                # Create conversation with the specific conversation_id
                await self.conversation_service.create_conversation_with_id(conversation_id, user_id, chatbot_id, None, user_email)
            
            # Prepare metadata for user message
            user_metadata = {}
            if image_url:
                user_metadata["image_url"] = image_url
            
            # Save user message with sentiment data
            user_message_id = await self.conversation_service.save_message(
                conversation_id=conversation_id,
                role="user",
                content=user_message,
                sentiment=sentiment_analysis.get("label", "neutral"),
                sentiment_score=sentiment_analysis.get("score", 0.0),
                triggers_detected=sentiment_analysis.get("triggers", []),
                metadata=user_metadata if user_metadata else None,
                session_id=session_id
            )
            message_ids["user_message_id"] = user_message_id
            
            # Save assistant response
            assistant_message_id = await self.conversation_service.save_message(
                conversation_id=conversation_id,
                role="assistant",
                content=ai_response,
                sentiment="neutral",  # Assistant messages are typically neutral
                sentiment_score=0.0,
                triggers_detected=[],
                session_id=session_id
            )
            message_ids["assistant_message_id"] = assistant_message_id
            
            # Store new conversation flag for event emission
            message_ids["is_new_conversation"] = is_new_conversation
            
            logger.debug(f"Saved conversation messages for {conversation_id}")
            
        except Exception as e:
            logger.error(f"Error saving conversation messages: {e}")
            # Don't raise error here as message saving is not critical for response generation
        
        return message_ids
    
    async def _emit_conversation_events(
        self,
        conversation_id: str,
        user_id: str,
        user_message: str,
        ai_response: str,
        sentiment_analysis: Dict[str, Any],
        intent_analysis: Dict[str, Any],
        message_ids: Dict[str, Optional[str]],
        chatbot_id: Optional[str] = None,
        user_email: Optional[str] = None,
        image_analysis: Optional[Dict[str, Any]] = None,
        image_url: Optional[str] = None
    ):
        """
        Emit automation events for conversation and message processing.
        
        Args:
            conversation_id: The conversation ID
            user_id: The user ID
            user_message: The user's message
            ai_response: The AI's response
            sentiment_analysis: Sentiment analysis results
            intent_analysis: Intent detection results
            message_ids: Dictionary with message IDs
            chatbot_id: Optional chatbot ID
            user_email: Optional external user email
            image_analysis: Optional image analysis results
            image_url: Optional image URL for image upload events
        """
        try:
            # Emit new conversation event if this is a new conversation
            if message_ids.get("is_new_conversation", False):
                await self.event_service.emit_new_conversation_event(
                    conversation_id, user_id, chatbot_id, user_email
                )
            
            # Emit message event for user message
            if message_ids.get("user_message_id"):
                await self.event_service.emit_message_event(
                    conversation_id, message_ids["user_message_id"], user_id,
                    user_message, "user", sentiment_analysis, chatbot_id
                )
            
            # Emit message event for assistant response
            if message_ids.get("assistant_message_id"):
                await self.event_service.emit_message_event(
                    conversation_id, message_ids["assistant_message_id"], user_id,
                    ai_response, "assistant", {"label": "neutral", "score": 0.0, "triggers": []}, chatbot_id
                )
            
            # Process sentiment-based triggers
            triggers = sentiment_analysis.get("triggers", [])
            if triggers and message_ids.get("user_message_id"):
                await self.event_service.process_triggers(
                    conversation_id, message_ids["user_message_id"], user_id,
                    triggers, sentiment_analysis, chatbot_id
                )
            
            # Process intent-based triggers
            if (intent_analysis.get("intent") and 
                self.intent_detector.should_trigger_intent_event(intent_analysis) and
                message_ids.get("user_message_id")):
                
                await self.event_service.emit_intent_detected_event(
                    conversation_id, message_ids["user_message_id"], user_id,
                    intent_analysis["intent"], intent_analysis["confidence"], chatbot_id
                )
            
            # Process image upload trigger
            if image_analysis and image_url and message_ids.get("user_message_id"):
                await self.event_service.emit_image_uploaded_event(
                    conversation_id, message_ids["user_message_id"], user_id,
                    image_url, image_analysis, chatbot_id
                )
            
            logger.debug(f"Emitted automation events for conversation {conversation_id}")
            
        except Exception as e:
            logger.error(f"Error emitting conversation events: {e}")
            # Don't raise error here as event emission is not critical for response generation
    
    async def get_rag_context(self, request: ChatRequest) -> RAGContext:
        """
        Get RAG context information for debugging and monitoring.
        
        Args:
            request: Chat request
            
        Returns:
            RAGContext with processing information
        """
        try:
            start_time = time.time()
            
            # Test query embedding generation
            embedding_start = time.time()
            try:
                embeddings_model = self.model_service.get_embeddings_model()
                query_embedding = embeddings_model.embed_query(request.message)
                query_embedding_generated = True
            except Exception as e:
                logger.error(f"Error generating query embedding: {e}")
                query_embedding_generated = False
            
            # Test document retrieval
            retrieval_start = time.time()
            retrieved_docs, _ = await self._retrieve_relevant_documents(
                request.message, request.user_id
            )
            retrieval_time = (time.time() - retrieval_start) * 1000
            
            # Construct context
            context, context_length = self._construct_context(retrieved_docs)
            
            return RAGContext(
                query_embedding_generated=query_embedding_generated,
                documents_retrieved=len(retrieved_docs),
                context_length=context_length,
                retrieval_time_ms=retrieval_time,
                generation_time_ms=0.0  # Not generating response in this method
            )
            
        except Exception as e:
            logger.error(f"Error getting RAG context: {e}")
            return RAGContext(
                query_embedding_generated=False,
                documents_retrieved=0,
                context_length=0,
                retrieval_time_ms=0.0,
                generation_time_ms=0.0
            )
    
    def is_ready(self) -> bool:
        """Check if the RAG service is ready to process requests."""
        try:
            return (
                self.model_service.is_ready() and
                self.vector_storage_service.is_ready() and
                self.conversation_service.is_ready() and
                self.event_service.is_ready()
            )
        except Exception as e:
            logger.error(f"Error checking RAG service readiness: {e}")
            return False
    
    async def _handle_session_memory(
        self, user_email: str, chatbot_id: str, session_id: Optional[str] = None
    ) -> Tuple[Optional[str], str]:
        """
        Handle session management and memory loading for external users.
        
        Args:
            user_email: External user's email
            chatbot_id: Chatbot ID
            session_id: Optional existing session ID
            
        Returns:
            Tuple of (session_id, memory_context)
        """
        try:
            from app.services.memory_service import get_session_manager, create_memory_manager
            
            session_manager = get_session_manager()
            
            # Get or create external user
            external_user_id = await session_manager.get_or_create_external_user(user_email)
            if not external_user_id:
                logger.warning(f"Failed to get/create external user for {user_email}")
                return None, ""
            
            # Get or create session
            if session_id:
                # Verify session exists and belongs to user
                # For now, trust the provided session_id
                actual_session_id = session_id
            else:
                actual_session_id = await session_manager.get_or_create_session(
                    external_user_id, chatbot_id
                )
            
            if not actual_session_id:
                logger.warning(f"Failed to get/create session for user {external_user_id}")
                return None, ""
            
            # Load memory for the session
            memory_manager = create_memory_manager(actual_session_id)
            await memory_manager.load_memory()
            memory_context = memory_manager.get_context_for_llm()
            
            logger.debug(f"Loaded memory context for session {actual_session_id}: {len(memory_context)} chars")
            return actual_session_id, memory_context
            
        except Exception as e:
            logger.error(f"Error handling session memory: {e}")
            return None, ""
    
    async def _update_session_memory(self, session_id: str, human_message: str, ai_message: str):
        """
        Update session memory with new message exchange.
        
        Args:
            session_id: Session ID
            human_message: User's message
            ai_message: AI's response
        """
        try:
            from app.services.memory_service import create_memory_manager
            
            memory_manager = create_memory_manager(session_id)
            await memory_manager.save_memory(human_message, ai_message)
            
            logger.debug(f"Updated memory for session {session_id}")
            
        except Exception as e:
            logger.error(f"Error updating session memory: {e}")
    
    async def _generate_llm_response_with_memory(
        self, question: str, context: str, system_instruction: str, memory_context: str, conversation_id: str
    ) -> str:
        """
        Generate response using ChatOpenAI with system instruction, document context and conversation memory.
        
        Args:
            question: User's question
            context: Document context from RAG
            system_instruction: System instruction for the chatbot
            memory_context: Conversation memory context
            conversation_id: Conversation ID
            
        Returns:
            Generated response text
        """
        try:
            # Combine all context sources
            full_context = context
            if memory_context.strip():
                full_context = f"Conversation Context:\n{memory_context}\n\nKnowledge Base:\n{context}"
            
            logger.info(f"🤖 RAG DEBUG - Generating response with enhanced model")
            logger.info(f"📚 Full context length: {len(full_context)} characters")
            logger.info(f"🎯 System instruction: {system_instruction[:100]}...")
            logger.info(f"❓ User question: {question}")
            
            # Use the new ChatOpenAI method for better response generation
            if self.model_service.has_chat_openai():
                logger.info(f"✨ Using ChatOpenAI for response generation")
                response = await self.model_service.generate_rag_response(
                    user_message=question,
                    retrieved_context=full_context,
                    system_instruction=system_instruction
                )
            else:
                logger.info(f"🔄 ChatOpenAI not available, using fallback method")
                # Fallback to existing method
                if memory_context.strip() and context.strip():
                    # Use conversation prompt with system instruction, memory and document context
                    prompt = f"""{system_instruction} 
                    Available information: {context} 
                    Previous conversation: {memory_context}
                    Current question: {question}
                    Please provide a helpful and detailed response that takes into account the conversation history and available information."""
                elif memory_context.strip():
                    # Use conversation prompt with system instruction and memory only
                    prompt = f"""{system_instruction}
                    Previous conversation: {memory_context}
                    Current question: {question}
                    Please provide a helpful response that takes into account the conversation history."""
                elif context.strip():
                    # Use simple RAG prompt with system instruction
                    prompt = self.simple_rag_prompt_template.format(
                        system_instruction=system_instruction,
                        context=context,
                        question=question
                    )
                else:
                    # Use system instruction with fallback
                    prompt = f"{system_instruction}\n\nQuestion: {question}\nAnswer:"
                
                response = await self.model_service.generate_text(
                    prompt,
                    max_new_tokens=1024,  # Increased for more detailed responses
                    temperature=0.7,
                    top_p=0.9,
                    do_sample=True,
                    return_full_text=False
                )
            
            logger.info(f"✅ Response generated successfully: {len(response)} characters")
            logger.info(f"📝 Response preview: {response[:200]}...")
            return response.strip()
            
        except Exception as e:
            logger.error(f"Error generating LLM response with memory: {e}")
            # Return fallback response
            if context.strip() or memory_context.strip():
                return "I found some relevant information, but I'm having trouble processing it right now. Please try rephrasing your question or contact support for assistance."
            else:
                return "I don't have specific information about that topic in our documentation. Please contact our support team for more detailed assistance."

    def get_service_info(self) -> Dict[str, Any]:
        """Get information about the RAG service configuration and status."""
        return {
            'max_context_length': self.max_context_length,
            'similarity_threshold': self.similarity_threshold,
            'max_retrieved_docs': self.max_retrieved_docs,
            'model_service_ready': self.model_service.is_ready(),
            'chat_openai_available': self.model_service.has_chat_openai(),
            'vector_storage_ready': self.vector_storage_service.is_ready(),
            'conversation_service_ready': self.conversation_service.is_ready(),
            'langchain_available': LANGCHAIN_AVAILABLE,
            'service_ready': self.is_ready()
        }


# Global RAG service instance
rag_service: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    """Get the global RAG service instance."""
    global rag_service
    if rag_service is None:
        rag_service = RAGService()
    return rag_service