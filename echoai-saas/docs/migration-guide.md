# EchoAI Widget Migration Guide

## Overview

This guide helps you migrate from previous versions of the EchoAI widget to the Enhanced Widget v1.0.0.

## Migration Paths

### From Basic Widget (v0.x) to Enhanced Widget (v1.0.0)

#### Breaking Changes

1. **Initialization Method**
   ```javascript
   // Old (v0.x)
   window.EchoAIWidget.init({
       apiKey: 'your-key',
       botId: 'your-bot-id'
   });
   
   // New (v1.0.0)
   EchoAI.init({
       apiKey: 'your-key',
       chatbotId: 'your-bot-id', // Changed from 'botId'
       apiUrl: 'https://your-api-endpoint.com/api/enhanced-chat/widget'
   });
   ```

2. **API Method Names**
   ```javascript
   // Old
   window.EchoAIWidget.openChat();
   window.EchoAIWidget.closeChat();
   
   // New
   EchoAI.open();
   EchoAI.close();
   ```

3. **Event System**
   ```javascript
   // Old
   window.EchoAIWidget.onMessage = function(message) {
       console.log(message);
   };
   
   // New
   EchoAI.on('message-received', (message) => {
       console.log(message);
   });
   ```

#### New Features Available

- **Streaming Responses**: Real-time message streaming
- **Image Upload**: Support for image attachments
- **Conversation History**: Browse previous conversations
- **FAQ Integration**: Built-in FAQ system
- **Real-time Status**: Live conversation status updates
- **Enhanced UI**: Improved design and animations

#### Migration Steps

1. **Update Script Source**
   ```html
   <!-- Old -->
   <script src="https://cdn.echoai.com/widget/basic-widget.js"></script>
   
   <!-- New -->
   <script src="https://cdn.echoai.com/widget/enhanced-widget-latest.min.js"></script>
   ```

2. **Update Configuration**
   ```javascript
   // Update your initialization code
   EchoAI.init({
       apiKey: 'your-api-key',
       chatbotId: 'your-chatbot-id', // Note: changed from 'botId'
       apiUrl: 'https://your-api-endpoint.com/api/enhanced-chat/widget',
       
       // Optional: Configure new features
       enableStreaming: true,
       enableImageUpload: true,
       enableConversationHistory: true,
       enableFAQ: true
   });
   ```

3. **Update Event Handlers**
   ```javascript
   // Replace old event handlers
   EchoAI.on('ready', () => {
       console.log('Widget is ready');
   });
   
   EchoAI.on('message-received', (message) => {
       // Handle received messages
   });
   
   EchoAI.on('error', (error) => {
       // Handle errors
   });
   ```

4. **Update API Calls**
   ```javascript
   // Update method calls
   EchoAI.open();           // Instead of openChat()
   EchoAI.close();          // Instead of closeChat()
   EchoAI.sendMessage(msg); // Instead of send(msg)
   ```

### From Custom Implementation to Enhanced Widget

If you have a custom chat implementation, here's how to migrate:

#### Assessment Checklist

- [ ] Current API endpoints and authentication
- [ ] Custom UI components and styling
- [ ] Event handling and callbacks
- [ ] Third-party integrations
- [ ] Analytics and tracking

#### Migration Strategy

1. **Parallel Implementation**
   - Keep existing implementation running
   - Implement Enhanced Widget alongside
   - Gradually migrate users with feature flags

2. **Feature Mapping**
   ```javascript
   // Map your custom features to Enhanced Widget config
   EchoAI.init({
       // Basic config
       apiKey: 'your-api-key',
       chatbotId: 'your-chatbot-id',
       apiUrl: 'your-api-endpoint',
       
       // Map your custom theme
       theme: {
           primaryColor: '#your-brand-color',
           backgroundColor: '#your-bg-color',
           // ... other theme options
       },
       
       // Map your custom features
       features: {
           streaming: { enabled: true },
           imageUpload: { enabled: true },
           // ... other features
       },
       
       // Map your event handlers
       onMessage: (message) => {
           // Your existing message handling logic
       }
   });
   ```

3. **Data Migration**
   ```javascript
   // Migrate existing conversation data
   const existingConversations = getExistingConversations();
   
   EchoAI.on('ready', () => {
       // Import existing conversations if needed
       existingConversations.forEach(conversation => {
           EchoAI.importConversation(conversation);
       });
   });
   ```

## Version-Specific Migration

### v0.1.x to v1.0.0

#### Configuration Changes
```javascript
// v0.1.x
{
    botId: 'bot-123',
    endpoint: '/api/chat',
    theme: 'light'
}

// v1.0.0
{
    chatbotId: 'bot-123',
    apiUrl: 'https://api.example.com/api/enhanced-chat/widget',
    theme: 'light'
}
```

#### API Changes
```javascript
// v0.1.x
widget.send('Hello');
widget.onReceive = callback;

// v1.0.0
EchoAI.sendMessage('Hello');
EchoAI.on('message-received', callback);
```

### v0.2.x to v1.0.0

