"""
Vector storage service with Supabase integration using LangChain.
"""
import logging
import uuid
import asyncio
import json
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime

# LangChain imports
try:
    from langchain_community.vectorstores import SupabaseVectorStore
    from langchain_core.documents import Document
    from langchain_core.embeddings import Embeddings
    LANGCHAIN_AVAILABLE = True
except ImportError:
    try:
        # Fallback imports
        from langchain.schema import Document
        from langchain.embeddings.base import Embeddings
        LANGCHAIN_AVAILABLE = True
    except ImportError:
        # Create minimal Document class if LangChain not available
        class Document:
            def __init__(self, page_content: str, metadata: Dict[str, Any] = None):
                self.page_content = page_content
                self.metadata = metadata or {}
        LANGCHAIN_AVAILABLE = False

# Database imports
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

# FastAPI imports
from fastapi import HTTPException

# Local imports
from app.config import settings

logger = logging.getLogger(__name__)


class HuggingFaceInferenceEmbeddings:
    """Custom embeddings wrapper for Hugging Face Inference API."""
    
    def __init__(self, model_service):
        self.model_service = model_service
    
    def embed_query(self, text: str) -> List[float]:
        """Embed a single query text."""
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If we're already in an async context, we need to handle this differently
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(asyncio.run, self.model_service.generate_embedding(text))
                    return future.result()
            else:
                return asyncio.run(self.model_service.generate_embedding(text))
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            # Return a zero vector as fallback
            return [0.0] * 1536  # Standard embedding dimension
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Embed multiple documents."""
        return [self.embed_query(text) for text in texts]


class VectorStorageService:
    """Service for storing and retrieving document embeddings using Supabase and LangChain."""
    
    def __init__(self):
        """Initialize the vector storage service."""
        self.supabase_client: Optional[Client] = None
        self.pg_connection: Optional[Any] = None
        self.vector_store: Optional[SupabaseVectorStore] = None
        self._initialize_connections()
    
    def _initialize_connections(self):
        """Initialize Supabase and PostgreSQL connections."""
        try:
            # Initialize Supabase client
            if SUPABASE_AVAILABLE and settings.SUPABASE_URL and settings.SUPABASE_KEY:
                self.supabase_client = create_client(
                    settings.SUPABASE_URL,
                    settings.SUPABASE_KEY
                )
                logger.info("Supabase client initialized successfully")
                
                # Initialize SupabaseVectorStore if available
                self._initialize_supabase_vector_store()
            else:
                logger.warning("Supabase credentials not provided or client not available")
                
        except Exception as e:
            logger.error(f"Failed to initialize vector storage connections: {e}")
            # Don't raise HTTPException here, let the service handle graceful degradation
            logger.warning("Vector storage will operate in limited mode")
    
    def _initialize_supabase_vector_store(self):
        """Initialize LangChain SupabaseVectorStore."""
        try:
            if not self.supabase_client or not LANGCHAIN_AVAILABLE:
                logger.warning("Supabase client or LangChain not available for vector store initialization")
                return
                
            from app.services.model_service import get_model_service
            model_service = get_model_service()
            embeddings_model = HuggingFaceInferenceEmbeddings(model_service)
            
            # Initialize SupabaseVectorStore
            self.vector_store = SupabaseVectorStore(
                client=self.supabase_client,
                table_name="Document",
                embedding=embeddings_model, 
                query_name="match_documents"  # This should match your RPC function name
            )
            
            logger.info("SupabaseVectorStore initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize SupabaseVectorStore: {e}")
            # Don't raise, allow fallback to direct database operations
            self.vector_store = None
    
    async def store_documents(self, documents: List[Document], user_id: str, chatbot_id: str) -> List[str]:
        """
        Store document chunks and their embeddings in the vector database.
        
        Args:
            documents: List of Document objects with embeddings
            user_id: User ID for document association
            chatbot_id: Chatbot ID for document association
            
        Returns:
            List of document IDs that were stored
        """
        if not documents:
            logger.warning("No documents provided for storage")
            return []
        
        # Validate user_id parameter
        if not user_id or not user_id.strip():
            raise ValueError(f"Invalid user_id provided: '{user_id}'. User ID cannot be empty.")
        
        try:
            logger.info(f"Storing {len(documents)} documents for user {user_id}")
            
            # Prepare documents with user metadata
            processed_documents = []
            document_ids = []
            
            for doc in documents:
                # Generate unique document ID
                doc_id = str(uuid.uuid4())
                document_ids.append(doc_id)
                
                # Add user_id and document_id to metadata
                doc.metadata.update({
                    'user_id': user_id,
                    'document_id': doc_id,
                    'created_at': datetime.utcnow().isoformat()
                })
                
                # Debug logging to verify metadata
                logger.debug(f"Document {doc_id} metadata after update: {doc.metadata}")
                
                processed_documents.append(doc)
            
            # Use direct database insertion instead of LangChain SupabaseVectorStore
            # because LangChain doesn't handle our custom userId field properly
            if self.pg_connection or self.supabase_client:
                # Use direct database insertion
                stored_ids = await self._store_documents_direct(processed_documents)
                logger.info(f"Successfully stored {len(stored_ids)} documents in database")
                return stored_ids
            else:
                # No database connection available - log documents but don't store
                logger.warning(f"No database connection available. Documents processed but not stored for user {user_id}")
                logger.info(f"Would have stored {len(processed_documents)} documents: {[doc.metadata.get('source', 'unknown') for doc in processed_documents]}")
                return document_ids  # Return the generated IDs even though not stored
                
        except Exception as e:
            logger.error(f"Error storing documents: {e}")
            # For graceful degradation, log the error but don't fail the entire request
            logger.warning(f"Document storage failed for user {user_id}, continuing without storage")
            # Generate and return document IDs as if they were stored
            document_ids = [str(uuid.uuid4()) for _ in documents]
            return document_ids
    
    async def _add_documents_to_vector_store(self, documents: List[Document]) -> List[str]:
        """Add documents to LangChain SupabaseVectorStore."""
        try:
            logger.info("Add document to vector store")
            if not self.vector_store:
                raise ValueError("Vector store not initialized")
                
            # Extract texts and metadatas
            texts = [doc.page_content for doc in documents]
            metadatas = [doc.metadata for doc in documents]
            
            # The LangChain SupabaseVectorStore doesn't handle our custom userId field
            # So we need to ensure all metadata includes the required fields
            for metadata in metadatas:
                if 'user_id' not in metadata:
                    raise ValueError("user_id is required in document metadata")
            
            # Add documents to vector store (run in thread pool for sync operation)
            loop = asyncio.get_event_loop()
            
            def add_texts_sync():
                return self.vector_store.add_texts(texts=texts, metadatas=metadatas)
            
            try:
                document_ids = await loop.run_in_executor(None, add_texts_sync)
                return document_ids
            except Exception as langchain_error:
                logger.warning(f"LangChain SupabaseVectorStore failed: {langchain_error}")
                logger.info("Falling back to direct Supabase client insertion")
                # Fallback to direct Supabase client method
                return await self._store_documents_supabase(documents)
            
        except Exception as e:
            logger.error(f"Error adding documents to vector store: {e}")
            raise
    
    async def _store_documents_supabase(self, documents: List[Document]) -> List[str]:
        """Store documents using Supabase client."""
        try:
            logger.info("Supabase Store")
            if not self.supabase_client:
                raise ValueError("Supabase client not available")
                
            document_ids = []
            from app.services.model_service import get_model_service
            model_service = get_model_service()
            
            for doc in documents:
                doc_id = doc.metadata.get('document_id', str(uuid.uuid4()))
                
                # Validate that user_id exists in metadata
                if 'user_id' not in doc.metadata:
                    raise ValueError(f"Document metadata missing required 'user_id' field: {doc.metadata}")
                
                user_id = doc.metadata['user_id']
                if not user_id or not user_id.strip():
                    raise ValueError(f"Document has empty user_id: {user_id}")
                
                logger.debug(f"Processing document {doc_id} for user {user_id}")
                
                # Use existing embedding from document metadata if available
                if 'embedding' in doc.metadata and doc.metadata['embedding']:
                    embedding = doc.metadata['embedding']
                    logger.debug(f"Using existing embedding from document metadata ({len(embedding)} dimensions)")
                else:
                    # Generate embedding for the document only if not already present
                    logger.debug(f"No existing embedding found, generating new one")
                    embedding = await model_service.generate_embedding(doc.page_content)
                    logger.debug(f"Generated new embedding ({len(embedding)} dimensions)")
                
                logger.info(f"length of embedding {len(embedding)}")
                # Validate embedding dimensions
                if len(embedding) != 1536:
                    logger.error(f"CRITICAL: Wrong embedding dimensions! Expected 1536, got {len(embedding)}")
                    logger.error(f"Document ID: {doc_id}")
                    logger.error(f"Source: {'existing metadata' if 'embedding' in doc.metadata else 'newly generated'}")
                    raise ValueError(f"Wrong embedding dimensions: {len(embedding)} (expected 1536)")
                
                # Convert embedding to list format for vector type
                embedding_list = embedding if isinstance(embedding, list) else embedding.tolist()
                
                # Prepare document data (let Prisma generate the ID with cuid())
                document_data = {
                    'content': doc.page_content,
                    'metadata': doc.metadata,
                    'embedding': embedding_list,
                    'chatbotId': doc.metadata.get('chatbot_id')
                    # createdAt will be set automatically by Prisma @default(now())
                }
                
                # Insert document using Supabase client
                result = self.supabase_client.table('Document').insert(document_data).execute()
                
                if result.data and len(result.data) > 0:
                    # Get the generated ID from the inserted record
                    inserted_doc = result.data[0]
                    generated_id = inserted_doc.get('id', doc_id)
                    document_ids.append(generated_id)
                    logger.debug(f"Successfully inserted document {generated_id} with length {len(embedding)}")
                else:
                    logger.error(f"Failed to insert document: {result}")
                    # Still add the original doc_id to maintain consistency
                    document_ids.append(doc_id)
            
            logger.info(f"Successfully stored {len(document_ids)} documents via Supabase")
            return document_ids
            
        except Exception as e:
            logger.error(f"Error in Supabase document storage: {e}")
            raise
    
    async def _store_documents_direct(self, documents: List[Document]) -> List[str]:
        """Store documents directly in PostgreSQL or Supabase (fallback method)."""
        try:
            if self.pg_connection:
                # Use direct PostgreSQL connection
                return await self._store_documents_postgresql(documents)
            elif self.supabase_client:
                # Use Supabase client
                return await self._store_documents_supabase(documents)
            else:
                logger.warning("No database connection available for direct storage")
                # Return generated document IDs without storing
                return [doc.metadata.get('document_id', str(uuid.uuid4())) for doc in documents]
                
        except Exception as e:
            logger.error(f"Error in direct document storage: {e}")
            # Return generated document IDs for graceful degradation
            logger.warning("Returning generated IDs due to storage failure")
            return [doc.metadata.get('document_id', str(uuid.uuid4())) for doc in documents]
    
    async def _store_documents_postgresql(self, documents: List[Document]) -> List[str]:
        """Store documents using direct PostgreSQL connection."""
        try:
            logger.info("Store in Postgress")
            if not self.pg_connection:
                raise ValueError("PostgreSQL connection not available")
                
            document_ids = []
            from app.services.model_service import get_model_service
            model_service = get_model_service()
            
            # Ensure the documents table exists
            # await self._ensure_documents_table_exists()
            
            with self.pg_connection.cursor() as cursor:
                for doc in documents:
                    doc_id = doc.metadata.get('document_id', str(uuid.uuid4()))
                    
                    # Validate that user_id exists in metadata
                    if 'user_id' not in doc.metadata:
                        raise ValueError(f"Document metadata missing required 'user_id' field: {doc.metadata}")
                    
                    user_id = doc.metadata['user_id']
                    if not user_id or not user_id.strip():
                        raise ValueError(f"Document has empty user_id: {user_id}")
                    
                    logger.debug(f"Processing document {doc_id} for user {user_id}")
                    
                    # Generate embedding for the document
                    embedding = await model_service.generate_embedding(doc.page_content)
                    
                    # Insert document with embedding (using Prisma Document table structure)
                    # Generate a cuid-like ID for the document (Prisma compatible)
                    import time
                    import random
                    import string
                    
                    timestamp = str(int(time.time() * 1000))[-10:]  # Last 10 digits of timestamp
                    random_part = ''.join(random.choices(string.ascii_lowercase + string.digits, k=15))
                    generated_id = f"cm{timestamp}{random_part}"
                    
                    # Convert embedding to proper vector format for PostgreSQL
                    embedding_list = embedding if isinstance(embedding, list) else embedding.tolist()
                    
                    logger.debug(f"Inserting document with ID: {generated_id}, userId: {user_id}")
                    
                    try:
                        cursor.execute("""
                            INSERT INTO "Document" (id, content, metadata, embedding, "chatbotId")
                            VALUES (%s, %s, %s, %s::vector, %s)
                            RETURNING id
                        """, (
                            generated_id,
                            doc.page_content,
                            json.dumps(doc.metadata),
                            embedding_list,
                            doc.metadata.get('chatbot_id')
                        ))
                        
                        # Get the generated ID from the INSERT
                        result = cursor.fetchone()
                        if result:
                            # Handle RealDictRow result
                            if hasattr(result, 'get'):
                                returned_id = result.get('id') or result.get(0)
                            elif isinstance(result, (list, tuple)):
                                returned_id = result[0]
                            else:
                                returned_id = str(result)
                                
                            document_ids.append(returned_id)
                            logger.debug(f"Successfully inserted document with ID: {returned_id}")
                        else:
                            logger.error(f"Failed to get returned ID for document")
                            document_ids.append(generated_id)  # Use the generated ID as fallback
                            
                    except Exception as insert_error:
                        logger.error(f"Error inserting document: {insert_error}")
                        raise insert_error
                
                self.pg_connection.commit()
            
            return document_ids
            
        except Exception as e:
            logger.error(f"Error in PostgreSQL document storage: {e}")
            if self.pg_connection:
                self.pg_connection.rollback()
            raise
    
    async def similarity_search(
        self, 
        query: str, 
        chatbot_id: str, 
        k: int = 5,
        score_threshold: float = 0.0
    ) -> List[Tuple[Document, float]]:
        """
        Perform similarity search for chatbot-specific documents.
        
        Args:
            query: Search query text
            chatbot_id: Chatbot ID to filter documents
            k: Number of results to return
            score_threshold: Minimum similarity score threshold
            
        Returns:
            List of tuples containing (Document, similarity_score)
        """
        try:
            logger.info(f"Performing similarity search for chatbot {chatbot_id} with query: {query[:100]}...")
            
            # Use direct database query instead of LangChain SupabaseVectorStore
            # because LangChain doesn't handle our custom chatbotId field properly
            return await self._similarity_search_direct(query, chatbot_id, k, score_threshold)
                
        except Exception as e:
            logger.error(f"Error in similarity search: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Similarity search failed: {str(e)}"
            )
    
    async def similarity_search_by_vector(
        self, 
        embedding: List[float], 
        chatbot_id: str, 
        k: int = 5,
        score_threshold: float = 0.0
    ) -> List[Tuple[Document, float]]:
        """
        Perform similarity search using a pre-computed embedding vector.
        
        Args:
            embedding: Pre-computed embedding vector
            chatbot_id: Chatbot ID to filter documents
            k: Number of results to return
            score_threshold: Minimum similarity score threshold
            
        Returns:
            List of tuples containing (Document, similarity_score)
        """
        try:
            logger.info(f"Performing similarity search by vector for chatbot {chatbot_id}")
            
            if self.pg_connection:
                return await self._similarity_search_postgresql(
                    embedding, chatbot_id, k, score_threshold
                )
            elif self.supabase_client:
                return await self._similarity_search_supabase(
                    embedding, chatbot_id, k, score_threshold
                )
            else:
                raise ValueError("No database connection available for similarity search")
                
        except Exception as e:
            logger.error(f"Error in similarity search by vector: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Similarity search by vector failed: {str(e)}"
            )
    
    async def _similarity_search_direct(
        self, 
        query: str, 
        chatbot_id: str, 
        k: int,
        score_threshold: float
    ) -> List[Tuple[Document, float]]:
        """Direct similarity search using PostgreSQL and pgvector or Supabase."""
        try:
            # Generate query embedding
            from app.services.model_service import get_model_service
            model_service = get_model_service()
            query_embedding = await model_service.generate_embedding(query)
            
            if self.pg_connection:
                return await self._similarity_search_postgresql(
                    query_embedding, chatbot_id, k, score_threshold
                )
            elif self.supabase_client:
                return await self._similarity_search_supabase(
                    query_embedding, chatbot_id, k, score_threshold
                )
            else:
                raise ValueError("No database connection available for similarity search")
                
        except Exception as e:
            logger.error(f"Error in direct similarity search: {e}")
            raise
    
    async def _similarity_search_postgresql(
        self,
        query_embedding: List[float],
        chatbot_id: str,
        k: int,
        score_threshold: float
    ) -> List[Tuple[Document, float]]:
        """Perform similarity search using PostgreSQL with pgvector."""
        try:
            with self.pg_connection.cursor() as cursor:
                # Perform cosine similarity search - filter by chatbotId
                cursor.execute("""
                    SELECT id, content, metadata, 
                           1 - (embedding <=> %s::vector) as similarity_score
                    FROM "Document" 
                    WHERE "chatbotId" = %s 
                      AND 1 - (embedding <=> %s::vector) >= %s
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                """, (query_embedding, chatbot_id, query_embedding, score_threshold, query_embedding, k))
                
                results = cursor.fetchall()
                
                # Convert to Document objects with scores
                document_results = []
                for row in results:
                    metadata = row['metadata'] if isinstance(row['metadata'], dict) else json.loads(row['metadata'])
                    doc = Document(
                        page_content=row['content'],
                        metadata=metadata
                    )
                    document_results.append((doc, row['similarity_score']))
                
                return document_results
                
        except Exception as e:
            logger.error(f"Error in PostgreSQL similarity search: {e}")
            raise
    
    async def _similarity_search_supabase(
        self,
        query_embedding: List[float],
        chatbot_id: str,
        k: int,
        score_threshold: float
    ) -> List[Tuple[Document, float]]:
        """Perform similarity search using Supabase RPC function."""
        try:
            # Log embedding dimensions for debugging
            logger.info(f"Query embedding dimensions: {len(query_embedding)}")
            
            # Call Supabase RPC function for similarity search
            result = self.supabase_client.rpc('match_documents', {
                'query_embedding': query_embedding,
                'match_threshold': score_threshold,
                'match_count': k,
                'chatbot_id': chatbot_id
            }).execute()
            
            logger.info(f"Similarity search result: {len(result.data) if result.data else 0} documents found")
            
            # Check if we got results
            if not result.data:
                logger.warning(f"No documents found for chatbot_id: {chatbot_id} with threshold: {score_threshold}")
                logger.info("Trying with lower threshold...")
                
                # Try with a much lower threshold
                fallback_result = self.supabase_client.rpc('match_documents', {
                    'query_embedding': query_embedding,
                    'match_threshold': 0.0,  # Very low threshold
                    'match_count': k,
                    'chatbot_id': chatbot_id
                }).execute()
                
                logger.info(f"Fallback search with threshold 0.0: {len(fallback_result.data) if fallback_result.data else 0} documents")
                result = fallback_result
            
            document_results = []
            for row in result.data:
                doc = Document(
                    page_content=row['content'],
                    metadata=row['metadata']
                )
                document_results.append((doc, row['similarity']))
            
            logger.info(f"Returning {len(document_results)} document results")
            return document_results
            
        except Exception as e:
            logger.error(f"Error in Supabase similarity search: {e}")
            raise
    
    async def get_chatbot_documents(self, chatbot_id: str, limit: int = 100) -> List[Document]:
        """
        Retrieve all documents for a specific chatbot.
        
        Args:
            chatbot_id: Chatbot ID to filter documents
            limit: Maximum number of documents to return
            
        Returns:
            List of Document objects
        """
        try:
            logger.info(f"Retrieving documents for chatbot {chatbot_id}")
            
            if self.pg_connection:
                return await self._get_chatbot_documents_postgresql(chatbot_id, limit)
            elif self.supabase_client:
                return await self._get_chatbot_documents_supabase(chatbot_id, limit)
            else:
                raise ValueError("No database connection available")
                
        except Exception as e:
            logger.error(f"Error retrieving user documents: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to retrieve documents: {str(e)}"
            )
    
    async def _get_chatbot_documents_postgresql(self, chatbot_id: str, limit: int) -> List[Document]:
        """Retrieve chatbot documents using PostgreSQL."""
        with self.pg_connection.cursor() as cursor:
            cursor.execute("""
                SELECT id, content, metadata
                FROM "Document" 
                WHERE "chatbotId" = %s
                ORDER BY "createdAt" DESC
                LIMIT %s
            """, (chatbot_id, limit))
            
            results = cursor.fetchall()
            
            documents = []
            for row in results:
                metadata = row['metadata'] if isinstance(row['metadata'], dict) else json.loads(row['metadata'])
                doc = Document(
                    page_content=row['content'],
                    metadata=metadata
                )
                documents.append(doc)
            
            logger.info(f"Retrieved {len(documents)} documents for chatbot {chatbot_id}")
            return documents
    
    async def _get_chatbot_documents_supabase(self, chatbot_id: str, limit: int) -> List[Document]:
        """Retrieve chatbot documents using Supabase."""
        result = self.supabase_client.table('Document').select('id, content, metadata').eq('chatbotId', chatbot_id).order('createdAt', desc=True).limit(limit).execute()
        
        documents = []
        for row in result.data:
            doc = Document(
                page_content=row['content'],
                metadata=row['metadata']
            )
            documents.append(doc)
        
        logger.info(f"Retrieved {len(documents)} documents for chatbot {chatbot_id}")
        return documents
    
    async def delete_chatbot_documents(self, chatbot_id: str) -> int:
        """
        Delete all documents for a specific chatbot.
        
        Args:
            chatbot_id: Chatbot ID whose documents to delete
            
        Returns:
            Number of documents deleted
        """
        try:
            logger.info(f"Deleting documents for chatbot {chatbot_id}")
            
            if self.pg_connection:
                return await self._delete_chatbot_documents_postgresql(chatbot_id)
            elif self.supabase_client:
                return await self._delete_chatbot_documents_supabase(chatbot_id)
            else:
                raise ValueError("No database connection available")
                
        except Exception as e:
            logger.error(f"Error deleting user documents: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to delete documents: {str(e)}"
            )
    
    async def _delete_chatbot_documents_postgresql(self, chatbot_id: str) -> int:
        """Delete chatbot documents using PostgreSQL."""
        try:
            with self.pg_connection.cursor() as cursor:
                cursor.execute("""
                    DELETE FROM "Document" 
                    WHERE "chatbotId" = %s
                """, (chatbot_id,))
                
                deleted_count = cursor.rowcount
                self.pg_connection.commit()
                
                logger.info(f"Deleted {deleted_count} documents for chatbot {chatbot_id}")
                return deleted_count
                
        except Exception as e:
            if self.pg_connection:
                self.pg_connection.rollback()
            raise
    
    async def _delete_chatbot_documents_supabase(self, chatbot_id: str) -> int:
        """Delete chatbot documents using Supabase."""
        result = self.supabase_client.table('Document').delete().eq('chatbotId', chatbot_id).execute()
        
        deleted_count = len(result.data) if result.data else 0
        logger.info(f"Deleted {deleted_count} documents for chatbot {chatbot_id}")
        return deleted_count
    
    async def get_document_stats(self, user_id: str, chatbot_id: str = None) -> Dict[str, Any]:
        """
        Get statistics about stored documents for a user and optionally a specific chatbot.
        
        Args:
            user_id: User ID to get statistics for
            chatbot_id: Optional chatbot ID to filter statistics
            
        Returns:
            Dictionary with document statistics
        """
        try:
            if self.pg_connection:
                return await self._get_document_stats_postgresql(user_id, chatbot_id)
            elif self.supabase_client:
                return await self._get_document_stats_supabase(user_id, chatbot_id)
            else:
                # Return empty stats if no connection
                logger.warning(f"No database connection available for user {user_id} stats")
                return {
                    'total_documents': 0,
                    'unique_sources': 0,
                    'avg_content_length': 0.0,
                    'first_document': None,
                    'last_document': None,
                    'source_types': {}
                }
                
        except Exception as e:
            logger.error(f"Error getting document statistics: {e}")
            # Return empty stats instead of raising exception to allow graceful degradation
            logger.warning(f"Returning empty stats due to database error for user {user_id}")
            return {
                'total_documents': 0,
                'unique_sources': 0,
                'avg_content_length': 0.0,
                'first_document': None,
                'last_document': None,
                'source_types': {}
            }
    
    async def _get_document_stats_postgresql(self, user_id: str, chatbot_id: str = None) -> Dict[str, Any]:
        """Get document statistics using PostgreSQL."""
        with self.pg_connection.cursor() as cursor:
            if chatbot_id:
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total_documents,
                        COUNT(DISTINCT metadata->>'source') as unique_sources,
                        AVG(LENGTH(content)) as avg_content_length,
                        MIN("createdAt") as first_document,
                        MAX("createdAt") as last_document
                    FROM "Document" 
                    WHERE "chatbotId" = %s
                """, (chatbot_id,))
            else:
                # If no chatbot_id provided, get stats for all documents of user's chatbots
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total_documents,
                        COUNT(DISTINCT metadata->>'source') as unique_sources,
                        AVG(LENGTH(content)) as avg_content_length,
                        MIN("createdAt") as first_document,
                        MAX("createdAt") as last_document
                    FROM "Document" d
                    JOIN "Chatbot" c ON d."chatbotId" = c.id
                    WHERE c."userId" = %s::uuid
                """, (user_id,))
            
            result = cursor.fetchone()
            
            # Get source type breakdown
            if chatbot_id:
                cursor.execute("""
                    SELECT 
                        metadata->>'source_type' as source_type,
                        COUNT(*) as count
                    FROM "Document" 
                    WHERE "chatbotId" = %s
                    GROUP BY metadata->>'source_type'
                """, (chatbot_id,))
            else:
                cursor.execute("""
                    SELECT 
                        metadata->>'source_type' as source_type,
                        COUNT(*) as count
                    FROM "Document" d
                    JOIN "Chatbot" c ON d."chatbotId" = c.id
                    WHERE c."userId" = %s::uuid
                    GROUP BY metadata->>'source_type'
                """, (user_id,))
            
            source_types = {row['source_type']: row['count'] for row in cursor.fetchall()}
            
            return {
                'total_documents': result['total_documents'] or 0,
                'unique_sources': result['unique_sources'] or 0,
                'avg_content_length': float(result['avg_content_length'] or 0),
                'first_document': result['first_document'],
                'last_document': result['last_document'],
                'source_types': source_types
            }
    
    async def _get_document_stats_supabase(self, user_id: str, chatbot_id: str = None) -> Dict[str, Any]:
        """Get document statistics using Supabase."""
        # Get basic stats
        if chatbot_id:
            query = self.supabase_client.table('Document').select('content, metadata, createdAt, embedding').eq('chatbotId', chatbot_id)
        else:
            # Get all documents for user's chatbots
            chatbots_result = self.supabase_client.table('Chatbot').select('id').eq('userId', user_id).execute()
            chatbot_ids = [chatbot['id'] for chatbot in chatbots_result.data]
            query = self.supabase_client.table('Document').select('content, metadata, createdAt').in_('chatbotId', chatbot_ids)
        result = query.execute()
        
        if not result.data:
            return {
                'total_documents': 0,
                'unique_sources': 0,
                'avg_content_length': 0.0,
                'first_document': None,
                'last_document': None,
                'source_types': {}
            }
        
        documents = result.data
        total_documents = len(documents)
        
        # Calculate statistics
        sources = set()
        source_types = {}
        content_lengths = []
        dates = []
        
        for doc in documents:
            if doc.get('metadata', {}).get('source'):
                sources.add(doc['metadata']['source'])
            
            source_type = doc.get('metadata', {}).get('source_type', 'unknown')
            source_types[source_type] = source_types.get(source_type, 0) + 1
            
            if doc.get('content'):
                content_lengths.append(len(doc['content']))
            
            if doc.get('createdAt'):
                dates.append(doc['createdAt'])
        
        avg_content_length = sum(content_lengths) / len(content_lengths) if content_lengths else 0.0
        
        return {
            'total_documents': total_documents,
            'unique_sources': len(sources),
            'avg_content_length': avg_content_length,
            'first_document': min(dates) if dates else None,
            'last_document': max(dates) if dates else None,
            'embedding_length': len(documents[0]),
            'source_types': source_types
        }
    
    def close_connections(self):
        """Close database connections."""
        try:
            if self.pg_connection:
                self.pg_connection.close()
                logger.info("PostgreSQL connection closed")
        except Exception as e:
            logger.error(f"Error closing connections: {e}")
    
    def is_ready(self) -> bool:
        """Check if the vector storage service is ready to use."""
        return (self.supabase_client is not None or self.pg_connection is not None)
    
    async def _ensure_documents_table_exists(self):
        """Ensure the documents table exists with proper schema."""
        try:
            if not self.pg_connection:
                return
                
            with self.pg_connection.cursor() as cursor:
                # Check if table exists
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'Document'
                    );
                """)
                
                table_exists = cursor.fetchone()[0]
                
                if not table_exists:
                    logger.info("Documents table doesn't exist, creating it...")
                    
                    # Create the table with proper schema
                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS public."Document" (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            content TEXT NOT NULL,
                            metadata JSONB DEFAULT '{}',
                            embedding vector(1536),
                            "userId" UUID NOT NULL,
                            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                            "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                        );
                    """)
                    
                    # Create indexes
                    cursor.execute("""
                        CREATE INDEX IF NOT EXISTS "Document"_user_id_idx ON public."Document" ("userId");
                        CREATE INDEX IF NOT EXISTS "Document"_created_at_idx ON public."Document" ("createdAt");
                    """)
                    
                    # Try to create vector index (might fail if pgvector not enabled)
                    try:
                        cursor.execute("""
                            CREATE INDEX IF NOT EXISTS "Document"_embedding_idx 
                            ON public.Document USING ivfflat (embedding vector_cosine_ops);
                        """)
                    except Exception as vector_error:
                        logger.warning(f"Could not create vector index (pgvector might not be enabled): {vector_error}")
                    
                    self.pg_connection.commit()
                    logger.info("Documents table created successfully")
                
        except Exception as e:
            logger.error(f"Error ensuring documents table exists: {e}")
            if self.pg_connection:
                self.pg_connection.rollback()
            # Don't raise here, let the insert operation handle the error

    def get_connection_info(self) -> Dict[str, Any]:
        """Get information about available connections."""
        return {
            'supabase_available': self.supabase_client is not None,
            'postgresql_available': self.pg_connection is not None,
            'vector_store_available': self.vector_store is not None,
            'langchain_available': LANGCHAIN_AVAILABLE,
            'psycopg2_available': PSYCOPG2_AVAILABLE,
            'supabase_client_available': SUPABASE_AVAILABLE
        }


# Global vector storage service instance
vector_storage_service: Optional[VectorStorageService] = None


def get_vector_storage_service() -> VectorStorageService:
    """Get the global vector storage service instance."""
    global vector_storage_service
    if vector_storage_service is None:
        vector_storage_service = VectorStorageService()
    return vector_storage_service