# Implementation Plan

- [x] 1. Database Schema Updates and Migrations

  - Create Prisma migration to add `role` field to User model with default value "user"
  - Create Prisma migration to add `status`, `customerEmail`, `source`, and `assignedTo` fields to Conversation model
  - Create Prisma migration to add ConversationStatus enum with values AI_HANDLING, AWAITING_HUMAN_RESPONSE, RESOLVED
  - Update Message model to support 'agent' role in addition to 'user' and 'assistant'
  - Create database indexes for optimal help desk query performance
  - _Requirements: 8.1, 8.2, 9.1, 9.2, 9.5_

- [x] 2. Role-Based Access Control Implementation

  - [x] 2.1 Create middleware for role-based route protection

    - Implement middleware function to verify user roles for help desk access
    - Create route protection wrapper that checks for 'staff' or 'admin' roles
    - Add unauthorized access handling and redirect logic
    - _Requirements: 1.4, 8.3_

  - [x] 2.2 Update authentication context with role management
    - Extend auth context to include user role information
    - Create helper functions for role checking (isStaff, isAdmin)
    - Implement role-based UI component rendering logic
    - _Requirements: 1.1, 1.2, 8.1_

- [x] 3. Navigation Integration

  - [x] 3.1 Update dashboard navigation component

    - Add "Help Desk" navigation item to top navigation bar in top right corner
    - Implement conditional rendering based on user role (staff/admin only)
    - Add HeadphonesIcon or similar icon for help desk navigation
    - _Requirements: 1.1, 1.2_

  - [x] 3.2 Create help desk route structure
    - Create `/helpdesk` page route with role protection
    - Create `/helpdesk/conversation/[id]` dynamic route for conversation details
    - Implement route-level authorization checks
    - _Requirements: 1.3, 1.4_

- [x] 4. Help Desk Dashboard Implementation

  - [x] 4.1 Create conversation data table component

    - Build data table using shadcn/ui Table components
    - Implement columns for conversation ID, customer email, source, status, sentiment, duration, last message
    - Add sorting functionality for all columns
    - Create status badge component with color coding
    - _Requirements: 2.1, 2.3, 2.6_

  - [x] 4.2 Implement real-time conversation updates

    - Set up Supabase Realtime subscription for conversations table
    - Implement real-time row highlighting for new messages
    - Create subscription cleanup and error handling
    - Add connection status indicator for real-time features
    - _Requirements: 2.2, 2.4_

  - [x] 4.3 Add filtering and search functionality
    - Create filter controls for conversation status (AI_HANDLING, AWAITING_HUMAN_RESPONSE, RESOLVED)
    - Implement sentiment-based filtering (positive, negative, neutral)
    - Add assignee filtering for conversations assigned to specific agents
    - Create search functionality for customer email and message content
    - _Requirements: 2.5_

- [x] 5. Conversation Detail View Implementation

  - [x] 5.1 Create conversation detail page layout

    - Build conversation detail page with chat interface layout
    - Implement message history display with role-based styling
    - Create customer context sidebar with email, past conversations, and AI tags
    - Add conversation metadata display (status, duration, sentiment)
    - _Requirements: 3.1, 3.2, 3.5_

  - [x] 5.2 Implement message history with real-time updates

    - Create message display component with visual differentiation for user/assistant/agent roles
    - Set up Supabase Realtime subscription for messages table filtered by conversation ID
    - Implement auto-scroll to latest messages
    - Add message timestamps and delivery status indicators
    - _Requirements: 3.2, 3.3, 3.4_

  - [x] 5.3 Build human agent message input interface
    - Create message input component with text area and send button
    - Implement message validation and character limits
    - Add typing indicators and message status feedback
    - Create keyboard shortcuts for sending messages (Ctrl+Enter)
    - _Requirements: 4.1, 4.2_

- [x] 6. Human Takeover Controls Implementation

  - [x] 6.1 Create conversation status management buttons

    - Implement "Take Over" button that changes status to AWAITING_HUMAN_RESPONSE
    - Create "Return to AI" button that changes status back to AI_HANDLING
    - Add confirmation dialogs for status changes
    - Implement button state management based on current conversation status
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 6.2 Implement conversation assignment logic
    - Create automatic assignment when agent sends first message
    - Implement manual assignment functionality for supervisors
    - Add assignment clearing when returning conversation to AI
    - Create assignment history tracking
    - _Requirements: 4.5, 5.5_

- [x] 7. API Endpoints for Help Desk Operations

  - [x] 7.1 Create help desk message API endpoint

    - Implement POST /api/helpdesk/message endpoint for agent message sending
    - Add role verification middleware (staff/admin only)
    - Implement message insertion with 'agent' role
    - Add automatic conversation status update to AWAITING_HUMAN_RESPONSE
    - Create real-time message broadcasting to embedded widgets
    - _Requirements: 4.2, 4.3, 4.4_

  - [x] 7.2 Create conversation management API endpoints
    - Implement PATCH /api/helpdesk/conversation/[id]/status for status updates
    - Create GET /api/helpdesk/conversations endpoint with filtering and pagination
    - Add conversation assignment API endpoints
    - Implement conversation metadata update endpoints
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 8. Embedded Widget Integration

  - [x] 8.1 Update embedded widget for agent message support

    - Modify existing EnhancedChatWidget component to listen for messages with role 'agent' via Supabase Realtime
    - Implement visual differentiation for agent messages vs AI messages in widget UI
    - Add agent identification in message display (e.g., "Support Agent" label)
    - Ensure seamless message flow regardless of sender type in widget
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 8.2 Implement widget real-time message delivery
    - Extend existing Supabase Realtime connection in widget to handle agent messages
    - Add message type detection and appropriate rendering in widget
    - Implement message delivery confirmation in widget
    - Add error handling for failed message delivery in widget
    - _Requirements: 7.1, 7.4_

