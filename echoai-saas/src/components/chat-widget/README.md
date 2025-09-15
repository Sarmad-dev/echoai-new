# Chat Widget Component

A fully-featured, customizable chat widget component for the EchoAI SaaS platform. This component provides a complete chat interface with theme support, real-time messaging, and comprehensive error handling.

## Features

### Core Functionality
- ✅ **Message Display**: Clean, responsive message bubbles with proper styling
- ✅ **Real-time Messaging**: Async message sending with loading states
- ✅ **State Management**: Proper conversation and message state handling
- ✅ **Auto-scroll**: Automatic scrolling to new messages
- ✅ **Keyboard Support**: Enter key to send messages

### Theme & Customization
- ✅ **Custom Primary Color**: Applies user's brand color throughout the widget
- ✅ **Dark Mode Detection**: Automatically detects browser/device dark mode preference
- ✅ **Theme Persistence**: Respects stored theme preferences from main application
- ✅ **Contrast-aware Text**: Automatically calculates appropriate text colors for accessibility

### User Experience
- ✅ **Minimized/Expanded States**: Starts minimized, expands on click
- ✅ **Welcome Message**: Shows customizable welcome message when opened
- ✅ **Loading States**: Visual feedback during message processing
- ✅ **Error Handling**: Graceful error display and recovery
- ✅ **Sentiment Analysis**: Displays message sentiment when available

### Accessibility
- ✅ **Keyboard Navigation**: Full keyboard support
- ✅ **Screen Reader Support**: Proper ARIA labels and semantic HTML
- ✅ **Color Contrast**: Automatic contrast calculation for text readability
- ✅ **Focus Management**: Proper focus handling when widget opens/closes

## Usage

### Basic Usage

```tsx
import { ChatWidget } from '@/components/chat-widget'

const settings = {
  chatbotName: "EchoAI Assistant",
  welcomeMessage: "Hello! How can I help you today?",
  primaryColor: "#3B82F6"
}

function MyApp() {
  return (
    <ChatWidget
      apiKey="your-api-key"
      settings={settings}
      onError={(error) => console.error('Chat error:', error)}
    />
  )
}
```

### Advanced Usage with Custom Styling

```tsx
import { ChatWidget } from '@/components/chat-widget'

const customSettings = {
  chatbotName: "My Custom Bot",
  welcomeMessage: "Welcome to our support chat!",
  primaryColor: "#10B981" // Custom green color
}

function MyApp() {
  const handleChatError = (error: string) => {
    // Custom error handling
    console.error('Chat widget error:', error)
    // Could send to error tracking service
  }

  return (
    <ChatWidget
      apiKey="your-api-key"
      settings={customSettings}
      className="custom-chat-widget"
      onError={handleChatError}
    />
  )
}
```

## Props

### ChatWidgetProps

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `apiKey` | `string` | ✅ | User's unique API key for authentication |
| `settings` | `UserSettings` | ✅ | Customization settings for the widget |
| `className` | `string` | ❌ | Additional CSS classes for the widget container |
| `onError` | `(error: string) => void` | ❌ | Callback function for error handling |

### UserSettings

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `chatbotName` | `string` | ✅ | - | Display name for the chatbot |
| `welcomeMessage` | `string` | ✅ | - | Initial message shown when widget opens |
| `primaryColor` | `string` | ✅ | - | Hex color code for branding (e.g., "#3B82F6") |

### ChatMessage

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique identifier for the message |
| `content` | `string` | Message text content |
| `role` | `'user' \| 'assistant'` | Who sent the message |
| `timestamp` | `Date` | When the message was created |
| `sentiment` | `'positive' \| 'negative' \| 'neutral'` | Optional sentiment analysis result |

## API Integration

The widget expects a `/api/chat` endpoint that accepts:

```typescript
interface ChatRequest {
  message: string
  apiKey: string
  conversationId?: string
}
```

And returns:

```typescript
interface ChatResponse {
  response: string
  sentiment: 'positive' | 'negative' | 'neutral'
  conversationId: string
}
```

## Styling

### CSS Custom Properties

The widget generates CSS custom properties for theming:

```css
:root {
  --chat-primary: #3B82F6;
  --chat-primary-rgb: 59, 130, 246;
  --chat-primary-hover: #2563EB;
  --chat-primary-light: #60A5FA;
  --chat-text-color: #ffffff;
}
```

### Custom Styling

You can override styles using CSS classes:

```css
.custom-chat-widget {
  /* Custom positioning */
  bottom: 20px;
  right: 20px;
}

.custom-chat-widget .chat-message {
  /* Custom message styling */
  border-radius: 12px;
}
```

## Hooks

The component uses several custom hooks for functionality:

### useChat

Manages chat state and API communication:

```typescript
const {
  messages,
  isLoading,
  error,
  sendMessage,
  clearMessages,
  addWelcomeMessage
} = useChat({ apiKey, onError })
```

### useThemeDetection

Detects and responds to theme changes:

```typescript
const { isDarkMode, isSystemTheme } = useThemeDetection()
```

## Testing

The component includes comprehensive tests:

- **Unit Tests**: Component rendering and interaction
- **Hook Tests**: Custom hook functionality
- **Integration Tests**: API communication
- **Accessibility Tests**: Keyboard navigation and screen readers

Run tests with:

```bash
npm test chat-widget
```

## Performance Considerations

- **Lazy Loading**: Component only loads when needed
- **Memoization**: Expensive calculations are memoized
- **Efficient Re-renders**: State updates are optimized
- **Memory Management**: Event listeners are properly cleaned up

## Browser Support

- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile**: iOS Safari 14+, Chrome Mobile 90+
- **Features**: CSS Grid, Flexbox, CSS Custom Properties, ES2020

## Accessibility

The widget follows WCAG 2.1 AA guidelines:

- **Keyboard Navigation**: Tab, Enter, Escape keys
- **Screen Readers**: Proper ARIA labels and roles
- **Color Contrast**: Minimum 4.5:1 contrast ratio
- **Focus Management**: Visible focus indicators

## Troubleshooting

### Common Issues

1. **Widget not appearing**: Check that the API key is valid
2. **Messages not sending**: Verify the `/api/chat` endpoint is working
3. **Styling issues**: Ensure CSS custom properties are supported
4. **Theme not applying**: Check localStorage for theme preferences

### Debug Mode

Enable debug logging:

```typescript
<ChatWidget
  apiKey="your-api-key"
  settings={settings}
  onError={(error) => {
    console.error('Chat Widget Error:', error)
    // Add additional debugging here
  }}
/>
```

## Contributing

When contributing to the chat widget:

1. **Follow TypeScript**: Maintain strict type safety
2. **Add Tests**: Include tests for new features
3. **Update Documentation**: Keep this README current
4. **Accessibility**: Ensure new features are accessible
5. **Performance**: Consider performance impact of changes

## Related Components

- **Dashboard Components**: For admin interface
- **Theme Provider**: For global theme management
- **UI Components**: shadcn/ui component library