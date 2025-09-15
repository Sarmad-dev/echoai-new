# Design Document

## Overview

EchoAI SaaS MVP is architected as a modern full-stack application with clear separation between the user-facing Next.js application and the AI processing FastAPI service. The system leverages a hybrid approach combining LangChain's orchestration capabilities with Hugging Face Inference API/Endpoints for scalable, cost-effective AI operations.

The architecture prioritizes scalability, maintainability, and user experience through:
- Next.js 14 App Router for optimal performance and developer experience
- Supabase for managed PostgreSQL with pgvector extension for vector operations
- FastAPI service for AI processing with Hugging Face Inference API/Endpoints
- shadcn/ui component system with custom theming for consistent UI/UX

## Architecture

### System Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        LandingPage[Landing Page]
        Dashboard[Dashboard]
        ChatWidget[Chat Widget]
    end
    
    subgraph "Next.js Application"
        AppRouter[App Router]
        AuthMiddleware[Auth Middleware]
        APIRoutes[API Routes]
        Components[shadcn/ui Components]
    end
    
    subgraph "FastAPI Service"
        IngestEndpoint[/ingest Endpoint]
        ChatEndpoint[/chat Endpoint]
        LangChainPipeline[LangChain Pipeline]
        HFModels[Hugging Face Models]
    end
    
    subgraph "Data Layer"
        Supabase[(Supabase PostgreSQL)]
        PgVector[(pgvector Extension)]
        SupabaseAuth[Supabase Auth]
    end
    
    LandingPage --> AppRouter
    Dashboard --> AppRouter
    ChatWidget --> APIRoutes
    
    AppRouter --> AuthMiddleware
    AuthMiddleware --> Components
    APIRoutes --> IngestEndpoint
    APIRoutes --> ChatEndpoint
    
    IngestEndpoint --> LangChainPipeline
    ChatEndpoint --> LangChainPipeline
    LangChainPipeline --> HFModels
    
    LangChainPipeline --> Supabase
    Supabase --> PgVector
    AuthMiddleware --> SupabaseAuth
```

### Technology Stack Integration

**Frontend Stack:**
- Next.js 14 with App Router provides file-based routing, server components, and optimal performance
- shadcn/ui components with Tailwind CSS enable consistent, themeable UI components
- Framer Motion adds smooth animations and transitions
- Custom CSS variables system supports seamless light/dark mode switching

**Backend Stack:**
- FastAPI service handles all AI operations with async support for better performance
- LangChain orchestrates document processing, embedding generation, and retrieval
- Hugging Face Inference API/Endpoints provide scalable model inference
- Supabase PostgreSQL with pgvector extension stores documents and embeddings

## Components and Interfaces

### Next.js Application Components

#### Core Layout Components
```typescript
// app/layout.tsx - Root layout with theme provider
interface RootLayoutProps {
  children: React.ReactNode;
}

// components/theme-provider.tsx - Theme context and persistence
interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: 'light' | 'dark' | 'system';
}
```

#### Authentication Components
```typescript
// components/auth/login-form.tsx
interface LoginFormProps {
  onSuccess?: () => void;
}

// components/auth/signup-form.tsx  
interface SignupFormProps {
  onSuccess?: () => void;
}
```

#### Dashboard Components
```typescript
// components/dashboard/data-connection-form.tsx
interface DataConnectionFormProps {
  onSubmit: (data: DataConnectionData) => Promise<void>;
}

interface DataConnectionData {
  urls?: string[];
  files?: File[];
}

// components/dashboard/customization-form.tsx
interface CustomizationFormProps {
  initialSettings?: UserSettings;
  onSave: (settings: UserSettings) => Promise<void>;
}

interface UserSettings {
  chatbotName: string;
  welcomeMessage: string;
  primaryColor: string;
}
```

#### Chat Widget Component
```typescript
// components/chat-widget.tsx
interface ChatWidgetProps {
  apiKey: string;
  settings: UserSettings;
  className?: string;
}

interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  sentiment?: 'positive' | 'negative' | 'neutral';
}
```

### API Route Interfaces

#### Next.js API Routes
```typescript
// app/api/train/route.ts
interface TrainRequest {
  urls?: string[];
  files?: FormData;
}

interface TrainResponse {
  success: boolean;
  message: string;
  documentsProcessed: number;
}

// app/api/chat/route.ts
interface ChatRequest {
  message: string;
  apiKey: string;
  conversationId?: string;
}

interface ChatResponse {
  response: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  conversationId: string;
}
```

### FastAPI Service Interfaces

#### Core Service Endpoints
```python
# app/models.py
class IngestRequest(BaseModel):
    user_id: str
    urls: Optional[List[str]] = None
    files: Optional[List[UploadFile]] = None

class IngestResponse(BaseModel):
    success: bool
    message: str
    documents_processed: int

class ChatRequest(BaseModel):
    message: str
    user_id: str
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    sentiment: str
    conversation_id: str
```

#### AI Pipeline Components
```python
# app/services/rag_service.py
class RAGService:
    def __init__(self):
        self.hf_api_token = os.getenv("HUGGINGFACE_API_TOKEN")
        self.embeddings_client = InferenceClient(
            model="BAAI/bge-base-en-v1.5",
            token=self.hf_api_token
        )
        self.llm_client = InferenceClient(
            model="HuggingFaceH4/zephyr-7b-beta",
            token=self.hf_api_token
        )
        self.sentiment_client = InferenceClient(
            model="siebert/sentiment-roberta-large-english",
            token=self.hf_api_token
        )
    
    async def ingest_documents(self, request: IngestRequest) -> IngestResponse
    async def generate_response(self, request: ChatRequest) -> ChatResponse
