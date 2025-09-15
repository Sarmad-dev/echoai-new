# Implementation Plan

- [x] 1. Initialize Next.js project with core dependencies and configuration

  - Create Next.js latest project with App Router
  - Install and configure shadcn/ui, Tailwind CSS, and Framer Motion
  - Set up custom theme system with CSS variables for light/dark mode
  - Configure TypeScript and ESLint settings
  - _Requirements: 6.5, 7.3_

- [x] 2. Set up Supabase database and Prisma ORM

  - Initialize Supabase project and configure PostgreSQL database
  - Enable pgvector extension in Supabase
  - Create Prisma schema with User, UserSettings, Document, Conversation, and Message models
  - Generate Prisma client and run initial migration
  - _Requirements: 1.2, 2.7, 5.3_

- [x] 3. Implement authentication system with Supabase Auth

  - Create Supabase Auth configuration and environment variables
  - Build login form component using shadcn/ui Form, Card, and Button components
  - Build signup form component with email/password validation
  - Implement authentication middleware for protected routes
  - Create auth context provider for user state management
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 4. Build landing page with animations and theme support

  - Create responsive landing page layout with shadcn/ui components
  - Implement animated hero section using Framer Motion
  - Add trust bar, key features, and footer sections
  - Integrate theme toggle functionality with persistent storage
  - Ensure full responsiveness across desktop, tablet, and mobile
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 6.1, 6.2, 6.3, 6.4_

- [x] 5. Create protected dashboard with navigation and layout

  - Build dashboard layout using shadcn/ui Sidebar, Sheet and Card components
  - Implement route protection middleware
  - Create welcome state for new users with guidance cards
  - Add navigation between data connection, customization, and embed sections
  - Display current chatbot configuration and status
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 6. Build data connection form and file upload functionality

  - Create data connection form with URL input and file upload using shadcn/ui components
  - Implement drag-and-drop file upload zone for PDF and DOCX files
  - Add form validation for URLs and file types
  - Create "Train Chatbot" button with loading states
  - Handle form submission and display success/error messages
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 7. Implement chatbot customization form

  - Build customization form with fields for chatbot name, welcome message, and primary color
  - Add color picker component for primary color selection
  - Implement form validation and save functionality
  - Create preview component showing chatbot appearance with current settings
  - Store settings in user_settings table via API
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 8. Create embed code generator with copy functionality

  - Generate JavaScript embed snippet with user's unique API key
  - Display embed code in shadcn/ui Textarea component
  - Implement copy-to-clipboard functionality with success feedback
  - Include user's customization settings in the embed code
  - Add instructions for embedding the widget
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 9. Build chat widget component with theme support

  - Create ChatWidget component with message display and input
  - Implement real-time messaging interface with proper state management
  - Apply user's primary color customization to widget styling
  - Add support for browser/device dark mode preference detection
  - Handle loading states and error messages in chat interface
  - _Requirements: 5.1, 6.6_

- [x] 10. Create Next.js API routes for FastAPI communication

  - Build /api/train route to proxy requests to FastAPI /ingest endpoint
  - Implement authentication validation in API routes
  - Create /api/chat route to handle chat requests and stream responses
  - Add error handling and proper HTTP status codes
  - Implement request/response validation and sanitization
  - _Requirements: 2.1, 5.1, 9.5_

- [x] 11. Initialize FastAPI service with core dependencies

  - Create FastAPI project structure with proper directory organization
  - Install required dependencies: langchain, huggingface-hub, fastapi, uvicorn, supabase, psycopg2-binary, unstructured, httpx
  - Set up environment configuration and logging
  - Create main FastAPI application with CORS and middleware configuration
  - _Requirements: 9.1, 9.2_

- [x] 12. Configure Hugging Face Inference API integration

  - Set up Hugging Face API token configuration in environment variables
  - Configure BAAI/bge-base-en-v1.5 embedding model via Hugging Face Inference API
  - Set up HuggingFaceH4/zephyr-7b-beta text generation via Hugging Face Inference Endpoints
  - Configure siebert/sentiment-roberta-large-english sentiment analysis via Inference API
  - Implement API client with rate limiting, retries, and error handling
  - Add fallback strategies for API failures and quota limits
  - _Requirements: 9.2, 5.5, 5.7_

