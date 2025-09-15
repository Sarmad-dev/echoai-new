# EchoAI Enhanced Widget Integration Guide

## Overview

The EchoAI Enhanced Widget provides a complete conversational AI interface with advanced features including real-time streaming, image uploads, conversation history, FAQ management, and intelligent conversation routing.

## Quick Start

### CDN Integration (Recommended)

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Website</title>
</head>
<body>
    <!-- Your website content -->
    
    <!-- EchoAI Widget -->
    <script src="https://cdn.echoai.com/widget/enhanced-widget-latest.min.js"></script>
    <script>
        EchoAI.init({
            apiKey: 'your-api-key',
            chatbotId: 'your-chatbot-id',
            apiUrl: 'https://your-api-endpoint.com/api/enhanced-chat/widget'
        });
    </script>
</body>
</html>
```

### Self-Hosted Integration

```html
<script src="/path/to/enhanced-widget.min.js"></script>
<script>
    EchoAI.init({
        apiKey: 'your-api-key',
        chatbotId: 'your-chatbot-id',
        apiUrl: 'https://your-api-endpoint.com/api/enhanced-chat/widget'
    });
</script>
```

## Configuration Options

### Basic Configuration

```javascript
EchoAI.init({
    // Required
    apiKey: 'your-api-key',
    chatbotId: 'your-chatbot-id',
    apiUrl: 'https://your-api-endpoint.com/api/enhanced-chat/widget',
    
    // Optional
    theme: 'light', // 'light' | 'dark' | 'auto'
    position: 'bottom-right', // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
    autoOpen: false,
    showBranding: true,
    enableStreaming: true,
    enableImageUpload: true,
    enableConversationHistory: true,
    enableFAQ: true,
    enableRealtime: true
});
```

### Advanced Configuration

```javascript
EchoAI.init({
    apiKey: 'your-api-key',
    chatbotId: 'your-chatbot-id',
    apiUrl: 'https://your-api-endpoint.com/api/enhanced-chat/widget',
    
    // UI Customization
    theme: {
        primaryColor: '#007bff',
        backgroundColor: '#ffffff',
        textColor: '#333333',
        borderRadius: '8px',
        fontFamily: 'Inter, sans-serif'
    },
    
    // Feature Configuration
    features: {
        streaming: {
            enabled: true,
            showTypingIndicator: true,
            chunkDelay: 50
        },
        imageUpload: {
            enabled: true,
            maxFileSize: 10 * 1024 * 1024, // 10MB
            allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        },
        conversationHistory: {
            enabled: true,
            maxItems: 50,
            enableSearch: true
        },
        faq: {
            enabled: true,
            showInSidebar: true,
            enableAnalytics: true
        },
        realtime: {
            enabled: true,
            heartbeatInterval: 30000,
            reconnectAttempts: 10
        }
    },
    
    // Event Handlers
    onReady: () => console.log('Widget ready'),
    onOpen: () => console.log('Widget opened'),
    onClose: () => console.log('Widget closed'),
    onMessage: (message) => console.log('New message:', message),
    onError: (error) => console.error('Widget error:', error)
});
```

## API Methods

### Widget Control

```javascript
// Open the widget
EchoAI.open();

// Close the widget
EchoAI.close();

// Toggle widget visibility
EchoAI.toggle();

// Check if widget is open
const isOpen = EchoAI.isOpen();

// Destroy the widget
EchoAI.destroy();
```

### Messaging

```javascript
// Send a message programmatically
EchoAI.sendMessage('Hello, how can I help?');

// Send a message with image
EchoAI.sendMessage('What is this?', { imageUrl: 'https://example.com/image.jpg' });

// Clear conversation
EchoAI.clearConversation();

// Get conversation history
const history = EchoAI.getConversationHistory();
```

### User Management

```javascript
// Set user information
EchoAI.setUser({
    id: 'user-123',
    name: 'John Doe',
    email: 'john@example.com',
    avatar: 'https://example.com/avatar.jpg'
});

// Get current user
const user = EchoAI.getUser();

// Clear user data
EchoAI.clearUser();
```

## Event System

### Available Events

```javascript
// Widget lifecycle events
EchoAI.on('ready', () => {});
EchoAI.on('open', () => {});
EchoAI.on('close', () => {});
EchoAI.on('destroy', () => {});

// Message events
EchoAI.on('message-sent', (message) => {});
EchoAI.on('message-received', (message) => {});
EchoAI.on('typing-start', () => {});
EchoAI.on('typing-stop', () => {});

// Streaming events
EchoAI.on('stream-start', () => {});
EchoAI.on('stream-token', (token) => {});
EchoAI.on('stream-complete', () => {});
EchoAI.on('stream-error', (error) => {});

// Connection events
EchoAI.on('connected', () => {});
EchoAI.on('disconnected', () => {});
EchoAI.on('reconnecting', () => {});

// Error events
EchoAI.on('error', (error) => {});
```

### Event Usage Example

```javascript
EchoAI.on('message-received', (message) => {
    // Track message analytics
    analytics.track('chat_message_received', {
        messageId: message.id,
        timestamp: message.timestamp,
        hasImage: !!message.imageUrl
    });
});