- [x] 9. Data Integration and API Improvements






  - [x] 9.1 Replace mock data with real API integration



    - Update help desk dashboard to fetch conversations from GET /api/helpdesk/conversations
    - Implement proper error handling and loading states for API calls
    - Add pagination support for large conversation datasets
    - Integrate real-time updates with actual database changes
    - _Requirements: 2.1, 2.2, 2.5_


  - [x] 9.2 Enhance conversation detail data loading

    - Update conversation detail page to use GET /api/helpdesk/conversation/[id]
    - Implement proper message loading and real-time message updates
    - Add error handling for conversation not found scenarios
    - Integrate status update buttons with PATCH /api/helpdesk/conversation/[id]/status
    - _Requirements: 3.1, 3.2, 5.1, 5.2_

- [x] 10. Automation Engine Integration








  - [x] 10.1 Create escalation trigger system




    - Implement sentiment-based escalation trigger for negative sentiment detection
    - Create conversation status update mechanism for automation triggers
    - Add escalation trigger configuration interface
    - Implement trigger logging and analytics
    - _Requirements: 6.1, 6.2_

  - [x] 10.2 Build automated conversation triage


    - Create automation rules for changing conversation status to AWAITING_HUMAN_RESPONSE
    - Implement priority queue management for escalated conversations
    - Add automatic notification system for new escalations
    - Create escalation reason tracking and reporting
    - _Requirements: 6.3, 6.4_

- [x] 11. Workflow Integration

  - [x] 11.1 Add escalation triggers to workflow trigger nodes

    - Create EscalationTrigger class implementing TriggerHandler interface
    - Add sentiment-based, keyword-based, and duration-based escalation evaluation
    - Register escalation trigger in TriggerRegistry with aliases
    - Update WorkflowTriggerMatcher to handle escalation trigger types
    - _Requirements: 6.1, 6.2_

  - [x] 11.2 Add conversation triage triggers to workflow trigger nodes

    - Create ConversationTriageTrigger class implementing TriggerHandler interface
    - Add high-priority sentiment, critical keywords, message count, and response time triage evaluation
    - Register triage trigger in TriggerRegistry with aliases
    - Update WorkflowTriggerMatcher to handle triage trigger types
    - _Requirements: 6.3, 6.4_

  - [x] 11.3 Create workflow integration manager

    - Build WorkflowIntegrationManager to bridge automation systems with workflow execution
    - Implement event processing for escalation and triage scenarios
    - Create convenience functions for message, sentiment, and timeout processing
    - Add integrated analytics combining escalation, triage, and workflow metrics
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 11.4 Update UI components for new trigger types

    - Add EscalationTriggerConfig and ConversationTriageConfig components to TriggerConfigForm
    - Update icon and color mappings in node palette components
    - Add trigger titles and descriptions for new trigger types
    - Create comprehensive configuration interfaces with sentiment thresholds, keywords, and conditions
    - Add new workflow template showcasing escalation and triage automation
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 12. Testing Implementation

  - [ ] 12.1 Expand unit tests for help desk components

    - Add comprehensive tests for conversation table component with real data scenarios
    - Create tests for message input component validation and submission
    - Implement tests for role-based navigation rendering and access control
    - Add tests for conversation status management buttons and state changes
    - _Requirements: All requirements validation_

  - [ ] 12.2 Implement integration tests for API endpoints
    - Expand existing basic tests to include full request/response validation
    - Write tests for help desk message API with role verification and database integration
    - Implement tests for conversation management API endpoints with real database operations
    - Add tests for real-time message delivery and status updates
    - _Requirements: All requirements validation_

- [ ] 13. Performance Optimization and Error Handling

  - [ ] 13.1 Implement database query optimization

    - Verify database indexes are properly created for conversation status and assignment queries
    - Optimize conversation list queries with proper JOIN strategies for message data
    - Implement efficient pagination for large conversation datasets
    - Add query performance monitoring and logging
    - _Requirements: 2.1, 2.5, 9.5_

  - [ ] 13.2 Add comprehensive error handling
    - Implement client-side error handling for real-time connection failures
    - Create server-side error handling for database operations
    - Add user-friendly error messages and retry mechanisms
    - Implement error logging and monitoring for help desk operations
    - _Requirements: All requirements robustness_

- [ ] 14. Final Integration and Testing

  - [ ] 14.1 End-to-end workflow testing

    - Test complete human takeover workflow from AI to agent and back
    - Verify real-time message delivery between agent and customer through embedded widget
    - Test automation escalation triggers and help desk notifications
    - Validate role-based access control across all help desk features
    - Test workflow integration with escalation and triage triggers
    - _Requirements: All requirements integration_

  - [ ] 14.2 Performance and load testing
    - Test help desk dashboard with multiple concurrent conversations
    - Verify real-time performance with multiple connected agents
    - Test database performance under high message volume
    - Validate system stability during peak usage scenarios
    - Test workflow execution performance with automation triggers
    - _Requirements: System performance and scalability_
