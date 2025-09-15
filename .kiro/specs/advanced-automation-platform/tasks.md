# Implementation Plan

- [x] 1. Database Schema Enhancement and Core Infrastructure

  - Extend the existing Supabase schema with new tables for conversation sessions, external users, automation workflows, integrations, and analytics
  - Create database migration scripts and update any existing Prisma schema files
  - Add necessary indexes and constraints for optimal performance
  - _Requirements: 1.1, 1.6, 2.6, 3.6, 5.2, 6.2_

- [x] 2. Enhanced Conversation Memory System

- [x] 2.1 Implement LangChain Memory Integration in FastAPI

  - Install LangChain memory dependencies in FastAPI service requirements
  - Create ConversationMemoryManager class to handle LangChain ConversationBufferWindowMemory
  - Implement memory persistence to/from database using the ConversationSession table
  - Write unit tests for memory loading, saving, and context retrieval
  - _Requirements: 1.2, 1.3, 1.4, 1.5_

- [ ] 2.2 Update Chat API Endpoint for Session Management

  - Modify the existing /chat endpoint to accept and return conversation_id/session_id
  - Implement session creation and retrieval logic for external users identified by email
  - Integrate memory context into the RAG pipeline alongside retrieved documents
  - Add conversation history storage in the Message table with session linking
  - Write integration tests for the enhanced chat flow with memory persistence
  - _Requirements: 1.1, 1.2, 1.3, 1.6_

- [x] 3. Sentiment Analysis and Automation Triggers

- [x] 3.1 Implement Real-time Sentiment Analysis

  - Add sentiment analysis library (textblob or similar) to FastAPI dependencies
  - Create SentimentAnalyzer service class to process message sentiment and assign scores
  - Update Message table storage to include sentimentScore field
  - Implement sentiment-based trigger detection for automation workflows
  - Write unit tests for sentiment analysis accuracy and trigger detection
  - _Requirements: 7.1, 7.2, 7.6_

- [x] 3.2 Create Event System for Automation Triggers

  - Install Inngest SDK in both Next.js and FastAPI services
  - Create event emission system in FastAPI for conversation events (new message, sentiment detected, etc.)
  - Implement event handlers that can trigger automation workflows
  - Create base trigger types: NewConversation, IntentDetected, NegativeSentiment, ImageUploaded
  - Write tests for event emission and trigger detection
  - _Requirements: 3.4, 7.3, 7.4, 8.1, 8.4_

- [ ] 4. Multi-Modal Image Analysis Integration

- [ ] 4.1 Implement OpenAI Vision API Service

  - Add OpenAI SDK to FastAPI requirements and configure API key
  - Create VisionService class with methods for different analysis types (product condition, invoice extraction, inventory counting)
  - Implement POST /api/vision/analyze endpoint that accepts image uploads and analysis prompts
  - Add ImageAnalysis table storage for analysis results and processing metadata
  - Write unit tests for vision API integration and structured data extraction
  - _Requirements: 4.1, 4.2, 4.3, 4.7_

- [ ] 4.2 Integrate Image Upload in Chat System

  - Add image upload capability to the chat API endpoint
  - Implement secure image storage (temporary URLs) and validation
  - Create automatic vision analysis trigger when images are uploaded in conversations
  - Link image analysis results to conversation messages and automation workflows
  - Write integration tests for end-to-end image upload and analysis flow
  - _Requirements: 4.1, 4.4, 4.5, 4.6_

- [x] 5. Enhanced Chat Widget with Tabs and History

- [x] 5.1 Create Multi-Tab Chat Widget Component

  - Install react-dropzone for image uploads in Next.js frontend
  - Create enhanced ChatWidget component with Radix UI tabs for Chat, FAQ, and History
  - Implement userEmail parameter acceptance and session identification
  - Add image upload UI with drag-and-drop functionality in the Chat tab
  - Write component tests for tab switching and user interaction
  - _Requirements: 2.1, 2.2, 2.6, 4.1_

- [x] 5.2 Implement FAQ Tab Functionality

  - Create FAQ management API endpoints (GET /api/faq, POST /api/faq) in Next.js
  - Implement FAQ table CRUD operations with chatbot association
  - Build FAQ tab UI that displays pre-defined questions and auto-populates chat input
  - Add FAQ administration interface in the main dashboard
  - Write tests for FAQ retrieval, display, and interaction
  - _Requirements: 2.3, 2.4_

