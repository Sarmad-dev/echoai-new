/**
 * Enhanced Database Types for Advanced Automation Platform
 *
 * These types correspond to the new database schema and can be used
 * throughout the application for type safety.
 */

// Existing enums
export enum UserPlan {
  FREE = "FREE",
  PRO = "PRO",
}

export enum UserRole {
  user = "user",
  staff = "staff",
  admin = "admin",
}

export enum ConversationStatus {
  AI_HANDLING = "AI_HANDLING",
  AWAITING_HUMAN_RESPONSE = "AWAITING_HUMAN_RESPONSE",
  RESOLVED = "RESOLVED",
}

export enum ExecutionStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

// Base types
export interface User {
  id: string;
  email: string;
  apiKey: string;
  plan: UserPlan;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface Chatbot {
  id: string;
  name: string;
  welcomeMessage: string;
  primaryColor: string;
  isActive: boolean;
  apiKey: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: string;
  content: string;
  metadata: Record<string, any>;
  embedding?: number[]; // Vector embedding
  chatbotId: string;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  userId: string;
  externalUserId?: string;
  chatbotId?: string;
  status: ConversationStatus;
  customerEmail?: string;
  source?: string;
  assignedTo?: string;
  memoryBuffer?: LangChainMemoryState;
  createdAt: Date;
  updatedAt: Date;
}

// Enhanced Message type
export interface Message {
  id: string;
  conversationId: string;
  content: string;
  role: "user" | "assistant" | "agent";
  sentiment?: "positive" | "negative" | "neutral";
  sessionId?: string;
  sentimentScore?: number; // -1.00 to 1.00
  metadata?: Record<string, any>;
  imageUrl?: string;
  createdAt: Date;
}

export interface ConversationIntelligenceData {
  leadPotential: number;
  topicsCovered: string[];
  escalationRisk: number;
  proactiveScore: number;
  helpfulnessScore: number;
  knowledgeGapsFound: string[];
  userGoalsIdentified: string[];
  contextUnderstanding: number;
  conversationFlowScore: number;
  userSatisfactionPrediction: number;
}

export interface ConversationIntelligence {
  id: string;
  conversationId: string;
  userId: string;
  chatbotId: string;
  intelligenceData: ConversationIntelligenceData;
  contextUnderstanding?: number;
  proactiveScore?: number;
  helpfulnessScore?: number;
  topicTransitions?: Record<string, any>;
  userProfile?: Record<string, any>;
  conversationSummary?: string;
  createdAt: Date;
  updatedAt: Date;
}

// New types for advanced features

export interface ExternalUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationSession {
  id: string;
  externalUserId: string;
  chatbotId: string;
  memoryBuffer?: LangChainMemoryState;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationWorkflow {
  id: string;
  userId: string;
  chatbotId: string; // Required for chatbot scoping
  name: string;
  description?: string;
  flowDefinition: ReactFlowDefinition;
  stateMachine: XStateDefinition;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  chatbotId: string; // Added for proper scoping and analytics
  triggerId: string;
  triggerData?: Record<string, any>;
  status: ExecutionStatus;
  executionLog?: Record<string, any>;
  startedAt: Date;
  completedAt?: Date;
  error?: string; // Added for error tracking
}

export interface Integration {
  id: string;
  userId: string;
  provider: IntegrationProvider;
  accessToken: string; // Encrypted
  refreshToken?: string; // Encrypted
  tokenExpiry?: Date;
  config?: ProviderConfig;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FAQ {
  id: string;
  chatbotId: string;
  question: string;
  answer: string;
  category?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
}

export interface ImageAnalysis {
  id: string;
  messageId: string;
  imageUrl: string;
  prompt: string;
  analysisResult: ImageAnalysisResult;
  processingTime?: number; // milliseconds
  createdAt: Date;
}

// Supporting types

export type IntegrationProvider =
  | "hubspot"
  | "slack"
  | "google_sheets"
  | "salesforce";

export interface LangChainMemoryState {
  messages: Array<{
    type: "human" | "ai";
    content: string;
    timestamp: string;
  }>;
  summary?: string;
  metadata?: Record<string, any>;
}

export interface ReactFlowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

// Type for handling nested flow definition structure from frontend
export interface WorkflowDefinitionWrapper {
  flowDefinition?: ReactFlowDefinition;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}

export interface WorkflowNode {
  id: string;
  type: "trigger" | "action" | "condition";
  position: { x: number; y: number };
  data: {
    label: string;
    config: Record<string, any>;
    nodeType?: string;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  data?: Record<string, any>;
}

export interface XStateDefinition {
  id: string;
  initial: string;
  states: Record<string, any>;
  context?: Record<string, any>;
}

export interface WorkflowContext {
  triggerId: string;
  triggerData: Record<string, unknown>;
  executionId: string;
  userId: string;
  chatbotId: string; // Added for chatbot context
  variables: Record<string, unknown>;
  errors: string[];
}

export interface ProviderConfig {
  // HubSpot specific
  hubspotPortalId?: string;
  hubspotScopes?: string[];

