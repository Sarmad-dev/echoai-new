# Help Desk API Endpoints

This document describes the Help Desk API endpoints implemented for the human takeover feature.

## Authentication & Authorization

All endpoints require:
- Valid user authentication (JWT token)
- User role of `staff` or `admin`

Unauthorized requests will receive:
- `401` - Authentication required
- `403` - Insufficient permissions (user role)

## Endpoints

### 1. Send Agent Message

**POST** `/api/helpdesk/message`

Send a message from a human agent to a customer conversation.

#### Request Body
```json
{
  "conversationId": "string",
  "content": "string (1-2000 characters)"
}
```

#### Response
```json
{
  "success": true,
  "message": {
    "id": "string",
    "conversationId": "string", 
    "content": "string",
    "role": "agent",
    "createdAt": "ISO date string"
  },
  "conversationStatus": "AWAITING_HUMAN_RESPONSE"
}
```

#### Behavior
- Inserts message with role `agent`
- Automatically updates conversation status to `AWAITING_HUMAN_RESPONSE`
- Assigns conversation to current agent
- Broadcasts message via Supabase Realtime to embedded widgets

---

### 2. Get Conversations

**GET** `/api/helpdesk/conversations`

Retrieve filtered and paginated list of conversations for help desk dashboard.

#### Query Parameters
- `status` (optional): `AI_HANDLING` | `AWAITING_HUMAN_RESPONSE` | `RESOLVED`
- `assignedTo` (optional): User ID of assigned agent
- `customerEmail` (optional): Filter by customer email (partial match)
- `source` (optional): Filter by source website (partial match)
- `search` (optional): Search in customer email and source
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (1-100, default: 20)
- `sortBy` (optional): `createdAt` | `updatedAt` | `customerEmail` | `status` (default: `updatedAt`)
- `sortOrder` (optional): `asc` | `desc` (default: `desc`)

#### Response
```json
{
  "conversations": [
    {
      "id": "string",
      "userId": "string",
      "customerEmail": "string",
      "source": "string",
      "status": "ConversationStatus",
      "assignedTo": "string | null",
      "createdAt": "ISO date string",
      "updatedAt": "ISO date string",
      "messageCount": "number",
      "lastMessage": {
        "content": "string (truncated to 100 chars)",
        "role": "string",
        "createdAt": "ISO date string"
      },
      "sentimentScore": "number (-1.00 to 1.00)",
      "duration": "number (minutes)"
    }
  ],
  "totalCount": "number",
  "page": "number",
  "limit": "number", 
  "hasMore": "boolean"
}
```

---

### 3. Update Conversation Status

**PATCH** `/api/helpdesk/conversation/{id}/status`

Update the status of a conversation and handle assignment logic.

#### Request Body
```json
{
  "status": "AI_HANDLING | AWAITING_HUMAN_RESPONSE | RESOLVED",
  "assignedTo": "string | null (optional)"
}
```

#### Response
```json
{
  "success": true,
  "conversation": {
    "id": "string",
    "status": "ConversationStatus",
    "assignedTo": "string | null",
    "updatedAt": "ISO date string"
  }
}
```

#### Behavior
- `AWAITING_HUMAN_RESPONSE`: Auto-assigns to current user if not specified
- `AI_HANDLING`: Clears assignment
- `RESOLVED`: Keeps current assignment or uses provided value
- Broadcasts status change via Supabase Realtime

---

### 4. Assign Conversation

**PATCH** `/api/helpdesk/conversation/{id}/assign`

Assign or reassign a conversation to an agent.

#### Request Body
```json
{
  "assignedTo": "string | null (optional)"
}
```

#### Response
```json
{
  "success": true,
  "conversation": {
    "id": "string",
    "assignedTo": "string | null",
    "updatedAt": "ISO date string"
  }
}
```

#### Behavior
- If `assignedTo` not provided, assigns to current user
- Broadcasts assignment change via Supabase Realtime

---

### 5. Get Conversation Details

**GET** `/api/helpdesk/conversation/{id}`

Retrieve detailed information about a specific conversation.

#### Response
```json
{
  "id": "string",
  "userId": "string",
  "customerEmail": "string",
  "source": "string", 
  "status": "ConversationStatus",
  "assignedTo": "string | null",
  "createdAt": "ISO date string",
  "updatedAt": "ISO date string"
}
```

---

### 6. Update Conversation Metadata

**PATCH** `/api/helpdesk/conversation/{id}`

Update conversation metadata fields.

#### Request Body
```json
{
  "customerEmail": "string (optional)",
  "source": "string (optional)",
  "status": "ConversationStatus (optional)",
  "assignedTo": "string | null (optional)"
}
```

#### Response
```json
{
  "id": "string",
  "userId": "string", 
  "customerEmail": "string",
  "source": "string",
  "status": "ConversationStatus",
  "assignedTo": "string | null",
  "createdAt": "ISO date string",
  "updatedAt": "ISO date string"
}
```

#### Behavior
- Handles assignment logic based on status changes
- Broadcasts updates via Supabase Realtime

## Error Responses

### Validation Error (400)
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "string",
      "message": "string"
    }
  ]
}
```

### Not Found (404)
```json
{
  "error": "Conversation not found"
}
```

### Server Error (500)
```json
{
  "error": "Internal server error"
}
```

## Real-time Integration

All conversation and message changes are automatically broadcast via Supabase Realtime:

- **Message Table**: New agent messages broadcast to embedded widgets
- **Conversation Table**: Status and assignment changes broadcast to help desk clients

Embedded widgets listen for messages with `role: 'agent'` and display them seamlessly alongside AI responses.

## Implementation Notes

- Uses `withRoleProtection` middleware for consistent role-based access control
- Includes comprehensive input validation with Zod schemas
- Handles Supabase type inference issues with proper type assertions
- Implements proper error handling and logging
- Supports CORS for cross-origin requests
- Includes OPTIONS handlers for preflight requests

## Testing

Basic API structure and validation tests are included in:
`src/app/api/helpdesk/__tests__/helpdesk-api.test.ts`

Run tests with:
```bash
npm run test -- src/app/api/helpdesk/__tests__/helpdesk-api.test.ts --run
```