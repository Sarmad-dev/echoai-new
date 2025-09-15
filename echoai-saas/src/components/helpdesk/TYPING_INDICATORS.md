# Typing Indicators System

This document explains the typing indicators system implemented for the helpdesk chat functionality.

## Overview

The typing indicators system provides real-time feedback when users are typing messages in conversations. It works for both agents (in the helpdesk interface) and customers (in chat widgets).

## Key Features

1. **Real-time typing indicators** using Supabase Realtime
2. **Automatic timeout** - typing indicators disappear after 3 seconds of inactivity
3. **Bidirectional support** - works for both agents and customers
4. **Conversation status awareness** - only shows when conversation is in `AWAITING_HUMAN_RESPONSE` status

## Components

### For Helpdesk (Agent Side)

- `useTypingIndicator` - Hook for managing typing state
- `TypingIndicator` - Component to display typing indicators
- `MessageInput` - Updated to send typing indicators
- `MessageHistory` - Updated to show customer typing

### For Chat Widgets (Customer Side)

- `useCustomerTypingIndicator` - Hook for customer-side typing
- `CustomerTypingIndicator` - Component for showing agent typing
- `ChatWidgetWithTyping` - Example implementation

## API Endpoints

### `/api/helpdesk/typing`

Handles typing indicator broadcasts for agents.

**Request:**
```json
{
  "conversationId": "string",
  "isTyping": boolean,
  "userType": "agent" | "customer"
}
```

**Response:**
```json
{
  "success": true,
  "conversationId": "string",
  "isTyping": boolean,
  "userType": "agent" | "customer"
}
```

## Conversation Status Handling

### When Status is `AWAITING_HUMAN_RESPONSE`

1. **Customer messages** are stored in the database but **no AI response is generated**
2. **Agent typing indicators** are shown to customers
3. **Customer typing indicators** are shown to agents
4. **AI remains silent** until conversation status changes

### Status Changes

- When agent **takes over**: Status changes to `AWAITING_HUMAN_RESPONSE`
- When agent **returns to AI**: Status changes to `AI_HANDLING`
- When conversation is **resolved**: Status changes to `RESOLVED`

## Usage Examples

### In Helpdesk Interface

```tsx
import { useTypingIndicator } from '@/hooks/use-typing-indicator'
import { TypingIndicator } from '@/components/helpdesk/typing-indicator'

function ChatInterface({ conversationId }) {
  const { startTyping, stopTyping, isCustomerTyping } = useTypingIndicator(
    conversationId,
    'agent'
  )

  return (
    <div>
      {/* Messages */}
      <TypingIndicator isVisible={isCustomerTyping} userType="customer" />
      
      {/* Input with typing detection */}
      <input 
        onChange={(e) => {
          if (e.target.value) startTyping()
          else stopTyping()
        }}
      />
    </div>
  )
}
```

### In Chat Widget

```tsx
import { useCustomerTypingIndicator } from '@/hooks/use-customer-typing-indicator'
import { CustomerTypingIndicator } from '@/components/customer-typing-indicator'

function ChatWidget({ conversationId, apiKey }) {
  const { startTyping, stopTyping, isAgentTyping } = useCustomerTypingIndicator(
    conversationId,
    apiKey
  )

  return (
    <div>
      {/* Messages */}
      <CustomerTypingIndicator isAgentTyping={isAgentTyping} />
      
      {/* Input */}
      <input 
        onChange={(e) => {
          if (e.target.value) startTyping()
          else stopTyping()
        }}
      />
    </div>
  )
}
```

## Realtime Channels

The system uses Supabase Realtime channels with the following naming convention:

- **Typing indicators**: `typing-{conversationId}`
- **Message updates**: `messages-{conversationId}`
- **Conversation updates**: `conversation-{conversationId}`

## Events

### Typing Events

- `typing_start` - User started typing
- `typing_stop` - User stopped typing

### Payload Structure

```json
{
  "conversationId": "string",
  "userId": "string",
  "userType": "agent" | "customer",
  "timestamp": "ISO string"
}
```

## Performance Considerations

1. **Auto-cleanup** - Old typing indicators are automatically removed after 10 seconds
2. **Debounced updates** - Typing indicators auto-stop after 3 seconds of inactivity
3. **Channel management** - Channels are properly cleaned up on component unmount
4. **Minimal payload** - Only essential data is broadcast

## Security

- Agent typing indicators require authentication (staff/admin roles)
- Customer typing indicators use broadcast channels (no authentication required)
- Conversation ID validation ensures users can only interact with valid conversations

## Integration with Existing Chat APIs

The system integrates seamlessly with existing chat APIs:

1. **Regular chat API** (`/api/chat`) - Checks conversation status before generating AI responses
2. **Enhanced chat API** (`/api/enhanced-chat`) - Same status checking logic
3. **Helpdesk message API** (`/api/helpdesk/message`) - Maintains `AWAITING_HUMAN_RESPONSE` status

## Troubleshooting

### Typing indicators not showing

1. Check Supabase Realtime connection
2. Verify conversation ID is correct
3. Ensure proper channel subscription
4. Check browser console for errors

### AI still responding when it shouldn't

1. Verify conversation status is `AWAITING_HUMAN_RESPONSE`
2. Check chat API status checking logic
3. Ensure database updates are working

### Performance issues

1. Check for memory leaks in channel subscriptions
2. Verify cleanup functions are running
3. Monitor Supabase Realtime usage