EchoAI.on('error', (error) => {
    // Log errors to monitoring service
    console.error('EchoAI Widget Error:', error);
    errorReporting.captureException(error);
});
```

## Styling and Customization

### CSS Custom Properties

```css
:root {
    --echoai-primary-color: #007bff;
    --echoai-background-color: #ffffff;
    --echoai-text-color: #333333;
    --echoai-border-color: #e0e0e0;
    --echoai-border-radius: 8px;
    --echoai-font-family: 'Inter', sans-serif;
    --echoai-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
```

### Custom CSS Classes

```css
/* Widget container */
.echoai-widget {
    /* Your custom styles */
}

/* Chat messages */
.echoai-message-user {
    /* User message styles */
}

.echoai-message-agent {
    /* Agent message styles */
}

/* Input area */
.echoai-input-container {
    /* Input container styles */
}

/* Buttons */
.echoai-button-primary {
    /* Primary button styles */
}
```

## Advanced Features

### Image Upload Configuration

```javascript
EchoAI.init({
    // ... other config
    features: {
        imageUpload: {
            enabled: true,
            maxFileSize: 10 * 1024 * 1024, // 10MB
            allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            compressionQuality: 0.8,
            maxWidth: 1920,
            maxHeight: 1080,
            onUploadStart: (file) => console.log('Upload started:', file.name),
            onUploadProgress: (progress) => console.log('Upload progress:', progress),
            onUploadComplete: (result) => console.log('Upload complete:', result),
            onUploadError: (error) => console.error('Upload error:', error)
        }
    }
});
```

### Conversation History

```javascript
// Load conversation history
EchoAI.loadConversationHistory({
    page: 1,
    limit: 20,
    search: 'search term'
}).then(history => {
    console.log('Loaded history:', history);
});

// Load specific conversation
EchoAI.loadConversation('conversation-id').then(conversation => {
    console.log('Loaded conversation:', conversation);
});
```

### FAQ Integration

```javascript
// Load FAQs
EchoAI.loadFAQs().then(faqs => {
    console.log('Available FAQs:', faqs);
});

// Track FAQ usage
EchoAI.on('faq-clicked', (faq) => {
    console.log('FAQ clicked:', faq.question);
});
```

### Real-time Features

```javascript
// Listen for real-time events
EchoAI.on('conversation-status-changed', (status) => {
    console.log('Conversation status:', status);
    
    if (status === 'AWAITING_HUMAN_RESPONSE') {
        // Show human agent indicator
    }
});

EchoAI.on('agent-typing', () => {
    // Show typing indicator
});

EchoAI.on('agent-stopped-typing', () => {
    // Hide typing indicator
});
```

## Security Considerations

### API Key Management

- Never expose your API key in client-side code for production
- Use environment variables or secure configuration management
- Consider implementing a proxy endpoint for additional security

### Content Security Policy

```html
<meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    script-src 'self' https://cdn.echoai.com;
    connect-src 'self' https://your-api-endpoint.com wss://your-websocket-endpoint.com;
    img-src 'self' data: https:;
    style-src 'self' 'unsafe-inline';
">
```

### CORS Configuration

Ensure your API endpoints are configured to accept requests from your domain:

```javascript
// Express.js example
app.use(cors({
    origin: ['https://yourdomain.com', 'https://www.yourdomain.com'],
    credentials: true
}));
```

## Performance Optimization

### Lazy Loading

```javascript
// Load widget only when needed
function loadEchoAIWidget() {
    const script = document.createElement('script');
    script.src = 'https://cdn.echoai.com/widget/enhanced-widget-latest.min.js';
    script.onload = () => {
        EchoAI.init({
            // Your configuration
        });
    };
    document.head.appendChild(script);
}

// Load on user interaction
document.getElementById('chat-button').addEventListener('click', loadEchoAIWidget);
```

### Preloading

```html
<!-- Preload the widget script -->
<link rel="preload" href="https://cdn.echoai.com/widget/enhanced-widget-latest.min.js" as="script">
```

## Troubleshooting

### Common Issues

1. **Widget not loading**
   - Check console for JavaScript errors
   - Verify API key and chatbot ID
   - Ensure API endpoint is accessible

2. **Styling conflicts**
   - Use CSS specificity or !important declarations
   - Check for conflicting CSS frameworks

3. **Connection issues**
   - Verify WebSocket/SSE endpoint accessibility
   - Check firewall and proxy settings
   - Monitor network requests in browser dev tools

### Debug Mode

```javascript
EchoAI.init({
    // ... other config
    debug: true, // Enable debug logging
    logLevel: 'verbose' // 'error' | 'warn' | 'info' | 'debug' | 'verbose'
});
```

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
- Mobile browsers (iOS Safari 12+, Chrome Mobile 60+)

## Migration Guide

See [Migration Guide](./migration-guide.md) for upgrading from previous widget versions.

## Examples

See the [examples directory](./examples/) for complete integration examples with popular frameworks and platforms.