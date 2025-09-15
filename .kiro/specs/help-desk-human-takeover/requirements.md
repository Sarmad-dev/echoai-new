# Requirements Document

## Introduction

The Help Desk & Human Takeover feature enables business owners and their human support teams to monitor, manage, and directly respond to customer conversations happening through embedded AI chatbots. This "human-in-the-loop" system provides seamless escalation from AI to human agents while maintaining real-time communication with customers across multiple client websites.

## Requirements

### Requirement 1

**User Story:** As a business owner with staff/admin role, I want to access a dedicated help desk dashboard, so that I can monitor all customer conversations across embedded widgets in real-time.

#### Acceptance Criteria

1. WHEN a user with "staff" or "admin" role logs in THEN the system SHALL display a "Help Desk" link in the main navigation bar
2. WHEN a user with "user" role logs in THEN the system SHALL NOT display the "Help Desk" link
3. WHEN a staff/admin user clicks the Help Desk link THEN the system SHALL navigate to /helpdesk route
4. WHEN a user without staff/admin role attempts to access /helpdesk THEN the system SHALL redirect them to an unauthorized page

### Requirement 2

**User Story:** As a help desk agent, I want to view a real-time conversation inbox, so that I can see all ongoing and recent conversations with their current status and priority.

#### Acceptance Criteria

1. WHEN the help desk dashboard loads THEN the system SHALL display a data table with all conversations
2. WHEN a new message is sent in any conversation THEN the system SHALL update the conversation row in real-time using Supabase Realtime
3. WHEN displaying conversations THEN the system SHALL show conversation ID, customer email, website source, status, sentiment score, duration, and last message preview
4. WHEN a conversation receives a new message THEN the system SHALL highlight that row temporarily
5. WHEN an agent applies filters THEN the system SHALL filter conversations by status, sentiment, or assignee
6. WHEN an agent sorts columns THEN the system SHALL reorder conversations accordingly

### Requirement 3

**User Story:** As a help desk agent, I want to view detailed conversation history, so that I can understand the full context before responding to customers.

#### Acceptance Criteria

1. WHEN an agent clicks on a conversation in the inbox THEN the system SHALL open a detailed conversation view
2. WHEN the conversation detail view loads THEN the system SHALL display the complete message history with role differentiation
3. WHEN displaying messages THEN the system SHALL visually distinguish between user, assistant (AI), and agent (human) messages
4. WHEN new messages arrive THEN the system SHALL stream them into the conversation view in real-time
5. WHEN displaying customer context THEN the system SHALL show customer email, past conversation history, and AI-generated tags in a sidebar

### Requirement 4

**User Story:** As a help desk agent, I want to send messages directly to customers, so that I can provide personalized human support when needed.

#### Acceptance Criteria

1. WHEN an agent types a message in the input field THEN the system SHALL provide a text input area at the bottom of the conversation view
2. WHEN an agent sends a message THEN the system SHALL insert the message with role "agent" into the conversation
3. WHEN an agent sends a message THEN the system SHALL push the message to the customer's embedded widget in real-time
4. WHEN an agent sends their first message THEN the system SHALL automatically change conversation status to "AWAITING_HUMAN_RESPONSE"
5. WHEN an agent sends a message THEN the system SHALL assign the conversation to the current agent

### Requirement 5

**User Story:** As a help desk agent, I want to take over or return conversations to AI, so that I can control when human intervention is needed.

#### Acceptance Criteria

1. WHEN viewing a conversation with AI_HANDLING status THEN the system SHALL display a "Take Over" button
2. WHEN an agent clicks "Take Over" THEN the system SHALL change status to "AWAITING_HUMAN_RESPONSE" and assign to current agent
3. WHEN viewing a conversation with AWAITING_HUMAN_RESPONSE status THEN the system SHALL display a "Return to AI" button
4. WHEN an agent clicks "Return to AI" THEN the system SHALL change status back to "AI_HANDLING" and clear assignment
5. WHEN status changes occur THEN the system SHALL update the help desk inbox in real-time

### Requirement 6

**User Story:** As a system administrator, I want conversations to be automatically escalated to the help desk, so that high-priority issues receive immediate human attention.

#### Acceptance Criteria

1. WHEN the automation engine detects negative sentiment THEN the system SHALL change conversation status to "AWAITING_HUMAN_RESPONSE"
2. WHEN a conversation is escalated THEN the system SHALL add it to the help desk queue immediately
3. WHEN escalation triggers fire THEN the system SHALL update the conversation status in real-time across all interfaces
4. WHEN automation rules are configured THEN the system SHALL support multiple escalation triggers beyond sentiment analysis

### Requirement 7

**User Story:** As a customer using an embedded chat widget, I want to receive human responses seamlessly, so that I experience uninterrupted support regardless of whether AI or human is responding.

#### Acceptance Criteria

1. WHEN a human agent sends a message THEN the embedded widget SHALL receive and display it in real-time
2. WHEN displaying agent messages THEN the widget SHALL visually indicate they are from a human agent
3. WHEN conversation status changes THEN the widget SHALL continue functioning without interruption
4. WHEN receiving messages THEN the widget SHALL maintain the same interface regardless of message source

### Requirement 8

**User Story:** As a business owner, I want role-based access control, so that only authorized staff can access the help desk functionality.

#### Acceptance Criteria

1. WHEN a user account is created THEN the system SHALL assign a default role of "user"
2. WHEN checking help desk access THEN the system SHALL verify user role is "staff" or "admin"
3. WHEN unauthorized users attempt access THEN the system SHALL deny access to help desk routes
4. WHEN API endpoints are called THEN the system SHALL verify user role before processing help desk operations

### Requirement 9

**User Story:** As a help desk manager, I want to track conversation metadata, so that I can analyze support patterns and customer sources.

#### Acceptance Criteria

1. WHEN a conversation is created THEN the system SHALL capture customer email from embedded widget
2. WHEN a conversation is created THEN the system SHALL record the source website/URL
3. WHEN conversations are displayed THEN the system SHALL show which client website generated each conversation
4. WHEN storing conversation data THEN the system SHALL maintain timestamps for creation and updates
5. WHEN indexing conversations THEN the system SHALL optimize database queries for status and user filtering