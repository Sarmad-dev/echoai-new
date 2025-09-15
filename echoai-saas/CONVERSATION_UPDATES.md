# Conversation Updates: Customer Email & Chat History

This document outlines the updates made to ensure proper storage and retrieval of customer conversations.

## 🔄 **Changes Made**

### 1. **Updated Chat Request Schema**
- Added `userEmail` field to `chatRequestSchema` in `/src/lib/api-validation.ts`
- Now accepts optional email parameter for customer identification

### 2. **Enhanced Conversation Storage**

#### **Regular Chat API** (`/src/app/api/chat/route.ts`)
- Updated `storeConversation()` function to accept `customerEmail` parameter
- When creating new conversations, `customerEmail` is now stored in the database
- Added logic to update existing conversations with `customerEmail` if missing

#### **Enhanced Chat API** (`/src/app/api/enhanced-chat/route.ts`)
- Updated `storeEnhancedConversation()` function to include `customerEmail`
- Enhanced chat API already had `userEmail` in schema, now properly stores it
- Added fallback logic to update conversations with missing `customerEmail`

### 3. **Improved Chat History API** (`/src/app/api/chat/history/route.ts`)

#### **Multiple Search Strategies**
```typescript
// Now searches by both customerEmail and externalUserId
conversationsQuery = conversationsQuery.or(
  `customerEmail.eq.${userEmail},externalUserId.eq.${userEmail}`
);
```

#### **Enhanced ChatBot Filtering**
- Properly filters conversations by `chatbotId` when provided
- Added logging for better debugging

#### **Better Error Handling**
- Comprehensive logging for debugging
- Shows sample database content when no conversations found
- Detailed error responses

### 4. **Database Schema Updates**

#### **Conversation Table Fields Used**
- `customerEmail` - Stores the customer's email address
- `chatbotId` - Links conversation to specific chatbot
- `externalUserId` - Alternative user identification
- `userId` - Internal user ID

## 🚀 **Usage Examples**

### **Creating Conversations with Customer Email**

#### **Frontend Chat Widget**
```javascript
// When sending a message from chat widget
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "Hello, I need help",
    apiKey: "your-api-key",
    chatbotId: "your-chatbot-id",
    userEmail: "customer@example.com"  // ← Now stored in customerEmail
  })
});
```

#### **Enhanced Chat API**
```javascript
const response = await fetch('/api/enhanced-chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "I have a question",
    apiKey: "your-api-key",
    chatbotId: "your-chatbot-id",
    userEmail: "customer@example.com",  // ← Properly stored
    enableEnhancedFeatures: true
  })
});
```

### **Retrieving Chat History**

#### **Basic History Retrieval**
```javascript
// Get all conversations for a user
const history = await fetch(
  `/api/chat/history?userEmail=customer@example.com`
);
```

#### **Filtered by Chatbot**
```javascript
// Get conversations for specific chatbot
const history = await fetch(
  `/api/chat/history?userEmail=customer@example.com&chatbotId=your-chatbot-id`
);
```

#### **With Search and Pagination**
```javascript
const history = await fetch(
  `/api/chat/history?userEmail=customer@example.com&chatbotId=your-chatbot-id&search=login&limit=10&offset=0`
);
```

## 🔧 **Testing**

### **Test Conversation Creation**
```bash
curl -X POST http://localhost:3000/api/test/conversation-creation \
  -H "Content-Type: application/json" \
  -d '{
    "userEmail": "test@example.com",
    "chatbotId": "your-chatbot-id",
    "message": "Test message"
  }'
```

### **Test History Retrieval**
```bash
curl "http://localhost:3000/api/chat/history?userEmail=test@example.com&chatbotId=your-chatbot-id"
```

### **Debug Database Content**
```bash
curl "http://localhost:3000/api/debug/conversations?userEmail=test@example.com"
```

## 📊 **Database Flow**

### **New Conversation Creation**
1. User sends message via chat widget with `userEmail`
2. API checks if conversation exists
3. If new conversation:
   - Creates `Conversation` record with `customerEmail` = `userEmail`
   - Creates `Message` record with user's message
   - Generates AI response and creates assistant `Message`

### **History Retrieval**
1. Frontend requests history with `userEmail` and optional `chatbotId`
2. API searches conversations by:
   - `customerEmail = userEmail` (primary method)
   - `externalUserId = userEmail` (fallback)
3. Filters by `chatbotId` if provided
4. Returns conversation list with message counts and previews

## 🐛 **Debugging**

### **Common Issues**

#### **No Conversations Found**
- Check if `userEmail` matches `customerEmail` in database
- Verify `chatbotId` filter is correct
- Use debug endpoint to see actual database content

#### **Wrong Chatbot Conversations**
- Ensure `chatbotId` is passed correctly from frontend
- Check database for correct `chatbotId` values

#### **Missing Customer Email**
- Older conversations might not have `customerEmail`
- API will attempt to update them when user sends new messages

### **Debug Endpoints**
- `/api/debug/conversations?userEmail=email` - Shows database content
- `/api/debug/supabase-test` - Tests Supabase connection
- `/api/test/conversation-creation` - Creates test conversation

## 🔄 **Migration Notes**

### **Existing Conversations**
- Older conversations without `customerEmail` will be updated when:
  - User sends new message with `userEmail`
  - Conversation status changes to `AWAITING_HUMAN_RESPONSE`

### **Frontend Updates Required**
- Chat widgets should pass `userEmail` in requests
- History components should pass `chatbotId` for filtering
- Error handling should account for new response formats

## ✅ **Verification Checklist**

- [ ] Chat API stores `customerEmail` when creating conversations
- [ ] Enhanced Chat API stores `customerEmail` properly
- [ ] History API finds conversations by `customerEmail`
- [ ] ChatBot filtering works correctly
- [ ] Search functionality works across conversations
- [ ] Pagination works properly
- [ ] Error handling provides useful debugging info
- [ ] Existing conversations get updated with missing `customerEmail`

## 🚀 **Next Steps**

1. **Test with real data** - Use debug endpoints to verify data flow
2. **Update frontend** - Ensure chat widgets pass `userEmail`
3. **Monitor logs** - Check console output for debugging info
4. **Performance optimization** - Add database indexes if needed
5. **Clean up debug endpoints** - Remove test endpoints in production