- [ ] 5.3 Build Conversation History Tab

  - Create API endpoints for conversation history retrieval by user email
  - Implement History tab UI showing past conversations with timestamps and previews
  - Add functionality to resume previous conversations by loading session context
  - Implement conversation search and filtering capabilities
  - Write tests for history retrieval, display, and conversation resumption
  - _Requirements: 2.5, 2.6, 1.5_

- [x] 6. Visual Automation Workflow Builder

- [x] 6.1 Install and Configure React Flow Dependencies




  - Add React Flow, XState, and @xstate/react to Next.js package.json
  - Create base AutomationBuilder component with React Flow canvas
  - Implement custom node types for Triggers, Actions, and Conditions
  - Create node palette with drag-and-drop functionality for workflow creation
  - Write component tests for node creation, connection, and basic workflow building
  - _Requirements: 3.1, 3.2_

- [x] 6.2 Implement Workflow State Machine Generation

  - Create WorkflowCompiler service to convert React Flow graphs to XState machine definitions
  - Implement workflow validation logic to ensure proper trigger-action connections
  - Add workflow saving and loading functionality with database persistence
  - Create workflow execution engine that processes XState machines
  - Write unit tests for workflow compilation, validation, and execution logic
  - _Requirements: 3.5, 3.6, 3.7_

- [x] 6.3 Build Core Trigger and Action Handlers




  - Implement trigger handlers: NewConversation, IntentDetected, NegativeSentiment, ImageUploaded, HighValueLead
  - Create action handlers: AddNote, TagConversation, SendSlackMessage, CreateHubSpotContact, AutoApproveReturn
  - Add action configuration UI for each action type (message templates, CRM field mapping, etc.)
  - Implement workflow execution logging and error handling
  - Write integration tests for complete trigger-to-action workflow execution
  - _Requirements: 3.2, 3.3, 3.4, 3.8, 7.3, 7.4, 7.5, 8.2, 8.3, 8.4, 8.5_

- [x] 7. Third-Party Integration System

- [x] 7.1 Implement OAuth2 Integration Framework

  - Create OAuth2Manager service for handling authorization flows with multiple providers
  - Implement secure token storage with encryption for access and refresh tokens
  - Add integration configuration UI with provider-specific setup flows
  - Create token refresh automation and connection health monitoring
  - Write tests for OAuth flows, token management, and connection validation
  - _Requirements: 5.2, 5.3, 5.7, 5.8_

- [x] 7.2 Build HubSpot Integration Actions

  - Implement HubSpot API client with contact creation, deal management, and property updates
  - Create HubSpot-specific action handlers for automation workflows
  - Add HubSpot connection configuration UI with scope selection and field mapping
  - Implement error handling for HubSpot API rate limits and failures
  - Write integration tests for HubSpot contact creation and deal management
  - _Requirements: 5.4, 8.2, 8.3, 8.5_

- [x] 7.3 Build Slack Integration Actions

  - Implement Slack API client for sending messages to channels and direct messages
  - Create Slack-specific action handlers with message templating and channel selection
  - Add Slack bot configuration UI and workspace connection flow
  - Implement Slack notification formatting for different trigger types
  - Write integration tests for Slack message delivery and formatting
  - _Requirements: 5.5, 7.5, 8.5_

- [x] 7.4 Build Google Sheets Integration Actions

  - Implement Google Sheets API client for reading from and writing to spreadsheets
  - Create Google Sheets action handlers for data logging and lead tracking
  - Add Google Sheets configuration UI with sheet selection and column mapping
  - Implement batch operations and error handling for sheet operations
  - Write integration tests for Google Sheets data operations
  - _Requirements: 5.6_

- [x] 8. Real-Time Analytics Dashboard

- [x] 8.1 Implement Supabase Realtime Subscriptions

  - Create useRealtimeAnalytics hook using Supabase JavaScript client subscriptions
  - Implement real-time listeners for Message, WorkflowExecution, and ConversationSession table changes
  - Create analytics data aggregation functions for conversation metrics and sentiment tracking
  - Add real-time chart components using recharts library (already installed)
  - Write tests for real-time data updates and chart rendering
  - _Requirements: 6.2, 6.3, 6.4_

