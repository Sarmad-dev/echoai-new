"use client";

import { useState, useEffect } from "react";
import { Copy, Check, Code, Eye, Settings, Zap, MessageSquare, Users, AlertTriangle, Brain, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ChatbotSelector } from "./chatbot-selector";
import type { ChatbotData } from "@/types/api";

interface EmbedConfig {
  position: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  theme: "light" | "dark" | "auto";
  userEmail: string;
  showBranding: boolean;
  // Enhanced features
  enableEnhancedFeatures: boolean;
  enableImageUpload: boolean;
  enableFAQ: boolean;
  enableHistory: boolean;
  // Streaming configuration
  streamingEnabled: boolean;
  typingSpeed: number;
  showTypingIndicator: boolean;
  enableTokenAnimation: boolean;
  // Intelligence configuration
  showProactiveQuestions: boolean;
  showSuggestedTopics: boolean;
  showConversationActions: boolean;
  showIntelligenceMetrics: boolean;
  // Lead collection configuration
  enableLeadCollection: boolean;
  collectEmail: boolean;
  collectPhone: boolean;
  collectCompany: boolean;
  progressiveCollection: boolean;
  // Escalation configuration
  enableEscalation: boolean;
  showEscalationButton: boolean;
  escalationThreshold: number;
  humanAgentAvailable: boolean;
  // Performance optimization
  enableCaching: boolean;
  enableCompression: boolean;
  lazyLoading: boolean;
  // Cross-browser compatibility
  enablePolyfills: boolean;
  fallbackMode: "basic" | "enhanced" | "auto";
}

interface ChatbotEmbedGeneratorProps {
  chatbot?: ChatbotData | null;
}

