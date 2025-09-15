# Help Desk Schema Updates Migration

## Overview
This migration adds the necessary database schema changes to support the Help Desk & Human Takeover feature.

## Changes Made

### 1. User Model Extensions
- Added `role` field with enum type `UserRole` (user, staff, admin)
- Default value set to 'user' for all existing and new users
- Enables role-based access control for help desk functionality

### 2. Conversation Model Extensions
- Added `status` field with enum type `ConversationStatus` (AI_HANDLING, AWAITING_HUMAN_RESPONSE, RESOLVED)
- Added `customerEmail` field to track customer contact information
- Added `source` field to track which website/widget generated the conversation
- Added `assignedTo` field to track which human agent is handling the conversation
- Default status set to 'AI_HANDLING' for all conversations

### 3. Message Model Updates
- Updated role field comment to include 'agent' role support
- Added database indexes for optimal help desk query performance

### 4. Database Indexes
Added the following indexes for optimal help desk query performance:
- `Conversation_status_idx` - For filtering conversations by status
- `Conversation_assignedTo_idx` - For filtering conversations by assigned agent
- `Conversation_status_assignedTo_idx` - Composite index for status and assignment queries
- `Conversation_customerEmail_idx` - For searching conversations by customer email
- `Message_conversationId_idx` - For efficient message retrieval by conversation
- `Message_role_idx` - For filtering messages by role (user/assistant/agent)
- `Message_createdAt_idx` - For chronological message ordering

## Requirements Addressed
- 8.1: Role-based access control with user roles
- 8.2: Help desk route protection based on user roles
- 9.1: Conversation metadata tracking (customer email, source)
- 9.2: Source website tracking for conversations
- 9.5: Database query optimization with proper indexing

## Migration Files
- `012_help_desk_schema_updates.sql` - Forward migration
- `012_help_desk_schema_updates_rollback.sql` - Rollback migration

## Usage
To apply this migration:
```bash
# Apply the migration
psql -d your_database -f 012_help_desk_schema_updates.sql

# To rollback if needed
psql -d your_database -f 012_help_desk_schema_updates_rollback.sql
```

## Testing
After applying this migration, verify:
1. All existing users have role 'user'
2. All existing conversations have status 'AI_HANDLING'
3. New conversations can be created with help desk fields
4. Indexes are properly created and improve query performance
5. Role-based queries work correctly