```

## Data Models

### Database Schema (Prisma)

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector]
}

model User {
  id            String         @id @default(cuid())
  email         String         @unique
  apiKey        String         @unique @default(cuid())
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  documents     Document[]
  settings      UserSettings?
  conversations Conversation[]
}

model UserSettings {
  id             String @id @default(cuid())
  userId         String @unique
  user           User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  chatbotName    String @default("EchoAI Assistant")
  welcomeMessage String @default("Hello! How can I help you today?")
  primaryColor   String @default("#3B82F6")
}

model Document {
  id        String                     @id @default(cuid())
  content   String
  metadata  Json
  embedding Unsupported("vector(1536)") // 1536 dimensions for text-embedding-3-small
  userId    String
  user      User                       @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime                   @default(now())

  @@index([userId])
}

model Conversation {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages  Message[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Message {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  content        String
  role           String       // 'user' or 'assistant'
  sentiment      String?      // 'positive', 'negative', 'neutral'
  createdAt      DateTime     @default(now())
}
```

### Vector Storage Strategy

The system uses Supabase PostgreSQL with the pgvector extension for efficient vector storage and similarity search:

- **Embedding Dimensions**: 1536 for text-embedding-3-small model
- **Similarity Function**: Cosine similarity for document retrieval
- **Indexing Strategy**: HNSW index on embedding column for fast approximate nearest neighbor search
- **Chunking Strategy**: Documents split into 1000-character chunks with 200-character overlap

## Error Handling

### Frontend Error Handling

#### API Error Responses
```typescript
// lib/api-client.ts
interface APIError {
  message: string;
  code: string;
  details?: any;
}

class APIClient {
  async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error: APIError = await response.json();
      throw new APIError(error.message, error.code, error.details);
    }
    return response.json();
  }
}
```

#### Component Error Boundaries
```typescript
// components/error-boundary.tsx
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  // Catches JavaScript errors in component tree
  // Displays fallback UI with error reporting
}
```

### Backend Error Handling

#### FastAPI Exception Handlers
```python
# app/exceptions.py
class EchoAIException(Exception):
    def __init__(self, message: str, code: str, status_code: int = 500):
        self.message = message
        self.code = code
        self.status_code = status_code

@app.exception_handler(EchoAIException)
async def echoai_exception_handler(request: Request, exc: EchoAIException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"message": exc.message, "code": exc.code}
    )
```

#### Inference API Error Handling
```python
# app/services/model_service.py
class ModelService:
    def __init__(self):
        try:
            self.initialize_inference_clients()
        except Exception as e:
            logger.error(f"Failed to initialize Inference API clients: {e}")
            # Fallback to alternative models or OpenAI API if configured
            self.use_fallback_models()
    
    def initialize_inference_clients(self):
        # Initialize Hugging Face Inference API clients with error handling
        # Implement retry logic and rate limiting strategies
```

## Testing Strategy

### Frontend Testing

#### Unit Testing with Jest and React Testing Library
```typescript
// __tests__/components/chat-widget.test.tsx
describe('ChatWidget', () => {
  it('should render with custom settings', () => {
    const settings = {
      chatbotName: 'Test Bot',
      welcomeMessage: 'Hello Test',
      primaryColor: '#FF0000'
    };
    
    render(<ChatWidget apiKey="test-key" settings={settings} />);
    expect(screen.getByText('Test Bot')).toBeInTheDocument();
  });
  
  it('should send messages to chat API', async () => {
    // Test message sending functionality
  });
});
```

#### Integration Testing for API Routes
```typescript
// __tests__/api/chat.test.ts
describe('/api/chat', () => {
  it('should return AI response for valid request', async () => {
    const response = await request(app)
      .post('/api/chat')
      .send({
        message: 'Hello',
        apiKey: 'valid-api-key'
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('response');
  });
});
```

### Backend Testing

#### FastAPI Testing with pytest
```python
# tests/test_rag_service.py
@pytest.mark.asyncio
async def test_ingest_documents():
    service = RAGService()
    request = IngestRequest(
        user_id="test-user",
        urls=["https://example.com"]
    )
    
    response = await service.ingest_documents(request)
    assert response.success is True
    assert response.documents_processed > 0

@pytest.mark.asyncio
async def test_generate_response():
    service = RAGService()
    request = ChatRequest(
        message="What is your company about?",
        user_id="test-user"
    )
    
    response = await service.generate_response(request)
    assert len(response.response) > 0
    assert response.sentiment in ['positive', 'negative', 'neutral']
```

#### Model Performance Testing
```python
# tests/test_model_performance.py
def test_embedding_generation_speed():
    # Test embedding generation performance
    # Ensure response times are acceptable
    
def test_inference_api_response_quality():
    # Test Inference API response quality with sample queries
    # Validate responses are relevant and coherent
    # Test API rate limiting and error handling
```

### End-to-End Testing

#### Playwright Testing for User Flows
```typescript
// e2e/user-journey.spec.ts
test('complete user journey', async ({ page }) => {
  // Test signup -> login -> data upload -> customization -> embed code generation
  await page.goto('/signup');
  await page.fill('[data-testid=email]', 'test@example.com');
  await page.fill('[data-testid=password]', 'password123');
  await page.click('[data-testid=signup-button]');
  
  // Continue with full user journey testing
});
```

This design provides a comprehensive foundation for building the EchoAI SaaS MVP with clear separation of concerns, robust error handling, and thorough testing strategies. The hybrid LangChain and Hugging Face Inference API approach ensures scalability and cost-effectiveness while maintaining high performance and reliability.