  // Slack specific
  slackTeamId?: string;
  slackChannels?: string[];

  // Google Sheets specific
  googleSheetsId?: string;
  googleSheetRange?: string;

  // Common fields
  webhookUrl?: string;
  customFields?: Record<string, any>;
}

export interface ImageAnalysisResult {
  confidence: number;
  extractedData: Record<string, any>;
  recommendations?: string[];
  categories?: string[];
  objects?: Array<{
    name: string;
    confidence: number;
    boundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
}

// API Request/Response types

export interface CreateConversationSessionRequest {
  externalUserEmail: string;
  chatbotId: string;
  firstName?: string;
  lastName?: string;
}

export interface CreateConversationSessionResponse {
  sessionId: string;
  externalUserId: string;
  isNewUser: boolean;
}

export interface SendMessageRequest {
  sessionId: string;
  content: string;
  imageUrl?: string;
}

export interface SendMessageResponse {
  messageId: string;
  response: string;
  sentimentScore?: number;
  imageAnalysis?: ImageAnalysisResult;
}

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  flowDefinition: ReactFlowDefinition;
  userId: string;
  chatbotId: string; // Required for chatbot association
  isActive?: boolean;
}

export interface CreateWorkflowResponse {
  workflowId: string;
  stateMachine: XStateDefinition;
}

// Enhanced workflow execution types
export interface TriggerEvent {
  type: string;
  data: Record<string, unknown>;
  conversationId?: string;
  messageId?: string;
  userId: string;
  chatbotId?: string; // Added for chatbot context
  timestamp?: Date;
}

export interface ExecutionContext {
  workflowId: string;
  chatbotId: string;
  userId: string;
  triggerEvent: TriggerEvent;
  variables: Record<string, unknown>;
}

export interface ExecutionResult {
  executionId: string;
  status: ExecutionStatus;
  startedAt: Date;
  completedAt?: Date;
  logs: ExecutionLog[];
  error?: string;
}

export interface ExecutionLog {
  timestamp: Date;
  level: "info" | "warn" | "error";
  message: string;
  nodeId?: string;
  data?: Record<string, unknown>;
}

// Workflow list options with enhanced filtering
export interface WorkflowListOptions {
  userId?: string;
  chatbotId?: string; // Filter by chatbot
  isActive?: boolean;
  limit?: number;
  offset?: number;
  search?: string; // Search by name or description
}

// Dead Letter Queue for failed executions
export interface DeadLetterRecord {
  executionId: string;
  workflowId: string;
  triggerEvent: TriggerEvent;
  error: {
    message: string;
    stack?: string;
    name: string;
  };
  retryCount: number;
  addedAt: Date;
  lastRetryAt: Date;
}

// Action execution types
export interface ActionResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export interface ActionExecutor {
  executeAction(
    actionType: string,
    config: Record<string, unknown>,
    context: WorkflowContext
  ): Promise<ActionResult>;
}

export interface ConnectIntegrationRequest {
  provider: IntegrationProvider;
  authCode: string;
  config?: ProviderConfig;
}

export interface ConnectIntegrationResponse {
  integrationId: string;
  status: "connected" | "failed";
  error?: string;
}

// Analytics types

export interface AnalyticsMetrics {
  totalConversations: number;
  averageSentiment: number;
  resolutionRate: number;
  automationTriggers: number;
  activeUsers: number;
  topIntents: Array<{
    intent: string;
    count: number;
  }>;
}

export interface ConversationAnalytics {
  conversationId: string;
  messageCount: number;
  averageSentiment: number;
  duration: number; // minutes
  resolved: boolean;
  automationTriggered: boolean;
}

export interface WorkflowAnalytics {
  workflowId: string;
  executionCount: number;
  successRate: number;
  averageExecutionTime: number; // milliseconds
  lastExecuted?: Date;
}

// Trigger matching types
export interface TriggerMatchResult {
  matches: boolean;
  confidence: number;
  matchedConditions: string[];
  context: Record<string, any>;
}

export interface TriggerCondition {
  type: "exact" | "contains" | "threshold" | "regex" | "range" | "in";
  field: string;
  value: any;
  operator?: "eq" | "gt" | "lt" | "gte" | "lte" | "in" | "not_in";
}

export interface TriggerConfiguration {
  triggerType: string;
  conditions: TriggerCondition[];
  requireAll?: boolean; // AND vs OR logic
  metadata?: Record<string, any>;
}

// Event processing pipeline types
export interface EventProcessingPipeline {
  receiveEvent(event: TriggerEvent): Promise<void>;
  matchTriggers(
    event: TriggerEvent,
    chatbotId: string
  ): Promise<AutomationWorkflow[]>;
  executeWorkflows(
    workflows: AutomationWorkflow[],
    event: TriggerEvent
  ): Promise<ExecutionResult[]>;
  getHealthStatus(): Promise<Record<string, any>>;
}

// Error types

export interface DatabaseError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// Utility types

export type CreateInput<T> = Omit<T, "id" | "createdAt" | "updatedAt">;
export type UpdateInput<T> = Partial<Omit<T, "id" | "createdAt" | "updatedAt">>;

// Database query helpers
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: "asc" | "desc";
  filters?: Record<string, any>;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Supabase Database Type Definition
export interface Database {
  public: {
    Tables: {
      User: {
        Row: User;
        Insert: Omit<User, 'id' | 'createdAt' | 'updatedAt'>;
        Update: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>;
      };
      Chatbot: {
        Row: Chatbot;
        Insert: Omit<Chatbot, 'id' | 'createdAt' | 'updatedAt'>;
        Update: Partial<Omit<Chatbot, 'id' | 'createdAt' | 'updatedAt'>>;
      };
      Conversation: {
        Row: Conversation;
        Insert: Omit<Conversation, 'id' | 'createdAt' | 'updatedAt'>;
        Update: Partial<Omit<Conversation, 'id' | 'createdAt' | 'updatedAt'>>;
      };
      Message: {
        Row: Message;
        Insert: Omit<Message, 'id' | 'createdAt'>;
        Update: Partial<Omit<Message, 'id' | 'createdAt'>>;
      };
      AutomationWorkflow: {
        Row: AutomationWorkflow;
        Insert: Omit<AutomationWorkflow, 'id' | 'createdAt' | 'updatedAt'>;
        Update: Partial<Omit<AutomationWorkflow, 'id' | 'createdAt' | 'updatedAt'>>;
      };
      WorkflowExecution: {
        Row: WorkflowExecution;
        Insert: Omit<WorkflowExecution, 'id' | 'startedAt'>;
        Update: Partial<Omit<WorkflowExecution, 'id' | 'startedAt'>>;
      };
      Integration: {
        Row: Integration;
        Insert: Omit<Integration, 'id' | 'createdAt' | 'updatedAt'>;
        Update: Partial<Omit<Integration, 'id' | 'createdAt' | 'updatedAt'>>;
      };
      ConversationIntelligence: {
        Row: ConversationIntelligence;
        Insert: Omit<ConversationIntelligence, 'id' | 'createdAt' | 'updatedAt'>;
        Update: Partial<Omit<ConversationIntelligence, 'id' | 'createdAt' | 'updatedAt'>>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      UserPlan: 'FREE' | 'PRO';
      UserRole: 'user' | 'staff' | 'admin';
      ConversationStatus: 'AI_HANDLING' | 'AWAITING_HUMAN_RESPONSE' | 'RESOLVED';
      ExecutionStatus: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    };
  };
}