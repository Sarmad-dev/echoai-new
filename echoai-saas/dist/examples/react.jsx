import React, { useEffect } from 'react';

const EchoAIWidget = ({ config }) => {
  useEffect(() => {
    // Load widget script
    const script = document.createElement('script');
    script.src = 'https://cdn.echoai.com/widget/latest/enhanced-widget.min.js';
    script.async = true;
    script.onload = () => {
      window.EchoAI.init(config);
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup
      if (window.EchoAI) {
        window.EchoAI.destroy();
      }
      document.head.removeChild(script);
    };
  }, [config]);

  return null; // Widget renders itself
};

export default EchoAIWidget;

// Usage:
// <EchoAIWidget config={{
//   apiKey: 'your-api-key',
//   chatbotId: 'your-chatbot-id',
//   apiUrl: 'https://your-api-endpoint.com/api/enhanced-chat/widget'
// }} />