- [x] 13. Build document ingestion service with LangChain loaders

  - Implement WebBaseLoader for URL content extraction
  - Create PyPDFLoader for PDF file processing
  - Add Docx2txtLoader for DOCX file handling
  - Implement text splitting with LangChain text splitters (1000 chars, 200 overlap)
  - Generate embeddings for text chunks using Hugging Face Inference API
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 14. Create vector storage service with Supabase integration

  - Implement SupabaseVectorStore integration with LangChain
  - Create functions to store text chunks and embeddings in documents table
  - Set up vector similarity search with cosine similarity
  - Implement user-specific document filtering and retrieval
  - Add error handling for database operations
  - _Requirements: 2.7, 5.3_

- [x] 15. Build FastAPI /ingest endpoint for document processing

  - Create IngestRequest and IngestResponse models with proper validation
  - Implement endpoint to receive URLs and files from Next.js API
  - Process documents using LangChain loaders and text splitters
  - Generate embeddings via Hugging Face Inference API and store in Supabase with user association
  - Return processing results with document count and status
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 9.3_

- [x] 16. Implement RAG service with Hugging Face Inference API

  - Create RAGService class using Hugging Face Inference API clients
  - Implement query embedding generation via BAAI/bge-base-en-v1.5 Inference API
  - Build document retrieval from vector store using generated embeddings
  - Create context-aware prompt construction with retrieved documents
  - Integrate text generation via Inference API with fallback handling
  - Add conversation ID generation and management
  - Implement proper error handling for API failures and rate limits with exponential backoff
  - Test RAG service functionality with comprehensive test suite
  - _Requirements: 5.2, 5.3, 5.4, 5.5_

- [x] 17. Complete FastAPI /chat endpoint implementation

  - Implement full chat endpoint logic using RAGService with Inference API
  - Add user authentication validation via API key lookup
  - Process user messages through RAG pipeline for contextual responses
  - Integrate sentiment analysis using Hugging Face Inference API
  - Return structured AI response with sentiment analysis and conversation ID
  - Handle API rate limits and implement retry logic for Inference API calls
  - _Requirements: 5.1, 5.2, 5.6, 5.7, 9.4, 9.5_

- [x] 18. Add streaming support to FastAPI /chat endpoint


  - Create /chat/stream endpoint for real-time response streaming via Inference Endpoints
  - Implement Server-Sent Events (SSE) for token-by-token response delivery
  - Handle streaming response generation with proper error handling for API calls
  - Add metadata streaming for conversation ID and sentiment analysis
  - Ensure proper connection management and cleanup for Inference API connections
  - Implement fallback to non-streaming if Inference Endpoints don't support streaming
  - _Requirements: 5.1, 5.5_

- [x] 19. Enhance Next.js chat widget with real-time functionality

  - Update chat widget to handle streaming responses from FastAPI
  - Implement real-time message display with typing indicators
  - Add conversation persistence and message history loading
  - Display sentiment analysis results in chat interface
  - Handle connection errors and retry logic for chat requests
  - _Requirements: 5.1, 5.7_

- [x] 20. Add comprehensive error handling and monitoring




  - Implement React error boundaries with fallback UI components
  - Add comprehensive API error handling with user-friendly messages
  - Create validation for all form inputs and API requests
  - Handle Hugging Face Inference API failures with graceful degradation and fallbacks
  - Add structured logging and monitoring for debugging and maintenance
  - _Requirements: 9.5_

- [ ] 21. Implement React error boundaries and enhanced error handling

  - Create React error boundary components with fallback UI for component tree errors
  - Add global error handling for unhandled promise rejections
  - Implement user-friendly error messages and recovery options
  - Add error reporting and logging for debugging
  - Create error state management for better user experience
  - _Requirements: 9.5_

- [ ] 22. Create comprehensive test suite

  - Write unit tests for React components using Jest and React Testing Library
  - Create integration tests for Next.js API routes with mock FastAPI responses
  - Build FastAPI endpoint tests with pytest including RAG pipeline testing
  - Implement end-to-end tests for complete user workflows using Playwright
  - Add performance tests for AI model response times and memory usage
  - _Requirements: All requirements validation_

- [ ] 23. Optimize performance and add production readiness features

  - Implement response caching and API call optimization for Inference API
  - Add request queuing and rate limiting for production scalability
  - Optimize embedding generation with batch processing via Inference API
  - Add health checks and monitoring endpoints for deployment
  - Implement graceful shutdown and resource cleanup
  - _Requirements: 9.1, 9.2, 9.5_
