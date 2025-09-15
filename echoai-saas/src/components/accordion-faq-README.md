# Accordion FAQ Component

A responsive, feature-rich FAQ component with accordion-style expansion, real-time search, category filtering, and analytics tracking.

## Features

- ✅ **Responsive accordion interface** with smooth animations
- ✅ **Real-time search and filtering** functionality
- ✅ **Category-based organization** with filter buttons
- ✅ **Multiple item expansion** support
- ✅ **Chat widget integration** for seamless conversation starting
- ✅ **FAQ popularity tracking** and analytics
- ✅ **Customizable styling** to match chatbot theme and branding
- ✅ **Empty state handling** with fallback options
- ✅ **Accessibility compliant** with proper ARIA attributes

## Usage

### Basic Usage

```tsx
import { AccordionFAQ } from '@/components/accordion-faq';

const faqs = [
  {
    id: '1',
    question: 'How do I get started?',
    answer: 'Getting started is easy! Just follow these steps...',
    category: 'Getting Started',
    tags: ['setup', 'onboarding'],
    popularity: 10,
  },
  // ... more FAQs
];

function MyComponent() {
  return (
    <AccordionFAQ
      faqs={faqs}
      chatbotId="my-chatbot-id"
      onFAQSelect={(faq) => console.log('FAQ selected:', faq)}
      onStartChat={() => console.log('Start chat')}
    />
  );
}
```

### Advanced Configuration

```tsx
<AccordionFAQ
  faqs={faqs}
  chatbotId="my-chatbot-id"
  searchable={true}
  categorized={true}
  allowMultipleOpen={true}
  onFAQSelect={handleFAQSelect}
  onStartChat={handleStartChat}
  primaryColor="#10b981"
  maxHeight="500px"
  showPopularity={true}
  enableChatIntegration={true}
  className="custom-faq-styles"
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `faqs` | `FAQ[]` | **Required** | Array of FAQ objects |
| `chatbotId` | `string` | `undefined` | Chatbot ID for analytics tracking |
| `searchable` | `boolean` | `true` | Enable/disable search functionality |
| `categorized` | `boolean` | `true` | Enable/disable category filtering |
| `allowMultipleOpen` | `boolean` | `true` | Allow multiple accordion items to be open |
| `onFAQSelect` | `(faq: FAQ) => void` | `undefined` | Callback when FAQ is selected |
| `onStartChat` | `() => void` | `undefined` | Callback to start chat conversation |
| `primaryColor` | `string` | `"#3b82f6"` | Primary color for theming |
| `className` | `string` | `undefined` | Additional CSS classes |
| `maxHeight` | `string` | `"400px"` | Maximum height of the FAQ container |
| `showPopularity` | `boolean` | `true` | Show popularity indicators |
| `enableChatIntegration` | `boolean` | `true` | Enable chat integration features |

## FAQ Object Structure

```typescript
interface FAQ {
  id: string;
  question: string;
  answer: string;
  category?: string;
  tags?: string[];
  popularity?: number;
  lastUpdated?: Date;
}
```

## Analytics Integration

The component automatically tracks user interactions when `chatbotId` is provided:

- **Click events**: When users click "Ask about this" button
- **View events**: When accordion items are expanded
- **Search events**: When users perform searches

Analytics data is sent to `/api/faq/analytics` endpoint.

## Styling and Theming

The component uses the `primaryColor` prop to theme various elements:

- Category filter buttons
- Accordion trigger text
- FAQ category badges
- Chat integration buttons
- Border colors

## Accessibility

The component includes proper accessibility features:

- ARIA attributes for accordion behavior
- Keyboard navigation support
- Screen reader friendly content
- Focus management
- Semantic HTML structure

## Empty State

When no FAQs are provided, the component shows:

- Helpful empty state message
- Optional "Start a Chat Instead" button
- Customizable empty state content

## Search and Filtering

### Search Features
- Real-time search as you type
- Searches across questions, answers, and tags
- Case-insensitive matching
- Debounced input for performance

### Category Filtering
- Automatic category extraction from FAQ data
- Filter buttons for each category
- "All" button to clear category filter
- Combined search and category filtering

### Filter Management
- Clear filters button when active
- Result count display
- No results state with clear option

## Performance Optimizations

- Memoized filtering and grouping logic
- Debounced search input
- Efficient re-rendering with React hooks
- Lazy loading of analytics requests

## Integration with Chat Widget

The component seamlessly integrates with the enhanced chat widget:

- FAQ selection triggers chat conversation
- Consistent theming with chat widget
- Shared analytics tracking
- Responsive design for widget constraints

## Testing

Comprehensive test suite covers:

- Component rendering
- Search functionality
- Category filtering
- Accordion behavior
- Analytics tracking
- Empty states
- User interactions

Run tests with:
```bash
npm test -- accordion-faq.test.tsx
```

## Demo

View the component demo at `/demo/accordion-faq` to see all features in action.

## API Endpoints

### FAQ Analytics Tracking

**POST** `/api/faq/analytics`
```json
{
  "faqId": "string",
  "chatbotId": "string", 
  "action": "click|view|search",
  "sessionId": "string?",
  "metadata": "object?"
}
```

**GET** `/api/faq/analytics?chatbotId=string&timeframe=7d`
Returns aggregated analytics data for the specified timeframe.

## Database Schema

The component requires these database tables:

```sql
-- Enhanced FAQ table with analytics fields
ALTER TABLE "FAQ" ADD COLUMN "popularity" INTEGER DEFAULT 0;
ALTER TABLE "FAQ" ADD COLUMN "tags" TEXT[];
ALTER TABLE "FAQ" ADD COLUMN "lastUpdated" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- FAQ analytics tracking table
CREATE TABLE "FAQAnalytics" (
    "id" TEXT NOT NULL,
    "faqId" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userAgent" TEXT,
    "sessionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FAQAnalytics_pkey" PRIMARY KEY ("id")
);
```

## Migration

To add the accordion FAQ component to an existing project:

1. Install dependencies: `npm install @radix-ui/react-accordion`
2. Add the accordion UI component
3. Apply database migrations
4. Update FAQ API endpoints
5. Replace existing FAQ implementation

## Browser Support

- Modern browsers with ES2017+ support
- CSS Grid and Flexbox support required
- JavaScript enabled for full functionality