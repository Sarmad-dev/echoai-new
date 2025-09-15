/**
 * Centralized type definitions for API routes and responses
 */

// Common types
/** Sentiment analysis result type */
export type SentimentType = 'positive' | 'negative' | 'neutral';

// Train API types
/** Request payload for training the chatbot with documents */
export interface TrainRequest {
  /** Array of URLs to scrape and process */
  urls?: string[];
  /** Array of files to upload and process */
  files?: File[];
  /** Training instructions for the chatbot */
  instructions?: string;
  /** ID of the chatbot to train */
  chatbotId: string;
  /** Whether to replace existing data or add to it */
  replaceExisting?: boolean;
}

/** Response from the train API endpoint */
export interface TrainResponse {
  /** Whether the training was successful */
  success: boolean;
  /** Human-readable message about the training result */
  message: string;
  /** Number of documents that were processed */
  documentsProcessed: number;
}

/** Processing statistics from document ingestion */
export interface ProcessingStats {
  total_documents: number;
  total_chunks: number;
  url_documents?: number;
  file_documents?: number;
  instruction_documents?: number;
}

/** Vector storage statistics */
export interface VectorStorageStats {
  total_embeddings: number;
  storage_size?: number;
}

/** Response from FastAPI ingest endpoint */
export interface FastAPIIngestResponse {
  /** Whether the ingestion was successful */
  success: boolean;
  /** Human-readable message about the ingestion result */
  message: string;
  /** Number of documents that were processed */
  documents_processed: number;
  /** Detailed processing statistics */
  processing_stats: ProcessingStats;
  /** Vector storage statistics */
  vector_storage_stats: VectorStorageStats;
}

// Chat API types
export interface ChatRequest {
  message: string;
  apiKey: string;
  conversationId?: string;
  chatbotId?: string;
}

export interface ChatResponse {
  response: string;
  sentiment: SentimentType;
  conversationId: string;
}

export interface FastAPIChatResponse {
  response: string;
  sentiment: string;
  conversation_id: string;
}

export interface ChatRequestData {
  message: string;
  user_id: string;
  conversation_id?: string;
  chatbot_id?: string;
}

// Streaming types
export interface StreamingChatData {
  type: 'token' | 'metadata' | 'done' | 'enhanced_data';
  content?: string;
  conversation_id?: string;
  sentiment?: string;
  metadata?: {
    conversation_id?: string;
    sentiment?: string;
    [key: string]: any;
  };
  data?: any; // For enhanced data payload
}

export interface StreamingCallbacks {
  onToken: (token: string) => void;
  onMetadata?: (metadata: { conversationId: string; sentiment: string }) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

// Error types
export interface APIError {
  message: string;
  code?: string;
  details?: unknown;
}

export interface ErrorResponse {
  error: string;
  details?: unknown;
}

// Database types
export interface UserData {
  id: string;
  email: string | null;
  apiKey: string | null;
  plan: 'FREE' | 'PRO';
}

export interface ChatbotData {
  id: string;
  name: string;
  welcomeMessage: string;
  primaryColor: string;
  isActive: boolean;
  apiKey: string;
  instructions?: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    documents: number;
    conversations: number;
  };
}

export interface ConversationData {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageData {
  id: string;
  conversationId: string;
  content: string;
  role: 'user' | 'assistant';
  sentiment?: string | null;
  createdAt: Date;
}

// Validation types
export interface FileValidation {
  valid: boolean;
  error?: string;
}

export interface RateLimitInfo {
  remainingRequests: number;
}



// Test types
export interface TestResult {
  endpoint: string;
  success: boolean;
  message: string;
  details?: unknown;
}

// Request data types for internal use
export interface TrainRequestData {
  urls?: string[];
  files?: File[];
  instructions?: string;
}

export interface ParsedRequestBody {
  message?: string;
  apiKey?: string;
  conversationId?: string;
  urls?: string[];
  files?: File[];
}