#### New Required Parameters
```javascript
EchoAI.init({
    apiKey: 'required-in-v1.0.0',
    chatbotId: 'your-chatbot-id',
    apiUrl: 'required-full-endpoint-url'
});
```

#### Deprecated Features
- `autoStart` option (use `autoOpen` instead)
- `customCSS` option (use `theme` object instead)
- Global callback functions (use event system instead)

## Testing Your Migration

### Pre-Migration Checklist

- [ ] Backup existing implementation
- [ ] Test Enhanced Widget in staging environment
- [ ] Verify all custom features work
- [ ] Check analytics and tracking
- [ ] Test on all supported browsers
- [ ] Validate mobile responsiveness

### Migration Testing

1. **Functionality Testing**
   ```javascript
   // Test basic functionality
   EchoAI.init({
       // Your config
       debug: true // Enable debug mode for testing
   });
   
   // Test all API methods
   EchoAI.open();
   EchoAI.sendMessage('Test message');
   EchoAI.close();
   ```

2. **Integration Testing**
   ```javascript
   // Test event integration
   let messageReceived = false;
   
   EchoAI.on('message-received', () => {
       messageReceived = true;
   });
   
   // Send test message and verify event fires
   ```

3. **Performance Testing**
   - Monitor bundle size impact
   - Test loading performance
   - Verify memory usage
   - Check for console errors

### Rollback Plan

If issues arise during migration:

1. **Immediate Rollback**
   ```html
   <!-- Switch back to old widget -->
   <script src="https://cdn.echoai.com/widget/basic-widget-v0.2.js"></script>
   ```

2. **Gradual Rollback**
   ```javascript
   // Use feature flags to control rollout
   if (featureFlags.useEnhancedWidget) {
       // Load Enhanced Widget
   } else {
       // Load old widget
   }
   ```

## Common Migration Issues

### Issue 1: Styling Conflicts

**Problem**: Enhanced Widget styles conflict with existing site styles.

**Solution**:
```css
/* Increase specificity for widget styles */
.echoai-widget {
    all: initial;
    font-family: inherit;
}

/* Or use CSS isolation */
.echoai-widget * {
    box-sizing: border-box;
}
```

### Issue 2: API Endpoint Changes

**Problem**: Old API endpoints not compatible.

**Solution**:
```javascript
// Create adapter for old API
const apiAdapter = {
    async sendMessage(message) {
        // Transform new format to old API format
        const oldFormat = transformToOldFormat(message);
        return await oldApiCall(oldFormat);
    }
};

EchoAI.init({
    // Use adapter
    apiAdapter: apiAdapter
});
```

### Issue 3: Event Handler Migration

**Problem**: Complex event handling logic needs migration.

**Solution**:
```javascript
// Create migration wrapper
class EventMigrationWrapper {
    constructor(oldHandlers) {
        this.oldHandlers = oldHandlers;
        this.setupNewHandlers();
    }
    
    setupNewHandlers() {
        EchoAI.on('message-received', (message) => {
            // Transform to old format and call old handler
            if (this.oldHandlers.onMessage) {
                this.oldHandlers.onMessage(transformMessage(message));
            }
        });
    }
}

// Use wrapper
const wrapper = new EventMigrationWrapper({
    onMessage: yourOldMessageHandler,
    onError: yourOldErrorHandler
});
```

## Post-Migration

### Monitoring

1. **Error Tracking**
   ```javascript
   EchoAI.on('error', (error) => {
       // Send to error tracking service
       errorTracker.captureException(error, {
           tags: { component: 'echoai-widget' }
       });
   });
   ```

2. **Performance Monitoring**
   ```javascript
   // Monitor widget performance
   EchoAI.on('ready', () => {
       performance.mark('echoai-widget-ready');
   });
   ```

3. **Usage Analytics**
   ```javascript
   EchoAI.on('message-sent', () => {
       analytics.track('widget_message_sent');
   });
   ```

### Optimization

1. **Bundle Size Optimization**
   - Use minified version in production
   - Consider lazy loading for better performance

2. **Caching Strategy**
   ```html
   <!-- Set appropriate cache headers -->
   <script src="https://cdn.echoai.com/widget/enhanced-widget-v1.0.0.min.js" 
           integrity="sha384-..." 
           crossorigin="anonymous"></script>
   ```

## Support

If you encounter issues during migration:

1. Check the [troubleshooting guide](./widget-integration-guide.md#troubleshooting)
2. Review [API documentation](./api-reference.md)
3. Contact support with migration details
4. Join our developer community for assistance

## Migration Timeline Recommendations

### Phase 1: Preparation (Week 1)
- Review current implementation
- Test Enhanced Widget in development
- Plan migration strategy

### Phase 2: Staging Migration (Week 2)
- Implement Enhanced Widget in staging
- Conduct thorough testing
- Train team on new features

### Phase 3: Production Rollout (Week 3-4)
- Gradual rollout with feature flags
- Monitor performance and errors
- Collect user feedback

### Phase 4: Cleanup (Week 5)
- Remove old widget code
- Update documentation
- Optimize configuration