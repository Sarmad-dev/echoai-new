"""
Document ingestion service with LangChain loaders for URL, PDF, and DOCX processing.
"""
import logging
import tempfile
import os
import time
from typing import List, Optional, Dict, Any, Union
from io import BytesIO
from contextlib import contextmanager

# LangChain imports for document loading and processing
try:
    from langchain_community.document_loaders import WebBaseLoader, PyPDFLoader, Docx2txtLoader
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    from langchain_core.documents import Document
except ImportError:
    # Fallback imports for older LangChain versions
    from langchain.document_loaders import WebBaseLoader, PyPDFLoader, Docx2txtLoader
    from langchain.text_splitter import RecursiveCharacterTextSplitter
    from langchain.schema import Document

# FastAPI imports
from fastapi import UploadFile, HTTPException

# Local imports
from app.config import settings
from app.services.model_service import get_model_service
from app.services.vector_storage_service import get_vector_storage_service

logger = logging.getLogger(__name__)


class DocumentIngestionService:
    """Service for ingesting and processing documents using LangChain loaders."""
    
    def __init__(self):
        """Initialize the document ingestion service."""
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            length_function=len,
            separators=["\n\n", "\n", " ", ""]
        )
        logger.info(f"Initialized DocumentIngestionService with chunk_size={settings.CHUNK_SIZE}, chunk_overlap={settings.CHUNK_OVERLAP}")
    
    @contextmanager
    def _safe_temp_file(self, suffix: str):
        """Context manager for safe temporary file handling on Windows."""
        temp_file_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
                temp_file_path = temp_file.name
                yield temp_file
        finally:
            # Clean up temporary file with retry logic for Windows
            if temp_file_path and os.path.exists(temp_file_path):
                max_retries = 3
                for attempt in range(max_retries):
                    try:
                        os.unlink(temp_file_path)
                        break
                    except OSError as e:
                        if attempt < max_retries - 1:
                            logger.warning(f"Attempt {attempt + 1} to delete temp file {temp_file_path} failed: {e}")
                            time.sleep(0.1 * (attempt + 1))  # Increasing delay
                        else:
                            logger.warning(f"Failed to delete temp file {temp_file_path} after {max_retries} attempts: {e}")
    
    async def process_urls(self, urls: List[str], user_id: str, chatbot_id: str) -> List[Document]:
        """
        Process a list of URLs using WebBaseLoader.
        
        Args:
            urls: List of URLs to process
            user_id: User ID for document association
            chatbot_id: Chatbot ID for document association
            
        Returns:
            List of processed Document objects with embeddings
        """
        all_documents = []
        
        for url in urls:
            try:
                logger.info(f"Processing URL: {url}")
                
                # Use WebBaseLoader to extract content from URL
                loader = WebBaseLoader(web_paths=[url])
                documents = loader.load()
                
                if not documents:
                    logger.warning(f"No content extracted from URL: {url}")
                    continue
                
                # Add metadata
                for doc in documents:
                    doc.metadata.update({
                        'source': url,
                        'source_type': 'url',
                        'user_id': user_id,
                        'chatbot_id': chatbot_id
                    })
                
                # Split documents into chunks
                chunks = self.text_splitter.split_documents(documents)
                logger.info(f"Split URL {url} into {len(chunks)} chunks")
                
                all_documents.extend(chunks)
                
            except Exception as e:
                logger.error(f"Error processing URL {url}: {e}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to process URL {url}: {str(e)}"
                )
        
        # Generate embeddings and store in vector database
        if all_documents:
            try:
                all_documents = await self._generate_embeddings(all_documents)
                await self._store_documents(all_documents, user_id, chatbot_id)
            except Exception as e:
                logger.error(f"Failed to generate embeddings or store documents: {e}")
                # Continue without embeddings for now
                logger.warning("Continuing without embeddings - documents processed but not stored in vector DB")
        
        return all_documents
    
    async def process_pdf_files(self, files: List[UploadFile], user_id: str, chatbot_id: str) -> List[Document]:
        """
        Process PDF files using PyPDFLoader.
        
        Args:
            files: List of PDF files to process
            user_id: User ID for document association
            chatbot_id: Chatbot ID for document association
            
        Returns:
            List of processed Document objects with embeddings
        """
        all_documents = []
        
        for file in files:
            filename = getattr(file, 'filename', None)
            if not filename or not filename.lower().endswith('.pdf'):
                logger.warning(f"Skipping non-PDF file: {filename}")
                continue
            
            try:
                logger.info(f"Processing PDF file: {filename}")
                
                # Create temporary file for PDF processing using safe context manager
                with self._safe_temp_file('.pdf') as temp_file:
                    # Read file content and write to temporary file
                    content = await file.read()
                    temp_file.write(content)
                    temp_file.flush()
                    
                    # Use PyPDFLoader to extract text from PDF
                    try:
                        loader = PyPDFLoader(temp_file.name)
                        documents = loader.load()
                        logger.info(f"PyPDFLoader successfully loaded {len(documents)} pages")
                    except Exception as pdf_error:
                        logger.warning(f"PyPDFLoader failed for {filename}: {pdf_error}")
                        # Try alternative PDF processing with pdfminer
                        try:
                            from langchain_community.document_loaders import PDFMinerLoader
                            logger.info(f"Trying PDFMinerLoader as fallback for {filename}")
                            loader = PDFMinerLoader(temp_file.name)
                            documents = loader.load()
                            logger.info(f"PDFMinerLoader successfully loaded {len(documents)} pages")
                        except Exception as miner_error:
                            logger.error(f"Both PyPDFLoader and PDFMinerLoader failed for {filename}")
                            logger.error(f"PyPDFLoader error: {pdf_error}")
                            logger.error(f"PDFMinerLoader error: {miner_error}")
                            raise HTTPException(
                                status_code=400,
                                detail=f"Failed to process PDF {filename}: Unable to extract text content"
                            )
                
                if not documents:
                    logger.warning(f"No content extracted from PDF: {filename}")
                    continue
                
                # Debug: Log extracted content
                logger.info(f"Extracted {len(documents)} pages from PDF: {filename}")
                total_content_length = sum(len(doc.page_content) for doc in documents)
                logger.info(f"Total content length: {total_content_length} characters")
                
                # Log first few characters of each page for debugging
                for i, doc in enumerate(documents[:3]):  # Only log first 3 pages
                    content_preview = doc.page_content[:200].replace('\n', ' ').strip()
                    logger.debug(f"Page {i+1} preview: {content_preview}...")
                
                # Add metadata
                for doc in documents:
                    doc.metadata.update({
                        'source': filename,
                        'source_type': 'pdf',
                        'user_id': user_id,
                        'chatbot_id': chatbot_id
                    })
                
                # Split documents into chunks
                chunks = self.text_splitter.split_documents(documents)
                logger.info(f"Split PDF {filename} into {len(chunks)} chunks")
                
                # Debug: If no chunks were created, investigate why
                if not chunks and documents:
                    logger.warning(f"No chunks created from PDF {filename} despite having {len(documents)} pages")
                    for i, doc in enumerate(documents):
                        content_length = len(doc.page_content)
                        stripped_length = len(doc.page_content.strip())
                        logger.debug(f"Page {i+1} content length: {content_length}, stripped: {stripped_length}")
                        
                        if stripped_length == 0:
                            logger.warning(f"Page {i+1} appears to be empty")
                        elif stripped_length < 10:
                            logger.warning(f"Page {i+1} has very little content: '{doc.page_content.strip()}'")
                        else:
                            # Try manual chunking as fallback with different settings
                            logger.info(f"Attempting manual chunking for page {i+1}")
                            
                            # Try with smaller chunk size for problematic content
                            fallback_splitter = RecursiveCharacterTextSplitter(
                                chunk_size=500,  # Smaller chunks
                                chunk_overlap=50,
                                length_function=len,
                                separators=["\n\n", "\n", ". ", " ", ""]
                            )
                            
                            manual_chunks = fallback_splitter.split_text(doc.page_content)
                            logger.info(f"Manual chunking produced {len(manual_chunks)} chunks")
                            
                            if manual_chunks:
                                # Create Document objects from manual chunks
                                for j, chunk_text in enumerate(manual_chunks):
                                    if chunk_text.strip():  # Only add non-empty chunks
                                        chunk_doc = Document(
                                            page_content=chunk_text.strip(),
                                            metadata=doc.metadata.copy()
                                        )
                                        chunks.append(chunk_doc)
                                        logger.debug(f"Added manual chunk {j+1} with {len(chunk_text)} characters")
                            else:
                                # Last resort: treat the entire page as one chunk if it's not too large
                                if content_length < 10000:  # Less than 10k characters
                                    logger.info(f"Using entire page {i+1} as single chunk")
                                    chunk_doc = Document(
                                        page_content=doc.page_content.strip(),
                                        metadata=doc.metadata.copy()
                                    )
                                    chunks.append(chunk_doc)
                
                all_documents.extend(chunks)
                
            except Exception as e:
                logger.error(f"Error processing PDF {filename}: {e}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to process PDF {filename}: {str(e)}"
                )
        
        # Generate embeddings and store in vector database
        if all_documents:
            try:
                all_documents = await self._generate_embeddings(all_documents)
                await self._store_documents(all_documents, user_id, chatbot_id)
            except Exception as e:
                logger.error(f"Failed to generate embeddings or store documents: {e}")
                # Continue without embeddings for now
                logger.warning("Continuing without embeddings - documents processed but not stored in vector DB")
        
        return all_documents
    
    async def process_docx_files(self, files: List[UploadFile], user_id: str, chatbot_id: str) -> List[Document]:
        """
        Process DOCX files using Docx2txtLoader.
        
        Args:
            files: List of DOCX files to process
            user_id: User ID for document association
            chatbot_id: Chatbot ID for document association
            
        Returns:
            List of processed Document objects with embeddings
        """
        all_documents = []
        
        for file in files:
            filename = getattr(file, 'filename', None)
            if not filename or not filename.lower().endswith('.docx'):
                logger.warning(f"Skipping non-DOCX file: {filename}")
                continue
            
            try:
                logger.info(f"Processing DOCX file: {filename}")
                
                # Create temporary file for DOCX processing using safe context manager
                with self._safe_temp_file('.docx') as temp_file:
                    # Read file content and write to temporary file
                    content = await file.read()
                    temp_file.write(content)
                    temp_file.flush()
                    
                    # Use Docx2txtLoader to extract text from DOCX
                    loader = Docx2txtLoader(temp_file.name)
                    documents = loader.load()
                
                if not documents:
                    logger.warning(f"No content extracted from DOCX: {filename}")
                    continue
                
                # Add metadata
                for doc in documents:
                    doc.metadata.update({
                        'source': filename,
                        'source_type': 'docx',
                        'user_id': user_id,
                        'chatbot_id': chatbot_id
                    })
                
                # Split documents into chunks
                chunks = self.text_splitter.split_documents(documents)
                logger.info(f"Split DOCX {filename} into {len(chunks)} chunks")
                
                all_documents.extend(chunks)
                
            except Exception as e:
                logger.error(f"Error processing DOCX {filename}: {e}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to process DOCX {filename}: {str(e)}"
                )
        
        # Generate embeddings and store in vector database
        if all_documents:
            try:
                all_documents = await self._generate_embeddings(all_documents)
                await self._store_documents(all_documents, user_id, chatbot_id)
            except Exception as e:
                logger.error(f"Failed to generate embeddings or store documents: {e}")
                # Continue without embeddings for now
                logger.warning("Continuing without embeddings - documents processed but not stored in vector DB")
        
        return all_documents
    
    async def process_mixed_sources(
        self, 
        user_id: str,
        chatbot_id: str,
        urls: Optional[List[str]] = None, 
        files: Optional[List[UploadFile]] = None,
        instructions: Optional[str] = None
    ) -> List[Document]:
        """
        Process mixed sources (URLs and files) in a single call.
        
        Args:
            user_id: User ID for document association
            chatbot_id: Chatbot ID for document association
            urls: Optional list of URLs to process
            files: Optional list of files to process
            instructions: Optional training instructions to process
            
        Returns:
            List of all processed Document objects with embeddings
        """
        all_documents = []
        
        # Process URLs if provided
        if urls:
            url_documents = await self.process_urls(urls, user_id, chatbot_id)
            all_documents.extend(url_documents)
        
        # Process files if provided
        if files:
            # Separate PDF and DOCX files
            pdf_files = [f for f in files if f.filename and f.filename.lower().endswith('.pdf')]
            docx_files = [f for f in files if f.filename and f.filename.lower().endswith('.docx')]
            
            # Process PDF files
            if pdf_files:
                pdf_documents = await self.process_pdf_files(pdf_files, user_id, chatbot_id)
                all_documents.extend(pdf_documents)
            
            # Process DOCX files
            if docx_files:
                docx_documents = await self.process_docx_files(docx_files, user_id, chatbot_id)
                all_documents.extend(docx_documents)
            
            # Check for unsupported file types
            supported_extensions = {'.pdf', '.docx'}
            unsupported_files = [
                f.filename for f in files 
                if f.filename and not any(f.filename.lower().endswith(ext) for ext in supported_extensions)
            ]
            
            if unsupported_files:
                logger.warning(f"Unsupported file types: {unsupported_files}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file types: {', '.join(unsupported_files)}. Only PDF and DOCX files are supported."
                )
        
        # Process instructions if provided
        if instructions and instructions.strip():
            try:
                from app.services.instruction_service import get_instruction_service
                from app.models.instruction import TrainingInstructionCreate, InstructionType
                
                instruction_service = get_instruction_service()
                
                # Create instruction data
                instruction_data = TrainingInstructionCreate(
                    chatbot_id=chatbot_id,
                    type=InstructionType.BEHAVIOR,
                    title="Training Instructions",
                    content=instructions.strip(),
                    priority=5,
                    is_active=True
                )
                
                # Create the instruction
                result = await instruction_service.create_instruction(instruction_data)
                logger.info(f"Successfully created training instruction {result.id} for chatbot {chatbot_id}")
                
            except ImportError as e:
                logger.error(f"Instruction service not available: {e}")
                logger.warning("Continuing without instruction creation - instruction service not imported")
            except Exception as e:
                logger.error(f"Failed to create training instruction: {e}")
                logger.warning("Continuing without instruction creation - check database schema and permissions")
                # Log more details for debugging
                logger.debug(f"Instruction content length: {len(instructions.strip())}")
                logger.debug(f"Chatbot ID: {chatbot_id}")

        logger.info(f"Total documents processed: {len(all_documents)}")
        return all_documents
    
    async def _generate_embeddings(self, documents: List[Document]) -> List[Document]:
        """
        Generate embeddings for document chunks using OpenAI model.
        
        Args:
            documents: List of Document objects to generate embeddings for
            
        Returns:
            List of Document objects with embeddings added to metadata
        """
        try:
            model_service = get_model_service()
            
            # Extract text content from documents
            texts = [doc.page_content for doc in documents]
            
            logger.info(f"Generating embeddings for {len(texts)} document chunks using OpenAI")
            
            # Generate embeddings for each document chunk
            embeddings = []
            for i, text in enumerate(texts):
                try:
                    # Truncate text if too long (OpenAI has token limits)
                    truncated_text = text[:8000] if len(text) > 8000 else text
                    embedding = await model_service.generate_embedding(truncated_text)
                    
                    # Validate embedding dimensions
                    if len(embedding) != 1536:
                        logger.error(f"Wrong embedding dimensions! Expected 1536, got {len(embedding)}")
                        logger.error(f"This suggests the wrong embedding model is being used")
                        raise ValueError(f"Embedding has {len(embedding)} dimensions, expected 1536")
                    
                    embeddings.append(embedding)
                    logger.debug(f"Generated embedding {i+1}/{len(texts)} with {len(embedding)} dimensions")
                    
                except Exception as e:
                    logger.error(f"Failed to generate embedding for chunk {i+1}: {e}")
                    logger.error(f"Model service info: {model_service.get_model_info()}")
                    # Don't use fallback - fail fast to identify the issue
                    raise HTTPException(
                        status_code=500,
                        detail=f"Embedding generation failed: {str(e)}. Check OpenAI API key and model configuration."
                    )
            
            # Add embeddings to document metadata
            for doc, embedding in zip(documents, embeddings):
                doc.metadata['embedding'] = embedding
            
            logger.info(f"Successfully generated {len(embeddings)} embeddings with 1536 dimensions each")
            return documents
            
        except Exception as e:
            logger.error(f"Error generating embeddings: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate embeddings: {str(e)}"
            )
    
    async def _store_documents(self, documents: List[Document], user_id: str, chatbot_id: str) -> List[str]:
        """
        Store documents in the vector database using the vector storage service.
        
        Args:
            documents: List of Document objects with embeddings
            user_id: User ID for document association
            chatbot_id: Chatbot ID for document association
            
        Returns:
            List of document IDs that were stored
        """
        try:
            vector_storage_service = get_vector_storage_service()
            document_ids = await vector_storage_service.store_documents(documents, user_id, chatbot_id)
            
            logger.info(f"Successfully stored {len(document_ids)} documents in vector database")
            return document_ids
            
        except Exception as e:
            logger.error(f"Error storing documents in vector database: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to store documents: {str(e)}"
            )
    
    def get_processing_stats(self, documents: List[Document]) -> Dict[str, Any]:
        """
        Get statistics about processed documents.
        
        Args:
            documents: List of processed documents
            
        Returns:
            Dictionary with processing statistics
        """
        if not documents:
            return {
                'total_documents': 0,
                'total_chunks': 0,
                'source_types': {},
                'avg_chunk_size': 0
            }
        
        source_types = {}
        total_chars = 0
        
        for doc in documents:
            source_type = doc.metadata.get('source_type', 'unknown')
            source_types[source_type] = source_types.get(source_type, 0) + 1
            total_chars += len(doc.page_content)
        
        return {
            'total_documents': len(set(doc.metadata.get('source', '') for doc in documents)),
            'total_chunks': len(documents),
            'source_types': source_types,
            'avg_chunk_size': total_chars // len(documents) if documents else 0,
            'chunk_size_config': settings.CHUNK_SIZE,
            'chunk_overlap_config': settings.CHUNK_OVERLAP
        }


# Global document ingestion service instance
document_ingestion_service: Optional[DocumentIngestionService] = None


def get_document_ingestion_service() -> DocumentIngestionService:
    """Get the global document ingestion service instance."""
    global document_ingestion_service
    if document_ingestion_service is None:
        document_ingestion_service = DocumentIngestionService()
    return document_ingestion_service