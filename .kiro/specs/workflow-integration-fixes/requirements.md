# Requirements Document

## Introduction

This specification addresses critical integration issues in the EchoAI automation platform. The current implementation has workflow services using in-memory storage instead of Supabase, missing chatbot associations, unused workflow execution functionality, and disconnected event services between frontend and backend. This spec will establish proper database persistence, complete the workflow execution pipeline, and integrate the event service across the full stack.

## Requirements

### Requirement 1: Database-Backed Workflow Persistence

**User Story:** As a business owner, I want my automation workflows to be permanently stored in the database and associated with specific chatbots, so that my workflows persist across system restarts and are properly organized by chatbot.

#### Acceptance Criteria

1. WHEN creating a workflow THEN the system SHALL save it to Supabase using the Supabase client instead of in-memory storage
2. WHEN saving a workflow THEN the system SHALL include a required chatbotId field to associate workflows with specific chatbots
3. WHEN updating a workflow THEN the system SHALL persist changes to the Supabase database
4. WHEN loading workflows THEN the system SHALL retrieve them from Supabase filtered by chatbotId and userId
5. WHEN deleting a workflow THEN the system SHALL remove it from the Supabase database
6. WHEN listing workflows THEN the system SHALL support pagination and filtering using database queries
7. IF database operations fail THEN the system SHALL provide proper error handling and user feedback

### Requirement 2: Complete Workflow Execution Integration

**User Story:** As a business owner, I want my visual automation workflows to actually execute when triggered by chatbot events, so that my business processes are automated as designed.

#### Acceptance Criteria

1. WHEN a conversation starts THEN the system SHALL check for "New Conversation" trigger workflows and execute them
2. WHEN sentiment analysis detects negative sentiment THEN the system SHALL execute associated sentiment trigger workflows
3. WHEN an image is uploaded THEN the system SHALL execute image upload trigger workflows
4. WHEN specific intents are detected THEN the system SHALL execute intent-based trigger workflows
5. WHEN workflow execution completes THEN the system SHALL log results and update conversation metadata
6. WHEN workflow actions execute THEN the system SHALL perform actual integrations (Slack, HubSpot, etc.)
7. IF workflow execution fails THEN the system SHALL implement retry logic and error notifications

### Requirement 3: Event Service Integration Across Stack

**User Story:** As a system administrator, I want the FastAPI event service to be properly connected to the frontend workflow system, so that events flow seamlessly from backend detection to frontend workflow execution.

#### Acceptance Criteria

1. WHEN the FastAPI service detects conversation events THEN it SHALL emit events using the event service
2. WHEN events are emitted THEN the frontend workflow service SHALL receive and process them
3. WHEN processing events THEN the system SHALL match them against active workflow triggers
4. WHEN trigger matches are found THEN the system SHALL execute the associated workflows
5. WHEN sentiment analysis completes THEN the backend SHALL emit sentiment events to trigger workflows
6. WHEN image analysis completes THEN the backend SHALL emit image events with analysis results
7. IF event processing fails THEN the system SHALL implement proper error handling and retry mechanisms

### Requirement 4: Chatbot-Scoped Workflow Management

**User Story:** As a business owner with multiple chatbots, I want workflows to be isolated per chatbot, so that automation rules for my support bot don't interfere with my sales bot.

#### Acceptance Criteria

1. WHEN creating workflows THEN the system SHALL require a chatbotId parameter
2. WHEN listing workflows THEN the system SHALL filter by the current chatbot context
3. WHEN executing workflows THEN the system SHALL only consider workflows associated with the triggering chatbot
4. WHEN displaying the automation dashboard THEN the system SHALL show workflows for the selected chatbot only
5. WHEN copying workflows THEN the system SHALL allow duplication across different chatbots
6. WHEN deleting a chatbot THEN the system SHALL handle associated workflow cleanup
7. IF a workflow references a non-existent chatbot THEN the system SHALL prevent execution and log warnings

### Requirement 5: Real-Time Event Processing Pipeline

**User Story:** As a customer service manager, I want automation workflows to execute immediately when events occur, so that customer issues are addressed in real-time.

#### Acceptance Criteria

1. WHEN chat messages are processed THEN the system SHALL emit events in real-time
2. WHEN events are emitted THEN the workflow engine SHALL process them within 1 second
3. WHEN multiple workflows match an event THEN the system SHALL execute them concurrently
4. WHEN workflow execution is in progress THEN the system SHALL provide status updates
5. WHEN workflows complete THEN the system SHALL update the conversation with results
6. WHEN high-priority events occur THEN the system SHALL prioritize their processing
7. IF the event queue becomes backlogged THEN the system SHALL implement proper queuing and scaling

### Requirement 6: Workflow Execution Monitoring and Logging

**User Story:** As a business owner, I want to see detailed logs of when my workflows execute and their results, so that I can troubleshoot issues and measure automation effectiveness.

#### Acceptance Criteria

1. WHEN workflows execute THEN the system SHALL log execution start, steps, and completion
2. WHEN workflow actions complete THEN the system SHALL record success/failure status and any outputs
3. WHEN viewing workflow history THEN the system SHALL display execution logs with timestamps
4. WHEN errors occur THEN the system SHALL capture detailed error information and stack traces
5. WHEN workflows are triggered THEN the system SHALL record the triggering event details
6. WHEN displaying analytics THEN the system SHALL show workflow execution metrics and success rates
7. IF logging fails THEN the system SHALL continue workflow execution and attempt to log errors separately

### Requirement 7: Database Schema Updates for Workflow Storage

**User Story:** As a developer, I want the database schema to properly support workflow storage with chatbot associations, so that the data model supports all workflow functionality.

#### Acceptance Criteria

1. WHEN defining the workflow table THEN it SHALL include fields for id, name, description, chatbotId, userId, flowDefinition, stateMachine, isActive, createdAt, updatedAt
2. WHEN creating foreign key relationships THEN the workflow table SHALL reference the chatbot and user tables
3. WHEN storing flowDefinition THEN the system SHALL use JSON type to store the React Flow graph data
4. WHEN storing stateMachine THEN the system SHALL use JSON type to store the compiled XState definition
5. WHEN creating indexes THEN the system SHALL optimize queries by chatbotId and userId
6. WHEN migrating existing data THEN the system SHALL handle the transition from in-memory to database storage
7. IF schema changes are required THEN the system SHALL provide proper migration scripts