export function ChatbotEmbedGenerator({ chatbot }: ChatbotEmbedGeneratorProps) {
  const [selectedChatbot, setSelectedChatbot] = useState<ChatbotData | null>(
    chatbot || null
  );
  const [embedConfig, setEmbedConfig] = useState<EmbedConfig>({
    position: "bottom-right",
    theme: "auto",
    userEmail: 'preview@example.com',
    showBranding: true,
    // Enhanced features - enabled by default for better experience
    enableEnhancedFeatures: true,
    enableImageUpload: true,
    enableFAQ: true,
    enableHistory: true,
    // Streaming configuration
    streamingEnabled: true,
    typingSpeed: 25,
    showTypingIndicator: true,
    enableTokenAnimation: true,
    // Intelligence configuration
    showProactiveQuestions: true,
    showSuggestedTopics: true,
    showConversationActions: true,
    showIntelligenceMetrics: false, // Advanced feature, disabled by default
    // Lead collection configuration
    enableLeadCollection: true,
    collectEmail: true,
    collectPhone: false,
    collectCompany: true,
    progressiveCollection: true,
    // Escalation configuration
    enableEscalation: true,
    showEscalationButton: true,
    escalationThreshold: 0.7,
    humanAgentAvailable: true,
    // Performance optimization
    enableCaching: true,
    enableCompression: true,
    lazyLoading: true,
    // Cross-browser compatibility
    enablePolyfills: true,
    fallbackMode: "auto",
  });
  const [copied, setCopied] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">(
    "desktop"
  );

  // Update selectedChatbot when prop changes
  useEffect(() => {
    if (chatbot) {
      setSelectedChatbot(chatbot);
    }
  }, [chatbot]);

  const generateEmbedCode = () => {
    if (!selectedChatbot) return "";

    const config = {
      chatbotId: selectedChatbot.id,
      apiKey: selectedChatbot.apiKey,
      userEmail: embedConfig.userEmail,
      // Embedded settings as fallback
      chatbotName: selectedChatbot.name,
      welcomeMessage: selectedChatbot.welcomeMessage,
      primaryColor: selectedChatbot.primaryColor,
      // Widget configuration
      position: embedConfig.position,
      theme: embedConfig.theme,
      showBranding: embedConfig.showBranding,
      // Enhanced features configuration
      enableEnhancedFeatures: embedConfig.enableEnhancedFeatures,
      enableImageUpload: embedConfig.enableImageUpload,
      enableFAQ: embedConfig.enableFAQ,
      enableHistory: embedConfig.enableHistory,
      // Streaming configuration
      streamingConfig: {
        enabled: embedConfig.streamingEnabled,
        typingSpeed: embedConfig.typingSpeed,
        showTypingIndicator: embedConfig.showTypingIndicator,
        enableTokenAnimation: embedConfig.enableTokenAnimation,
      },
      // Intelligence configuration
      intelligenceConfig: {
        enabled: embedConfig.enableEnhancedFeatures,
        showProactiveQuestions: embedConfig.showProactiveQuestions,
        showSuggestedTopics: embedConfig.showSuggestedTopics,
        showConversationActions: embedConfig.showConversationActions,
        showIntelligenceMetrics: embedConfig.showIntelligenceMetrics,
      },
      // Lead collection configuration
      leadCollectionConfig: {
        enabled: embedConfig.enableLeadCollection,
        collectEmail: embedConfig.collectEmail,
        collectPhone: embedConfig.collectPhone,
        collectCompany: embedConfig.collectCompany,
        progressiveCollection: embedConfig.progressiveCollection,
      },
      // Escalation configuration
      escalationConfig: {
        enabled: embedConfig.enableEscalation,
        showEscalationButton: embedConfig.showEscalationButton,
        escalationThreshold: embedConfig.escalationThreshold,
        humanAgentAvailable: embedConfig.humanAgentAvailable,
      },
      // Performance optimization
      performanceConfig: {
        enableCaching: embedConfig.enableCaching,
        enableCompression: embedConfig.enableCompression,
        lazyLoading: embedConfig.lazyLoading,
      },
      // Cross-browser compatibility
      compatibilityConfig: {
        enablePolyfills: embedConfig.enablePolyfills,
        fallbackMode: embedConfig.fallbackMode,
      },
      // API URLs - use enhanced endpoints when enhanced features are enabled
      apiUrl: typeof window !== "undefined" 
        ? `${window.location.origin}/api/${embedConfig.enableEnhancedFeatures ? 'enhanced-chat/widget' : 'chat'}`
        : `https://your-domain.com/api/${embedConfig.enableEnhancedFeatures ? 'enhanced-chat/widget' : 'chat'}`,
    };

    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://your-domain.com";

    const widgetScript = embedConfig.enableEnhancedFeatures ? 'enhanced-widget.js' : 'widget.js';

    return `<!-- EchoAI Enhanced Chatbot Widget -->
<div id="echoai-chatbot"></div>
<script>
  (function() {
    window.EchoAIConfig = ${JSON.stringify(config, null, 4)};
    
    // Performance optimization: Preload critical resources
    ${embedConfig.enableCaching ? `
    // Enable caching for better performance
    if ('serviceWorker' in navigator && window.EchoAIConfig.performanceConfig.enableCaching) {
      navigator.serviceWorker.register('https://echoai-pi.vercel.app/sw-echoai.js').catch(function(err) {
        console.log('EchoAI: Service worker registration failed:', err);
      });
    }` : ''}
    
    // Cross-browser compatibility checks
    function checkBrowserSupport() {
      const isModernBrowser = 'fetch' in window && 'Promise' in window && 'Map' in window;
      
      if (!isModernBrowser && window.EchoAIConfig.compatibilityConfig.enablePolyfills) {
        // Load polyfills for older browsers
        const polyfillScript = document.createElement('script');
        polyfillScript.src = 'https://echoai-pi.vercel.app/polyfills.js';
        polyfillScript.onload = loadEchoAI;
        document.head.appendChild(polyfillScript);
        return false;
      }
      
      return true;
    }
    
    // Create and inject the enhanced chat widget
    function loadEchoAI() {
      const script = document.createElement('script');
      script.src = 'https://echoai-pi.vercel.app/${widgetScript}';
      script.async = true;
      
      ${embedConfig.lazyLoading ? `
      // Lazy loading: Only load when user is likely to interact
      const observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            document.head.appendChild(script);
            observer.disconnect();
          }
        });
      });
      
      const trigger = document.createElement('div');
      trigger.style.cssText = 'position:fixed;bottom:0;right:0;width:100px;height:100px;pointer-events:none;';
      document.body.appendChild(trigger);
      observer.observe(trigger);` : `
      document.head.appendChild(script);`}
      
      script.onload = function() {
        if (window.EchoAI) {
          window.EchoAI.init(window.EchoAIConfig);
        }
      };
      
      script.onerror = function() {
        console.error('EchoAI: Failed to load widget script');
        // Fallback to basic widget if enhanced fails
        if (window.EchoAIConfig.compatibilityConfig.fallbackMode !== 'enhanced') {
          const fallbackScript = document.createElement('script');
          fallbackScript.src = 'https://echoai-pi.vercel.app/widget.js';
          fallbackScript.async = true;
          fallbackScript.onload = function() {
            if (window.EchoAI) {
              window.EchoAI.init(window.EchoAIConfig);
            }
          };
          document.head.appendChild(fallbackScript);
        }
      };
    }
    
    // Initialize based on browser support and loading strategy
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        if (checkBrowserSupport()) {
          loadEchoAI();
        }
      });
    } else {
      if (checkBrowserSupport()) {
        loadEchoAI();
      }
    }
  })();
</script>
<!-- End EchoAI Enhanced Chatbot Widget -->`;
  };

  const generateTypeScriptCode = () => {
    if (!selectedChatbot) return "";

    return `import React from 'react';
import { EnhancedChatWidget, type EnhancedChatWidgetProps } from '@/components/enhanced-chat-widget';

interface ChatbotSettings {
  chatbotName: string;
  welcomeMessage: string;
  primaryColor: string;
}

interface StreamingConfig {
  enabled: boolean;
  typingSpeed: number;
  showTypingIndicator: boolean;
  enableTokenAnimation: boolean;
}

interface IntelligenceConfig {
  enabled: boolean;
  showProactiveQuestions: boolean;
  showSuggestedTopics: boolean;
  showConversationActions: boolean;
  showIntelligenceMetrics: boolean;
}

interface LeadCollectionConfig {
  enabled: boolean;
  collectEmail: boolean;
  collectPhone: boolean;
  collectCompany: boolean;
  progressiveCollection: boolean;
}

interface EscalationConfig {
  enabled: boolean;
  showEscalationButton: boolean;
  escalationThreshold: number;
  humanAgentAvailable: boolean;
}

const App: React.FC = () => {
  const chatbotSettings: ChatbotSettings = {
    chatbotName: "${selectedChatbot.name}",
    welcomeMessage: "${selectedChatbot.welcomeMessage}",
    primaryColor: "${selectedChatbot.primaryColor}"
  };

  const streamingConfig: StreamingConfig = {
    enabled: ${embedConfig.streamingEnabled},
    typingSpeed: ${embedConfig.typingSpeed},
    showTypingIndicator: ${embedConfig.showTypingIndicator},
    enableTokenAnimation: ${embedConfig.enableTokenAnimation}
  };

  const intelligenceConfig: IntelligenceConfig = {
    enabled: ${embedConfig.enableEnhancedFeatures},
    showProactiveQuestions: ${embedConfig.showProactiveQuestions},
    showSuggestedTopics: ${embedConfig.showSuggestedTopics},
    showConversationActions: ${embedConfig.showConversationActions},
    showIntelligenceMetrics: ${embedConfig.showIntelligenceMetrics}
  };

  const leadCollectionConfig: LeadCollectionConfig = {
    enabled: ${embedConfig.enableLeadCollection},
    collectEmail: ${embedConfig.collectEmail},
    collectPhone: ${embedConfig.collectPhone},
    collectCompany: ${embedConfig.collectCompany},
    progressiveCollection: ${embedConfig.progressiveCollection}
  };

  const escalationConfig: EscalationConfig = {
    enabled: ${embedConfig.enableEscalation},
    showEscalationButton: ${embedConfig.showEscalationButton},
    escalationThreshold: ${embedConfig.escalationThreshold},
    humanAgentAvailable: ${embedConfig.humanAgentAvailable}
  };

  const handleLeadCollected = (leadData: Record<string, any>): void => {
    console.log('Lead collected:', leadData);
    // Handle lead data (send to CRM, analytics, etc.)
  };

  const handleEscalationRequested = (escalationData: Record<string, any>): void => {
    console.log('Escalation requested:', escalationData);
    // Handle escalation (notify agents, create ticket, etc.)
  };

  const handleError = (error: string): void => {
    console.error('Chat widget error:', error);
    // Handle errors (logging, user notification, etc.)
  };

  return (
    <div>
      {/* Your app content */}
      
      <EnhancedChatWidget
        apiKey="${selectedChatbot.apiKey}"
        chatbotId="${selectedChatbot.id}"
        settings={chatbotSettings}
        className="!fixed !${embedConfig.position.includes('bottom') ? 'bottom-4' : 'top-4'} !${embedConfig.position.includes('right') ? 'right-4' : 'left-4'}"
        enableImageUpload={${embedConfig.enableImageUpload}}
        enableFAQ={${embedConfig.enableFAQ}}
        enableHistory={${embedConfig.enableHistory}}
        enableEnhancedFeatures={${embedConfig.enableEnhancedFeatures}}
        streamingConfig={streamingConfig}
        intelligenceConfig={intelligenceConfig}
        leadCollectionConfig={leadCollectionConfig}
        escalationConfig={escalationConfig}
        onLeadCollected={handleLeadCollected}
        onEscalationRequested={handleEscalationRequested}
        onError={handleError}
        userEmail="user@example.com" // Replace with actual user email
      />
    </div>
  );
};

export default App;`;
  };

  const generateConfigurationGuide = () => {
    if (!selectedChatbot) return "";

    return `# EchoAI Enhanced Chatbot Configuration Guide

## Basic Configuration

\`\`\`javascript
const config = {
  chatbotId: "${selectedChatbot.id}",
  apiKey: "${selectedChatbot.apiKey}",
  position: "${embedConfig.position}",
  theme: "${embedConfig.theme}",
  showBranding: ${embedConfig.showBranding}
};
\`\`\`

## Enhanced Features

### Streaming Configuration
- **Enabled**: ${embedConfig.streamingEnabled ? 'Yes' : 'No'}
- **Typing Speed**: ${embedConfig.typingSpeed}ms per token
- **Typing Indicator**: ${embedConfig.showTypingIndicator ? 'Enabled' : 'Disabled'}
- **Token Animation**: ${embedConfig.enableTokenAnimation ? 'Enabled' : 'Disabled'}

### Intelligence Features
- **Proactive Questions**: ${embedConfig.showProactiveQuestions ? 'Enabled' : 'Disabled'}
- **Suggested Topics**: ${embedConfig.showSuggestedTopics ? 'Enabled' : 'Disabled'}
- **Conversation Actions**: ${embedConfig.showConversationActions ? 'Enabled' : 'Disabled'}
- **Intelligence Metrics**: ${embedConfig.showIntelligenceMetrics ? 'Enabled' : 'Disabled'}

### Lead Collection
- **Enabled**: ${embedConfig.enableLeadCollection ? 'Yes' : 'No'}
- **Collect Email**: ${embedConfig.collectEmail ? 'Yes' : 'No'}
- **Collect Phone**: ${embedConfig.collectPhone ? 'Yes' : 'No'}
- **Collect Company**: ${embedConfig.collectCompany ? 'Yes' : 'No'}
- **Progressive Collection**: ${embedConfig.progressiveCollection ? 'Yes' : 'No'}

### Escalation Management
- **Enabled**: ${embedConfig.enableEscalation ? 'Yes' : 'No'}
- **Escalation Button**: ${embedConfig.showEscalationButton ? 'Visible' : 'Hidden'}
- **Escalation Threshold**: ${Math.round(embedConfig.escalationThreshold * 100)}%
- **Human Agent Available**: ${embedConfig.humanAgentAvailable ? 'Yes' : 'No'}

### Performance Optimization
- **Caching**: ${embedConfig.enableCaching ? 'Enabled' : 'Disabled'}
- **Compression**: ${embedConfig.enableCompression ? 'Enabled' : 'Disabled'}
- **Lazy Loading**: ${embedConfig.lazyLoading ? 'Enabled' : 'Disabled'}
- **Polyfills**: ${embedConfig.enablePolyfills ? 'Enabled' : 'Disabled'}
- **Fallback Mode**: ${embedConfig.fallbackMode}

## Integration Examples

### WordPress
\`\`\`php
// Add to your theme's functions.php
function add_echoai_chatbot() {
    ?>
    <!-- EchoAI Enhanced Chatbot Widget -->
    <div id="echoai-chatbot"></div>
    <script>
      // Your configuration here
    </script>
    <?php
}
add_action('wp_footer', 'add_echoai_chatbot');
\`\`\`

### Shopify
\`\`\`liquid
<!-- Add to theme.liquid before </body> -->
<!-- EchoAI Enhanced Chatbot Widget -->
<div id="echoai-chatbot"></div>
<script>
  // Your configuration here
</script>
\`\`\`

### Custom HTML
\`\`\`html
<!DOCTYPE html>
<html>
<head>
    <title>Your Website</title>
</head>
<body>
    <!-- Your content -->
    
    <!-- EchoAI Enhanced Chatbot Widget -->
    <div id="echoai-chatbot"></div>
    <script>
      // Your configuration here
    </script>
</body>
</html>
\`\`\`

## Event Handling

### Lead Collection Events
\`\`\`javascript
window.EchoAIConfig.onLeadCollected = function(leadData) {
    // Send to your CRM
    console.log('New lead:', leadData);
    
    // Example: Send to Google Analytics
    gtag('event', 'lead_collected', {
        'event_category': 'chatbot',
        'event_label': leadData.email
    });
};
\`\`\`

### Escalation Events
\`\`\`javascript
window.EchoAIConfig.onEscalationRequested = function(escalationData) {
    // Notify your support team
    console.log('Escalation requested:', escalationData);
    
    // Example: Send notification to Slack
    fetch('/api/notify-support', {
        method: 'POST',
        body: JSON.stringify(escalationData)
    });
};
\`\`\`

### Error Handling
\`\`\`javascript
window.EchoAIConfig.onError = function(error) {
    // Log errors for debugging
    console.error('Chatbot error:', error);
    
    // Example: Send to error tracking service
    if (window.Sentry) {
        Sentry.captureException(new Error(error));
    }
};
\`\`\`

## Customization

### Custom CSS
\`\`\`css
/* Override widget styles */
.echoai-enhanced-widget {
    border-radius: 20px !important;
}

.echoai-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
}

.echoai-message-user .echoai-message-content {
    background: ${selectedChatbot.primaryColor} !important;
}
\`\`\`

### Custom Positioning
\`\`\`css
/* Custom positioning */
.echoai-enhanced-widget-container {
    ${embedConfig.position.includes('bottom') ? 'bottom' : 'top'}: 20px !important;
    ${embedConfig.position.includes('right') ? 'right' : 'left'}: 20px !important;
}

/* Mobile responsive */
@media (max-width: 768px) {
    .echoai-enhanced-widget {
        width: calc(100vw - 20px) !important;
        height: calc(100vh - 100px) !important;
    }
}
\`\`\`

## Troubleshooting

### Common Issues

1. **Widget not loading**: Check console for JavaScript errors
2. **CORS errors**: Ensure your domain is whitelisted
3. **Styling conflicts**: Use more specific CSS selectors
4. **Performance issues**: Enable caching and compression

### Debug Mode
\`\`\`javascript
window.EchoAIConfig.debug = true; // Enable debug logging
\`\`\`

### Browser Support
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
- IE 11 (with polyfills)

For older browsers, polyfills are automatically loaded when enabled.`;
  };

  const generateReactCode = () => {
    if (!selectedChatbot) return "";

    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";

    return `import React, { useEffect, useRef, useState } from 'react';

// EchoAI Enhanced Chatbot React Component
const EchoAIChatbot: React.FC = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Configuration object - same as HTML version
  const config = {
    chatbotId: "${selectedChatbot.id}",
    apiKey: "${selectedChatbot.apiKey}",
    userEmail: 'preview@example.com', // Replace with actual user email
    // Embedded settings as fallback
    chatbotName: "${selectedChatbot.name}",
    welcomeMessage: "${selectedChatbot.welcomeMessage}",
    primaryColor: "${selectedChatbot.primaryColor}",
    // Widget configuration
    position: "${embedConfig.position}",
    theme: "${embedConfig.theme}",
    showBranding: ${embedConfig.showBranding},
    // Enhanced features configuration
    enableEnhancedFeatures: ${embedConfig.enableEnhancedFeatures},
    enableImageUpload: ${embedConfig.enableImageUpload},
    enableFAQ: ${embedConfig.enableFAQ},
    enableHistory: ${embedConfig.enableHistory},
    // Streaming configuration
    streamingConfig: {
      enabled: ${embedConfig.streamingEnabled},
      typingSpeed: ${embedConfig.typingSpeed},
      showTypingIndicator: ${embedConfig.showTypingIndicator},
      enableTokenAnimation: ${embedConfig.enableTokenAnimation},
    },
    // Intelligence configuration
    intelligenceConfig: {
      enabled: ${embedConfig.enableEnhancedFeatures},
      showProactiveQuestions: ${embedConfig.showProactiveQuestions},
      showSuggestedTopics: ${embedConfig.showSuggestedTopics},
      showConversationActions: ${embedConfig.showConversationActions},
      showIntelligenceMetrics: ${embedConfig.showIntelligenceMetrics},
    },
    // Lead collection configuration
    leadCollectionConfig: {
      enabled: ${embedConfig.enableLeadCollection},
      collectEmail: ${embedConfig.collectEmail},
      collectPhone: ${embedConfig.collectPhone},
      collectCompany: ${embedConfig.collectCompany},
      progressiveCollection: ${embedConfig.progressiveCollection},
    },
    // Escalation configuration
    escalationConfig: {
      enabled: ${embedConfig.enableEscalation},
      showEscalationButton: ${embedConfig.showEscalationButton},
      escalationThreshold: ${embedConfig.escalationThreshold},
      humanAgentAvailable: ${embedConfig.humanAgentAvailable},
    },
    // Performance optimization
    performanceConfig: {
      enableCaching: ${embedConfig.enableCaching},
      enableCompression: ${embedConfig.enableCompression},
      lazyLoading: ${embedConfig.lazyLoading},
    },
    // Cross-browser compatibility
    compatibilityConfig: {
      enablePolyfills: ${embedConfig.enablePolyfills},
      fallbackMode: "${embedConfig.fallbackMode}",
    },
    // API URLs - use enhanced endpoints when enhanced features are enabled
    apiUrl: \`\${window.location.origin}/api/\${${embedConfig.enableEnhancedFeatures} ? 'enhanced-chat/widget' : 'chat'}\`,
    // Event handlers
    onLeadCollected: (leadData: Record<string, any>) => {
      console.log('Lead collected:', leadData);
      // Handle lead data (send to CRM, analytics, etc.)
      // Example: Send to Google Analytics
      const w = window as unknown as { gtag?: (...args: any[]) => void };
      if (typeof w.gtag === 'function') {
        w.gtag('event', 'lead_collected', {
          'event_category': 'chatbot',
          'event_label': leadData.email
        });
      }
    },
    onEscalationRequested: (escalationData: Record<string, any>) => {
      console.log('Escalation requested:', escalationData);
      // Handle escalation (notify agents, create ticket, etc.)
      // Example: Send notification to your backend
      fetch('/api/notify-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(escalationData)
      }).catch(err => console.error('Failed to notify support:', err));
    },
    onError: (error: string) => {
      console.error('Chatbot error:', error);
      setError(error);
      // Example: Send to error tracking service
      const w = window as unknown as { Sentry?: { captureException: (e: any) => void } };
      if (w.Sentry && typeof w.Sentry.captureException === 'function') {
        w.Sentry.captureException(new Error(error));
      }
    }
  };

  // Check browser support - same logic as HTML version
  const checkBrowserSupport = (): boolean => {
    const isModernBrowser = 'fetch' in window && 'Promise' in window && 'Map' in window;
    
    if (!isModernBrowser && config.compatibilityConfig.enablePolyfills) {
      // Load polyfills for older browsers
      const polyfillScript = document.createElement('script');
      polyfillScript.src = \`\https://echoai-pi.vercel.app/polyfills.js\`;
      polyfillScript.onload = () => loadEchoAI();
      document.head.appendChild(polyfillScript);
      return false;
    }
    
    return true;
  };

  // Load EchoAI script - same logic as HTML version
  const loadEchoAI = (): void => {
    if (isLoaded || isLoading) return;
    
    setIsLoading(true);
    setError(null);

    const script = document.createElement('script');
    const widgetScript = config.enableEnhancedFeatures ? 'enhanced-widget.js' : 'widget.js';
    script.src = \`\https://echoai-pi.vercel.app/\${widgetScript}\`;
    script.async = true;
    
    script.onload = () => {
      if (window.EchoAI) {
        // Set global config
        window.EchoAIConfig = config;
        window.EchoAI.init(config);
        setIsLoaded(true);
        setIsLoading(false);
      } else {
        setError('EchoAI widget failed to initialize');
        setIsLoading(false);
      }
    };
    
    script.onerror = () => {
      console.error('EchoAI: Failed to load widget script');
      setError('Failed to load EchoAI widget script');
      
      // Fallback to basic widget if enhanced fails
      if (config.compatibilityConfig.fallbackMode !== 'enhanced') {
        const fallbackScript = document.createElement('script');
        fallbackScript.src = \`\https://echoai-pi.vercel.app/widget.js\`;
        fallbackScript.async = true;
        fallbackScript.onload = () => {
          if (window.EchoAI) {
            window.EchoAIConfig = config;
            window.EchoAI.init(config);
            setIsLoaded(true);
            setIsLoading(false);
          }
        };
        fallbackScript.onerror = () => {
          setError('Failed to load fallback widget script');
          setIsLoading(false);
        };
        document.head.appendChild(fallbackScript);
      } else {
        setIsLoading(false);
      }
    };
    
    document.head.appendChild(script);
    scriptRef.current = script;
  };

  // Performance optimization: Preload critical resources
  useEffect(() => {
    if (config.performanceConfig.enableCaching && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register(\`\https://echoai-pi.vercel.app/sw-echoai.js\`).catch((err) => {
        console.log('EchoAI: Service worker registration failed:', err);
      });
    }
  }, []);

  // Main initialization effect
  useEffect(() => {
    if (checkBrowserSupport()) {
      if (config.performanceConfig.lazyLoading) {
        // Lazy loading: Only load when user is likely to interact
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              loadEchoAI();
              observer.disconnect();
            }
          });
        });
        
        if (containerRef.current) {
          observer.observe(containerRef.current);
        }
        
        return () => observer.disconnect();
      } else {
        // Load immediately
        loadEchoAI();
      }
    }
  }, []);

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Clean up script if component unmounts
      if (scriptRef.current && scriptRef.current.parentNode) {
        scriptRef.current.parentNode.removeChild(scriptRef.current);
      }
    };
  }, []);

  return (
    <div>
      {/* EchoAI Chatbot Container */}
      <div 
        ref={containerRef}
        id="echoai-chatbot"
        style={{
          position: 'fixed',
          ...(config.position.includes('bottom') ? { bottom: '20px' } : { top: '20px' }),
          ...(config.position.includes('right') ? { right: '20px' } : { left: '20px' }),
          zIndex: 9999
        }}
      />
      
      {/* Loading indicator */}
      {isLoading && (
        <div 
          style={{
            position: 'fixed',
            ...(config.position.includes('bottom') ? { bottom: '20px' } : { top: '20px' }),
            ...(config.position.includes('right') ? { right: '20px' } : { left: '20px' }),
            zIndex: 10000,
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: config.primaryColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '24px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}
        >
          💬
        </div>
      )}
      
      {/* Error display */}
      {error && (
        <div 
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            right: '20px',
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '14px',
            zIndex: 10001
          }}
        >
          EchoAI Error: {error}
        </div>
      )}
    </div>
  );
};

// Main App Component
const App: React.FC = () => {
  return (
    <div>
      {/* Your app content */}
      <h1>Welcome to My Website</h1>
      <p>Your website content goes here...</p>
      
      {/* EchoAI Chatbot */}
      <EchoAIChatbot />
    </div>
  );
};

export default App;`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const getPositionStyles = () => {
    const positions = {
      "bottom-right": "bottom: 20px; right: 20px;",
      "bottom-left": "bottom: 20px; left: 20px;",
      "top-right": "top: 20px; right: 20px;",
      "top-left": "top: 20px; left: 20px;",
    };
    return positions[embedConfig.position];
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Embed Code Generator</h2>
        <p className="text-muted-foreground">
          Generate embed code to add your chatbot to any website
        </p>
      </div>

      {/* Chatbot Selection - only show if no chatbot prop provided */}
      {!chatbot && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Chatbot Selection
            </CardTitle>
            <CardDescription>
              Choose which chatbot to embed on your website
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="chatbot-select">Select Chatbot</Label>
                <ChatbotSelector
                  selectedChatbotId={selectedChatbot?.id}
                  onSelect={setSelectedChatbot}
                  placeholder="Choose a chatbot to embed..."
                />
              </div>

              {selectedChatbot && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                      style={{ backgroundColor: selectedChatbot.primaryColor }}
                    >
                      AI
                    </div>
                    <div>
                      <div className="font-medium">{selectedChatbot.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedChatbot._count?.documents || 0} training
                        documents
                      </div>
                    </div>
                    <Badge
                      variant={
                        selectedChatbot.isActive ? "default" : "secondary"
                      }
                    >
                      {selectedChatbot.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Chatbot Display - show when chatbot prop is provided */}
      {chatbot && selectedChatbot && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Embedding Chatbot
            </CardTitle>
            <CardDescription>
              Generate embed code for this chatbot
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                  style={{ backgroundColor: selectedChatbot.primaryColor }}
                >
                  AI
                </div>
                <div>
                  <div className="font-medium">{selectedChatbot.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedChatbot._count?.documents || 0} training documents
                  </div>
                </div>
                <Badge
                  variant={selectedChatbot.isActive ? "default" : "secondary"}
                >
                  {selectedChatbot.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedChatbot && (
        <>
          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Enhanced Widget Configuration</CardTitle>
              <CardDescription>
                Customize your chatbot with advanced features and behavior settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Basic Configuration */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Basic Settings
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="position">Position</Label>
                    <Select
                      value={embedConfig.position}
                      onValueChange={(value) =>
                        setEmbedConfig((prev) => ({
                          ...prev,
                          position: value as EmbedConfig["position"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bottom-right">Bottom Right</SelectItem>
                        <SelectItem value="bottom-left">Bottom Left</SelectItem>
                        <SelectItem value="top-right">Top Right</SelectItem>
                        <SelectItem value="top-left">Top Left</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="theme">Theme</Label>
                    <Select
                      value={embedConfig.theme}
                      onValueChange={(value) =>
                        setEmbedConfig((prev) => ({
                          ...prev,
                          theme: value as EmbedConfig["theme"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto (System)</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="branding"
                    checked={embedConfig.showBranding}
                    onCheckedChange={(checked) =>
                      setEmbedConfig((prev) => ({
                        ...prev,
                        showBranding: checked,
                      }))
                    }
                  />
                  <Label htmlFor="branding">Show EchoAI branding</Label>
                </div>
              </div>

              <Separator />

              {/* Enhanced Features */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Enhanced Features
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="enhanced-features">Enable Enhanced Features</Label>
                      <p className="text-xs text-muted-foreground">
                        Unlock intelligent responses, proactive assistance, and advanced analytics
                      </p>
                    </div>
                    <Switch
                      id="enhanced-features"
                      checked={embedConfig.enableEnhancedFeatures}
                      onCheckedChange={(checked) =>
                        setEmbedConfig((prev) => ({
                          ...prev,
                          enableEnhancedFeatures: checked,
                        }))
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="image-upload"
                        checked={embedConfig.enableImageUpload}
                        onCheckedChange={(checked) =>
                          setEmbedConfig((prev) => ({
                            ...prev,
                            enableImageUpload: checked,
                          }))
                        }
                      />
                      <Label htmlFor="image-upload" className="text-sm">Image Upload</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="faq"
                        checked={embedConfig.enableFAQ}
                        onCheckedChange={(checked) =>
                          setEmbedConfig((prev) => ({
                            ...prev,
                            enableFAQ: checked,
                          }))
                        }
                      />
                      <Label htmlFor="faq" className="text-sm">FAQ Section</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="history"
                        checked={embedConfig.enableHistory}
                        onCheckedChange={(checked) =>
                          setEmbedConfig((prev) => ({
                            ...prev,
                            enableHistory: checked,
                          }))
                        }
                      />
                      <Label htmlFor="history" className="text-sm">Conversation History</Label>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Streaming Configuration */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Streaming & Animation
                </h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="streaming">Enable Streaming Responses</Label>
                      <p className="text-xs text-muted-foreground">
                        Show responses as they're being generated for better user experience
                      </p>
                    </div>
                    <Switch
                      id="streaming"
                      checked={embedConfig.streamingEnabled}
                      onCheckedChange={(checked) =>
                        setEmbedConfig((prev) => ({
                          ...prev,
                          streamingEnabled: checked,
                        }))
                      }
                    />
                  </div>

                  {embedConfig.streamingEnabled && (
                    <div className="space-y-4 pl-4 border-l-2 border-muted">
                      <div className="space-y-2">
                        <Label htmlFor="typing-speed">
                          Typing Speed: {embedConfig.typingSpeed} ms/token
                        </Label>
                        <Slider
                          id="typing-speed"
                          min={10}
                          max={100}
                          step={5}
                          value={[embedConfig.typingSpeed]}
                          onValueChange={(value) =>
                            setEmbedConfig((prev) => ({
                              ...prev,
                              typingSpeed: value[0],
                            }))
                          }
                          className="w-full"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="typing-indicator"
                            checked={embedConfig.showTypingIndicator}
                            onCheckedChange={(checked) =>
                              setEmbedConfig((prev) => ({
                                ...prev,
                                showTypingIndicator: checked,
                              }))
                            }
                          />
                          <Label htmlFor="typing-indicator" className="text-sm">Typing Indicator</Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch
                            id="token-animation"
                            checked={embedConfig.enableTokenAnimation}
                            onCheckedChange={(checked) =>
                              setEmbedConfig((prev) => ({
                                ...prev,
                                enableTokenAnimation: checked,
                              }))
                            }
                          />
                          <Label htmlFor="token-animation" className="text-sm">Token Animation</Label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Intelligence Configuration */}
              {embedConfig.enableEnhancedFeatures && (
                <>
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Brain className="h-4 w-4" />
                      Conversation Intelligence
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="proactive-questions"
                          checked={embedConfig.showProactiveQuestions}
                          onCheckedChange={(checked) =>
                            setEmbedConfig((prev) => ({
                              ...prev,
                              showProactiveQuestions: checked,
                            }))
                          }
                        />
                        <Label htmlFor="proactive-questions" className="text-sm">Proactive Questions</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="suggested-topics"
                          checked={embedConfig.showSuggestedTopics}
                          onCheckedChange={(checked) =>
                            setEmbedConfig((prev) => ({
                              ...prev,
                              showSuggestedTopics: checked,
                            }))
                          }
                        />
                        <Label htmlFor="suggested-topics" className="text-sm">Suggested Topics</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="conversation-actions"
                          checked={embedConfig.showConversationActions}
                          onCheckedChange={(checked) =>
                            setEmbedConfig((prev) => ({
                              ...prev,
                              showConversationActions: checked,
                            }))
                          }
                        />
                        <Label htmlFor="conversation-actions" className="text-sm">Conversation Actions</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="intelligence-metrics"
                          checked={embedConfig.showIntelligenceMetrics}
                          onCheckedChange={(checked) =>
                            setEmbedConfig((prev) => ({
                              ...prev,
                              showIntelligenceMetrics: checked,
                            }))
                          }
                        />
                        <Label htmlFor="intelligence-metrics" className="text-sm">Intelligence Metrics</Label>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Lead Collection Configuration */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Lead Collection
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="lead-collection">Enable Lead Collection</Label>
                          <p className="text-xs text-muted-foreground">
                            Automatically identify and collect potential customer information
                          </p>
                        </div>
                        <Switch
                          id="lead-collection"
                          checked={embedConfig.enableLeadCollection}
                          onCheckedChange={(checked) =>
                            setEmbedConfig((prev) => ({
                              ...prev,
                              enableLeadCollection: checked,
                            }))
                          }
                        />
                      </div>

                      {embedConfig.enableLeadCollection && (
                        <div className="space-y-3 pl-4 border-l-2 border-muted">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center space-x-2">
                              <Switch
                                id="collect-email"
                                checked={embedConfig.collectEmail}
                                onCheckedChange={(checked) =>
                                  setEmbedConfig((prev) => ({
                                    ...prev,
                                    collectEmail: checked,
                                  }))
                                }
                              />
                              <Label htmlFor="collect-email" className="text-sm">Collect Email</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <Switch
                                id="collect-phone"
                                checked={embedConfig.collectPhone}
                                onCheckedChange={(checked) =>
                                  setEmbedConfig((prev) => ({
                                    ...prev,
                                    collectPhone: checked,
                                  }))
                                }
                              />
                              <Label htmlFor="collect-phone" className="text-sm">Collect Phone</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <Switch
                                id="collect-company"
                                checked={embedConfig.collectCompany}
                                onCheckedChange={(checked) =>
                                  setEmbedConfig((prev) => ({
                                    ...prev,
                                    collectCompany: checked,
                                  }))
                                }
                              />
                              <Label htmlFor="collect-company" className="text-sm">Collect Company</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <Switch
                                id="progressive-collection"
                                checked={embedConfig.progressiveCollection}
                                onCheckedChange={(checked) =>
                                  setEmbedConfig((prev) => ({
                                    ...prev,
                                    progressiveCollection: checked,
                                  }))
                                }
                              />
                              <Label htmlFor="progressive-collection" className="text-sm">Progressive Collection</Label>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Escalation Configuration */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Escalation Management
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="escalation">Enable Escalation</Label>
                          <p className="text-xs text-muted-foreground">
                            Automatically detect when conversations need human intervention
                          </p>
                        </div>
                        <Switch
                          id="escalation"
                          checked={embedConfig.enableEscalation}
                          onCheckedChange={(checked) =>
                            setEmbedConfig((prev) => ({
                              ...prev,
                              enableEscalation: checked,
                            }))
                          }
                        />
                      </div>

                      {embedConfig.enableEscalation && (
                        <div className="space-y-4 pl-4 border-l-2 border-muted">
                          <div className="space-y-2">
                            <Label htmlFor="escalation-threshold">
                              Escalation Threshold: {Math.round(embedConfig.escalationThreshold * 100)}%
                            </Label>
                            <Slider
                              id="escalation-threshold"
                              min={0.1}
                              max={1.0}
                              step={0.1}
                              value={[embedConfig.escalationThreshold]}
                              onValueChange={(value) =>
                                setEmbedConfig((prev) => ({
                                  ...prev,
                                  escalationThreshold: value[0],
                                }))
                              }
                              className="w-full"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center space-x-2">
                              <Switch
                                id="escalation-button"
                                checked={embedConfig.showEscalationButton}
                                onCheckedChange={(checked) =>
                                  setEmbedConfig((prev) => ({
                                    ...prev,
                                    showEscalationButton: checked,
                                  }))
                                }
                              />
                              <Label htmlFor="escalation-button" className="text-sm">Show Escalation Button</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <Switch
                                id="human-agent-available"
                                checked={embedConfig.humanAgentAvailable}
                                onCheckedChange={(checked) =>
                                  setEmbedConfig((prev) => ({
                                    ...prev,
                                    humanAgentAvailable: checked,
                                  }))
                                }
                              />
                              <Label htmlFor="human-agent-available" className="text-sm">Human Agent Available</Label>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />
                </>
              )}

              {/* Performance & Compatibility */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Performance & Compatibility
                </h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="caching"
                        checked={embedConfig.enableCaching}
                        onCheckedChange={(checked) =>
                          setEmbedConfig((prev) => ({
                            ...prev,
                            enableCaching: checked,
                          }))
                        }
                      />
                      <Label htmlFor="caching" className="text-sm">Enable Caching</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="compression"
                        checked={embedConfig.enableCompression}
                        onCheckedChange={(checked) =>
                          setEmbedConfig((prev) => ({
                            ...prev,
                            enableCompression: checked,
                          }))
                        }
                      />
                      <Label htmlFor="compression" className="text-sm">Enable Compression</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="lazy-loading"
                        checked={embedConfig.lazyLoading}
                        onCheckedChange={(checked) =>
                          setEmbedConfig((prev) => ({
                            ...prev,
                            lazyLoading: checked,
                          }))
                        }
                      />
                      <Label htmlFor="lazy-loading" className="text-sm">Lazy Loading</Label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="polyfills"
                        checked={embedConfig.enablePolyfills}
                        onCheckedChange={(checked) =>
                          setEmbedConfig((prev) => ({
                            ...prev,
                            enablePolyfills: checked,
                          }))
                        }
                      />
                      <Label htmlFor="polyfills" className="text-sm">Enable Polyfills</Label>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fallback-mode">Fallback Mode</Label>
                      <Select
                        value={embedConfig.fallbackMode}
                        onValueChange={(value) =>
                          setEmbedConfig((prev) => ({
                            ...prev,
                            fallbackMode: value as EmbedConfig["fallbackMode"],
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto</SelectItem>
                          <SelectItem value="enhanced">Enhanced Only</SelectItem>
                          <SelectItem value="basic">Basic Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Preview
              </CardTitle>
              <CardDescription>
                See how your chatbot will appear on your website
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    variant={previewMode === "desktop" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreviewMode("desktop")}
                  >
                    Desktop
                  </Button>
                  <Button
                    variant={previewMode === "mobile" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreviewMode("mobile")}
                  >
                    Mobile
                  </Button>
                </div>

                <div
                  className={`relative border rounded-lg overflow-hidden ${
                    previewMode === "mobile" ? "max-w-sm mx-auto" : ""
                  }`}
                >
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900 p-8 min-h-[300px]">
                    <div className="text-center text-muted-foreground">
                      Your website content would appear here
                    </div>

                    {/* Chat Widget Preview */}
                    <div
                      className="absolute w-16 h-16 rounded-full shadow-lg cursor-pointer flex items-center justify-center text-white font-medium"
                      style={{
                        backgroundColor: selectedChatbot.primaryColor,
                        ...Object.fromEntries(
                          getPositionStyles()
                            .split(";")
                            .map((style) => {
                              const [key, value] = style
                                .split(":")
                                .map((s) => s.trim());
                              return [
                                key.replace(/-([a-z])/g, (_, letter) =>
                                  letter.toUpperCase()
                                ),
                                value,
                              ];
                            })
                            .filter(([key]) => key)
                        ),
                      }}
                    >
                      💬
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Embed Code */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Embed Code
              </CardTitle>
              <CardDescription>
                Copy and paste this code into your website
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="html" className="w-full">
                <TabsList>
                  <TabsTrigger value="html">HTML</TabsTrigger>
                  <TabsTrigger value="react">React</TabsTrigger>
                </TabsList>

                <TabsContent value="html" className="space-y-4">
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                      <code>{generateEmbedCode()}</code>
                    </pre>
                    <Button
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(generateEmbedCode())}
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="react" className="space-y-4">
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                      <code>{generateReactCode()}</code>
                    </pre>
                    <Button
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(generateReactCode())}
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>React Integration:</strong> This React component uses useEffect hooks to replicate 
                      the exact same functionality as the HTML version, including lazy loading, error handling, 
                      and performance optimizations.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="typescript" className="space-y-4">
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                      <code>{generateTypeScriptCode()}</code>
                    </pre>
                    <Button
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(generateTypeScriptCode())}
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      <strong>TypeScript Benefits:</strong> Full type safety, better IDE support, 
                      and compile-time error checking for enhanced development experience.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="config" className="space-y-4">
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
                      <code>{generateConfigurationGuide()}</code>
                    </pre>
                    <Button
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(generateConfigurationGuide())}
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                    <p className="text-sm text-purple-800 dark:text-purple-200">
                      <strong>Configuration Guide:</strong> Comprehensive documentation for all 
                      enhanced features, integration examples, and troubleshooting tips.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
