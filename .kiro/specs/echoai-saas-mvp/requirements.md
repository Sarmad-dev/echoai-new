# Requirements Document

## Introduction

EchoAI SaaS MVP is a B2B application that enables business owners to embed AI-powered customer support and lead qualification chatbots on their websites. The system provides a dashboard for data source connection (URLs, PDFs, DOCX), chatbot customization, and embed code generation. The core AI functionality uses a hybrid LangChain and Hugging Face RAG pipeline with Hugging Face Inference API/Endpoints for scalable and cost-effective AI operations.

## Requirements

### Requirement 1

**User Story:** As a business owner, I want to create an account and authenticate securely, so that I can access my personalized chatbot dashboard and data.

#### Acceptance Criteria

1. WHEN a user visits the signup page THEN the system SHALL display a form with email and password fields using shadcn/ui components
2. WHEN a user submits valid signup credentials THEN the system SHALL create a new account using Supabase Auth and generate a unique API key
3. WHEN a user visits the login page THEN the system SHALL display a login form with email and password fields
4. WHEN a user submits valid login credentials THEN the system SHALL authenticate them and redirect to the dashboard
5. WHEN an unauthenticated user tries to access protected routes THEN the system SHALL redirect them to the login page

### Requirement 2

**User Story:** As a business owner, I want to connect my data sources (website URLs, PDF files, DOCX files), so that my chatbot can answer questions based on my business information.

#### Acceptance Criteria

1. WHEN a user accesses the data connection form THEN the system SHALL display input fields for URL and file upload using shadcn/ui components
2. WHEN a user submits a website URL THEN the system SHALL use LangChain's WebBaseLoader to extract and process the content
3. WHEN a user uploads PDF files THEN the system SHALL use LangChain's PyPDFLoader to extract text content
4. WHEN a user uploads DOCX files THEN the system SHALL use LangChain's Docx2txtLoader to extract text content
5. WHEN documents are processed THEN the system SHALL split them into chunks using LangChain text splitters
6. WHEN text chunks are created THEN the system SHALL generate embeddings using Hugging Face Inference API with BAAI/bge-base-en-v1.5 model
7. WHEN embeddings are generated THEN the system SHALL store text chunks and embeddings in Supabase PostgreSQL with pgvector extension

### Requirement 3

**User Story:** As a business owner, I want to customize my chatbot's appearance and behavior, so that it matches my brand and provides a personalized experience.

#### Acceptance Criteria

1. WHEN a user accesses the customization form THEN the system SHALL display fields for chatbot name, welcome message, and primary color using shadcn/ui components
2. WHEN a user updates customization settings THEN the system SHALL save them to the user_settings table in the database
3. WHEN a user changes the primary color THEN the system SHALL validate it's a valid hex color code
4. WHEN customization settings are saved THEN the system SHALL apply them to the chat widget preview

### Requirement 4

**User Story:** As a business owner, I want to get an embed code for my chatbot, so that I can integrate it into my website easily.

#### Acceptance Criteria

1. WHEN a user requests the embed code THEN the system SHALL generate a JavaScript snippet containing their unique API key
2. WHEN the embed code is displayed THEN the system SHALL show it in a shadcn/ui Textarea component with a copy button
3. WHEN a user clicks the copy button THEN the system SHALL copy the embed code to their clipboard
4. WHEN the embed code is used on a website THEN the system SHALL load the chat widget with the user's customization settings

### Requirement 5

**User Story:** As a website visitor, I want to interact with an AI chatbot that understands the business's content, so that I can get accurate answers to my questions.

#### Acceptance Criteria

1. WHEN a visitor sends a message to the chatbot THEN the system SHALL authenticate the request using the API key
2. WHEN a message is received THEN the system SHALL generate an embedding for the query using Hugging Face Inference API with the same model used for document processing
3. WHEN the query embedding is created THEN the system SHALL perform similarity search in the documents table using LangChain's SupabaseVectorStore
4. WHEN relevant documents are retrieved THEN the system SHALL construct a prompt with the context and user's question
5. WHEN the prompt is ready THEN the system SHALL generate a response using Hugging Face Inference Endpoints with HuggingFaceH4/zephyr-7b-beta model
6. WHEN a response is generated THEN the system SHALL analyze the user's message sentiment using Hugging Face Inference API with siebert/sentiment-roberta-large-english model
7. WHEN processing is complete THEN the system SHALL return the AI response and sentiment analysis to the chat widget

### Requirement 6

**User Story:** As a user of the application, I want a responsive interface with light and dark mode support, so that I can use the application comfortably in different environments.

#### Acceptance Criteria

1. WHEN a user visits any page THEN the system SHALL display a theme toggle button in the navigation
2. WHEN a user clicks the theme toggle THEN the system SHALL switch between light and dark modes
3. WHEN the theme is changed THEN the system SHALL persist the preference in local storage
4. WHEN the application loads THEN the system SHALL respect the user's saved theme preference or system preference
5. WHEN any shadcn/ui component is rendered THEN the system SHALL apply the custom theme with CSS variables
6. WHEN the chat widget is embedded THEN the system SHALL respect the browser's/device's dark mode preference

### Requirement 7

**User Story:** As a business owner, I want an attractive landing page that showcases the product features, so that I can understand the value proposition before signing up.

#### Acceptance Criteria

1. WHEN a user visits the root URL THEN the system SHALL display a marketing landing page with animated hero section
2. WHEN the landing page loads THEN the system SHALL include sections for hero, trust bar, key features, and footer
3. WHEN animations are displayed THEN the system SHALL use Framer Motion for smooth transitions
4. WHEN a user interacts with the page THEN the system SHALL provide clear call-to-action buttons leading to signup
5. WHEN the page is viewed THEN the system SHALL be fully responsive across desktop, tablet, and mobile devices

### Requirement 8

**User Story:** As a business owner, I want a dashboard that provides an overview of my chatbot setup, so that I can manage my AI assistant effectively.

#### Acceptance Criteria

1. WHEN an authenticated user visits /dashboard THEN the system SHALL display a protected dashboard page
2. WHEN a new user accesses the dashboard THEN the system SHALL show a welcome state with guidance to connect data
3. WHEN the dashboard loads THEN the system SHALL use shadcn/ui Layout components including Sheet and Card
4. WHEN a user has connected data THEN the system SHALL display their current chatbot configuration and status
5. WHEN navigation is needed THEN the system SHALL provide clear links to data connection, customization, and embed code sections

### Requirement 9

**User Story:** As a system administrator, I want the AI processing to be handled by a separate FastAPI service, so that the system can scale efficiently and maintain separation of concerns.

#### Acceptance Criteria

1. WHEN the Next.js application needs AI processing THEN the system SHALL communicate with a separate FastAPI service
2. WHEN the FastAPI service starts THEN the system SHALL initialize Hugging Face Inference API clients with proper authentication and configuration
3. WHEN the /ingest endpoint is called THEN the system SHALL process documents using LangChain loaders and generate embeddings
4. WHEN the /chat endpoint is called THEN the system SHALL perform RAG retrieval and generation using the hybrid pipeline
5. WHEN API requests are made THEN the system SHALL validate authentication and user permissions
6. WHEN errors occur in the FastAPI service THEN the system SHALL return appropriate error responses to the Next.js application