- [x] 8.2 Build Analytics Metrics Calculation

  - Implement metrics calculation functions: Total Conversations, Average Sentiment, Resolution Rate, Automation Triggers
  - Create analytics API endpoints for historical data retrieval and trend analysis
  - Add filtering capabilities by date range, conversation type, and workflow performance
  - Implement caching for expensive analytics queries
  - Write tests for metrics accuracy and performance under load
  - _Requirements: 6.4, 6.5, 6.6_

- [x] 8.3 Create Live Analytics Dashboard UI

  - Build AnalyticsDashboard component with real-time updating charts and metrics
  - Implement dashboard layout with key performance indicators and trend visualizations
  - Add interactive filtering and drill-down capabilities for detailed analysis
  - Create export functionality for analytics reports
  - Write component tests for dashboard interactivity and data visualization
  - _Requirements: 6.1, 6.4, 6.6, 6.7_

- [x] 9. Session Management and External User Integration

- [x] 9.1 Implement External User and Session Management APIs

  - Create API endpoints for external user creation and management by email
  - Implement conversation session creation and retrieval for chat widget users
  - Add session-based conversation history and memory loading
  - Create session validation and cleanup for inactive sessions
  - Write tests for session lifecycle management and external user workflows
  - _Requirements: 1.1, 1.6, 2.5, 2.6_

- [x] 9.2 Integrate Session Management with Chat Widget

  - Update enhanced chat widget to use session-based conversations
  - Implement automatic session creation for new external users
  - Add session persistence across browser sessions using localStorage
  - Create session resumption functionality for returning users
  - Write integration tests for session-based chat flows
  - _Requirements: 1.2, 1.3, 1.5, 2.1, 2.2_

- [x] 10. Lead Qualification and Sales Automation

- [x] 10.1 Implement Intent Detection and Lead Scoring

  - Create IntentAnalyzer service to detect high-value keywords and phrases in conversations
  - Implement lead scoring algorithm based on conversation content, length, and engagement
  - Add lead qualification triggers for enterprise inquiries, demo requests, and bulk orders
  - Create lead data extraction from conversation context for CRM population
  - Write unit tests for intent detection accuracy and lead scoring consistency
  - _Requirements: 8.1, 8.6_

- [x] 10.2 Build Automated CRM Lead Creation

  - Implement automatic contact and deal creation in connected CRM systems
  - Create lead prioritization logic with urgency levels and assignment rules
  - Add sales team notification system for high-priority leads
  - Implement lead data validation and duplicate detection
  - Write integration tests for end-to-end lead qualification and CRM creation
  - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.7_

- [x] 11. Advanced Workflow Examples and Templates

- [x] 11.1 Implement Pre-built Automation Templates

  - Create workflow templates for common use cases: Auto-Return Approval, Lead Prioritization, Customer Support Escalation
  - Implement template import/export functionality for workflow sharing
  - Add template customization UI for adapting workflows to specific business needs
  - Create workflow marketplace or library for discovering automation patterns
  - Write tests for template functionality and customization capabilities
  - _Requirements: 3.3, 7.3, 7.4, 7.5, 8.2, 8.3, 8.5_

- [x] 11.2 Build Advanced Workflow Features

  - Implement conditional logic nodes for complex decision trees in workflows
  - Add delay and scheduling capabilities for time-based automation
  - Create workflow analytics and performance monitoring
  - Implement A/B testing framework for workflow optimization
  - Write tests for advanced workflow features and performance monitoring
  - _Requirements: 3.7, 3.8, 6.5_

- [ ] 12. Integration Testing and System Validation

- [ ] 12.1 Create End-to-End Integration Tests

  - Write comprehensive integration tests covering complete user journeys from chat to automation
  - Test multi-modal workflows including image upload, analysis, and automated actions
  - Validate real-time analytics updates during conversation and workflow execution
  - Test error handling and recovery scenarios across all system components
  - Implement performance testing for high-volume conversation and automation scenarios
  - _Requirements: All requirements validation_

- [ ] 12.2 Build System Monitoring and Health Checks
  - Implement health check endpoints for all services and integrations
  - Create monitoring dashboard for system performance and integration status
  - Add alerting system for critical failures and performance degradation
  - Implement automated testing pipeline for continuous integration validation
  - Write documentation for system monitoring and troubleshooting procedures
  - _Requirements: 5.7, 6.7, 7.7_
