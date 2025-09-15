(function() {
  'use strict';

  // EchoAI Chat Widget
  window.EchoAI = {
    init: function(config) {
      if (!config || !config.chatbotId || !config.apiKey) {
        console.error('EchoAI: Missing required configuration (chatbotId, apiKey)');
        return;
      }

      this.config = {
        chatbotId: config.chatbotId,
        apiKey: config.apiKey,
        position: config.position || 'bottom-right',
        theme: config.theme || 'auto',
        showBranding: config.showBranding !== false,
        apiUrl: config.apiUrl || window.location.origin + '/api/chat',
        // Embedded fallback settings
        chatbotName: config.chatbotName,
        welcomeMessage: config.welcomeMessage,
        primaryColor: config.primaryColor
      };

      this.createWidget();
      this.loadStyles();
    },

    createWidget: function() {
      // Create widget container
      const container = document.createElement('div');
      container.id = 'echoai-widget-container';
      container.className = 'echoai-widget-container';
      
      // Set position
      const positions = {
        'bottom-right': { bottom: '20px', right: '20px' },
        'bottom-left': { bottom: '20px', left: '20px' },
        'top-right': { top: '20px', right: '20px' },
        'top-left': { top: '20px', left: '20px' }
      };
      
      const pos = positions[this.config.position];
      Object.assign(container.style, {
        position: 'fixed',
        zIndex: '9999',
        ...pos
      });

      // Create widget HTML
      container.innerHTML = this.getWidgetHTML();
      
      // Append to body
      document.body.appendChild(container);
      
      // Initialize widget functionality
      this.initializeWidget();
    },

    getWidgetHTML: function() {
      return `
        <div class="echoai-widget" style="display: none;">
          <div class="echoai-chat-container">
            <div class="echoai-header">
              <div class="echoai-header-content">
                <div class="echoai-bot-avatar">AI</div>
                <div class="echoai-header-text">
                  <div class="echoai-bot-name">AI Assistant</div>
                  <div class="echoai-bot-status">Online</div>
                </div>
              </div>
              <button class="echoai-close-btn">&times;</button>
            </div>
            <div class="echoai-messages" id="echoai-messages"></div>
            <div class="echoai-input-container">
              <input type="text" class="echoai-input" placeholder="Type your message..." />
              <button class="echoai-send-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22,2 15,22 11,13 2,9"></polygon>
                </svg>
              </button>
            </div>
            ${this.config.showBranding ? '<div class="echoai-branding">Powered by EchoAI</div>' : ''}
          </div>
        </div>
        <button class="echoai-toggle-btn">
          <svg class="echoai-chat-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <svg class="echoai-close-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;
    },

    initializeWidget: function() {
      const widget = document.querySelector('.echoai-widget');
      const toggleBtn = document.querySelector('.echoai-toggle-btn');
      const closeBtn = document.querySelector('.echoai-close-btn');
      const input = document.querySelector('.echoai-input');
      const sendBtn = document.querySelector('.echoai-send-btn');
      const messagesContainer = document.getElementById('echoai-messages');

      let isOpen = false;
      let conversationId = null;
      let isLoading = false;

      // Load chatbot settings
      this.loadChatbotSettings();

      // Toggle widget
      const toggleWidget = () => {
        isOpen = !isOpen;
        widget.style.display = isOpen ? 'block' : 'none';
        
        const chatIcon = toggleBtn.querySelector('.echoai-chat-icon');
        const closeIcon = toggleBtn.querySelector('.echoai-close-icon');
        
        if (isOpen) {
          chatIcon.style.display = 'none';
          closeIcon.style.display = 'block';
          input.focus();
          
          // Add welcome message if no messages
          if (messagesContainer.children.length === 0) {
            this.addWelcomeMessage();
          }
        } else {
          chatIcon.style.display = 'block';
          closeIcon.style.display = 'none';
        }
      };

      toggleBtn.addEventListener('click', toggleWidget);
      closeBtn.addEventListener('click', toggleWidget);

      // Send message
      const sendMessage = async () => {
        const message = input.value.trim();
        if (!message || isLoading) return;

        // Add user message
        this.addMessage(message, 'user');
        input.value = '';
        isLoading = true;
        this.showTyping();

        try {
          const requestBody = {
            message: message,
            apiKey: this.config.apiKey,
            chatbotId: this.config.chatbotId,
            conversationId: conversationId
          };
          
          console.log('EchoAI: Sending request to:', this.config.apiUrl);
          console.log('EchoAI: Request body:', requestBody);

          const response = await fetch(this.config.apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
          });

          console.log('EchoAI: Response status:', response.status);
          console.log('EchoAI: Response headers:', Object.fromEntries(response.headers.entries()));

          if (!response.ok) {
            const errorText = await response.text();
            console.error('EchoAI: Error response:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const data = await response.json();
          console.log('EchoAI: Response data:', data);
          
          // Update conversation ID
          if (!conversationId && data.conversationId) {
            conversationId = data.conversationId;
          }

          // Add assistant response
          this.hideTyping();
          this.addMessage(data.response, 'assistant');
          
        } catch (error) {
          console.error('EchoAI: Error sending message:', error);
          this.hideTyping();
          
          let errorMsg = 'Sorry, I encountered an error. Please try again.';
          
          if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
            // This is likely a CORS or network connectivity issue
            errorMsg = 'Unable to connect to the chat service. This might be due to network issues or CORS configuration.';
            console.error('EchoAI: Network/CORS error. Check that the API endpoint supports CORS for this domain.');
          } else if (error.message.includes('401')) {
            errorMsg = 'Authentication error. Please check your API key and chatbot ID.';
          } else if (error.message.includes('404')) {
            errorMsg = 'Chat service not found. Please verify your configuration.';
          } else if (error.message.includes('429')) {
            errorMsg = 'Too many requests. Please wait a moment and try again.';
          } else if (error.message.includes('500')) {
            errorMsg = 'Server error. Please try again in a few moments.';
          }
          
          this.addMessage(errorMsg, 'assistant');
        } finally {
          isLoading = false;
        }
      };

      sendBtn.addEventListener('click', sendMessage);
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          sendMessage();
        }
      });
    },

    loadChatbotSettings: async function() {
      console.log('EchoAI: Loading chatbot settings...');
      
      // Set fallback values first
      this.welcomeMessage = this.config.welcomeMessage || 'Hello! How can I help you today?';
      
      // Apply embedded settings immediately as fallback
      this.applySettings({
        name: this.config.chatbotName || 'AI Assistant',
        primaryColor: this.config.primaryColor || '#3b82f6',
        welcomeMessage: this.welcomeMessage
      });
      
      try {
        // Try to get updated settings from the public API endpoint
        const apiUrl = this.config.apiUrl.replace('/api/chat', '/api/public/chatbots/' + this.config.chatbotId);
        console.log('EchoAI: Fetching settings from:', apiUrl);
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (response.ok) {
          const chatbot = await response.json();
          console.log('EchoAI: Received settings:', chatbot);
          
          // Apply updated settings from API
          this.applySettings(chatbot);
          this.welcomeMessage = chatbot.welcomeMessage;
        } else {
          console.log('EchoAI: API call failed, using embedded settings');
        }
      } catch (error) {
        console.log('EchoAI: Failed to load from API, using embedded settings:', error.message);
      }
    },

    applySettings: function(settings) {
      // Update UI with chatbot settings
      const botName = document.querySelector('.echoai-bot-name');
      const header = document.querySelector('.echoai-header');
      const toggleBtn = document.querySelector('.echoai-toggle-btn');
      const sendBtn = document.querySelector('.echoai-send-btn');
      
      if (botName && settings.name) {
        botName.textContent = settings.name;
      }
      
      // Apply primary color with !important to override default styles
      if (settings.primaryColor) {
        if (header) {
          header.style.setProperty('background-color', settings.primaryColor, 'important');
        }
        if (toggleBtn) {
          toggleBtn.style.setProperty('background-color', settings.primaryColor, 'important');
        }
        if (sendBtn) {
          sendBtn.style.setProperty('background-color', settings.primaryColor, 'important');
        }
        
        // Update user message color in CSS
        this.updateUserMessageColor(settings.primaryColor);
      }
    },

    updateUserMessageColor: function(color) {
      // Update the CSS for user messages dynamically
      const styleId = 'echoai-dynamic-styles';
      let dynamicStyles = document.getElementById(styleId);
      
      if (!dynamicStyles) {
        dynamicStyles = document.createElement('style');
        dynamicStyles.id = styleId;
        document.head.appendChild(dynamicStyles);
      }
      
      dynamicStyles.textContent = `
        .echoai-message-user .echoai-message-content {
          background: ${color} !important;
          color: white !important;
        }
        .echoai-input:focus {
          border-color: ${color} !important;
        }
      `;
    },

    addWelcomeMessage: function() {
      const welcomeMsg = this.welcomeMessage || 'Hello! How can I help you today?';
      this.addMessage(welcomeMsg, 'assistant');
    },

    addMessage: function(content, role) {
      const messagesContainer = document.getElementById('echoai-messages');
      const messageDiv = document.createElement('div');
      messageDiv.className = `echoai-message echoai-message-${role}`;
      
      messageDiv.innerHTML = `
        <div class="echoai-message-content">
          ${content}
        </div>
      `;
      
      messagesContainer.appendChild(messageDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    },

    showTyping: function() {
      const messagesContainer = document.getElementById('echoai-messages');
      const typingDiv = document.createElement('div');
      typingDiv.className = 'echoai-message echoai-message-assistant echoai-typing';
      typingDiv.innerHTML = `
        <div class="echoai-message-content">
          <div class="echoai-typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      `;
      messagesContainer.appendChild(typingDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    },

    hideTyping: function() {
      const typing = document.querySelector('.echoai-typing');
      if (typing) {
        typing.remove();
      }
    },

    loadStyles: function() {
      if (document.getElementById('echoai-styles')) return;
      
      const styles = document.createElement('style');
      styles.id = 'echoai-styles';
      styles.textContent = this.getStyles();
      document.head.appendChild(styles);
    },

    getStyles: function() {
      return `
        .echoai-widget-container * {
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .echoai-widget {
          width: 320px;
          height: 500px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          margin-bottom: 10px;
        }
        
        .echoai-header {
          background: #3b82f6;
          color: white;
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .echoai-header-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .echoai-bot-avatar {
          width: 32px;
          height: 32px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
        }
        
        .echoai-bot-name {
          font-weight: 600;
          font-size: 14px;
        }
        
        .echoai-bot-status {
          font-size: 12px;
          opacity: 0.8;
        }
        
        .echoai-close-btn {
          background: none;
          border: none;
          color: white;
          font-size: 20px;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
        }
        
        .echoai-close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        
        .echoai-messages {
          flex: 1;
          padding: 16px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .echoai-messages::-webkit-scrollbar {
          width: 6px;
        }
        
        .echoai-messages::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .echoai-messages::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 3px;
        }
        
        .echoai-message {
          display: flex;
        }
        
        .echoai-message-user {
          justify-content: flex-end;
        }
        
        .echoai-message-assistant {
          justify-content: flex-start;
        }
        
        .echoai-message-content {
          max-width: 80%;
          padding: 8px 12px;
          border-radius: 12px;
          font-size: 14px;
          line-height: 1.4;
          word-wrap: break-word;
        }
        
        .echoai-message-user .echoai-message-content {
          background: #3b82f6;
          color: white;
        }
        
        .echoai-message-assistant .echoai-message-content {
          background: #f3f4f6;
          color: #374151;
        }
        
        .echoai-typing-indicator {
          display: flex;
          gap: 4px;
          align-items: center;
        }
        
        .echoai-typing-indicator span {
          width: 6px;
          height: 6px;
          background: #9ca3af;
          border-radius: 50%;
          animation: echoai-bounce 1.4s infinite ease-in-out;
        }
        
        .echoai-typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .echoai-typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
        
        @keyframes echoai-bounce {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
        
        .echoai-input-container {
          padding: 16px;
          border-top: 1px solid #e5e7eb;
          display: flex;
          gap: 8px;
          background: white;
          position: sticky;
          bottom: 0;
          flex-shrink: 0;
        }
        
        .echoai-input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 20px;
          outline: none;
          font-size: 14px;
        }
        
        .echoai-input:focus {
          border-color: #3b82f6;
        }
        
        .echoai-send-btn {
          width: 36px;
          height: 36px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .echoai-send-btn:hover {
          background: #2563eb;
        }
        
        .echoai-send-btn:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }
        
        .echoai-toggle-btn {
          width: 56px;
          height: 56px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          transition: transform 0.2s;
        }
        
        .echoai-toggle-btn:hover {
          transform: scale(1.05);
        }
        
        .echoai-branding {
          padding: 8px 16px;
          text-align: center;
          font-size: 11px;
          color: #6b7280;
          border-top: 1px solid #e5e7eb;
        }
        
        @media (max-width: 480px) {
          .echoai-widget {
            width: calc(100vw - 40px);
            height: calc(100vh - 100px);
            max-width: 320px;
            max-height: 500px;
          }
        }
      `;
    }
  };
})();