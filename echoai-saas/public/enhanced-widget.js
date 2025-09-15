(function () {
  "use strict";

  // State Manager - Centralized state management
  class StateManager {
    constructor() {
      this.state = {
        // UI State
        isOpen: false,
        activeTab: "chat",
        isLoading: false,
        isStreaming: false,

        // Conversation State
        conversationId: null,
        messages: [],
        conversationStatus: "AI_HANDLING",

        // Enhanced Features State
        proactiveQuestions: [],
        suggestedTopics: [],
        conversationActions: [],
        intelligenceMetadata: null,

        // Connection State
        realtimeConnected: false,
        realtimeError: null,

        // Content State
        faqs: [],
        conversationHistory: [],

        // Form State
        showEscalationDialog: false,
        showLeadCollection: false,
        escalationReason: "",
        leadCollectionData: {},
      };

      this.listeners = new Map();
    }

    getState() {
      return { ...this.state };
    }

    setState(updates) {
      const prevState = { ...this.state };
      this.state = { ...this.state, ...updates };
      this.notifyListeners(prevState, this.state);
    }

    subscribe(key, callback) {
      if (!this.listeners.has(key)) {
        this.listeners.set(key, []);
      }
      this.listeners.get(key).push(callback);

      // Return unsubscribe function
      return () => {
        const callbacks = this.listeners.get(key);
        if (callbacks) {
          const index = callbacks.indexOf(callback);
          if (index > -1) {
            callbacks.splice(index, 1);
          }
        }
      };
    }

    notifyListeners(prevState, newState) {
      this.listeners.forEach((callbacks, key) => {
        if (prevState[key] !== newState[key]) {
          callbacks.forEach((callback) =>
            callback(newState[key], prevState[key])
          );
        }
      });
    }
  }

  // Event Manager - DOM and custom event handling
  class EventManager {
    constructor() {
      this.eventListeners = new Map();
      this.customEventListeners = new Map();
    }

    addEventListener(element, event, handler, options = {}) {
      const key = `${element.id || "element"}-${event}`;

      if (!this.eventListeners.has(key)) {
        this.eventListeners.set(key, []);
      }

      const listenerInfo = { element, event, handler, options };
      this.eventListeners.get(key).push(listenerInfo);

      element.addEventListener(event, handler, options);

      return () => this.removeEventListener(element, event, handler);
    }

    removeEventListener(element, event, handler) {
      element.removeEventListener(event, handler);

      const key = `${element.id || "element"}-${event}`;
      const listeners = this.eventListeners.get(key);
      if (listeners) {
        const index = listeners.findIndex((l) => l.handler === handler);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    }

    emit(eventName, data) {
      const listeners = this.customEventListeners.get(eventName);
      if (listeners) {
        listeners.forEach((callback) => callback(data));
      }
    }

    on(eventName, callback) {
      if (!this.customEventListeners.has(eventName)) {
        this.customEventListeners.set(eventName, []);
      }
      this.customEventListeners.get(eventName).push(callback);

      return () => {
        const callbacks = this.customEventListeners.get(eventName);
        if (callbacks) {
          const index = callbacks.indexOf(callback);
          if (index > -1) {
            callbacks.splice(index, 1);
          }
        }
      };
    }

    cleanup() {
      // Remove all DOM event listeners
      this.eventListeners.forEach((listeners) => {
        listeners.forEach(({ element, event, handler }) => {
          element.removeEventListener(event, handler);
        });
      });

      this.eventListeners.clear();
      this.customEventListeners.clear();
    }
  }

  // API Client - All backend communication
  class APIClient {
    constructor(config, stateManager) {
      this.config = config;
      this.stateManager = stateManager;
      this.abortControllers = new Map();
    }

    async request(endpoint, options = {}) {
      const url = endpoint.startsWith("http")
        ? endpoint
        : `${this.config.apiUrl.replace(
            "/api/enhanced-chat/widget",
            ""
          )}${endpoint}`;

      const defaultOptions = {
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      };

      const response = await fetch(url, { ...defaultOptions, ...options });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    }

    async sendMessage(message, imageUrl, streaming = false) {
      const currentState = this.stateManager.getState();
      const body = {
        message,
        apiKey: this.config.apiKey,
        chatbotId: this.config.chatbotId,
        conversationId: currentState.conversationId ?? "",
        userEmail: this.config.userEmail, // Include userEmail
        imageUrl,
        stream: streaming,
      };

      if (streaming) {
        const abortController = new AbortController();
        this.abortControllers.set("streaming", abortController);

        return this.request("/api/enhanced-chat/widget", {
          method: "POST",
          body: JSON.stringify(body),
          signal: abortController.signal,
        });
      } else {
        const response = await this.request("/api/enhanced-chat/widget", {
          method: "POST",
          body: JSON.stringify(body),
        });
        const data = await response.json();

        // Save conversation ID if provided
        if (data.conversation_id && window.EchoAI) {
          window.EchoAI.saveConversationToStorage(data.conversation_id);
          this.stateManager.setState({ conversationId: data.conversation_id });
        } else if (data.session_id && window.EchoAI) {
          window.EchoAI.saveConversationToStorage(data.session_id);
          this.stateManager.setState({ conversationId: data.session_id });
        }

        return data;
      }
    }

    async sendStreamingMessage(message, imageUrl) {
      const abortController = new AbortController();
      this.abortControllers.set("streaming", abortController);

      try {
        const currentState = this.stateManager.getState();
        const body = {
          message,
          apiKey: this.config.apiKey,
          chatbotId: this.config.chatbotId,
          conversationId: currentState.conversationId,
          userEmail: this.config.userEmail, // Include userEmail
          imageUrl,
          stream: true,
        };

        const response = await this.request("/api/enhanced-chat/widget", {
          method: "POST",
          body: JSON.stringify(body),
          signal: abortController.signal,
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (error) {
        this.abortControllers.delete("streaming");
        throw error;
      }
    }

    async createStreamingConnection(
      message,
      imageUrl,
      onToken,
      onEnhancedData,
      onComplete,
      onError
    ) {
      try {
        const response = await this.sendStreamingMessage(message, imageUrl);
        await this.processStreamingResponse(
          response,
          onToken,
          onEnhancedData,
          onComplete,
          onError
        );
      } catch (error) {
        if (error.name === "AbortError") {
          console.log("EchoAI: Streaming cancelled by user");
          onError(new Error("Streaming cancelled"));
        } else {
          console.error("EchoAI: Streaming connection error:", error);
          onError(error);
        }
      }
    }

    async processStreamingResponse(
      response,
      onToken,
      onEnhancedData,
      onComplete,
      onError
    ) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let heartbeatTimeout;
      let lastActivity = Date.now();
      const HEARTBEAT_INTERVAL = 30000; // 30 seconds

      // Set up heartbeat monitoring
      const resetHeartbeat = () => {
        clearTimeout(heartbeatTimeout);
        lastActivity = Date.now();
        heartbeatTimeout = setTimeout(() => {
          if (Date.now() - lastActivity > HEARTBEAT_INTERVAL) {
            onError(new Error("Streaming connection timeout"));
          }
        }, HEARTBEAT_INTERVAL);
      };

      resetHeartbeat();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            clearTimeout(heartbeatTimeout);
            break;
          }

          resetHeartbeat();
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");

          // Keep the last incomplete line in buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.trim() === "") continue; // Skip empty lines

            if (line.startsWith("data: ")) {
              try {
                const jsonData = line.slice(6).trim();
                if (jsonData === "[DONE]") {
                  onComplete();
                  return;
                }

                const data = JSON.parse(jsonData);

                if (data.token) {
                  onToken(data.token);
                } else if (data.enhanced_data) {
                  onEnhancedData(data.enhanced_data);
                } else if (data.done) {
                  onComplete();
                  return;
                } else if (data.error) {
                  onError(new Error(data.error));
                  return;
                }
              } catch (e) {
                // Skip invalid JSON chunks but log for debugging
                console.warn("EchoAI: Invalid JSON in stream:", line, e);
              }
            } else if (line.startsWith("event: ")) {
              // Handle Server-Sent Events format
              const eventType = line.slice(7).trim();
              if (eventType === "error") {
                onError(new Error("Server sent error event"));
                return;
              }
            }
          }
        }
      } catch (error) {
        clearTimeout(heartbeatTimeout);
        if (error.name === "AbortError") {
          console.log("EchoAI: Streaming cancelled by user");
        } else {
          console.error("EchoAI: Streaming processing error:", error);
          onError(error);
        }
      } finally {
        clearTimeout(heartbeatTimeout);
        this.abortControllers.delete("streaming");
      }
    }

    async uploadImage(file, onProgress = null) {
      const formData = new FormData();
      formData.append("image", file);

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Handle upload progress
        if (onProgress) {
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              const percentComplete = (e.loaded / e.total) * 100;
              onProgress(percentComplete);
            }
          });
        }

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (error) {
              reject(new Error("Invalid JSON response"));
            }
          } else {
            reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Network error during upload"));
        });

        xhr.addEventListener("timeout", () => {
          reject(new Error("Upload timeout"));
        });

        const url = "/api/upload/image".startsWith("http")
          ? "/api/upload/image"
          : `${this.config.apiUrl.replace(
              "/api/enhanced-chat/widget",
              ""
            )}/api/upload/image`;

        xhr.open("POST", url);
        xhr.timeout = 30000; // 30 second timeout
        xhr.send(formData);
      });
    }

    async loadFAQs() {
      const response = await this.request(
        `/api/faq?chatbotId=${this.config.chatbotId}`
      );
      return response.json();
    }

    async trackFAQUsage(faqId) {
      try {
        const response = await this.request("/api/faq/track-usage", {
          method: "POST",
          body: JSON.stringify({
            faqId: faqId,
            chatbotId: this.config.chatbotId,
            timestamp: new Date().toISOString(),
          }),
        });
        return response.json();
      } catch (error) {
        // Don't throw - usage tracking is not critical
        console.debug("EchoAI: FAQ usage tracking failed:", error);
        return null;
      }
    }

    async loadConversationHistory(page = 1, limit = 20, search = "") {
      const params = new URLSearchParams({
        userEmail: this.config.userEmail || "preview@example.com",
        page: page.toString(),
        limit: limit.toString(),
      });

      if (search) {
        params.append("search", search);
      }

      const response = await this.request(
        `/api/chat/history?${params.toString()}`
      );
      return response.json();
    }

    async loadConversation(sessionId) {
      const response = await this.request(`/api/chat/session/${sessionId}`);
      return response.json();
    }

    async loadChatbotSettings() {
      const apiUrl = this.config.apiUrl.replace(
        "/api/enhanced-chat/widget",
        "/api/public/chatbots/" + this.config.chatbotId
      );
      const response = await this.request(apiUrl);
      return response.json();
    }

    cancelStreaming() {
      const controller = this.abortControllers.get("streaming");
      if (controller) {
        controller.abort();
        this.abortControllers.delete("streaming");
      }
    }

    cleanup() {
      this.abortControllers.forEach((controller) => controller.abort());
      this.abortControllers.clear();
    }
  }

  // Realtime Manager - Handle WebSocket/SSE connections and conversation status
  class RealtimeManager {
    constructor(config, stateManager, eventManager) {
      this.config = config;
      this.stateManager = stateManager;
      this.eventManager = eventManager;

      // Connection properties
      this.connection = null;
      this.connectionType = null; // 'websocket' or 'sse'
      this.isConnected = false;
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 10;
      this.reconnectDelay = 1000; // Start with 1 second
      this.maxReconnectDelay = 30000; // Max 30 seconds
      this.heartbeatInterval = null;
      this.heartbeatTimeout = null;
      this.lastHeartbeat = null;

      // Message delivery tracking
      this.pendingMessages = new Map();
      this.messageDeliveryTimeout = 10000; // 10 seconds

      // Conversation status tracking
      this.conversationStatus = "AI_HANDLING";
      this.statusUpdateCallbacks = new Set();

      // Initialize connection
      this.initializeConnection();
    }

    async initializeConnection() {
      try {
        // Try WebSocket first, fallback to Server-Sent Events
        if (this.supportsWebSocket()) {
          await this.connectWebSocket();
        } else {
          await this.connectServerSentEvents();
        }
      } catch (error) {
        console.error(
          "EchoAI: Failed to initialize realtime connection:",
          error
        );
        this.handleConnectionError(error);
      }
    }

    supportsWebSocket() {
      return (
        typeof WebSocket !== "undefined" && WebSocket.CLOSING !== undefined
      );
    }

    async connectWebSocket() {
      try {
        const wsUrl = this.getWebSocketUrl();
        this.connection = new WebSocket(wsUrl);
        this.connectionType = "websocket";

        this.connection.onopen = () => {
          console.log("EchoAI: WebSocket connected");
          this.handleConnectionOpen();
        };

        this.connection.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.connection.onclose = (event) => {
          console.log("EchoAI: WebSocket closed:", event.code, event.reason);
          this.handleConnectionClose(event);
        };

        this.connection.onerror = (error) => {
          console.error("EchoAI: WebSocket error:", error);
          this.handleConnectionError(error);
        };
      } catch (error) {
        console.error("EchoAI: WebSocket connection failed:", error);
        throw error;
      }
    }

    async connectServerSentEvents() {
      try {
        const sseUrl = this.getServerSentEventsUrl();
        this.connection = new EventSource(sseUrl);
        this.connectionType = "sse";

        this.connection.onopen = () => {
          console.log("EchoAI: Server-Sent Events connected");
          this.handleConnectionOpen();
        };

        this.connection.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.connection.onerror = (error) => {
          console.error("EchoAI: Server-Sent Events error:", error);
          this.handleConnectionError(error);
        };

        // Handle specific event types
        this.connection.addEventListener("message", (event) => {
          this.handleRealtimeMessage(JSON.parse(event.data));
        });

        this.connection.addEventListener("status", (event) => {
          this.handleStatusUpdate(JSON.parse(event.data));
        });

        this.connection.addEventListener("heartbeat", (event) => {
          this.handleHeartbeat();
        });
      } catch (error) {
        console.error("EchoAI: Server-Sent Events connection failed:", error);
        throw error;
      }
    }

    getWebSocketUrl() {
      const baseUrl = this.config.apiUrl.replace(/^https?:\/\//, "");
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${baseUrl}/ws/chat/${this.config.chatbotId}?apiKey=${this.config.apiKey}`;
    }

    getServerSentEventsUrl() {
      const baseUrl = this.config.apiUrl.replace(
        "/api/enhanced-chat/widget",
        ""
      );
      return `${baseUrl}/api/realtime/events?chatbotId=${this.config.chatbotId}&apiKey=${this.config.apiKey}`;
    }

    handleConnectionOpen() {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;

      // Update state
      this.stateManager.setState({
        realtimeConnected: true,
        realtimeError: null,
      });

      // Start heartbeat
      this.startHeartbeat();

      // Emit connection event
      this.eventManager.emit("realtime-connected", {
        connectionType: this.connectionType,
      });

      // Send authentication and subscribe to conversation
      this.authenticateConnection();
    }

    handleConnectionClose(event) {
      this.isConnected = false;
      this.stopHeartbeat();

      // Update state
      this.stateManager.setState({
        realtimeConnected: false,
        realtimeError: event.reason || "Connection closed",
      });

      // Emit disconnection event
      this.eventManager.emit("realtime-disconnected", {
        code: event.code,
        reason: event.reason,
      });

      // Attempt reconnection if not intentional close
      if (
        event.code !== 1000 &&
        this.reconnectAttempts < this.maxReconnectAttempts
      ) {
        this.scheduleReconnect();
      }
    }

    handleConnectionError(error) {
      this.isConnected = false;
      this.stopHeartbeat();

      // Update state
      this.stateManager.setState({
        realtimeConnected: false,
        realtimeError: error.message || "Connection error",
      });

      // Emit error event
      this.eventManager.emit("realtime-error", { error });

      // Attempt reconnection
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    }

    scheduleReconnect() {
      this.reconnectAttempts++;

      // Exponential backoff with jitter
      const jitter = Math.random() * 1000;
      const delay = Math.min(
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1) + jitter,
        this.maxReconnectDelay
      );

      console.log(
        `EchoAI: Scheduling reconnect attempt ${
          this.reconnectAttempts
        } in ${Math.round(delay)}ms`
      );

      setTimeout(() => {
        if (!this.isConnected) {
          this.initializeConnection();
        }
      }, delay);
    }

    handleMessage(data) {
      try {
        const message = typeof data === "string" ? JSON.parse(data) : data;

        switch (message.type) {
          case "message":
            this.handleRealtimeMessage(message);
            break;
          case "status":
            this.handleStatusUpdate(message);
            break;
          case "delivery_confirmation":
            this.handleDeliveryConfirmation(message);
            break;
          case "heartbeat":
            this.handleHeartbeat();
            break;
          case "error":
            this.handleServerError(message);
            break;
          default:
            console.warn("EchoAI: Unknown message type:", message.type);
        }
      } catch (error) {
        console.error("EchoAI: Error parsing realtime message:", error);
      }
    }

    handleRealtimeMessage(message) {
      // Add message to chat interface
      if (window.EchoAI && window.EchoAI.uiManager) {
        const messageId = window.EchoAI.uiManager.addMessage(
          message.content,
          message.role || "agent",
          message.imageUrl,
          {
            id: message.id,
            timestamp: new Date(message.createdAt),
            status: "delivered",
            metadata: message.metadata,
          }
        );

        // Send delivery confirmation
        this.sendDeliveryConfirmation(message.id);

        // Emit message received event
        this.eventManager.emit("message-received", {
          message: message,
          messageId: messageId,
        });
      }
    }

    handleStatusUpdate(statusData) {
      const previousStatus = this.conversationStatus;
      this.conversationStatus = statusData.status;

      // Update state
      this.stateManager.setState({
        conversationStatus: statusData.status,
      });

      // Update UI based on status
      this.updateConversationStatusUI(statusData.status, statusData);

      // Notify callbacks
      this.statusUpdateCallbacks.forEach((callback) => {
        try {
          callback(statusData.status, previousStatus, statusData);
        } catch (error) {
          console.error("EchoAI: Error in status update callback:", error);
        }
      });

      // Emit status change event
      this.eventManager.emit("conversation-status-changed", {
        status: statusData.status,
        previousStatus: previousStatus,
        data: statusData,
      });
    }

    handleDeliveryConfirmation(confirmation) {
      const messageId = confirmation.messageId;

      if (this.pendingMessages.has(messageId)) {
        clearTimeout(this.pendingMessages.get(messageId).timeout);
        this.pendingMessages.delete(messageId);

        // Update message status in UI
        this.updateMessageStatus(messageId, "delivered");

        // Emit delivery confirmed event
        this.eventManager.emit("message-delivered", { messageId });
      }
    }

    handleHeartbeat() {
      this.lastHeartbeat = Date.now();

      // Reset heartbeat timeout
      if (this.heartbeatTimeout) {
        clearTimeout(this.heartbeatTimeout);
      }

      this.heartbeatTimeout = setTimeout(() => {
        console.warn("EchoAI: Heartbeat timeout, connection may be lost");
        this.handleConnectionError(new Error("Heartbeat timeout"));
      }, 35000); // 35 seconds timeout
    }

    handleServerError(errorMessage) {
      console.error("EchoAI: Server error:", errorMessage);

      // Update state with error
      this.stateManager.setState({
        realtimeError: errorMessage.message || "Server error",
      });

      // Emit error event
      this.eventManager.emit("realtime-server-error", { error: errorMessage });
    }

    startHeartbeat() {
      // Send heartbeat every 30 seconds
      this.heartbeatInterval = setInterval(() => {
        if (this.isConnected) {
          this.sendHeartbeat();
        }
      }, 30000);
    }

    stopHeartbeat() {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      if (this.heartbeatTimeout) {
        clearTimeout(this.heartbeatTimeout);
        this.heartbeatTimeout = null;
      }
    }

    sendHeartbeat() {
      if (this.isConnected && this.connection) {
        const heartbeat = {
          type: "heartbeat",
          timestamp: Date.now(),
        };

        try {
          if (this.connectionType === "websocket") {
            this.connection.send(JSON.stringify(heartbeat));
          }
          // SSE doesn't need to send heartbeats, only receive them
        } catch (error) {
          console.error("EchoAI: Error sending heartbeat:", error);
        }
      }
    }

    authenticateConnection() {
      if (this.isConnected && this.connection) {
        const authMessage = {
          type: "authenticate",
          apiKey: this.config.apiKey,
          chatbotId: this.config.chatbotId,
          conversationId: this.stateManager.getState().conversationId,
        };

        try {
          if (this.connectionType === "websocket") {
            this.connection.send(JSON.stringify(authMessage));
          }
          // SSE authentication is handled via URL parameters
        } catch (error) {
          console.error("EchoAI: Error authenticating connection:", error);
        }
      }
    }

    sendDeliveryConfirmation(messageId) {
      if (this.isConnected && this.connection) {
        const confirmation = {
          type: "delivery_confirmation",
          messageId: messageId,
          timestamp: Date.now(),
        };

        try {
          if (this.connectionType === "websocket") {
            this.connection.send(JSON.stringify(confirmation));
          }
          // For SSE, we might need to send via HTTP POST
        } catch (error) {
          console.error("EchoAI: Error sending delivery confirmation:", error);
        }
      }
    }

    trackMessageDelivery(messageId) {
      // Set up timeout for message delivery
      const timeout = setTimeout(() => {
        console.warn(`EchoAI: Message ${messageId} delivery timeout`);
        this.updateMessageStatus(messageId, "failed");
        this.pendingMessages.delete(messageId);

        // Emit delivery failed event
        this.eventManager.emit("message-delivery-failed", { messageId });
      }, this.messageDeliveryTimeout);

      this.pendingMessages.set(messageId, {
        timeout: timeout,
        timestamp: Date.now(),
      });

      // Update message status to pending
      this.updateMessageStatus(messageId, "pending");
    }

    updateMessageStatus(messageId, status) {
      if (window.EchoAI && window.EchoAI.uiManager) {
        const messageElement = document.querySelector(
          `[data-message-id="${messageId}"]`
        );
        if (messageElement) {
          // Remove old status classes
          messageElement.classList.remove(
            "echoai-message-pending",
            "echoai-message-delivered",
            "echoai-message-failed"
          );

          // Add new status class
          messageElement.classList.add(`echoai-message-${status}`);

          // Update status icon
          const statusElement = messageElement.querySelector(
            ".echoai-message-status"
          );
          if (statusElement) {
            statusElement.innerHTML =
              window.EchoAI.uiManager.getStatusIcon(status);
            statusElement.setAttribute("aria-label", `Message ${status}`);
          }
        }
      }
    }

    updateConversationStatusUI(status, statusData) {
      if (window.EchoAI && window.EchoAI.uiManager) {
        window.EchoAI.uiManager.updateConversationStatus(status, statusData);
      }
    }

    // Public methods for conversation status management
    onStatusUpdate(callback) {
      this.statusUpdateCallbacks.add(callback);

      // Return unsubscribe function
      return () => {
        this.statusUpdateCallbacks.delete(callback);
      };
    }

    getCurrentStatus() {
      return this.conversationStatus;
    }

    isHumanAgentActive() {
      return this.conversationStatus === "AWAITING_HUMAN_RESPONSE";
    }

    isConversationResolved() {
      return this.conversationStatus === "RESOLVED";
    }

    // Connection management methods
    disconnect() {
      if (this.connection) {
        this.isConnected = false;
        this.stopHeartbeat();

        if (this.connectionType === "websocket") {
          this.connection.close(1000, "Client disconnect");
        } else if (this.connectionType === "sse") {
          this.connection.close();
        }

        this.connection = null;
      }
    }

    reconnect() {
      this.disconnect();
      this.reconnectAttempts = 0;
      this.initializeConnection();
    }

    getConnectionStatus() {
      return {
        isConnected: this.isConnected,
        connectionType: this.connectionType,
        reconnectAttempts: this.reconnectAttempts,
        lastHeartbeat: this.lastHeartbeat,
        conversationStatus: this.conversationStatus,
      };
    }

    cleanup() {
      this.disconnect();
      this.statusUpdateCallbacks.clear();
      this.pendingMessages.forEach(({ timeout }) => clearTimeout(timeout));
      this.pendingMessages.clear();
    }
  }

  // Theme Manager - Handle light theme styling and CSS custom properties
  class ThemeManager {
    constructor(config) {
      this.config = config;
      this.cssVariables = new Map();
      this.initializeTheme();
    }

    initializeTheme() {
      // Set light theme CSS custom properties
      const primaryColor = this.config.primaryColor || "#3b82f6";
      this.setCSSVariable("--echoai-primary-color", primaryColor);
      this.setCSSVariable(
        "--echoai-primary-hover",
        this.lightenColor(primaryColor, -10)
      );
      this.setCSSVariable(
        "--echoai-primary-light",
        this.lightenColor(primaryColor, 90)
      );

      // Light theme colors only
      this.setCSSVariable("--echoai-text-primary", "#374151");
      this.setCSSVariable("--echoai-text-secondary", "#6b7280");
      this.setCSSVariable("--echoai-text-muted", "#9ca3af");
      this.setCSSVariable("--echoai-background", "#ffffff");
      this.setCSSVariable("--echoai-background-secondary", "#f8fafc");
      this.setCSSVariable("--echoai-border", "#e5e7eb");
      this.setCSSVariable("--echoai-border-light", "#f3f4f6");
      this.setCSSVariable("--echoai-shadow", "0 20px 60px rgba(0, 0, 0, 0.15)");
      this.setCSSVariable("--echoai-radius", "16px");
      this.setCSSVariable("--echoai-radius-small", "8px");
      this.setCSSVariable("--echoai-spacing-xs", "4px");
      this.setCSSVariable("--echoai-spacing-sm", "8px");
      this.setCSSVariable("--echoai-spacing-md", "12px");
      this.setCSSVariable("--echoai-spacing-lg", "16px");
      this.setCSSVariable("--echoai-spacing-xl", "20px");
    }

    setCSSVariable(property, value) {
      this.cssVariables.set(property, value);
      document.documentElement.style.setProperty(property, value);
    }

    getCSSVariable(property) {
      return this.cssVariables.get(property);
    }

    updatePrimaryColor(color) {
      this.setCSSVariable("--echoai-primary-color", color);
      this.setCSSVariable(
        "--echoai-primary-hover",
        this.lightenColor(color, -10)
      );
      this.setCSSVariable(
        "--echoai-primary-light",
        this.lightenColor(color, 90)
      );
    }

    lightenColor(color, percent) {
      const num = parseInt(color.replace("#", ""), 16);
      const amt = Math.round(2.55 * percent);
      const R = (num >> 16) + amt;
      const G = ((num >> 8) & 0x00ff) + amt;
      const B = (num & 0x0000ff) + amt;
      return (
        "#" +
        (
          0x1000000 +
          (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
          (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
          (B < 255 ? (B < 1 ? 0 : B) : 255)
        )
          .toString(16)
          .slice(1)
      );
    }

    generateColorTheme(primaryColor) {
      this.updatePrimaryColor(primaryColor);

      // Calculate contrast ratio for accessibility
      const contrast = this.calculateContrast(primaryColor, "#ffffff");
      if (contrast < 4.5) {
        // If contrast is too low, darken the color
        const darkerColor = this.lightenColor(primaryColor, -20);
        this.updatePrimaryColor(darkerColor);
      }
    }

    calculateContrast(color1, color2) {
      const getLuminance = (color) => {
        const rgb = parseInt(color.slice(1), 16);
        const r = (rgb >> 16) & 0xff;
        const g = (rgb >> 8) & 0xff;
        const b = (rgb >> 0) & 0xff;

        const [rs, gs, bs] = [r, g, b].map((c) => {
          c = c / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });

        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      };

      const lum1 = getLuminance(color1);
      const lum2 = getLuminance(color2);
      const brightest = Math.max(lum1, lum2);
      const darkest = Math.min(lum1, lum2);

      return (brightest + 0.05) / (darkest + 0.05);
    }
  }

  // Responsive Manager - Handle responsive design and breakpoints
  class ResponsiveManager {
    constructor() {
      this.breakpoints = {
        mobile: 480,
        tablet: 768,
        desktop: 1024,
      };
      this.currentBreakpoint = this.getCurrentBreakpoint();
      this.setupResizeListener();
    }

    getCurrentBreakpoint() {
      const width = window.innerWidth;
      if (width <= this.breakpoints.mobile) return "mobile";
      if (width <= this.breakpoints.tablet) return "tablet";
      return "desktop";
    }

    setupResizeListener() {
      let resizeTimeout;
      window.addEventListener("resize", () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          const newBreakpoint = this.getCurrentBreakpoint();
          if (newBreakpoint !== this.currentBreakpoint) {
            this.currentBreakpoint = newBreakpoint;
            this.onBreakpointChange(newBreakpoint);
          }
        }, 100);
      });
    }

    onBreakpointChange(breakpoint) {
      // Emit custom event for breakpoint changes
      document.dispatchEvent(
        new CustomEvent("echoai:breakpoint-change", {
          detail: { breakpoint },
        })
      );
    }

    isMobile() {
      return this.currentBreakpoint === "mobile";
    }

    isTablet() {
      return this.currentBreakpoint === "tablet";
    }

    isDesktop() {
      return this.currentBreakpoint === "desktop";
    }

    getResponsiveConfig(config) {
      const baseConfig = { ...config };

      if (this.isMobile()) {
        return {
          ...baseConfig,
          width: "calc(100vw - 40px)",
          height: "calc(100vh - 120px)",
          maxWidth: "380px",
          maxHeight: "600px",
          position: "fixed",
          bottom: "20px",
          left: "20px",
          right: "20px",
          top: "auto",
        };
      }

      return baseConfig;
    }
  }

  // UI Manager - Handle all UI rendering and updates
  class UIManager {
    constructor(config, stateManager, eventManager, apiClient) {
      this.config = config;
      this.stateManager = stateManager;
      this.eventManager = eventManager;
      this.apiClient = apiClient;
      this.container = null;
      this.elements = {};
      this.templates = {};
      this.themeManager = new ThemeManager(config);
      this.responsiveManager = new ResponsiveManager();

      // Tab system properties
      this.tabContentCache = new Map();
      this.tabLoadingStates = new Map();
      this.tabTransitionDuration = 300;
      this.focusableElements =
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

      // Initialize virtual scrolling
      this.initializeVirtualScrolling();

      // Initialize templates
      this.initializeTemplates();
    }

    initializeTemplates() {
      // Message templates
      this.templates.message = {
        user: (content, imageUrl, timestamp) => `
          <div class="echoai-message echoai-message-user">
            ${
              imageUrl
                ? `<div class="echoai-message-image"><img src="${imageUrl}" alt="Uploaded image" /></div>`
                : ""
            }
            <div class="echoai-message-content">${this.escapeHtml(
              content
            )}</div>
            <div class="echoai-message-time">${timestamp}</div>
          </div>
        `,
        assistant: (content, timestamp) => `
          <div class="echoai-message echoai-message-assistant">
            <div class="echoai-message-content">${this.escapeHtml(
              content
            )}</div>
            <div class="echoai-message-time">${timestamp}</div>
          </div>
        `,
        streaming: (messageId, timestamp) => `
          <div class="echoai-message echoai-message-assistant echoai-streaming" id="${messageId}">
            <div class="echoai-message-content">
              <span class="echoai-streaming-text"></span>
              ${
                this.config.streamingConfig.showTypingIndicator
                  ? '<span class="echoai-cursor">|</span>'
                  : ""
              }
            </div>
            <div class="echoai-message-time">${timestamp}</div>
          </div>
        `,
        typing: () => `
          <div class="echoai-message echoai-message-assistant echoai-typing">
            <div class="echoai-message-content">
              <div class="echoai-typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        `,
      };

      // Tab templates
      this.templates.tab = (tabId, label, isActive = false) => `
        <button 
          class="echoai-tab ${isActive ? "echoai-tab-active" : ""}" 
          data-tab="${tabId}"
          role="tab"
          aria-selected="${isActive}"
          aria-controls="${tabId}-panel"
          id="${tabId}-tab"
          tabindex="${isActive ? "0" : "-1"}"
        >
          ${label}
        </button>
      `;

      // Intelligence panel templates
      this.templates.intelligence = {
        proactiveQuestions: (questions) => `
          <div class="echoai-intelligence-section">
            <h4>Suggested Questions</h4>
            <div class="echoai-question-buttons">
              ${questions
                .map(
                  (q) => `
                <button class="echoai-proactive-btn" data-question="${this.escapeHtml(
                  q
                )}">
                  ${this.escapeHtml(q)}
                </button>
              `
                )
                .join("")}
            </div>
          </div>
        `,
        suggestedTopics: (topics) => `
          <div class="echoai-intelligence-section">
            <h4>Related Topics</h4>
            <div class="echoai-topic-buttons">
              ${topics
                .map(
                  (topic) => `
                <button class="echoai-topic-btn" data-topic="${this.escapeHtml(
                  topic
                )}">
                  ${this.escapeHtml(topic)}
                </button>
              `
                )
                .join("")}
            </div>
          </div>
        `,
        conversationActions: (actions) => `
          <div class="echoai-intelligence-section">
            <h4>Suggested Actions</h4>
            <div class="echoai-action-buttons">
              ${actions
                .filter((action) => action.priority > 0.5)
                .map(
                  (action) => `
                <button class="echoai-action-btn" data-action-type="${
                  action.action_type
                }" data-content="${this.escapeHtml(action.content)}">
                  ${this.escapeHtml(action.content)}
                </button>
              `
                )
                .join("")}
            </div>
          </div>
        `,
      };

      // FAQ templates
      this.templates.faq = {
        item: (faq) => `
          <div class="echoai-faq-item" 
               data-faq-id="${faq.id || ""}"
               data-question="${this.escapeHtml(faq.question)}" 
               data-answer="${this.escapeHtml(faq.answer)}"
               data-category="${this.escapeHtml(faq.category || "General")}"
               tabindex="0"
               role="button"
               aria-label="FAQ: ${this.escapeHtml(faq.question)}">
            <div class="echoai-faq-question">
              ${this.escapeHtml(faq.question)}
              ${
                faq.popularity > 0
                  ? `<span class="echoai-faq-popularity" title="Popular FAQ">ðŸ”¥</span>`
                  : ""
              }
            </div>
            <div class="echoai-faq-answer">${this.escapeHtml(faq.answer)}</div>
            <div class="echoai-faq-meta">
              <span class="echoai-faq-category">${this.escapeHtml(
                faq.category || "General"
              )}</span>
              ${
                faq.viewCount > 0
                  ? `<span class="echoai-faq-views">${faq.viewCount} views</span>`
                  : ""
              }
              ${
                faq.helpfulCount > 0
                  ? `<span class="echoai-faq-helpful">ðŸ‘ ${faq.helpfulCount}</span>`
                  : ""
              }
            </div>
          </div>
        `,
        category: (categoryName, faqs) => `
          <div class="echoai-faq-category-section" data-category="${this.escapeHtml(
            categoryName
          )}">
            <h3 class="echoai-faq-category-title">${this.escapeHtml(
              categoryName
            )}</h3>
            <div class="echoai-faq-category-items">
              ${faqs.map((faq) => this.templates.faq.item(faq)).join("")}
            </div>
          </div>
        `,
        empty: () => `
          <div class="echoai-no-content">
            <div class="echoai-no-content-icon">â“</div>
            <div class="echoai-no-content-title">No FAQs available</div>
            <div class="echoai-no-content-message">Check back later for frequently asked questions.</div>
          </div>
        `,
        loading: () => `
          <div class="echoai-loading">
            <div class="echoai-loading-spinner"></div>
            <div class="echoai-loading-text">Loading FAQs...</div>
          </div>
        `,
        error: () => `
          <div class="echoai-error">
            <div class="echoai-error-icon">âš ï¸</div>
            <div class="echoai-error-title">Failed to load FAQs</div>
            <div class="echoai-error-message">Please try again later or contact support.</div>
            <button class="echoai-error-retry" onclick="window.EchoAI?.uiManager?.refreshTabContent('faq')">
              Retry
            </button>
          </div>
        `,
        noResults: () => `
          <div class="echoai-no-content">
            <div class="echoai-no-content-icon">ðŸ”</div>
            <div class="echoai-no-content-title">No matching FAQs found</div>
            <div class="echoai-no-content-message">Try adjusting your search terms.</div>
          </div>
        `,
      };

      // History templates
      this.templates.history = {
        item: (conversation) => `
          <div class="echoai-history-item" data-session-id="${
            conversation.sessionId
          }">
            <div class="echoai-history-question" title="${this.escapeHtml(
              conversation.lastUserMessage || conversation.preview
            )}">${this.escapeHtml(
          this.truncateText(
            conversation.lastUserMessage || conversation.preview,
            60
          )
        )}</div>
            <div class="echoai-history-answer" title="${this.escapeHtml(
              conversation.lastAiMessage || "No response yet"
            )}">${this.escapeHtml(
          this.truncateText(conversation.lastAiMessage || "No response yet", 60)
        )}</div>
            <div class="echoai-history-meta">
              <span>${conversation.messageCount} messages</span>
              <span>${conversation.timestamp}</span>
            </div>
          </div>
        `,
        empty: () => `
          <div class="echoai-no-content">
            <div class="echoai-no-content-icon">ðŸ’¬</div>
            <div class="echoai-no-content-title">No conversation history</div>
            <div class="echoai-no-content-message">Start a conversation to see your chat history here.</div>
          </div>
        `,
        loading: () => `
          <div class="echoai-loading">
            <div class="echoai-loading-spinner"></div>
            <div class="echoai-loading-text">Loading conversation history...</div>
          </div>
        `,
        error: () => `
          <div class="echoai-error">
            <div class="echoai-error-icon">âš ï¸</div>
            <div class="echoai-error-title">Failed to load history</div>
            <div class="echoai-error-message">Unable to load your conversation history. Please try again.</div>
            <button class="echoai-error-retry" type="button">Retry</button>
          </div>
        `,
      };
    }

    escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }

    // Truncate text to specified length with ellipsis
    truncateText(text, maxLength = 60) {
      if (!text) return "";
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength).trim() + "...";
    }

    // Image validation and handling methods
    validateImageFile(file) {
      const errors = [];

      // Check file type
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
      ];
      if (!allowedTypes.includes(file.type)) {
        errors.push(
          "File type not supported. Please use JPG, PNG, GIF, or WebP."
        );
      }

      // Check file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        errors.push("File size too large. Maximum size is 10MB.");
      }

      // Check if file is actually an image
      if (!file.type.startsWith("image/")) {
        errors.push("Selected file is not an image.");
      }

      return {
        isValid: errors.length === 0,
        errors: errors,
      };
    }

    formatFileSize(bytes) {
      if (bytes === 0) return "0 Bytes";
      const k = 1024;
      const sizes = ["Bytes", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }

    showImagePreview(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageHtml = `
          <div class="echoai-image-preview-container">
            <img src="${
              e.target.result
            }" alt="Upload preview" class="echoai-preview-image" />
            <div class="echoai-image-info">
              <span class="echoai-image-name">${this.escapeHtml(
                file.name
              )}</span>
              <span class="echoai-image-size">${this.formatFileSize(
                file.size
              )}</span>
            </div>
          </div>
        `;
        this.elements.imagePreview.innerHTML = imageHtml;
        this.elements.imageUpload.style.display = "block";
        this.hideDragDropArea();
      };
      reader.readAsDataURL(file);
    }

    showUploadProgress(show = true) {
      if (this.elements.uploadProgress) {
        this.elements.uploadProgress.style.display = show ? "block" : "none";
      }
    }

    updateUploadProgress(percentage) {
      if (this.elements.progressFill && this.elements.progressText) {
        this.elements.progressFill.style.width = `${percentage}%`;
        this.elements.progressText.textContent = `Uploading... ${Math.round(
          percentage
        )}%`;
      }
    }

    showUploadError(message) {
      this.showNotification(message, "error");
      this.showUploadProgress(false);
    }

    showDragDropArea() {
      if (this.elements.dragDropArea) {
        this.elements.dragDropArea.style.display = "block";
      }
    }

    hideDragDropArea() {
      if (this.elements.dragDropArea) {
        this.elements.dragDropArea.style.display = "none";
      }
    }

    showNotification(message, type = "info") {
      // Create notification element if it doesn't exist
      let notification = this.container.querySelector(".echoai-notification");
      if (!notification) {
        notification = document.createElement("div");
        notification.className = "echoai-notification";
        this.container.appendChild(notification);
      }

      notification.className = `echoai-notification echoai-notification-${type}`;
      notification.textContent = message;
      notification.style.display = "block";

      // Auto-hide after 5 seconds
      setTimeout(() => {
        notification.style.display = "none";
      }, 5000);
    }

    clearImageUpload() {
      if (this.elements.fileInput) this.elements.fileInput.value = "";
      if (this.elements.imageUpload)
        this.elements.imageUpload.style.display = "none";
      if (this.elements.imagePreview) this.elements.imagePreview.innerHTML = "";
      this.showUploadProgress(false);
      this.hideDragDropArea();
    }

    renderTemplate(templatePath, ...args) {
      const pathParts = templatePath.split(".");
      let template = this.templates;

      for (const part of pathParts) {
        template = template[part];
        if (!template) {
          console.error(`Template not found: ${templatePath}`);
          return "";
        }
      }

      return typeof template === "function" ? template(...args) : template;
    }

    createWidget() {
      // Create widget container
      this.container = document.createElement("div");
      this.container.id = "echoai-enhanced-widget-container";
      this.container.className = "echoai-enhanced-widget-container";

      // Apply responsive configuration
      this.applyResponsiveStyles();

      // Create widget HTML using templates
      this.container.innerHTML = this.generateWidgetHTML();

      // Append to body
      document.body.appendChild(this.container);

      // Cache important elements
      this.cacheElements();

      // Setup responsive listeners
      this.setupResponsiveListeners();

      // Apply theme
      this.applyTheme();

      return this.container;
    }

    applyResponsiveStyles() {
      const responsiveConfig = this.responsiveManager.getResponsiveConfig({
        position: this.config.position,
      });

      // Set base position styles
      const positions = {
        "bottom-right": { bottom: "20px", right: "20px" },
        "bottom-left": { bottom: "20px", left: "20px" },
        "top-right": { top: "20px", right: "20px" },
        "top-left": { top: "20px", left: "20px" },
      };

      const baseStyles = {
        position: "fixed",
        zIndex: "9999",
        ...positions[this.config.position],
      };

      // Apply responsive overrides
      Object.assign(this.container.style, baseStyles, responsiveConfig);
    }

    setupResponsiveListeners() {
      document.addEventListener("echoai:breakpoint-change", (e) => {
        this.handleBreakpointChange(e.detail.breakpoint);
      });
    }

    handleBreakpointChange(breakpoint) {
      // Reapply responsive styles
      this.applyResponsiveStyles();

      // Adjust widget layout for mobile
      if (breakpoint === "mobile") {
        this.container.classList.add("echoai-mobile");
      } else {
        this.container.classList.remove("echoai-mobile");
      }
    }

    applyTheme() {
      // Apply light theme class
      this.container.classList.add("echoai-theme-light");

      // Apply primary color if specified
      if (this.config.primaryColor) {
        this.themeManager.generateColorTheme(this.config.primaryColor);
        // Also set the CSS variable for immediate use
        document.documentElement.style.setProperty(
          "--echoai-primary-color",
          this.config.primaryColor
        );
      }
    }

    cacheElements() {
      console.log("EchoAI: Caching elements from container:", this.container);
      console.log(
        "EchoAI: Container HTML:",
        this.container.innerHTML.substring(0, 500)
      );

      this.elements = {
        widget: this.container.querySelector(".echoai-enhanced-widget"),
        toggleBtn: this.container.querySelector(".echoai-toggle-btn"),
        closeBtn: this.container.querySelector(".echoai-close-btn"),
        input: this.container.querySelector(".echoai-input"),
        sendBtn: this.container.querySelector(".echoai-send-btn"),
        messagesContainer: this.container.querySelector("#echoai-messages"),
        tabs: this.container.querySelectorAll(".echoai-tab"),
        tabPanels: this.container.querySelectorAll(".echoai-tab-panel"),
        intelligencePanel: this.container.querySelector(
          "#echoai-intelligence-panel"
        ),
        fileInput: this.container.querySelector("#echoai-file-input"),
        imageUpload: this.container.querySelector("#echoai-image-upload"),
        imagePreview: this.container.querySelector("#echoai-image-preview"),
        removeImageBtn: this.container.querySelector("#echoai-remove-image"),
        uploadBtn: this.container.querySelector("#echoai-upload-btn"),
        escalateBtn: this.container.querySelector("#echoai-escalate-btn"),
        dragDropArea: this.container.querySelector("#echoai-drag-drop-area"),
        browseBtn: this.container.querySelector("#echoai-browse-btn"),
        uploadProgress: this.container.querySelector("#echoai-upload-progress"),
        progressFill: this.container.querySelector("#echoai-progress-fill"),
        progressText: this.container.querySelector("#echoai-progress-text"),
        botStatus: this.container.querySelector("#echoai-bot-status"),
        connectionStatus: this.container.querySelector(
          "#echoai-connection-status"
        ),
      };

      console.log("EchoAI: Cached tabs:", this.elements.tabs.length);
      console.log("EchoAI: Cached panels:", this.elements.tabPanels.length);
      console.log("EchoAI: Widget element:", this.elements.widget);
    }

    generateWidgetHTML() {
      return `
        <div class="echoai-enhanced-widget" style="display: none;">
          <div class="echoai-chat-container">
            ${this.generateHeader()}
            ${this.generateTabs()}
            ${this.generateTabContent()}
            ${this.generateBranding()}
          </div>
        </div>
        ${this.generateToggleButton()}
        ${this.generateFileInput()}
      `;
    }

    generateHeader() {
      return `
        <div class="echoai-header">
          <div class="echoai-header-content">
            <div class="echoai-bot-avatar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
              </svg>
            </div>
            <div class="echoai-header-text">
              <div class="echoai-bot-name">${
                this.config.chatbotName || "AI Assistant"
              }</div>
              <div class="echoai-bot-status" id="echoai-bot-status">Online</div>
            </div>
            <div class="echoai-connection-status" id="echoai-connection-status" style="display: none;">
              <div class="echoai-connection-indicator"></div>
            </div>
          </div>
          <div class="echoai-header-actions">
            ${
              this.stateManager.getState().messages.length > 1
                ? `
              <button class="echoai-new-conversation-btn" aria-label="Start new conversation" title="Start new conversation">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
            `
                : ""
            }
            <button class="echoai-close-btn" aria-label="Close chat">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      `;
    }

    generateTabs() {
      const tabs = [];

      if (this.config.enableFAQ) {
        tabs.push(this.renderTemplate("tab", "faq", "FAQ", false));
      }

      tabs.push(this.renderTemplate("tab", "chat", "Chat", true));

      if (this.config.enableHistory) {
        tabs.push(this.renderTemplate("tab", "history", "History", false));
      }

      return tabs.length > 1
        ? `
        <div class="echoai-tabs" role="tablist" aria-label="Chat widget navigation">
          ${tabs.join("")}
        </div>
      `
        : "";
    }

    generateTabContent() {
      return `
        <div class="echoai-tab-content">
          ${this.config.enableFAQ ? this.generateFAQPanel() : ""}
          ${this.generateChatPanel()}
          ${this.config.enableHistory ? this.generateHistoryPanel() : ""}
        </div>
      `;
    }

    generateFAQPanel() {
      return `
        <div class="echoai-tab-panel echoai-tab-panel-transition" data-panel="faq" style="display: none;" role="tabpanel" aria-labelledby="faq-tab" id="faq-panel" tabindex="0">
          <div class="echoai-faq-container">

            <div class="echoai-faq-search">
              <div class="echoai-search-input-container">
                <input type="text" 
                       placeholder="Search FAQs..." 
                       class="echoai-faq-search-input" 
                       aria-label="Search FAQs"
                       autocomplete="off" />
                <div class="echoai-search-icon">ðŸ”</div>
              </div>
            </div>
            <div class="echoai-faq-content">
              <div class="echoai-faq-list" id="echoai-faq-list">
                ${this.renderTemplate("faq.loading")}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    generateChatPanel() {
      return `
        <div class="echoai-tab-panel echoai-tab-panel-active echoai-tab-panel-transition" data-panel="chat" role="tabpanel" aria-labelledby="chat-tab" id="chat-panel" tabindex="0">
          <div class="echoai-messages" id="echoai-messages" role="log" aria-live="polite" aria-label="Chat messages"></div>
          ${
            this.config.intelligenceConfig?.enabled
              ? this.generateIntelligencePanel()
              : ""
          }
          ${this.generateInputContainer()}
        </div>
      `;
    }

    generateHistoryPanel() {
      return `
        <div class="echoai-tab-panel echoai-tab-panel-transition" data-panel="history" style="display: none;" role="tabpanel" aria-labelledby="history-tab" id="history-panel" tabindex="0">
          <div class="echoai-history-container">
            <div class="echoai-history-search">
              <input type="text" placeholder="Search conversations..." class="echoai-history-search-input" aria-label="Search conversations" />
            </div>
            <div class="echoai-history-list" id="echoai-history-list">
              ${this.renderTemplate("history.loading")}
            </div>
            <div class="echoai-history-pagination" id="echoai-history-pagination" style="display: none;">
              <button class="echoai-load-more-btn" type="button" aria-label="Load more conversations">
                Load More Conversations
              </button>
              <div class="echoai-pagination-info">
                <span class="echoai-pagination-text"></span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    generateIntelligencePanel() {
      return `
        <div class="echoai-intelligence-panel" id="echoai-intelligence-panel" style="display: none;" aria-label="AI suggestions">
          <div class="echoai-proactive-questions" id="echoai-proactive-questions"></div>
          <div class="echoai-suggested-topics" id="echoai-suggested-topics"></div>
          <div class="echoai-conversation-actions" id="echoai-conversation-actions"></div>
        </div>
      `;
    }

    generateInputContainer() {
      return `
        <div class="echoai-input-container">
          ${this.config.enableImageUpload ? this.generateImageUpload() : ""}
          <div class="echoai-input-row">
            <input type="text" class="echoai-input" placeholder="Type your message..." aria-label="Type your message" />
            ${
              this.config.escalationConfig?.enabled &&
              this.config.escalationConfig?.showEscalationButton
                ? this.generateEscalationButton()
                : ""
            }
            ${this.generateSendButton()}
          </div>
        </div>
      `;
    }

    generateImageUpload() {
      return `
        <div class="echoai-image-upload" id="echoai-image-upload" style="display: none;">
          <div class="echoai-image-preview" id="echoai-image-preview"></div>
          <div class="echoai-upload-progress" id="echoai-upload-progress" style="display: none;">
            <div class="echoai-progress-bar">
              <div class="echoai-progress-fill" id="echoai-progress-fill"></div>
            </div>
            <span class="echoai-progress-text" id="echoai-progress-text">Uploading...</span>
          </div>
          <button class="echoai-remove-image" id="echoai-remove-image" aria-label="Remove image">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="echoai-drag-drop-area" id="echoai-drag-drop-area" style="display: none;">
          <div class="echoai-drag-drop-content">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21,15 16,10 5,21"></polyline>
            </svg>
            <p>Drop your image here or <button class="echoai-browse-btn" id="echoai-browse-btn">browse</button></p>
            <small>Supports: JPG, PNG, GIF, WebP (max 10MB)</small>
          </div>
        </div>
      `;
    }

    generateUploadButton() {
      return `
        <button class="echoai-upload-btn" id="echoai-upload-btn" title="Upload image" aria-label="Upload image">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21,15 16,10 5,21"></polyline>
          </svg>
        </button>
      `;
    }

    generateEscalationButton() {
      const currentStatus = this.stateManager ? this.stateManager.getState().conversationStatus : "AI_HANDLING";
      
      let buttonText, buttonTitle, buttonIcon;
      
      if (currentStatus === "AWAITING_HUMAN_RESPONSE") {
        buttonText = "🔄 Return to AI";
        buttonTitle = "Return to AI assistant";
        buttonIcon = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        `;
      } else if (currentStatus === "RESOLVED") {
        buttonText = "✅ Resolved";
        buttonTitle = "Conversation resolved";
        buttonIcon = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20,6 9,17 4,12"></polyline>
          </svg>
        `;
      } else {
        buttonText = "";
        buttonTitle = "Talk to human agent";
        buttonIcon = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        `;
      }

      return `
        <button class="echoai-escalate-btn" id="echoai-escalate-btn" title="${buttonTitle}" aria-label="${buttonTitle}">
          ${buttonIcon}
        </button>
      `;
    }

    generateSendButton() {
      return `
        <button class="echoai-send-btn" aria-label="Send message">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22,2 15,22 11,13 2,9"></polygon>
          </svg>
        </button>
      `;
    }

    generateToggleButton() {
      return `
        <button class="echoai-toggle-btn" aria-label="Toggle chat">
          <svg class="echoai-chat-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <svg class="echoai-close-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;
    }

    generateFileInput() {
      return this.config.enableImageUpload
        ? '<input type="file" id="echoai-file-input" accept="image/jpeg,image/png,image/gif,image/webp" multiple="false" style="display: none;" aria-label="Select image file" />'
        : "";
    }

    generateBranding() {
      return "";
    }

    updateWidgetVisibility(isOpen) {
      if (this.elements.widget) {
        this.elements.widget.style.display = isOpen ? "block" : "none";

        const chatIcon =
          this.elements.toggleBtn.querySelector(".echoai-chat-icon");
        const closeIcon =
          this.elements.toggleBtn.querySelector(".echoai-close-icon");

        if (isOpen) {
          chatIcon.style.display = "none";
          closeIcon.style.display = "block";
          if (this.elements.input) this.elements.input.focus();
        } else {
          chatIcon.style.display = "block";
          closeIcon.style.display = "none";
        }
      }
    }

    async switchTab(targetTab, focusTarget = null) {
      console.log("EchoAI: switchTab called with:", targetTab);
      const currentState = this.stateManager.getState();
      const currentTab = currentState.activeTab;
      console.log("EchoAI: Current tab:", currentTab, "Target tab:", targetTab);

      // Don't switch if already on target tab
      if (currentTab === targetTab) {
        console.log("EchoAI: Already on target tab, returning");
        return;
      }

      // Check if tab content is loading
      if (this.tabLoadingStates.get(targetTab)) {
        return;
      }

      // Update state immediately
      this.stateManager.setState({ activeTab: targetTab });

      // Get current and target panels
      const currentPanel = this.container.querySelector(
        `[data-panel="${currentTab}"]`
      );
      const targetPanel = this.container.querySelector(
        `[data-panel="${targetTab}"]`
      );

      console.log("EchoAI: Current panel:", currentPanel);
      console.log("EchoAI: Target panel:", targetPanel);

      if (!targetPanel) {
        console.error("EchoAI: Target panel not found for tab:", targetTab);
        return;
      }

      // Load content if not cached
      await this.loadTabContent(targetTab);

      // Update tab accessibility attributes first
      this.updateTabAccessibility(targetTab);

      // Handle smooth transition (fallback to direct switching if needed)
      try {
        await this.performTabTransition(currentPanel, targetPanel, targetTab);
      } catch (error) {
        console.error("EchoAI: Transition failed, using direct switch:", error);
        // Direct panel switching as fallback
        this.elements.tabPanels.forEach((panel) => {
          const isActive = panel.dataset.panel === targetTab;
          if (isActive) {
            panel.style.display = "flex";
            panel.style.visibility = "visible";
            panel.classList.add("echoai-tab-panel-active");
          } else {
            panel.style.display = "none";
            panel.style.visibility = "hidden";
            panel.classList.remove("echoai-tab-panel-active");
          }
        });
      }

      // Manage focus
      this.manageFocusOnTabSwitch(targetTab, focusTarget);

      // Emit custom event for tab change
      this.eventManager.emit("tab-changed", {
        previousTab: currentTab,
        currentTab: targetTab,
      });
    }

    async loadTabContent(tabId) {
      // Check if content is already cached
      if (this.tabContentCache.has(tabId)) {
        return this.tabContentCache.get(tabId);
      }

      // Set loading state
      this.tabLoadingStates.set(tabId, true);

      try {
        let content = null;

        switch (tabId) {
          case "faq":
            content = await this.loadFAQContent();
            break;
          case "history":
            content = await this.loadHistoryContent();
            break;
          case "chat":
            // Chat content is always live, no caching needed
            content = { type: "live" };
            break;
          default:
            content = { type: "empty" };
        }

        // Cache the content
        this.tabContentCache.set(tabId, content);

        // Update UI with loaded content
        this.updateTabContentUI(tabId, content);

        return content;
      } catch (error) {
        console.error(`Error loading content for tab ${tabId}:`, error);
        this.updateTabContentUI(tabId, { type: "error", error });
        return { type: "error", error };
      } finally {
        this.tabLoadingStates.set(tabId, false);
      }
    }

    async loadFAQContent() {
      try {
        this.stateManager.setState({ isLoading: true });

        // Load FAQs from API
        const faqData = await this.apiClient.loadFAQs();

        // Process and categorize FAQs
        const processedFAQs = this.processFAQData(faqData);

        // Update state with loaded FAQs
        this.stateManager.setState({
          faqs: processedFAQs,
          isLoading: false,
        });

        return {
          type: "faq",
          data: processedFAQs,
          timestamp: Date.now(),
        };
      } catch (error) {
        console.error("EchoAI: Error loading FAQ content:", error);

        this.stateManager.setState({ isLoading: false });

        return {
          type: "error",
          error: error.message,
          timestamp: Date.now(),
        };
      }
    }

    processFAQData(faqData) {
      if (!faqData || !Array.isArray(faqData)) {
        return [];
      }

      // Process each FAQ item
      return faqData.map((faq, index) => ({
        id: faq.id || `faq-${index}`,
        question: faq.question || "",
        answer: faq.answer || "",
        category: faq.category || "General",
        tags: faq.tags || [],
        popularity: faq.popularity || 0,
        viewCount: faq.viewCount || 0,
        helpfulCount: faq.helpfulCount || 0,
        createdAt: faq.createdAt || new Date().toISOString(),
        updatedAt: faq.updatedAt || new Date().toISOString(),
      }));
    }

    categorizeFAQs(faqs) {
      const categories = {};

      faqs.forEach((faq) => {
        const category = faq.category || "General";
        if (!categories[category]) {
          categories[category] = [];
        }
        categories[category].push(faq);
      });

      // Sort categories and FAQs within each category
      Object.keys(categories).forEach((category) => {
        categories[category].sort((a, b) => {
          // Sort by popularity first, then by helpfulCount
          if (b.popularity !== a.popularity) {
            return b.popularity - a.popularity;
          }
          return b.helpfulCount - a.helpfulCount;
        });
      });

      return categories;
    }

    async loadHistoryContent(page = 1, search = "") {
      try {
        const historyResponse = await this.apiClient.loadConversationHistory(
          page,
          20,
          search
        );

        // Handle both array response and paginated response
        const historyData = Array.isArray(historyResponse)
          ? historyResponse
          : historyResponse.conversations || historyResponse.data || [];
        const pagination = historyResponse.pagination || {
          currentPage: page,
          totalPages: 1,
          totalCount: historyData.length,
          hasMore: false,
        };

        // Process and format history data
        const processedHistory = historyData.map((item) => ({
          sessionId: item.sessionId || item.id,
          preview: this.truncateText(
            item.lastMessage || item.preview || "No messages",
            60
          ),
          messageCount: item.messageCount || item.messages?.length || 0,
          timestamp: this.formatTimestamp(
            item.updatedAt || item.createdAt || item.timestamp
          ),
          createdAt: item.createdAt,
          status: item.status || "completed",
        }));

        // Sort by most recent first if not already sorted
        if (!historyResponse.pagination) {
          processedHistory.sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
          );
        }

        // Update state - append if loading more pages, replace if first page
        const currentHistory =
          this.stateManager.getState().conversationHistory || [];
        const updatedHistory =
          page === 1
            ? processedHistory
            : [...currentHistory, ...processedHistory];

        this.stateManager.setState({
          conversationHistory: updatedHistory,
          historyPagination: pagination,
        });

        return {
          type: "history",
          data: processedHistory,
          pagination: pagination,
          isLoadMore: page > 1,
          timestamp: Date.now(),
        };
      } catch (error) {
        console.error("EchoAI: Failed to load conversation history:", error);
        return {
          type: "error",
          error: error.message,
          timestamp: Date.now(),
        };
      }
    }

    updateTabContentUI(tabId, content) {
      const panel = this.container.querySelector(`[data-panel="${tabId}"]`);
      if (!panel) return;

      switch (tabId) {
        case "faq":
          this.updateFAQPanelContent(panel, content);
          break;
        case "history":
          this.updateHistoryPanelContent(panel, content);
          break;
      }
    }

    updateFAQPanelContent(panel, content) {
      const faqList = panel.querySelector("#echoai-faq-list");
      if (!faqList) return;

      if (content.type === "error") {
        faqList.innerHTML = this.renderTemplate("faq.error");
      } else if (content.data && content.data.length > 0) {
        // Categorize FAQs for better organization
        const categorizedFAQs = this.categorizeFAQs(content.data);

        // Generate HTML for categorized FAQs
        const categoriesHTML = Object.keys(categorizedFAQs)
          .sort() // Sort categories alphabetically
          .map((categoryName) =>
            this.renderTemplate(
              "faq.category",
              categoryName,
              categorizedFAQs[categoryName]
            )
          )
          .join("");

        faqList.innerHTML = categoriesHTML;
        this.setupFAQEventListeners(panel);

        // Store original FAQ data for search functionality
        faqList.setAttribute(
          "data-original-content",
          JSON.stringify(content.data)
        );
      } else {
        faqList.innerHTML = this.renderTemplate("faq.empty");
      }
    }

    updateHistoryPanelContent(panel, content) {
      const historyList = panel.querySelector("#echoai-history-list");
      const paginationContainer = panel.querySelector(
        "#echoai-history-pagination"
      );
      if (!historyList) return;

      if (content.type === "error") {
        historyList.innerHTML = this.renderTemplate("history.error");
        if (paginationContainer) {
          paginationContainer.style.display = "none";
        }
      } else if (content.data && content.data.length > 0) {
        // For load more, append to existing content
        if (content.isLoadMore) {
          const newItems = content.data
            .map((conversation) =>
              this.renderTemplate("history.item", conversation)
            )
            .join("");
          historyList.insertAdjacentHTML("beforeend", newItems);
        } else {
          // For initial load or refresh, replace content
          historyList.innerHTML = content.data
            .map((conversation) =>
              this.renderTemplate("history.item", conversation)
            )
            .join("");
        }

        this.setupHistoryEventListeners(panel);
        this.updateHistoryPagination(panel, content.pagination);
      } else {
        historyList.innerHTML = this.renderTemplate("history.empty");
        if (paginationContainer) {
          paginationContainer.style.display = "none";
        }
      }
    }

    updateHistoryPagination(panel, pagination) {
      const paginationContainer = panel.querySelector(
        "#echoai-history-pagination"
      );
      if (!paginationContainer || !pagination) return;

      const loadMoreBtn = paginationContainer.querySelector(
        ".echoai-load-more-btn"
      );
      const paginationText = paginationContainer.querySelector(
        ".echoai-pagination-text"
      );

      if (
        pagination.hasMore ||
        pagination.currentPage < pagination.totalPages
      ) {
        paginationContainer.style.display = "block";

        if (loadMoreBtn) {
          loadMoreBtn.style.display = "block";
          loadMoreBtn.disabled = false;

          // Remove existing event listeners
          const newBtn = loadMoreBtn.cloneNode(true);
          loadMoreBtn.parentNode.replaceChild(newBtn, loadMoreBtn);

          // Add new event listener
          this.eventManager.addEventListener(newBtn, "click", async () => {
            newBtn.disabled = true;
            newBtn.textContent = "Loading...";

            try {
              const nextPage = pagination.currentPage + 1;
              const searchInput = panel.querySelector(
                ".echoai-history-search-input"
              );
              const searchTerm = searchInput ? searchInput.value : "";

              const content = await this.loadHistoryContent(
                nextPage,
                searchTerm
              );
              this.updateHistoryPanelContent(panel, content);
            } catch (error) {
              console.error("EchoAI: Failed to load more history:", error);
              newBtn.disabled = false;
              newBtn.textContent = "Load More Conversations";
              this.showNotification(
                "Failed to load more conversations",
                "error"
              );
            }
          });
        }
      } else {
        if (loadMoreBtn) {
          loadMoreBtn.style.display = "none";
        }
      }

      if (paginationText) {
        const totalCount = pagination.totalCount || 0;
        const currentCount =
          this.stateManager.getState().conversationHistory?.length || 0;
        paginationText.textContent = `Showing ${currentCount} of ${totalCount} conversations`;
      }
    }

    async performTabTransition(currentPanel, targetPanel, targetTab) {
      return new Promise((resolve) => {
        // Add transition classes
        if (currentPanel) {
          currentPanel.classList.add("echoai-tab-panel-exit");
        }
        targetPanel.classList.add("echoai-tab-panel-enter");

        // Show target panel
        targetPanel.style.display = "block";
        targetPanel.classList.add("echoai-tab-panel-active");

        // Use requestAnimationFrame for smooth animation
        requestAnimationFrame(() => {
          if (currentPanel) {
            currentPanel.classList.add("echoai-tab-panel-exit-active");
          }
          targetPanel.classList.add("echoai-tab-panel-enter-active");

          // Complete transition after duration
          setTimeout(() => {
            // Hide and clean up current panel
            if (currentPanel) {
              currentPanel.style.display = "none";
              currentPanel.classList.remove(
                "echoai-tab-panel-active",
                "echoai-tab-panel-exit",
                "echoai-tab-panel-exit-active"
              );
            }

            // Clean up target panel classes
            targetPanel.classList.remove(
              "echoai-tab-panel-enter",
              "echoai-tab-panel-enter-active"
            );

            resolve();
          }, this.tabTransitionDuration);
        });
      });
    }

    updateTabAccessibility(activeTab) {
      console.log("EchoAI: updateTabAccessibility called with:", activeTab);

      // Update tab buttons
      this.elements.tabs.forEach((tab) => {
        const isActive = tab.dataset.tab === activeTab;
        console.log(
          "EchoAI: Updating tab:",
          tab.dataset.tab,
          "isActive:",
          isActive
        );

        tab.classList.toggle("echoai-tab-active", isActive);
        tab.setAttribute("aria-selected", isActive.toString());
        tab.setAttribute("tabindex", isActive ? "0" : "-1");
      });

      // Update panels - both visibility and display
      this.elements.tabPanels.forEach((panel) => {
        const isActive = panel.dataset.panel === activeTab;
        console.log(
          "EchoAI: Updating panel:",
          panel.dataset.panel,
          "isActive:",
          isActive
        );

        panel.setAttribute("aria-hidden", (!isActive).toString());

        // Ensure panels are properly shown/hidden
        if (isActive) {
          panel.style.display = "flex";
          panel.style.visibility = "visible";
          panel.classList.add("echoai-tab-panel-active");
        } else {
          panel.style.display = "none";
          panel.style.visibility = "hidden";
          panel.classList.remove("echoai-tab-panel-active");
        }
      });
    }

    manageFocusOnTabSwitch(targetTab, focusTarget = null) {
      const targetPanel = this.container.querySelector(
        `[data-panel="${targetTab}"]`
      );
      if (!targetPanel) return;

      // Focus management strategy
      if (focusTarget) {
        // Focus specific element if provided
        const element = targetPanel.querySelector(focusTarget);
        if (element) {
          element.focus();
          return;
        }
      }

      // Default focus management
      switch (targetTab) {
        case "faq":
          // Focus search input for FAQ tab
          const faqSearch = targetPanel.querySelector(
            ".echoai-faq-search-input"
          );
          if (faqSearch) {
            faqSearch.focus();
          }
          break;
        case "history":
          // Focus search input for history tab
          const historySearch = targetPanel.querySelector(
            ".echoai-history-search-input"
          );
          if (historySearch) {
            historySearch.focus();
          }
          break;
        case "chat":
          // Focus message input for chat tab
          const chatInput = targetPanel.querySelector(".echoai-input");
          if (chatInput) {
            chatInput.focus();
          }
          break;
        default:
          // Focus the panel itself as fallback
          targetPanel.focus();
      }
    }

    setupFAQEventListeners(panel) {
      // Setup search functionality with debouncing
      const searchInput = panel.querySelector(".echoai-faq-search-input");
      if (searchInput) {
        let searchTimeout;
        this.eventManager.addEventListener(searchInput, "input", (e) => {
          clearTimeout(searchTimeout);
          searchTimeout = setTimeout(() => {
            this.filterFAQs(e.target.value, panel);
          }, 300); // 300ms debounce
        });

        // Clear search on escape
        this.eventManager.addEventListener(searchInput, "keydown", (e) => {
          if (e.key === "Escape") {
            e.target.value = "";
            this.filterFAQs("", panel);
            e.target.blur();
          }
        });
      }

      // Setup FAQ item click handlers
      const faqItems = panel.querySelectorAll(".echoai-faq-item");
      faqItems.forEach((item) => {
        this.eventManager.addEventListener(item, "click", () => {
          const faqId = item.getAttribute("data-faq-id");
          const question = item.getAttribute("data-question");
          const answer = item.getAttribute("data-answer");

          // Track FAQ usage for popularity
          if (faqId) {
            this.trackFAQUsage(faqId);
          }

          // Add FAQ to chat and switch to chat tab
          if (question && answer && window.EchoAI) {
            window.EchoAI.addFAQToChat(question, answer);
            this.switchTab("chat");
          }
        });

        // Add keyboard support
        this.eventManager.addEventListener(item, "keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            item.click();
          }
        });

        // Add hover effects for better UX
        this.eventManager.addEventListener(item, "mouseenter", () => {
          item.classList.add("echoai-faq-item-hover");
        });

        this.eventManager.addEventListener(item, "mouseleave", () => {
          item.classList.remove("echoai-faq-item-hover");
        });
      });

      // Setup retry button if present
      const retryButton = panel.querySelector(".echoai-error-retry");
      if (retryButton) {
        this.eventManager.addEventListener(retryButton, "click", () => {
          this.refreshTabContent("faq");
        });
      }
    }

    setupHistoryEventListeners(panel) {
      // Setup search functionality with debouncing
      const searchInput = panel.querySelector(".echoai-history-search-input");
      if (searchInput) {
        let searchTimeout;

        this.eventManager.addEventListener(searchInput, "input", (e) => {
          const searchTerm = e.target.value;

          // Clear existing timeout
          clearTimeout(searchTimeout);

          // Debounce search for 300ms
          searchTimeout = setTimeout(async () => {
            try {
              // If search term, perform server-side search, otherwise filter locally
              if (searchTerm.trim()) {
                const content = await this.loadHistoryContent(1, searchTerm);
                this.updateHistoryPanelContent(panel, content);
              } else {
                // Clear search - reload first page
                const content = await this.loadHistoryContent(1, "");
                this.updateHistoryPanelContent(panel, content);
              }
            } catch (error) {
              console.error("EchoAI: Search failed:", error);
              // Fallback to local filtering
              this.filterHistory(searchTerm);
            }
          }, 300);
        });

        // Handle escape key to clear search
        this.eventManager.addEventListener(searchInput, "keydown", (e) => {
          if (e.key === "Escape") {
            e.target.value = "";
            clearTimeout(searchTimeout);
            this.loadHistoryContent(1, "").then((content) => {
              this.updateHistoryPanelContent(panel, content);
            });
            e.target.blur();
          }
        });
      }

      // Setup history item click handlers
      const historyItems = panel.querySelectorAll(".echoai-history-item");
      historyItems.forEach((item) => {
        // Remove existing event listeners to prevent duplicates
        const newItem = item.cloneNode(true);
        item.parentNode.replaceChild(newItem, item);

        this.eventManager.addEventListener(newItem, "click", async () => {
          const sessionId = newItem.getAttribute("data-session-id");

          if (sessionId && window.EchoAI) {
            // Add loading state to the item
            newItem.classList.add("echoai-history-item-loading");

            try {
              await window.EchoAI.loadConversation(sessionId);
              this.switchTab("chat");
            } catch (error) {
              console.error("EchoAI: Failed to load conversation:", error);
            } finally {
              newItem.classList.remove("echoai-history-item-loading");
            }
          }
        });

        // Add keyboard support
        this.eventManager.addEventListener(newItem, "keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            newItem.click();
          }
        });

        // Add hover effects for better UX
        this.eventManager.addEventListener(newItem, "mouseenter", () => {
          newItem.classList.add("echoai-history-item-hover");
        });

        this.eventManager.addEventListener(newItem, "mouseleave", () => {
          newItem.classList.remove("echoai-history-item-hover");
        });
      });

      // Setup retry button if present
      const retryButton = panel.querySelector(".echoai-error-retry");
      if (retryButton) {
        this.eventManager.addEventListener(retryButton, "click", () => {
          this.refreshTabContent("history");
        });
      }
    }

    filterFAQs(searchTerm, panel) {
      const faqList = panel.querySelector("#echoai-faq-list");
      if (!faqList) return;

      const term = searchTerm.toLowerCase().trim();

      if (!term) {
        // Show all FAQs when search is empty
        this.showAllFAQs(panel);
        return;
      }

      // Get original FAQ data
      const originalData = faqList.getAttribute("data-original-content");
      if (!originalData) return;

      try {
        const faqs = JSON.parse(originalData);

        // Filter FAQs based on search term
        const filteredFAQs = faqs.filter((faq) => {
          const question = (faq.question || "").toLowerCase();
          const answer = (faq.answer || "").toLowerCase();
          const category = (faq.category || "").toLowerCase();
          const tags = (faq.tags || []).join(" ").toLowerCase();

          return (
            question.includes(term) ||
            answer.includes(term) ||
            category.includes(term) ||
            tags.includes(term)
          );
        });

        // Display filtered results
        if (filteredFAQs.length > 0) {
          // Sort filtered results by relevance (question matches first, then answer matches)
          filteredFAQs.sort((a, b) => {
            const aQuestionMatch = (a.question || "")
              .toLowerCase()
              .includes(term);
            const bQuestionMatch = (b.question || "")
              .toLowerCase()
              .includes(term);

            if (aQuestionMatch && !bQuestionMatch) return -1;
            if (!aQuestionMatch && bQuestionMatch) return 1;

            // If both or neither match in question, sort by popularity
            return (b.popularity || 0) - (a.popularity || 0);
          });

          // Render filtered FAQs without categorization for search results
          const filteredHTML = filteredFAQs
            .map((faq) => this.renderTemplate("faq.item", faq))
            .join("");

          faqList.innerHTML = `
            <div class="echoai-faq-search-results">
              <div class="echoai-faq-search-header">
                Found ${filteredFAQs.length} result${
            filteredFAQs.length !== 1 ? "s" : ""
          } for "${this.escapeHtml(searchTerm)}"
              </div>
              ${filteredHTML}
            </div>
          `;
        } else {
          faqList.innerHTML = this.renderTemplate("faq.noResults");
        }

        // Re-setup event listeners for filtered results
        this.setupFAQEventListeners(panel);
      } catch (error) {
        console.error("EchoAI: Error filtering FAQs:", error);
      }
    }

    showAllFAQs(panel) {
      const faqList = panel.querySelector("#echoai-faq-list");
      if (!faqList) return;

      const originalData = faqList.getAttribute("data-original-content");
      if (!originalData) return;

      try {
        const faqs = JSON.parse(originalData);

        // Re-categorize and display all FAQs
        const categorizedFAQs = this.categorizeFAQs(faqs);
        const categoriesHTML = Object.keys(categorizedFAQs)
          .sort()
          .map((categoryName) =>
            this.renderTemplate(
              "faq.category",
              categoryName,
              categorizedFAQs[categoryName]
            )
          )
          .join("");

        faqList.innerHTML = categoriesHTML;
        this.setupFAQEventListeners(panel);
      } catch (error) {
        console.error("EchoAI: Error showing all FAQs:", error);
      }
    }

    filterHistory(searchTerm) {
      const historyPanel = this.container.querySelector(
        '[data-panel="history"]'
      );
      if (!historyPanel) return;

      const historyItems = historyPanel.querySelectorAll(
        ".echoai-history-item"
      );
      const term = searchTerm.toLowerCase().trim();

      let visibleCount = 0;

      historyItems.forEach((item) => {
        const question =
          item
            .querySelector(".echoai-history-question")
            ?.textContent?.toLowerCase() || "";
        const answer =
          item
            .querySelector(".echoai-history-answer")
            ?.textContent?.toLowerCase() || "";
        const timestamp =
          item
            .querySelector(".echoai-history-meta")
            ?.textContent?.toLowerCase() || "";

        // Search in question, answer, and timestamp
        const matches =
          !term ||
          question.includes(term) ||
          answer.includes(term) ||
          timestamp.includes(term);

        if (matches) {
          item.style.display = "block";
          visibleCount++;

          // Highlight search terms
          if (term) {
            this.highlightSearchTerm(item, term);
          } else {
            this.removeHighlights(item);
          }
        } else {
          item.style.display = "none";
        }
      });

      // Show/hide empty state
      this.updateHistoryEmptyState(historyPanel, visibleCount, term);
    }

    highlightSearchTerm(item, term) {
      const questionElement = item.querySelector(".echoai-history-question");
      const answerElement = item.querySelector(".echoai-history-answer");
      if (!questionElement && !answerElement) return;

      const regex = new RegExp(`(${this.escapeRegex(term)})`, "gi");

      if (questionElement) {
        const originalText = questionElement.textContent;
        const highlightedText = originalText.replace(
          regex,
          '<mark class="echoai-search-highlight">$1</mark>'
        );
        questionElement.innerHTML = highlightedText;
      }

      if (answerElement) {
        const originalText = answerElement.textContent;
        const highlightedText = originalText.replace(
          regex,
          '<mark class="echoai-search-highlight">$1</mark>'
        );
        answerElement.innerHTML = highlightedText;
      }
    }

    removeHighlights(item) {
      const questionElement = item.querySelector(".echoai-history-question");
      const answerElement = item.querySelector(".echoai-history-answer");
      if (!questionElement && !answerElement) return;

      // Remove highlights and restore original text
      if (questionElement) {
        const questionMarks = questionElement.querySelectorAll(
          ".echoai-search-highlight"
        );
        questionMarks.forEach((mark) => {
          mark.outerHTML = mark.textContent;
        });
      }

      if (answerElement) {
        const answerMarks = answerElement.querySelectorAll(
          ".echoai-search-highlight"
        );
        answerMarks.forEach((mark) => {
          mark.outerHTML = mark.textContent;
        });
      }
    }

    escapeRegex(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    updateHistoryEmptyState(panel, visibleCount, searchTerm) {
      const historyList = panel.querySelector("#echoai-history-list");
      if (!historyList) return;

      // Remove existing empty state
      const existingEmptyState = panel.querySelector(
        ".echoai-search-no-results"
      );
      if (existingEmptyState) {
        existingEmptyState.remove();
      }

      // Add empty state if no results
      if (visibleCount === 0 && searchTerm) {
        const emptyState = document.createElement("div");
        emptyState.className = "echoai-search-no-results";
        emptyState.innerHTML = `
          <div class="echoai-no-content">
            <p>No conversations found for "${this.escapeHtml(searchTerm)}"</p>
            <button class="echoai-clear-search" type="button">Clear search</button>
          </div>
        `;

        historyList.appendChild(emptyState);

        // Add clear search functionality
        const clearButton = emptyState.querySelector(".echoai-clear-search");
        if (clearButton) {
          this.eventManager.addEventListener(clearButton, "click", () => {
            const searchInput = panel.querySelector(
              ".echoai-history-search-input"
            );
            if (searchInput) {
              searchInput.value = "";
              this.filterHistory("");
              searchInput.focus();
            }
          });
        }
      }
    }

    trackFAQUsage(faqId) {
      try {
        // Track FAQ usage locally
        const faqUsage = JSON.parse(
          localStorage.getItem("echoai-faq-usage") || "{}"
        );
        faqUsage[faqId] = (faqUsage[faqId] || 0) + 1;
        localStorage.setItem("echoai-faq-usage", JSON.stringify(faqUsage));

        // Send usage tracking to server (fire and forget)
        if (window.EchoAI && window.EchoAI.apiClient) {
          window.EchoAI.apiClient.trackFAQUsage(faqId);
        }
      } catch (error) {
        console.debug("EchoAI: Error tracking FAQ usage:", error);
      }
    }

    async refreshTabContent(tabId) {
      try {
        // Clear cache for the tab
        this.clearTabCache(tabId);

        // Reload content
        const content = await this.loadTabContent(tabId);

        // Update UI
        const panel = this.container.querySelector(`[data-panel="${tabId}"]`);
        if (panel) {
          this.updateTabContentUI(tabId, content);
        }

        return content;
      } catch (error) {
        console.error(`EchoAI: Error refreshing ${tabId} content:`, error);
        throw error;
      }
    }

    // Method to clear tab content cache
    clearTabCache(tabId = null) {
      if (tabId) {
        this.tabContentCache.delete(tabId);
      } else {
        this.tabContentCache.clear();
      }
    }

    // Method to refresh tab content
    async refreshTabContent(tabId) {
      this.clearTabCache(tabId);
      await this.loadTabContent(tabId);
    }

    // Enhanced Message Display System Implementation

    // Initialize virtual scrolling properties
    initializeVirtualScrolling() {
      this.virtualScrolling = {
        itemHeight: 80, // Estimated message height
        containerHeight: 0,
        scrollTop: 0,
        visibleStart: 0,
        visibleEnd: 0,
        buffer: 5, // Extra items to render for smooth scrolling
        isEnabled: false,
      };

      // Enable virtual scrolling for large message lists
      this.virtualScrollingThreshold = 50;
    }

    // Enhanced addMessage with role support, status indicators, and actions
    addMessage(content, role = "user", imageUrl = null, options = {}) {
      console.log("EchoAI: UIManager.addMessage called with:", {
        content,
        role,
        imageUrl,
        options,
      });

      if (!this.elements.messagesContainer) {
        console.error("EchoAI: messagesContainer not found!");
        return;
      }

      const messageId =
        options.id ||
        `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = options.timestamp || new Date();
      const status = options.status || "delivered";

      // Create message object
      const message = {
        id: messageId,
        content,
        role,
        imageUrl,
        timestamp,
        status,
        isStreaming: false,
        ...options,
      };

      // Add to state
      const currentState = this.stateManager.getState();
      const updatedMessages = [...currentState.messages, message];
      this.stateManager.setState({ messages: updatedMessages });

      // Render message
      this.renderMessage(message);

      // Scroll to bottom
      this.scrollToBottom();

      // Check if virtual scrolling should be enabled
      this.checkVirtualScrolling();

      // Announce to screen readers
      this.announceMessage(content, role);

      return messageId;
    }

    // Render individual message with enhanced features
    renderMessage(message) {
      if (!this.elements.messagesContainer) return;

      const messageElement = this.createMessageElement(message);

      // Add message with animation
      messageElement.style.opacity = "0";
      messageElement.style.transform = "translateY(10px)";

      this.elements.messagesContainer.appendChild(messageElement);

      // Animate in
      requestAnimationFrame(() => {
        messageElement.style.transition = "all 0.3s ease";
        messageElement.style.opacity = "1";
        messageElement.style.transform = "translateY(0)";
      });

      // Update virtual scrolling if enabled
      if (this.virtualScrolling && this.virtualScrolling.isEnabled) {
        this.updateVirtualScrolling();
      }
    }

    // Create enhanced message element with proper structure
    createMessageElement(message) {
      const messageDiv = document.createElement("div");
      messageDiv.className = `echoai-message-group ${
        message.role === "user" ? "flex-row-reverse" : ""
      }`;
      messageDiv.setAttribute("data-message-id", message.id);
      messageDiv.setAttribute("data-role", message.role);
      messageDiv.setAttribute("role", "article");
      messageDiv.setAttribute("aria-label", `${message.role} message`);

      // Create avatar
      const avatarDiv = document.createElement("div");
      avatarDiv.className = "echoai-message-avatar";

      // Set avatar styling based on role
      const primaryColor = this.config.primaryColor || "#3b82f6";
      if (message.role === "user") {
        avatarDiv.style.background = `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`;
        avatarDiv.style.color = "white";
      } else if (message.role === "agent") {
        avatarDiv.style.background =
          "linear-gradient(135deg, #22c55e, #16a34a)";
        avatarDiv.style.color = "white";
      } else {
        avatarDiv.style.background = `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`;
        avatarDiv.style.color = "white";
      }

      // Add avatar icon
      avatarDiv.innerHTML =
        message.role === "user"
          ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>'
          : message.role === "agent"
          ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>'
          : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>';

      // Create message content container
      const contentContainer = document.createElement("div");
      contentContainer.className = "echoai-message-content";
      if (message.role === "user") {
        contentContainer.style.textAlign = "right";
      }

      // Create message bubble
      const bubbleDiv = document.createElement("div");
      bubbleDiv.className = "echoai-message-bubble";

      // Set bubble styling based on role
      if (message.role === "user") {
        bubbleDiv.style.background = `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`;
        bubbleDiv.style.color = "white";
        bubbleDiv.style.borderTopRightRadius = "6px";
      } else if (message.role === "agent") {
        bubbleDiv.style.backgroundColor = "#f0fdf4";
        bubbleDiv.style.borderColor = "#22c55e33";
        bubbleDiv.style.color = "#0f172a";
        bubbleDiv.style.borderTopLeftRadius = "6px";
      } else {
        bubbleDiv.style.backgroundColor = "#f8fafc";
        bubbleDiv.style.borderColor = `${primaryColor}20`;
        bubbleDiv.style.color = "#0f172a";
        bubbleDiv.style.borderTopLeftRadius = "6px";
      }

      // Handle image if present
      if (message.imageUrl) {
        const imageDiv = document.createElement("div");
        imageDiv.className = "echoai-message-image";
        const img = document.createElement("img");
        img.src = message.imageUrl;
        img.alt = "Message attachment";
        img.loading = "lazy";
        imageDiv.appendChild(img);
        bubbleDiv.appendChild(imageDiv);
      }

      // Add text content
      const textDiv = document.createElement("div");
      textDiv.className = "echoai-message-text";
      textDiv.innerHTML = this.formatMessageContent(message.content);
      bubbleDiv.appendChild(textDiv);

      // Add agent badge for agent messages
      if (message.role === "agent") {
        const agentBadge = document.createElement("div");
        agentBadge.className = "echoai-agent-badge";
        agentBadge.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
          </svg>
          Support Agent
        `;
        bubbleDiv.appendChild(agentBadge);
      }

      contentContainer.appendChild(bubbleDiv);

      // Create message footer
      const footerDiv = document.createElement("div");
      footerDiv.className = "echoai-message-footer";
      if (message.role === "user") {
        footerDiv.style.justifyContent = "flex-end";
      }

      // Add timestamp and status
      const timestampDiv = document.createElement("div");
      timestampDiv.style.display = "flex";
      timestampDiv.style.alignItems = "center";
      timestampDiv.style.gap = "8px";
      timestampDiv.innerHTML = `
        <svg style="width: 12px; height: 12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12,6 12,12 16,14"></polyline>
        </svg>
        <span>${this.formatTimestamp(message.timestamp)}</span>
        ${
          message.status
            ? `
          <div style="width: 1px; height: 12px; background: var(--echoai-border);"></div>
          ${this.getStatusIcon(message.status)}
        `
            : ""
        }
      `;
      footerDiv.appendChild(timestampDiv);

      // Add actions for assistant and agent messages
      if (
        (message.role === "assistant" || message.role === "agent") &&
        !message.isStreaming
      ) {
        const actionsDiv = this.createMessageActions(message);
        footerDiv.appendChild(actionsDiv);
      }

      contentContainer.appendChild(footerDiv);

      // Assemble the message
      messageDiv.appendChild(avatarDiv);
      messageDiv.appendChild(contentContainer);

      return messageDiv;
    }

    // Format message content with proper escaping and formatting
    formatMessageContent(content) {
      // Escape HTML to prevent XSS
      const escaped = this.escapeHtml(content);

      // Convert line breaks to <br> tags
      const withBreaks = escaped.replace(/\n/g, "<br>");

      // Convert URLs to links (basic implementation)
      const withLinks = withBreaks.replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
      );

      return withLinks;
    }

    // Format timestamp for display
    formatTimestamp(timestamp) {
      // Handle completely invalid timestamps
      if (timestamp === null || timestamp === undefined) {
        return "Just now";
      }

      const date = new Date(timestamp);

      // Check if date is valid
      if (isNaN(date.getTime())) {
        return "Just now";
      }

      const now = new Date();
      const diffMs = now - date;

      // Only handle significantly future dates as invalid (more than 1 hour in future)
      if (diffMs < -3600000) {
        return "Just now";
      }

      // For past dates, use positive values; for slightly future dates, treat as "just now"
      if (diffMs < 0) {
        return "Just now";
      }

      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) {
        return "Just now";
      } else if (diffMins < 60) {
        return `${diffMins}m ago`;
      } else if (diffHours < 24) {
        return `${diffHours}h ago`;
      } else if (diffDays < 7) {
        return `${diffDays}d ago`;
      } else {
        try {
          return date.toLocaleDateString();
        } catch (error) {
          return "Just now";
        }
      }
    }

    // Truncate text to specified length
    truncateText(text, maxLength) {
      if (!text || text.length <= maxLength) {
        return text || "";
      }
      return text.substring(0, maxLength).trim() + "...";
    }

    // Get status icon for message status
    getStatusIcon(status) {
      switch (status) {
        case "pending":
          return `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12,6 12,12 16,14"></polyline>
            </svg>
          `;
        case "delivered":
          return `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20,6 9,17 4,12"></polyline>
            </svg>
          `;
        case "failed":
          return `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          `;
        default:
          return "";
      }
    }

    // Create message actions (copy, feedback)
    createMessageActions(message) {
      const actionsDiv = document.createElement("div");
      actionsDiv.className = "echoai-message-actions";

      // Copy button
      const copyBtn = document.createElement("button");
      copyBtn.className = "echoai-message-action";
      copyBtn.setAttribute("aria-label", "Copy message");
      copyBtn.setAttribute("title", "Copy message");
      copyBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      `;

      // Add copy functionality
      this.eventManager.addEventListener(copyBtn, "click", () => {
        this.copyMessageToClipboard(message.content);
        // Show copied state
        copyBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20,6 9,17 4,12"></polyline>
          </svg>
        `;
        copyBtn.style.color = "#22c55e";
        setTimeout(() => {
          copyBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          `;
          copyBtn.style.color = "";
        }, 2000);
      });

      actionsDiv.appendChild(copyBtn);

      // Feedback buttons for assistant and agent messages
      if (message.role === "assistant" || message.role === "agent") {
        const thumbsUpBtn = document.createElement("button");
        thumbsUpBtn.className = "echoai-message-action";
        thumbsUpBtn.setAttribute("aria-label", "Good response");
        thumbsUpBtn.setAttribute("title", "Good response");
        thumbsUpBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
          </svg>
        `;

        const thumbsDownBtn = document.createElement("button");
        thumbsDownBtn.className = "echoai-message-action";
        thumbsDownBtn.setAttribute("aria-label", "Poor response");
        thumbsDownBtn.setAttribute("title", "Poor response");
        thumbsDownBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path>
          </svg>
        `;

        // Add feedback functionality
        this.eventManager.addEventListener(thumbsUpBtn, "click", () => {
          this.submitMessageFeedback(message.id, "positive");
          thumbsUpBtn.style.backgroundColor = "#dcfce7";
          thumbsUpBtn.style.color = "#16a34a";
          thumbsDownBtn.style.display = "none";
        });

        this.eventManager.addEventListener(thumbsDownBtn, "click", () => {
          this.submitMessageFeedback(message.id, "negative");
          thumbsDownBtn.style.backgroundColor = "#fef2f2";
          thumbsDownBtn.style.color = "#dc2626";
          thumbsUpBtn.style.display = "none";
        });

        actionsDiv.appendChild(thumbsUpBtn);
        actionsDiv.appendChild(thumbsDownBtn);
      }

      return actionsDiv;
    }

    // Copy message content to clipboard
    async copyMessageToClipboard(content) {
      try {
        await navigator.clipboard.writeText(content);
        this.showNotification("Message copied to clipboard", "success");
      } catch (error) {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = content;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        this.showNotification("Message copied to clipboard", "success");
      }
    }

    // Submit message feedback
    submitMessageFeedback(messageId, feedback) {
      // This would typically send feedback to the server
      console.log(
        `EchoAI: Feedback submitted for message ${messageId}: ${feedback}`
      );
      this.showNotification(`Thank you for your feedback!`, "success");

      // Emit feedback event
      this.eventManager.emit("message-feedback", { messageId, feedback });
    }

    // Announce message to screen readers
    announceMessage(content, role) {
      const announcement = document.createElement("div");
      announcement.className = "echoai-sr-only";
      announcement.setAttribute("aria-live", "polite");
      announcement.textContent = `${
        role === "user" ? "You" : "Assistant"
      }: ${content}`;

      document.body.appendChild(announcement);

      // Remove after announcement
      setTimeout(() => {
        document.body.removeChild(announcement);
      }, 1000);
    }

    // Check if virtual scrolling should be enabled
    checkVirtualScrolling() {
      const currentState = this.stateManager.getState();
      const messageCount = currentState.messages.length;

      if (
        messageCount > this.virtualScrollingThreshold &&
        !this.virtualScrolling.isEnabled
      ) {
        this.enableVirtualScrolling();
      }
    }

    // Enable virtual scrolling for performance
    enableVirtualScrolling() {
      this.virtualScrolling.isEnabled = true;

      if (this.elements.messagesContainer) {
        this.elements.messagesContainer.classList.add(
          "echoai-virtual-scrolling"
        );

        // Set up scroll listener for virtual scrolling
        this.eventManager.addEventListener(
          this.elements.messagesContainer,
          "scroll",
          () => {
            this.updateVirtualScrolling();
          }
        );
      }
    }

    // Update virtual scrolling viewport
    updateVirtualScrolling() {
      if (!this.virtualScrolling.isEnabled || !this.elements.messagesContainer)
        return;

      const container = this.elements.messagesContainer;
      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;

      this.virtualScrolling.scrollTop = scrollTop;
      this.virtualScrolling.containerHeight = containerHeight;

      // Calculate visible range
      const startIndex = Math.floor(
        scrollTop / this.virtualScrolling.itemHeight
      );
      const endIndex = Math.min(
        startIndex +
          Math.ceil(containerHeight / this.virtualScrolling.itemHeight) +
          this.virtualScrolling.buffer,
        this.stateManager.getState().messages.length
      );

      this.virtualScrolling.visibleStart = Math.max(
        0,
        startIndex - this.virtualScrolling.buffer
      );
      this.virtualScrolling.visibleEnd = endIndex;

      // Re-render visible messages
      this.renderVirtualMessages();
    }

    // Render only visible messages for virtual scrolling
    renderVirtualMessages() {
      if (!this.virtualScrolling.isEnabled) return;

      const messages = this.stateManager.getState().messages;
      const container = this.elements.messagesContainer;

      // Clear container
      container.innerHTML = "";

      // Create spacer for scrolled-out messages above
      if (this.virtualScrolling.visibleStart > 0) {
        const topSpacer = document.createElement("div");
        topSpacer.style.height = `${
          this.virtualScrolling.visibleStart * this.virtualScrolling.itemHeight
        }px`;
        container.appendChild(topSpacer);
      }

      // Render visible messages
      for (
        let i = this.virtualScrolling.visibleStart;
        i < this.virtualScrolling.visibleEnd;
        i++
      ) {
        if (messages[i]) {
          const messageElement = this.createMessageElement(messages[i]);
          container.appendChild(messageElement);
        }
      }

      // Create spacer for scrolled-out messages below
      if (this.virtualScrolling.visibleEnd < messages.length) {
        const bottomSpacer = document.createElement("div");
        const remainingMessages =
          messages.length - this.virtualScrolling.visibleEnd;
        bottomSpacer.style.height = `${
          remainingMessages * this.virtualScrolling.itemHeight
        }px`;
        container.appendChild(bottomSpacer);
      }
    }

    // Scroll to bottom of messages
    scrollToBottom(smooth = true) {
      if (this.elements.messagesContainer) {
        const scrollOptions = {
          top: this.elements.messagesContainer.scrollHeight,
          behavior: smooth ? "smooth" : "auto",
        };

        this.elements.messagesContainer.scrollTo(scrollOptions);
      }
    }

    // Clear all messages from the UI and state
    clearMessages() {
      if (this.elements.messagesContainer) {
        this.elements.messagesContainer.innerHTML = "";
      }

      // Clear messages from state
      this.stateManager.setState({ messages: [] });

      // Clear any streaming state
      this.stateManager.setState({
        isStreaming: false,
        proactiveQuestions: [],
        suggestedTopics: [],
        conversationActions: [],
        intelligenceMetadata: null,
      });
    }

    // Conversation Status and Realtime Management UI Methods

    // Update conversation status in the UI
    updateConversationStatus(status, statusData = {}) {
      const statusElement = this.container.querySelector("#echoai-bot-status");
      const inputElement = this.elements.input;
      const sendButton = this.elements.sendBtn;

      if (!statusElement) return;

      // Update status text and styling
      switch (status) {
        case "AI_HANDLING":
          statusElement.textContent = "AI Assistant";
          statusElement.className = "echoai-bot-status echoai-status-ai";

          // Enable input
          if (inputElement) {
            inputElement.disabled = false;
            inputElement.placeholder = "Type your message...";
          }
          if (sendButton) {
            sendButton.disabled = false;
          }

          // Hide human agent indicator
          this.hideHumanAgentIndicator();
          break;

        case "AWAITING_HUMAN_RESPONSE":
          statusElement.textContent = statusData.agentName || "Human Agent";
          statusElement.className = "echoai-bot-status echoai-status-human";

          // Disable input temporarily
          if (inputElement) {
            inputElement.disabled = true;
            inputElement.placeholder = "Human agent is responding...";
          }
          if (sendButton) {
            sendButton.disabled = true;
          }

          // Show human agent indicator
          this.showHumanAgentIndicator(statusData);
          break;

        case "RESOLVED":
          statusElement.textContent = "Conversation Resolved";
          statusElement.className = "echoai-bot-status echoai-status-resolved";

          // Enable input for new conversation
          if (inputElement) {
            inputElement.disabled = false;
            inputElement.placeholder = "Start a new conversation...";
          }
          if (sendButton) {
            sendButton.disabled = false;
          }

          // Hide human agent indicator
          this.hideHumanAgentIndicator();
          break;

        default:
          statusElement.textContent = "Online";
          statusElement.className = "echoai-bot-status";
      }

      // Announce status change to screen readers
      this.announceStatusChange(status, statusData);
    }

    // Show human agent indicator
    showHumanAgentIndicator(statusData = {}) {
      // Remove existing indicator
      this.hideHumanAgentIndicator();

      // Create human agent indicator
      const indicator = document.createElement("div");
      indicator.className = "echoai-human-agent-indicator";
      indicator.id = "echoai-human-agent-indicator";
      indicator.innerHTML = `
        <div class="echoai-agent-avatar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
        <div class="echoai-agent-info">
          <div class="echoai-agent-name">${
            statusData.agentName || "Human Agent"
          }</div>
          <div class="echoai-agent-status">
            <span class="echoai-status-dot"></span>
            ${statusData.agentStatus || "Online"}
          </div>
        </div>
      `;

      // Insert after header
      const header = this.container.querySelector(".echoai-header");
      if (header) {
        header.insertAdjacentElement("afterend", indicator);
      }

      // Add animation
      requestAnimationFrame(() => {
        indicator.classList.add("echoai-agent-indicator-visible");
      });
    }

    // Hide human agent indicator
    hideHumanAgentIndicator() {
      const indicator = this.container.querySelector(
        "#echoai-human-agent-indicator"
      );
      if (indicator) {
        indicator.classList.add("echoai-agent-indicator-hiding");
        setTimeout(() => {
          if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
          }
        }, 300);
      }
    }

    // Update connection status indicator
    updateConnectionStatus(isConnected, connectionType = null, error = null) {
      const statusElement = this.container.querySelector(
        "#echoai-connection-status"
      );
      if (!statusElement) return;

      if (isConnected) {
        statusElement.style.display = "none";
      } else {
        statusElement.style.display = "flex";
        statusElement.className =
          "echoai-connection-status echoai-connection-disconnected";

        const indicator = statusElement.querySelector(
          ".echoai-connection-indicator"
        );
        if (indicator) {
          indicator.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
            </svg>
            <span>Reconnecting...</span>
          `;
        }
      }
    }

    // Announce status change to screen readers
    announceStatusChange(status, statusData) {
      let announcement = "";

      switch (status) {
        case "AI_HANDLING":
          announcement = "AI assistant is now handling the conversation";
          break;
        case "AWAITING_HUMAN_RESPONSE":
          announcement = `${
            statusData.agentName || "Human agent"
          } has joined the conversation`;
          break;
        case "RESOLVED":
          announcement = "Conversation has been resolved";
          break;
      }

      if (announcement) {
        const announcer = document.createElement("div");
        announcer.className = "echoai-sr-only";
        announcer.setAttribute("aria-live", "assertive");
        announcer.textContent = announcement;

        document.body.appendChild(announcer);

        setTimeout(() => {
          document.body.removeChild(announcer);
        }, 1000);
      }
    }

    // Show notification to user
    showNotification(message, type = "info", duration = 3000) {
      // Remove existing notifications
      const existingNotifications = document.querySelectorAll(
        ".echoai-notification"
      );
      existingNotifications.forEach((notification) => {
        notification.remove();
      });

      // Create notification element
      const notification = document.createElement("div");
      notification.className = `echoai-notification echoai-notification-${type}`;
      notification.innerHTML = `
        <div class="echoai-notification-content">
          <span class="echoai-notification-message">${this.escapeHtml(
            message
          )}</span>
          <button class="echoai-notification-close" aria-label="Close notification">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      `;

      // Add to document
      document.body.appendChild(notification);

      // Add close functionality
      const closeBtn = notification.querySelector(".echoai-notification-close");
      const closeNotification = () => {
        notification.classList.add("echoai-notification-hiding");
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      };

      this.eventManager.addEventListener(closeBtn, "click", closeNotification);

      // Auto-hide after duration
      if (duration > 0) {
        setTimeout(closeNotification, duration);
      }

      // Show with animation
      requestAnimationFrame(() => {
        notification.classList.add("echoai-notification-visible");
      });
    }

    // Format timestamp for display
    formatTimestamp(timestamp) {
      // Handle completely invalid timestamps
      if (timestamp === null || timestamp === undefined) {
        return "Just now";
      }

      const date = new Date(timestamp);

      // Check if date is valid
      if (isNaN(date.getTime())) {
        return "Just now";
      }

      const now = new Date();
      const diffMs = now - date;

      // Only handle significantly future dates as invalid (more than 1 hour in future)
      if (diffMs < -3600000) {
        return "Just now";
      }

      // For past dates, use positive values; for slightly future dates, treat as "just now"
      if (diffMs < 0) {
        return "Just now";
      }

      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      try {
        return date.toLocaleDateString();
      } catch (error) {
        return "Just now";
      }
    }

    // Get status icon for message
    getStatusIcon(status) {
      const icons = {
        delivered: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20,6 9,17 4,12"></polyline>
        </svg>`,
        pending: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12,6 12,12 16,14"></polyline>
        </svg>`,
        failed: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>`,
      };

      return icons[status] || icons.delivered;
    }

    // Create message actions (copy, feedback)
    createMessageActions(message) {
      const actionsDiv = document.createElement("div");
      actionsDiv.className = "echoai-message-actions";

      // Copy button
      const copyBtn = document.createElement("button");
      copyBtn.className = "echoai-message-action echoai-copy-btn";
      copyBtn.setAttribute("aria-label", "Copy message");
      copyBtn.title = "Copy message";
      copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>`;

      this.eventManager.addEventListener(copyBtn, "click", () => {
        this.copyMessageToClipboard(message);
      });

      actionsDiv.appendChild(copyBtn);

      // Feedback buttons for assistant messages
      if (message.role === "assistant") {
        const feedbackDiv = document.createElement("div");
        feedbackDiv.className = "echoai-message-feedback";

        // Thumbs up
        const thumbsUpBtn = document.createElement("button");
        thumbsUpBtn.className =
          "echoai-message-action echoai-feedback-btn echoai-thumbs-up";
        thumbsUpBtn.setAttribute("aria-label", "Good response");
        thumbsUpBtn.title = "Good response";
        thumbsUpBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
        </svg>`;

        // Thumbs down
        const thumbsDownBtn = document.createElement("button");
        thumbsDownBtn.className =
          "echoai-message-action echoai-feedback-btn echoai-thumbs-down";
        thumbsDownBtn.setAttribute("aria-label", "Poor response");
        thumbsDownBtn.title = "Poor response";
        thumbsDownBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path>
        </svg>`;

        this.eventManager.addEventListener(thumbsUpBtn, "click", () => {
          this.handleMessageFeedback(message.id, "positive");
        });

        this.eventManager.addEventListener(thumbsDownBtn, "click", () => {
          this.handleMessageFeedback(message.id, "negative");
        });

        feedbackDiv.appendChild(thumbsUpBtn);
        feedbackDiv.appendChild(thumbsDownBtn);
        actionsDiv.appendChild(feedbackDiv);
      }

      return actionsDiv;
    }

    // Copy message to clipboard
    async copyMessageToClipboard(message) {
      try {
        await navigator.clipboard.writeText(message.content);
        this.showToast("Message copied to clipboard", "success");
      } catch (error) {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = message.content;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);

        this.showToast("Message copied to clipboard", "success");
      }
    }

    // Handle message feedback
    handleMessageFeedback(messageId, feedback) {
      // Update UI to show feedback was given
      const messageElement = this.container.querySelector(
        `[data-message-id="${messageId}"]`
      );
      if (messageElement) {
        const feedbackBtns = messageElement.querySelectorAll(
          ".echoai-feedback-btn"
        );
        feedbackBtns.forEach((btn) => {
          btn.classList.remove("echoai-feedback-active");
        });

        const activeBtn = messageElement.querySelector(
          `.echoai-${feedback === "positive" ? "thumbs-up" : "thumbs-down"}`
        );
        if (activeBtn) {
          activeBtn.classList.add("echoai-feedback-active");
        }
      }

      // Send feedback to backend (if API exists)
      this.sendMessageFeedback(messageId, feedback);

      // Show confirmation
      this.showToast(`Thank you for your feedback!`, "success");
    }

    // Send feedback to backend
    async sendMessageFeedback(messageId, feedback) {
      try {
        // This would be implemented when the feedback API is available
        console.log(`Feedback for message ${messageId}: ${feedback}`);
      } catch (error) {
        console.error("Failed to send feedback:", error);
      }
    }

    // Virtual scrolling implementation
    checkVirtualScrolling() {
      const currentState = this.stateManager.getState();
      const shouldEnable =
        currentState.messages.length > this.virtualScrollingThreshold;

      if (
        shouldEnable &&
        (!this.virtualScrolling || !this.virtualScrolling.isEnabled)
      ) {
        this.enableVirtualScrolling();
      } else if (
        !shouldEnable &&
        this.virtualScrolling &&
        this.virtualScrolling.isEnabled
      ) {
        this.disableVirtualScrolling();
      }
    }

    enableVirtualScrolling() {
      if (!this.elements.messagesContainer) return;

      if (!this.virtualScrolling) {
        this.initializeVirtualScrolling();
      }

      this.virtualScrolling.isEnabled = true;
      this.virtualScrolling.containerHeight =
        this.elements.messagesContainer.clientHeight;

      // Add scroll listener
      this.scrollListener = () => {
        this.updateVirtualScrolling();
      };

      this.eventManager.addEventListener(
        this.elements.messagesContainer,
        "scroll",
        this.scrollListener
      );

      // Initial render
      this.updateVirtualScrolling();
    }

    disableVirtualScrolling() {
      if (!this.virtualScrolling) return;

      this.virtualScrolling.isEnabled = false;

      if (this.scrollListener) {
        this.eventManager.removeEventListener(
          this.elements.messagesContainer,
          "scroll",
          this.scrollListener
        );
      }

      // Render all messages
      this.renderAllMessages();
    }

    updateVirtualScrolling() {
      if (
        !this.virtualScrolling ||
        !this.virtualScrolling.isEnabled ||
        !this.elements.messagesContainer
      )
        return;

      const { scrollTop, clientHeight } = this.elements.messagesContainer;
      const { itemHeight, buffer } = this.virtualScrolling;

      const visibleStart = Math.floor(scrollTop / itemHeight);
      const visibleEnd = Math.min(
        visibleStart + Math.ceil(clientHeight / itemHeight),
        this.stateManager.getState().messages.length - 1
      );

      this.virtualScrolling.visibleStart = Math.max(0, visibleStart - buffer);
      this.virtualScrolling.visibleEnd = Math.min(
        this.stateManager.getState().messages.length - 1,
        visibleEnd + buffer
      );

      this.renderVisibleMessages();
    }

    renderVisibleMessages() {
      const currentState = this.stateManager.getState();
      const { visibleStart, visibleEnd } = this.virtualScrolling;

      // Clear container
      this.elements.messagesContainer.innerHTML = "";

      // Create spacer for items before visible range
      if (visibleStart > 0) {
        const topSpacer = document.createElement("div");
        topSpacer.style.height = `${
          visibleStart * this.virtualScrolling.itemHeight
        }px`;
        this.elements.messagesContainer.appendChild(topSpacer);
      }

      // Render visible messages
      for (let i = visibleStart; i <= visibleEnd; i++) {
        const message = currentState.messages[i];
        if (message) {
          const messageElement = this.createMessageElement(message);
          this.elements.messagesContainer.appendChild(messageElement);
        }
      }

      // Create spacer for items after visible range
      const remainingItems = currentState.messages.length - visibleEnd - 1;
      if (remainingItems > 0) {
        const bottomSpacer = document.createElement("div");
        bottomSpacer.style.height = `${
          remainingItems * this.virtualScrolling.itemHeight
        }px`;
        this.elements.messagesContainer.appendChild(bottomSpacer);
      }
    }

    renderAllMessages() {
      if (!this.elements.messagesContainer) return;

      this.elements.messagesContainer.innerHTML = "";

      // Add human agent status indicator if needed
      const currentState = this.stateManager.getState();
      if (currentState.conversationStatus === "AWAITING_HUMAN_RESPONSE") {
        const statusIndicator = document.createElement("div");
        statusIndicator.className = "echoai-human-agent-status";
        statusIndicator.innerHTML = `
          <div class="echoai-status-header">
            <div class="echoai-status-dot"></div>
            <span class="echoai-status-title">Connected to human support agent</span>
          </div>
          <p class="echoai-status-message">A support agent will respond to your message shortly</p>
        `;
        this.elements.messagesContainer.appendChild(statusIndicator);
      }

      currentState.messages.forEach((message) => {
        const messageElement = this.createMessageElement(message);
        this.elements.messagesContainer.appendChild(messageElement);
      });
    }

    // Show toast notification
    showToast(message, type = "info") {
      const toast = document.createElement("div");
      toast.className = `echoai-toast echoai-toast-${type}`;
      toast.textContent = message;
      toast.setAttribute("role", "alert");
      toast.setAttribute("aria-live", "polite");

      // Position toast
      toast.style.position = "fixed";
      toast.style.top = "20px";
      toast.style.right = "20px";
      toast.style.zIndex = "10000";
      toast.style.padding = "12px 16px";
      toast.style.borderRadius = "8px";
      toast.style.backgroundColor = type === "success" ? "#10b981" : "#3b82f6";
      toast.style.color = "white";
      toast.style.fontSize = "14px";
      toast.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
      toast.style.transform = "translateX(100%)";
      toast.style.transition = "transform 0.3s ease";

      document.body.appendChild(toast);

      // Animate in
      requestAnimationFrame(() => {
        toast.style.transform = "translateX(0)";
      });

      // Remove after delay
      setTimeout(() => {
        toast.style.transform = "translateX(100%)";
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }, 3000);
    }

    announceMessage(content, role) {
      const announcement =
        role === "user"
          ? `You said: ${content}`
          : `Assistant replied: ${content}`;

      // Create temporary announcement element
      const announcer = document.createElement("div");
      announcer.setAttribute("aria-live", "polite");
      announcer.setAttribute("aria-atomic", "true");
      announcer.className = "echoai-sr-only";
      announcer.textContent = announcement;

      document.body.appendChild(announcer);

      // Remove after announcement
      setTimeout(() => {
        document.body.removeChild(announcer);
      }, 1000);
    }

    // Enhanced streaming message functionality
    addStreamingMessage(messageId, role = "assistant") {
      console.log("EchoAI: addStreamingMessage called with:", {
        messageId,
        role,
      });
      const timestamp = new Date();

      const message = {
        id: messageId,
        content: "",
        role,
        timestamp,
        status: "pending",
        isStreaming: true,
      };

      // Add to state
      const currentState = this.stateManager.getState();
      const updatedMessages = [...currentState.messages, message];
      this.stateManager.setState({ messages: updatedMessages });

      // Create streaming message element
      const messageElement = this.createStreamingMessageElement(message);
      this.elements.messagesContainer.appendChild(messageElement);

      this.scrollToBottom();

      return messageId;
    }

    // Create streaming message element with typing indicator
    createStreamingMessageElement(message) {
      const messageDiv = document.createElement("div");
      messageDiv.className = `echoai-message echoai-message-${message.role} echoai-streaming`;
      messageDiv.setAttribute("data-message-id", message.id);
      messageDiv.setAttribute("role", "article");
      messageDiv.setAttribute(
        "aria-label",
        `${message.role} message streaming`
      );
      messageDiv.setAttribute("aria-live", "polite");

      const contentDiv = document.createElement("div");
      contentDiv.className = "echoai-message-content";

      const textDiv = document.createElement("div");
      textDiv.className = "echoai-message-text echoai-streaming-text";
      contentDiv.appendChild(textDiv);

      // Add typing cursor if enabled
      if (this.config.streamingConfig?.showTypingIndicator) {
        const cursor = document.createElement("span");
        cursor.className = "echoai-streaming-cursor";
        cursor.textContent = "|";
        cursor.style.marginLeft = "2px";
        cursor.style.fontWeight = "bold";
        contentDiv.appendChild(cursor);

        // Start cursor animation
        this.animateStreamingCursor(cursor);
      }

      messageDiv.appendChild(contentDiv);

      // Add timestamp
      const timeDiv = document.createElement("div");
      timeDiv.className = "echoai-message-time";
      timeDiv.textContent = this.formatTimestamp(message.timestamp);
      messageDiv.appendChild(timeDiv);

      return messageDiv;
    }

    // Update streaming message with new content
    updateStreamingMessage(messageId, content) {
      console.log("EchoAI: updateStreamingMessage called with:", {
        messageId,
        content: content.substring(0, 50) + "...",
      });
      const messageElement = this.container.querySelector(
        `[data-message-id="${messageId}"]`
      );
      if (!messageElement) return;

      const textElement = messageElement.querySelector(
        ".echoai-streaming-text"
      );
      if (textElement) {
        // Apply typing animation if enabled
        if (this.config.streamingConfig?.enableTokenAnimation) {
          this.animateTyping(textElement, content);
        } else {
          textElement.innerHTML = this.formatMessageContent(content);
        }
      }

      // Update state
      const currentState = this.stateManager.getState();
      const updatedMessages = currentState.messages.map((msg) =>
        msg.id === messageId ? { ...msg, content } : msg
      );
      this.stateManager.setState({ messages: updatedMessages });

      this.scrollToBottom();
    }

    // Enhanced typing animation for streaming with better performance
    animateTyping(element, newContent) {
      const currentContent = element.textContent || "";
      const targetContent = newContent;

      if (targetContent.length <= currentContent.length) {
        element.innerHTML = this.formatMessageContent(targetContent);
        return;
      }

      // Cancel any existing animation
      if (element._typingAnimation) {
        clearTimeout(element._typingAnimation);
      }

      // Add new characters with animation
      const newChars = targetContent.slice(currentContent.length);
      const speed = this.config.streamingConfig?.typingSpeed || 30;
      const chunkSize = Math.max(1, Math.floor(newChars.length / 20)); // Animate in chunks for better performance

      let charIndex = 0;
      const typeChunk = () => {
        if (charIndex < newChars.length) {
          const nextChunkEnd = Math.min(charIndex + chunkSize, newChars.length);
          const contentToShow =
            currentContent + newChars.slice(0, nextChunkEnd);
          element.innerHTML = this.formatMessageContent(contentToShow);
          charIndex = nextChunkEnd;

          element._typingAnimation = setTimeout(typeChunk, speed);
        } else {
          delete element._typingAnimation;
        }
      };

      typeChunk();
    }

    // Enhanced streaming cursor animation
    animateStreamingCursor(cursorElement) {
      if (!cursorElement || cursorElement._cursorAnimation) return;

      let visible = true;
      const blink = () => {
        cursorElement.style.opacity = visible ? "1" : "0";
        visible = !visible;
        cursorElement._cursorAnimation = setTimeout(blink, 500);
      };

      blink();
    }

    // Stop cursor animation
    stopStreamingCursor(cursorElement) {
      if (cursorElement && cursorElement._cursorAnimation) {
        clearTimeout(cursorElement._cursorAnimation);
        delete cursorElement._cursorAnimation;
        cursorElement.style.opacity = "0";
      }
    }

    // Finalize streaming message
    finalizeStreamingMessage(messageId, finalContent) {
      console.log("EchoAI: finalizeStreamingMessage called with:", {
        messageId,
        finalContent: finalContent.substring(0, 50) + "...",
      });
      const messageElement = this.container.querySelector(
        `[data-message-id="${messageId}"]`
      );
      if (!messageElement) {
        console.error(
          "EchoAI: Message element not found for messageId:",
          messageId
        );
        return;
      }

      // Stop any ongoing animations
      const textElement = messageElement.querySelector(
        ".echoai-streaming-text"
      );
      if (textElement && textElement._typingAnimation) {
        clearTimeout(textElement._typingAnimation);
        delete textElement._typingAnimation;
      }

      // Stop cursor animation and remove cursor
      const cursor = messageElement.querySelector(".echoai-streaming-cursor");
      if (cursor) {
        this.stopStreamingCursor(cursor);
        cursor.remove();
      }

      // Remove streaming classes
      messageElement.classList.remove("echoai-streaming");

      // Update content with final text
      if (textElement) {
        textElement.className = "echoai-message-text";
        textElement.innerHTML = this.formatMessageContent(finalContent);
      }

      // Update status
      const statusDiv = messageElement.querySelector(".echoai-message-status");
      if (statusDiv) {
        statusDiv.innerHTML = this.getStatusIcon("delivered");
      }

      // Add message actions
      const existingActions = messageElement.querySelector(
        ".echoai-message-actions"
      );
      if (!existingActions) {
        const message = {
          id: messageId,
          content: finalContent,
          role: "assistant",
          timestamp: new Date(),
        };
        const actionsDiv = this.createMessageActions(message);
        messageElement.appendChild(actionsDiv);
      }

      // Update state
      const currentState = this.stateManager.getState();
      const updatedMessages = currentState.messages.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              content: finalContent,
              status: "delivered",
              isStreaming: false,
            }
          : msg
      );
      this.stateManager.setState({ messages: updatedMessages });

      this.scrollToBottom();
    }

    // Show streaming controls (cancel button)
    showStreamingControls() {
      if (!this.elements.messagesContainer) return;

      // Remove existing controls
      this.hideStreamingControls();

      const controlsDiv = document.createElement("div");
      controlsDiv.className = "echoai-streaming-controls";
      controlsDiv.innerHTML = `
        <button class="echoai-cancel-streaming-btn" aria-label="Cancel streaming">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          Cancel
        </button>
      `;

      // Add to input area
      const inputContainer = this.container.querySelector(
        ".echoai-input-container"
      );
      if (inputContainer) {
        inputContainer.appendChild(controlsDiv);
      }

      // Add event listener
      const cancelBtn = controlsDiv.querySelector(
        ".echoai-cancel-streaming-btn"
      );
      if (cancelBtn && window.EchoAI) {
        this.eventManager.addEventListener(cancelBtn, "click", () => {
          if (window.EchoAI.cancelStreaming) {
            window.EchoAI.cancelStreaming();
          }
        });
      }
    }

    // Hide streaming controls
    hideStreamingControls() {
      const existingControls = this.container.querySelector(
        ".echoai-streaming-controls"
      );
      if (existingControls) {
        existingControls.remove();
      }
    }

    // Remove streaming message (for cancellation)
    removeStreamingMessage(messageId) {
      const messageElement = this.container.querySelector(
        `[data-message-id="${messageId}"]`
      );
      if (messageElement) {
        messageElement.remove();
      }

      // Update state
      const currentState = this.stateManager.getState();
      const updatedMessages = currentState.messages.filter(
        (msg) => msg.id !== messageId
      );
      this.stateManager.setState({ messages: updatedMessages });
    }

    showTyping() {
      if (!this.elements.messagesContainer) return;

      const typingHTML = this.renderTemplate("message.typing");

      // Create temporary container to parse HTML
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = typingHTML;
      const typingElement = tempDiv.firstElementChild;

      this.elements.messagesContainer.appendChild(typingElement);
      this.scrollToBottom();
    }

    hideTyping() {
      const typing = this.container.querySelector(".echoai-typing");
      if (typing) {
        typing.remove();
      }
    }

    scrollToBottom() {
      if (this.elements.messagesContainer) {
        this.elements.messagesContainer.scrollTop =
          this.elements.messagesContainer.scrollHeight;
      }
    }

    clearInput() {
      if (this.elements.input) {
        this.elements.input.value = "";
      }

      if (this.config.enableImageUpload) {
        this.clearImageUpload();
      }
    }

    applySettings(settings) {
      // Update bot name
      const botName = this.container.querySelector(".echoai-bot-name");
      if (botName && settings.name) {
        botName.textContent = settings.name;
      }

      // Update welcome message
      if (settings.welcomeMessage) {
        this.welcomeMessage = settings.welcomeMessage;
      }

      // Update primary color using theme manager
      if (settings.primaryColor) {
        this.themeManager.generateColorTheme(settings.primaryColor);
      }

      // Update any other dynamic settings
      if (settings.chatbotName) {
        const botNameElement = this.container.querySelector(".echoai-bot-name");
        if (botNameElement) {
          botNameElement.textContent = settings.chatbotName;
        }
      }
    }

    updateTheme() {
      // Always apply light theme
      this.container.classList.remove("echoai-theme-light");
      this.container.classList.add("echoai-theme-light");
    }

    updatePrimaryColor(color) {
      this.themeManager.generateColorTheme(color);
      this.config.primaryColor = color;
    }

    // Enhanced method for updating intelligence panel with templates
    updateIntelligencePanel(enhancedData) {
      const intelligencePanel = this.container.querySelector(
        "#echoai-intelligence-panel"
      );
      if (!intelligencePanel) return;

      let hasContent = false;
      let panelHTML = `<div class="echoai-intelligence-header">
          <span class="echoai-intelligence-title">AI Suggestions</span>
          <button class="echoai-intelligence-toggle" aria-label="Toggle suggestions" aria-expanded="true">
            <svg class="echoai-toggle-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6,9 12,15 18,9"></polyline>
            </svg>
          </button>
        </div>`;

      // Handle proactive questions
      if (
        enhancedData.proactive_questions &&
        enhancedData.proactive_questions.length > 0 &&
        this.config.intelligenceConfig?.showProactiveQuestions
      ) {
        panelHTML += this.renderTemplate(
          "intelligence.proactiveQuestions",
          enhancedData.proactive_questions
        );
        hasContent = true;
      }

      // Handle suggested topics
      if (
        enhancedData.suggested_topics &&
        enhancedData.suggested_topics.length > 0 &&
        this.config.intelligenceConfig?.showSuggestedTopics
      ) {
        panelHTML += this.renderTemplate(
          "intelligence.suggestedTopics",
          enhancedData.suggested_topics
        );
        hasContent = true;
      }

      // Handle conversation actions
      if (
        enhancedData.conversation_actions &&
        enhancedData.conversation_actions.length > 0 &&
        this.config.intelligenceConfig?.showConversationActions
      ) {
        panelHTML += this.renderTemplate(
          "intelligence.conversationActions",
          enhancedData.conversation_actions
        );
        hasContent = true;
      }

      // Update panel content
      intelligencePanel.innerHTML = panelHTML;
      intelligencePanel.style.display = hasContent ? "block" : "none";

      // Add event listeners for intelligence buttons
      if (hasContent) {
        this.setupIntelligenceEventListeners();
      }
    }

    setupIntelligenceEventListeners() {
      // Proactive question buttons
      const questionButtons = this.container.querySelectorAll(
        ".echoai-proactive-btn"
      );
      questionButtons.forEach((button) => {
        this.eventManager.addEventListener(button, "click", () => {
          const question = button.getAttribute("data-question");
          if (question && window.EchoAI && window.EchoAI.sendMessage) {
            window.EchoAI.sendMessage(question);
          }
        });
      });

      // Topic buttons
      const topicButtons = this.container.querySelectorAll(".echoai-topic-btn");
      topicButtons.forEach((button) => {
        this.eventManager.addEventListener(button, "click", () => {
          const topic = button.getAttribute("data-topic");
          if (topic && window.EchoAI && window.EchoAI.sendMessage) {
            window.EchoAI.sendMessage(`Tell me about ${topic}`);
          }
        });
      });

      // Action buttons
      const actionButtons =
        this.container.querySelectorAll(".echoai-action-btn");
      actionButtons.forEach((button) => {
        this.eventManager.addEventListener(button, "click", () => {
          const actionType = button.getAttribute("data-action-type");
          const content = button.getAttribute("data-content");
          if (window.EchoAI && window.EchoAI.handleAction) {
            window.EchoAI.handleAction(actionType, content);
          }
        });
      });
    }

    // Add message to the chat
    addMessage(content, role = "user", imageUrl = null, options = {}) {
      if (!this.elements.messagesContainer) return;

      const messageId =
        options.id ||
        `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = options.timestamp || new Date();

      // Create message group container
      const messageGroup = document.createElement("div");
      messageGroup.className = `echoai-message-group ${
        role === "user" ? "flex-row-reverse" : ""
      }`;
      messageGroup.setAttribute("data-message-id", messageId);

      // Create avatar
      const avatarDiv = document.createElement("div");
      avatarDiv.className = "echoai-message-avatar";

      // Set avatar styling based on role
      const primaryColor = this.config.primaryColor || "#3b82f6";
      if (role === "user") {
        avatarDiv.style.background = `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`;
        avatarDiv.style.color = "white";
      } else if (role === "agent") {
        avatarDiv.style.background =
          "linear-gradient(135deg, #22c55e, #16a34a)";
        avatarDiv.style.color = "white";
      } else {
        avatarDiv.style.background = `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`;
        avatarDiv.style.color = "white";
      }

      // Add avatar icon
      avatarDiv.innerHTML =
        role === "user"
          ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>'
          : role === "agent"
          ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>'
          : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>';

      // Create message content container
      const contentContainer = document.createElement("div");
      contentContainer.className = "echoai-message-content";
      if (role === "user") {
        contentContainer.style.textAlign = "right";
      }

      // Create message bubble
      const bubbleDiv = document.createElement("div");
      bubbleDiv.className = "echoai-message-bubble";

      // Set bubble styling based on role
      if (role === "user") {
        bubbleDiv.style.background = `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`;
        bubbleDiv.style.color = "white";
        bubbleDiv.style.borderTopRightRadius = "6px";
      } else if (role === "agent") {
        bubbleDiv.style.backgroundColor = "#f0fdf4";
        bubbleDiv.style.borderColor = "#22c55e33";
        bubbleDiv.style.color = "#0f172a";
        bubbleDiv.style.borderTopLeftRadius = "6px";
      } else {
        bubbleDiv.style.backgroundColor = "#f8fafc";
        bubbleDiv.style.borderColor = `${primaryColor}20`;
        bubbleDiv.style.color = "#0f172a";
        bubbleDiv.style.borderTopLeftRadius = "6px";
      }

      // Handle image if present
      if (imageUrl) {
        const imageDiv = document.createElement("div");
        imageDiv.className = "echoai-message-image";
        const img = document.createElement("img");
        img.src = imageUrl;
        img.alt = "Message attachment";
        img.loading = "lazy";
        imageDiv.appendChild(img);
        bubbleDiv.appendChild(imageDiv);
      }

      // Add text content
      const textDiv = document.createElement("div");
      textDiv.className = "echoai-message-text";
      textDiv.innerHTML = this.formatMessageContent(content);
      bubbleDiv.appendChild(textDiv);

      // Add agent badge for agent messages
      if (role === "agent") {
        const agentBadge = document.createElement("div");
        agentBadge.className = "echoai-agent-badge";
        agentBadge.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
          </svg>
          Support Agent
        `;
        bubbleDiv.appendChild(agentBadge);
      }

      contentContainer.appendChild(bubbleDiv);

      // Create message footer
      const footerDiv = document.createElement("div");
      footerDiv.className = "echoai-message-footer";
      if (role === "user") {
        footerDiv.style.justifyContent = "flex-end";
      }

      // Add timestamp and status
      const timestampDiv = document.createElement("div");
      timestampDiv.style.display = "flex";
      timestampDiv.style.alignItems = "center";
      timestampDiv.style.gap = "8px";
      timestampDiv.innerHTML = `
        <svg style="width: 12px; height: 12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12,6 12,12 16,14"></polyline>
        </svg>
        <span>${this.formatTimestamp(timestamp)}</span>
      `;
      footerDiv.appendChild(timestampDiv);

      contentContainer.appendChild(footerDiv);

      // Assemble the message
      messageGroup.appendChild(avatarDiv);
      messageGroup.appendChild(contentContainer);

      // Add to messages container
      this.elements.messagesContainer.appendChild(messageGroup);

      // Update state
      const currentState = this.stateManager.getState();
      const message = {
        id: messageId,
        content,
        role,
        timestamp,
        imageUrl,
        ...options,
      };

      const updatedMessages = [...currentState.messages, message];
      this.stateManager.setState({ messages: updatedMessages });

      // Scroll to bottom
      this.scrollToBottom();

      return messageId;
    }

    // Escape HTML to prevent XSS
    escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }

    // Format message content with proper escaping and formatting
    formatMessageContent(content) {
      // Escape HTML to prevent XSS
      const escaped = this.escapeHtml(content);

      // Convert line breaks to <br> tags
      const withBreaks = escaped.replace(/\n/g, "<br>");

      // Convert URLs to links (basic implementation)
      const withLinks = withBreaks.replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
      );

      return withLinks;
    }

    // Clear all messages
    clearMessages() {
      if (this.elements.messagesContainer) {
        this.elements.messagesContainer.innerHTML = "";
      }

      // Clear messages from state
      this.stateManager.setState({ messages: [] });
    }

    // Format timestamp for display
    formatTimestamp(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;

      const diffHours = Math.floor(diffMs / 3600000);
      if (diffHours < 24) return `${diffHours}h ago`;

      return date.toLocaleDateString();
    }

    // Show typing indicator
    showTyping() {
      console.log("EchoAI: Showing typing indicator");

      // Remove existing typing indicator
      this.hideTyping();

      if (!this.elements.messagesContainer) return;

      // Create typing indicator
      const typingDiv = document.createElement("div");
      typingDiv.className = "echoai-typing-indicator";
      typingDiv.id = "echoai-typing-indicator";

      typingDiv.innerHTML = `
        <div class="echoai-message-group" data-role="assistant">
          <div class="echoai-message-avatar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
            </svg>
          </div>
          <div class="echoai-message-content">
            <div class="echoai-message-bubble echoai-typing-bubble">
              <div class="echoai-typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        </div>
      `;

      // Add CSS for typing animation if not already added
      if (!document.getElementById("echoai-typing-styles")) {
        const style = document.createElement("style");
        style.id = "echoai-typing-styles";
        style.textContent = `
          .echoai-typing-indicator {
            padding: 8px 16px;
          }
          
          .echoai-typing-bubble {
            background: #f8fafc !important;
            border: 1px solid rgba(0, 0, 0, 0.05) !important;
            padding: 12px 16px !important;
          }
          
          .echoai-typing-dots {
            display: flex;
            gap: 4px;
            align-items: center;
          }
          
          .echoai-typing-dots span {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #9ca3af;
            animation: echoai-typing-bounce 1.4s infinite ease-in-out;
          }
          
          .echoai-typing-dots span:nth-child(1) {
            animation-delay: -0.32s;
          }
          
          .echoai-typing-dots span:nth-child(2) {
            animation-delay: -0.16s;
          }
          
          @keyframes echoai-typing-bounce {
            0%, 80%, 100% {
              transform: scale(0.8);
              opacity: 0.5;
            }
            40% {
              transform: scale(1);
              opacity: 1;
            }
          }
        `;
        document.head.appendChild(style);
      }

      this.elements.messagesContainer.appendChild(typingDiv);
      this.scrollToBottom();
    }

    // Hide typing indicator
    hideTyping() {
      console.log("EchoAI: Hiding typing indicator");
      const typingIndicator = document.getElementById(
        "echoai-typing-indicator"
      );
      if (typingIndicator) {
        typingIndicator.remove();
      }
    }

    // Scroll to bottom of messages
    scrollToBottom() {
      if (this.elements.messagesContainer) {
        this.elements.messagesContainer.scrollTop =
          this.elements.messagesContainer.scrollHeight;
      }
    }

    cleanup() {
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
    }
  }

  // EchoAI Enhanced Chat Widget - Main class
  window.EchoAI = {
    init: function (config) {
      if (!config || !config.chatbotId || !config.apiKey) {
        console.error(
          "EchoAI: Missing required configuration (chatbotId, apiKey)"
        );
        return;
      }

      this.config = {
        chatbotId: config.chatbotId,
        apiKey: config.apiKey,
        userEmail: config.userEmail, // Add userEmail support
        position: config.position || "bottom-right",
        showBranding: config.showBranding !== false,
        apiUrl:
          config.apiUrl || window.location.origin + "/api/enhanced-chat/widget",

        // Enhanced features
        enableEnhancedFeatures: config.enableEnhancedFeatures !== false,
        enableImageUpload: config.enableImageUpload !== false,
        enableFAQ: config.enableFAQ !== false,
        enableHistory: config.enableHistory !== false,

        // Enhanced Streaming configuration
        streamingConfig: {
          enabled: config.streamingConfig?.enabled === true,
          typingSpeed: config.streamingConfig?.typingSpeed || 30,
          showTypingIndicator:
            config.streamingConfig?.showTypingIndicator !== false,
          enableTokenAnimation:
            config.streamingConfig?.enableTokenAnimation !== false,
          fallbackToRegular:
            config.streamingConfig?.fallbackToRegular !== false,
          retryAttempts: config.streamingConfig?.retryAttempts || 2,
          connectionTimeout: config.streamingConfig?.connectionTimeout || 30000,
        },

        // Intelligence configuration
        intelligenceConfig: {
          enabled: config.intelligenceConfig?.enabled !== false,
          showProactiveQuestions:
            config.intelligenceConfig?.showProactiveQuestions !== false,
          showSuggestedTopics:
            config.intelligenceConfig?.showSuggestedTopics !== false,
          showConversationActions:
            config.intelligenceConfig?.showConversationActions !== false,
          showIntelligenceMetrics:
            config.intelligenceConfig?.showIntelligenceMetrics || false,
        },

        // Lead collection configuration
        leadCollectionConfig: {
          enabled: config.leadCollectionConfig?.enabled !== false,
          collectEmail: config.leadCollectionConfig?.collectEmail !== false,
          collectPhone: config.leadCollectionConfig?.collectPhone || false,
          collectCompany: config.leadCollectionConfig?.collectCompany !== false,
          progressiveCollection:
            config.leadCollectionConfig?.progressiveCollection !== false,
        },

        // Escalation configuration
        escalationConfig: {
          enabled: config.escalationConfig?.enabled !== false,
          showEscalationButton:
            config.escalationConfig?.showEscalationButton !== false,
          escalationThreshold:
            config.escalationConfig?.escalationThreshold || 0.7,
          humanAgentAvailable:
            config.escalationConfig?.humanAgentAvailable !== false,
        },

        // Embedded fallback settings
        chatbotName: config.chatbotName,
        welcomeMessage: config.welcomeMessage,
        primaryColor: config.primaryColor || "#3b82f6", // Default blue color
      };

      // Initialize core components
      this.stateManager = new StateManager();
      this.eventManager = new EventManager();
      this.apiClient = new APIClient(this.config, this.stateManager);
      this.uiManager = new UIManager(
        this.config,
        this.stateManager,
        this.eventManager,
        this.apiClient
      );
      this.realtimeManager = new RealtimeManager(
        this.config,
        this.stateManager,
        this.eventManager
      );

      this.createWidget();
      this.loadStyles();
    },

    // Conversation storage methods
    getConversationStorageKey: function () {
      return `chat-conversation-${this.config.chatbotId}-${this.config.userEmail}`;
    },

    saveConversationToStorage: function (conversationId) {
      if (!this.config.userEmail || !this.config.chatbotId || !conversationId) {
        console.log("❌ Cannot save conversation - missing data:", {
          userEmail: this.config.userEmail,
          chatbotId: this.config.chatbotId,
          conversationId: conversationId,
        });
        return;
      }

      try {
        const conversationData = {
          conversationId: conversationId,
          timestamp: Date.now(),
          userEmail: this.config.userEmail,
          chatbotId: this.config.chatbotId,
        };
        const storageKey = this.getConversationStorageKey();
        localStorage.setItem(storageKey, JSON.stringify(conversationData));
        console.log("✅ Saved conversation to localStorage:", {
          storageKey: storageKey,
          conversationId: conversationId,
        });
      } catch (error) {
        console.error("Failed to save conversation to storage:", error);
      }
    },

    loadStoredConversationId: function () {
      if (!this.config.userEmail || !this.config.chatbotId) return null;

      try {
        const stored = localStorage.getItem(this.getConversationStorageKey());
        if (stored) {
          const conversationData = JSON.parse(stored);
          // Check if conversation is not too old (7 days)
          const conversationAge = Date.now() - conversationData.timestamp;
          if (conversationAge < 7 * 24 * 60 * 60 * 1000) {
            return conversationData.conversationId;
          } else {
            // Remove expired conversation
            localStorage.removeItem(this.getConversationStorageKey());
          }
        }
      } catch (error) {
        console.error("Failed to load stored conversation:", error);
        localStorage.removeItem(this.getConversationStorageKey());
      }
      return null;
    },

    clearStoredConversation: function () {
      if (this.config.userEmail && this.config.chatbotId) {
        try {
          localStorage.removeItem(this.getConversationStorageKey());
          console.log("🗑️ Cleared stored conversation");
        } catch (error) {
          console.error("Failed to clear stored conversation:", error);
        }
      }
    },

    loadStoredConversationMessages: async function (conversationId) {
      if (!conversationId || !this.config.userEmail || !this.config.chatbotId) {
        return;
      }

      try {
        console.log(
          "Loading messages for stored conversation:",
          conversationId
        );

        const response = await this.apiClient.request(
          `/api/chat/messages?conversationId=${conversationId}&chatbotId=${this.config.chatbotId}&userEmail=${this.config.userEmail}`
        );

        if (response.ok) {
          const data = await response.json();
          const messages = data.messages || [];

          console.log(
            "Loaded",
            messages.length,
            "messages for conversation:",
            conversationId
          );

          // Clear current messages and add loaded ones
          this.stateManager.setState({ messages: [] });
          this.uiManager.clearMessages();

          // Add loaded messages to UI
          messages.forEach((msg) => {
            this.uiManager.addMessage(msg.content, msg.role, msg.imageUrl, {
              id: msg.id,
              timestamp: new Date(msg.createdAt),
              status: "delivered",
            });
          });

          // Update state with loaded messages
          this.stateManager.setState({
            messages: messages.map((msg) => ({
              id: msg.id,
              content: msg.content,
              role: msg.role,
              timestamp: new Date(msg.createdAt),
              imageUrl: msg.imageUrl,
              status: "delivered",
            })),
          });
        } else if (response.status === 404) {
          console.log("Conversation not found, clearing stored ID");
          this.clearStoredConversation();
        } else {
          console.error(
            "Failed to load conversation messages:",
            response.status
          );
        }
      } catch (error) {
        console.error("Error loading stored conversation messages:", error);
        // Clear stored conversation on error
        this.clearStoredConversation();
      }
    },
    createWidget: function () {
      // Create UI using UIManager
      this.container = this.uiManager.createWidget();

      // Initialize widget functionality
      this.initializeWidget();
    },

    // Cleanup method for proper resource management
    destroy: function () {
      if (this.realtimeManager) {
        this.realtimeManager.cleanup();
      }

      if (this.eventManager) {
        this.eventManager.cleanup();
      }

      if (this.apiClient) {
        this.apiClient.cleanup();
      }

      if (this.uiManager) {
        this.uiManager.cleanup();
      }

      // Clear references
      this.stateManager = null;
      this.eventManager = null;
      this.apiClient = null;
      this.uiManager = null;
      this.realtimeManager = null;
      this.container = null;
    },
    initializeWidget: function () {
      console.log("EchoAI: Starting widget initialization");

      // Load chatbot settings
      this.loadChatbotSettings();

      console.log("EchoAI: About to setup event listeners");
      console.log("EchoAI: UIManager elements:", this.uiManager.elements);

      // Set up event listeners using EventManager
      this.setupEventListeners();

      // Ensure initial tab state is correct
      this.initializeTabState();

      // Subscribe to state changes
      this.setupStateSubscriptions();

      console.log("EchoAI: Widget initialization complete");
    },

    initializeTabState: function () {
      console.log("EchoAI: Initializing tab state");
      const currentState = this.stateManager.getState();
      const activeTab = currentState.activeTab;

      // Force update the tab accessibility and visibility
      this.uiManager.updateTabAccessibility(activeTab);

      console.log("EchoAI: Initial tab state set to:", activeTab);
    },

    setupEventListeners: function () {
      const elements = this.uiManager.elements;
      console.log(
        "EchoAI: Setting up event listeners, found tabs:",
        elements.tabs.length
      );
      console.log("EchoAI: Found panels:", elements.tabPanels.length);

      // Debug: Log all found tabs
      elements.tabs.forEach((tab, i) => {
        console.log(`Tab ${i}:`, tab.dataset.tab, tab.textContent.trim());
      });

      // Debug: Log all found panels
      elements.tabPanels.forEach((panel, i) => {
        console.log(`Panel ${i}:`, panel.dataset.panel, panel.style.display);
      });

      // Enhanced tab functionality with keyboard navigation
      elements.tabs.forEach((tab, index) => {
        console.log("EchoAI: Setting up listeners for tab:", tab.dataset.tab);
        // Click handler
        this.eventManager.addEventListener(tab, "click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const targetTab = tab.dataset.tab;
          console.log("EchoAI: Tab clicked:", targetTab);

          // Ensure we have a valid target tab
          if (!targetTab) {
            console.error("EchoAI: No target tab found");
            return;
          }

          // Call switchTab and handle any errors
          try {
            this.uiManager.switchTab(targetTab);
          } catch (error) {
            console.error("EchoAI: Error switching tab:", error);
          }

          // Load content when switching to tabs
          if (targetTab === "faq" && this.config.enableFAQ) {
            setTimeout(() => this.loadFAQs(), 100);
          } else if (targetTab === "history" && this.config.enableHistory) {
            setTimeout(() => this.loadConversationHistory(), 100);
          }
        });

        // Keyboard navigation handler
        this.eventManager.addEventListener(tab, "keydown", (e) => {
          let targetIndex = index;
          let shouldPreventDefault = true;

          switch (e.key) {
            case "ArrowLeft":
              targetIndex = index > 0 ? index - 1 : elements.tabs.length - 1;
              break;
            case "ArrowRight":
              targetIndex = index < elements.tabs.length - 1 ? index + 1 : 0;
              break;
            case "Home":
              targetIndex = 0;
              break;
            case "End":
              targetIndex = elements.tabs.length - 1;
              break;
            case "Enter":
            case " ":
              // Activate current tab
              const targetTab = tab.dataset.tab;
              this.uiManager.switchTab(targetTab);
              break;
            default:
              shouldPreventDefault = false;
          }

          if (shouldPreventDefault) {
            e.preventDefault();

            // Focus and activate the target tab for arrow keys, Home, End
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
              const targetTab = elements.tabs[targetIndex];
              targetTab.focus();

              // Update tabindex for all tabs
              elements.tabs.forEach((t, i) => {
                t.setAttribute("tabindex", i === targetIndex ? "0" : "-1");
              });
            }
          }
        });
      });

      // Backup: Add direct event listeners as fallback
      this.setupDirectTabListeners();

      // Toggle widget
      const toggleWidget = () => {
        const currentState = this.stateManager.getState();
        const newIsOpen = !currentState.isOpen;

        this.stateManager.setState({ isOpen: newIsOpen });
        this.uiManager.updateWidgetVisibility(newIsOpen);

        if (newIsOpen) {
          // Initialize session and add welcome message if needed
          this.initializeSession().then(() => {
            const messages = this.stateManager.getState().messages;
            if (messages.length === 0) {
              this.addWelcomeMessage();
            }
          });
        } else {
          // Cancel any ongoing streaming
          if (this.stateManager.getState().isStreaming) {
            this.apiClient.cancelStreaming();
            this.stateManager.setState({ isStreaming: false });
          }
        }
      };

      this.eventManager.addEventListener(
        elements.toggleBtn,
        "click",
        toggleWidget
      );
      this.eventManager.addEventListener(
        elements.closeBtn,
        "click",
        toggleWidget
      );

      // New conversation button
      const newConversationBtn = this.container.querySelector(
        ".echoai-new-conversation-btn"
      );
      if (newConversationBtn) {
        this.eventManager.addEventListener(newConversationBtn, "click", () => {
          this.startNewConversation();
        });
      }

      // Image upload functionality
      if (this.config.enableImageUpload && elements.uploadBtn) {
        // Upload button click handler
        this.eventManager.addEventListener(elements.uploadBtn, "click", () => {
          elements.fileInput.click();
        });

        // Browse button click handler (in drag-drop area)
        if (elements.browseBtn) {
          this.eventManager.addEventListener(
            elements.browseBtn,
            "click",
            (e) => {
              e.preventDefault();
              elements.fileInput.click();
            }
          );
        }

        // File input change handler
        this.eventManager.addEventListener(
          elements.fileInput,
          "change",
          (e) => {
            const file = e.target.files[0];
            if (file) {
              this.handleFileSelection(file);
            }
          }
        );

        // Remove image button handler
        this.eventManager.addEventListener(
          elements.removeImageBtn,
          "click",
          () => {
            this.uiManager.clearImageUpload();
          }
        );

        // Drag and drop functionality
        const chatContainer = elements.widget.querySelector(
          ".echoai-chat-container"
        );
        if (chatContainer) {
          // Prevent default drag behaviors
          ["dragenter", "dragover", "dragleave", "drop"].forEach(
            (eventName) => {
              this.eventManager.addEventListener(
                chatContainer,
                eventName,
                (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }
              );
            }
          );

          // Highlight drop area when dragging over
          ["dragenter", "dragover"].forEach((eventName) => {
            this.eventManager.addEventListener(chatContainer, eventName, () => {
              chatContainer.classList.add("echoai-drag-over");
              this.uiManager.showDragDropArea();
            });
          });

          // Remove highlight when dragging leaves
          ["dragleave", "drop"].forEach((eventName) => {
            this.eventManager.addEventListener(chatContainer, eventName, () => {
              chatContainer.classList.remove("echoai-drag-over");
              if (eventName === "dragleave") {
                // Only hide if we're actually leaving the container
                setTimeout(() => {
                  if (!chatContainer.classList.contains("echoai-drag-over")) {
                    this.uiManager.hideDragDropArea();
                  }
                }, 100);
              }
            });
          });

          // Handle file drop
          this.eventManager.addEventListener(chatContainer, "drop", (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
              this.handleFileSelection(files[0]);
            }
            this.uiManager.hideDragDropArea();
          });
        }
      }

      // Escalation functionality
      if (this.config.escalationConfig.enabled && elements.escalateBtn) {
        this.eventManager.addEventListener(
          elements.escalateBtn,
          "click",
          () => {
            this.handleEscalation("user_request");
          }
        );
      }

      // Send message functionality
      const sendMessage = async (messageContent) => {
        const message = messageContent || elements.input.value.trim();
        const hasImage =
          elements.fileInput && elements.fileInput.files.length > 0;

        if (!message && !hasImage) return;

        const currentState = this.stateManager.getState();
        if (currentState.isLoading || currentState.isStreaming) return;

        let imageUrl = null;

        try {
          // Upload image if present
          if (hasImage) {
            this.stateManager.setState({ isLoading: true });
            this.uiManager.showUploadProgress(true);
            this.uiManager.updateUploadProgress(0);

            try {
              const uploadData = await this.apiClient.uploadImage(
                elements.fileInput.files[0],
                (progress) => {
                  this.uiManager.updateUploadProgress(progress);
                }
              );
              imageUrl = uploadData.url;
              this.uiManager.updateUploadProgress(100);

              // Brief delay to show 100% completion
              await new Promise((resolve) => setTimeout(resolve, 500));
            } catch (uploadError) {
              console.error("EchoAI: Image upload failed:", uploadError);
              this.uiManager.showUploadError(
                "Failed to upload image. Please try again."
              );
              this.stateManager.setState({ isLoading: false });
              return;
            } finally {
              this.uiManager.showUploadProgress(false);
            }

            this.stateManager.setState({ isLoading: false });
          }

          // Add user message to UI
          const userMessageId = this.uiManager.addMessage(
            message,
            "user",
            imageUrl
          );

          // Track message delivery if realtime is enabled
          if (userMessageId && this.realtimeManager) {
            this.trackMessageDelivery(userMessageId);
          }

          // Clear input and image
          this.uiManager.clearInput();

          // Send message with streaming or regular response
          console.log(
            "EchoAI: Streaming enabled:",
            this.config.streamingConfig.enabled
          );

          if (this.config.streamingConfig.enabled) {
            try {
              console.log("EchoAI: Attempting streaming message");
              await this.sendRegularMessage(message, imageUrl);
            } catch (streamingError) {
              console.warn(
                "EchoAI: Streaming failed, attempting fallback:",
                streamingError
              );

              // If streaming fails and fallback is enabled, try regular messaging
              if (this.config.streamingConfig.fallbackToRegular) {
                console.log("EchoAI: Falling back to regular message");
                await this.sendRegularMessage(message, imageUrl);
              } else {
                throw streamingError;
              }
            }
          } else {
            console.log("EchoAI: Using regular message");
            await this.sendRegularMessage(message, imageUrl);
          }
        } catch (error) {
          console.error("EchoAI: Error sending message:", error);
          this.uiManager.hideTyping();
          this.stateManager.setState({ isLoading: false, isStreaming: false });

          this.uiManager.addMessage(
            "Sorry, I encountered an error. Please try again.",
            "assistant"
          );
        }
      };

      this.eventManager.addEventListener(elements.sendBtn, "click", () =>
        sendMessage()
      );
      this.eventManager.addEventListener(elements.input, "keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });

      // Store sendMessage for external access
      this.sendMessage = sendMessage;
    },

    setupInputEventListeners: function () {
      const elements = this.uiManager.elements;

      if (elements.sendBtn && elements.input) {
        // Remove existing listeners to prevent duplicates
        const newSendBtn = elements.sendBtn.cloneNode(true);
        const newInput = elements.input.cloneNode(true);

        elements.sendBtn.parentNode.replaceChild(newSendBtn, elements.sendBtn);
        elements.input.parentNode.replaceChild(newInput, elements.input);

        // Update cached elements
        this.uiManager.elements.sendBtn = newSendBtn;
        this.uiManager.elements.input = newInput;

        // Add event listeners
        this.eventManager.addEventListener(newSendBtn, "click", () => {
          if (this.sendMessage) {
            this.sendMessage();
          }
        });

        this.eventManager.addEventListener(newInput, "keypress", (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (this.sendMessage) {
              this.sendMessage();
            }
          }
        });
      }
    },

    // Conversation Status Management Methods

    // Get current conversation status
    getConversationStatus: function () {
      if (this.realtimeManager) {
        return this.realtimeManager.getCurrentStatus();
      }
      return this.stateManager.getState().conversationStatus;
    },

    // Check if human agent is active
    isHumanAgentActive: function () {
      if (this.realtimeManager) {
        return this.realtimeManager.isHumanAgentActive();
      }
      return (
        this.stateManager.getState().conversationStatus ===
        "AWAITING_HUMAN_RESPONSE"
      );
    },

    // Check if conversation is resolved
    isConversationResolved: function () {
      if (this.realtimeManager) {
        return this.realtimeManager.isConversationResolved();
      }
      return this.stateManager.getState().conversationStatus === "RESOLVED";
    },

    // Subscribe to conversation status changes
    onStatusChange: function (callback) {
      if (this.realtimeManager) {
        return this.realtimeManager.onStatusUpdate(callback);
      }

      // Fallback to state manager subscription
      return this.stateManager.subscribe("conversationStatus", callback);
    },

    // Get realtime connection status
    getConnectionStatus: function () {
      if (this.realtimeManager) {
        return this.realtimeManager.getConnectionStatus();
      }

      const state = this.stateManager.getState();
      return {
        isConnected: state.realtimeConnected,
        connectionType: null,
        reconnectAttempts: 0,
        lastHeartbeat: null,
        conversationStatus: state.conversationStatus,
      };
    },

    // Manually reconnect realtime connection
    reconnectRealtime: function () {
      if (this.realtimeManager) {
        this.realtimeManager.reconnect();
      }
    },

    // Track message delivery (called when sending messages)
    trackMessageDelivery: function (messageId) {
      if (this.realtimeManager) {
        this.realtimeManager.trackMessageDelivery(messageId);
      }
    },

    // Handle escalation with conversation status awareness
    handleEscalation: async function (reason) {
      const currentStatus = this.getConversationStatus();
      const currentState = this.stateManager.getState();

      if (!currentState.conversationId) {
        console.log("EchoAI: No conversation ID available for escalation");
        return;
      }

      if (currentStatus === "AWAITING_HUMAN_RESPONSE") {
        // Return to AI handling
        try {
          const response = await fetch("http://localhost:3000/api/chat/conversation-status", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              conversationId: currentState.conversationId,
              status: "AI_HANDLING",
            }),
          });

          if (response.ok) {
            this.stateManager.setState({ conversationStatus: "AI_HANDLING" });

            // Add system message about returning to AI
            this.uiManager.addMessage(
              "You're now back to chatting with the AI assistant. How can I help you?",
              "assistant",
              null,
              {
                timestamp: new Date(),
              }
            );
          }
        } catch (error) {
          console.error("EchoAI: Failed to return to AI:", error);
        }
        return;
      }

      if (currentStatus === "RESOLVED") {
        // Start new conversation
        this.startNewConversation();
        return;
      }

      // Escalate to human agent
      try {
        const response = await fetch("http://localhost:3000/api/chat/conversation-status", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversationId: currentState.conversationId,
            status: "AWAITING_HUMAN_RESPONSE",
          }),
        });

        if (response.ok) {
          this.stateManager.setState({ conversationStatus: "AWAITING_HUMAN_RESPONSE" });

          // Add system message about escalation
          const escalationMessage = this.config.escalationConfig?.humanAgentAvailable
            ? "I've connected you with a human agent. They'll be with you shortly."
            : "I've recorded your request for human assistance. Someone will contact you soon.";

          this.uiManager.addMessage(
            escalationMessage,
            "assistant",
            null,
            {
              timestamp: new Date(),
            }
          );
        }
      } catch (error) {
        console.error("EchoAI: Failed to escalate conversation:", error);
      }
    },

    // Update escalation button based on conversation status
    updateEscalationButton: function () {
      const escalateBtn = this.container.querySelector("#echoai-escalate-btn");
      if (!escalateBtn) return;

      const currentStatus = this.stateManager.getState().conversationStatus;
      
      let buttonText, buttonTitle, buttonIcon;
      
      if (currentStatus === "AWAITING_HUMAN_RESPONSE") {
        buttonText = "🔄 Return to AI";
        buttonTitle = "Return to AI assistant";
        buttonIcon = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        `;
      } else if (currentStatus === "RESOLVED") {
        buttonText = "✅ Resolved";
        buttonTitle = "Conversation resolved";
        buttonIcon = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20,6 9,17 4,12"></polyline>
          </svg>
        `;
      } else {
        buttonText = "🙋‍♂️ Talk to human";
        buttonTitle = "Talk to human agent";
        buttonIcon = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        `;
      }

      escalateBtn.innerHTML = `
        ${buttonIcon}
        <span class="echoai-escalate-text" style="margin-left: 4px; font-size: 12px;">${buttonText}</span>
      `;
      escalateBtn.title = buttonTitle;
      escalateBtn.setAttribute("aria-label", buttonTitle);
    },

    // Show escalation dialog
    showEscalationDialog: function (defaultReason = "") {
      // Create escalation dialog
      const dialog = document.createElement("div");
      dialog.className = "echoai-escalation-dialog";
      dialog.innerHTML = `
        <div class="echoai-dialog-overlay">
          <div class="echoai-dialog-content">
            <div class="echoai-dialog-header">
              <h3>Request Human Support</h3>
              <button class="echoai-dialog-close" aria-label="Close dialog">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div class="echoai-dialog-body">
              <p>Please let us know why you'd like to speak with a human agent:</p>
              <textarea 
                class="echoai-escalation-reason" 
                placeholder="Describe your issue or question..."
                rows="3"
              >${defaultReason}</textarea>
            </div>
            <div class="echoai-dialog-footer">
              <button class="echoai-btn echoai-btn-secondary echoai-cancel-escalation">Cancel</button>
              <button class="echoai-btn echoai-btn-primary echoai-submit-escalation">Request Support</button>
            </div>
          </div>
        </div>
      `;

      // Add to document
      document.body.appendChild(dialog);

      // Add event listeners
      const closeDialog = () => {
        dialog.classList.add("echoai-dialog-hiding");
        setTimeout(() => {
          if (dialog.parentNode) {
            dialog.parentNode.removeChild(dialog);
          }
        }, 300);
      };

      const closeBtn = dialog.querySelector(".echoai-dialog-close");
      const cancelBtn = dialog.querySelector(".echoai-cancel-escalation");
      const submitBtn = dialog.querySelector(".echoai-submit-escalation");
      const reasonTextarea = dialog.querySelector(".echoai-escalation-reason");

      this.eventManager.addEventListener(closeBtn, "click", closeDialog);
      this.eventManager.addEventListener(cancelBtn, "click", closeDialog);

      this.eventManager.addEventListener(submitBtn, "click", async () => {
        const reason = reasonTextarea.value.trim();

        if (!reason) {
          this.uiManager.showNotification(
            "Please provide a reason for escalation",
            "warning",
            3000
          );
          return;
        }

        try {
          submitBtn.disabled = true;
          submitBtn.textContent = "Requesting...";

          // Submit escalation
          await this.submitEscalation(reason);

          closeDialog();

          this.uiManager.showNotification(
            "Your request has been submitted. A human agent will join shortly.",
            "success",
            5000
          );
        } catch (error) {
          console.error("EchoAI: Escalation failed:", error);
          this.uiManager.showNotification(
            "Failed to submit escalation request. Please try again.",
            "error",
            4000
          );

          submitBtn.disabled = false;
          submitBtn.textContent = "Request Support";
        }
      });

      // Show with animation
      requestAnimationFrame(() => {
        dialog.classList.add("echoai-dialog-visible");
      });

      // Focus the textarea
      setTimeout(() => {
        reasonTextarea.focus();
      }, 100);
    },

    // Submit escalation request
    submitEscalation: async function (reason) {
      const conversationId = this.stateManager.getState().conversationId;

      if (!conversationId) {
        throw new Error("No active conversation");
      }

      try {
        await this.apiClient.escalate(conversationId, reason);

        // Update conversation status locally (will be confirmed by realtime)
        this.stateManager.setState({
          conversationStatus: "AWAITING_HUMAN_RESPONSE",
        });

        // Add system message about escalation
        this.uiManager.addMessage(
          `You've requested human support. An agent will join the conversation shortly.`,
          "assistant",
          null,
          {
            isSystemMessage: true,
            timestamp: new Date(),
          }
        );
      } catch (error) {
        console.error("EchoAI: Failed to submit escalation:", error);
        throw error;
      }
    },

    // Add FAQ to chat (called from FAQ tab)
    addFAQToChat: function (question, answer) {
      // Add question as user message
      this.uiManager.addMessage(question, "user");

      // Add answer as assistant message
      this.uiManager.addMessage(answer, "assistant", null, {
        isFAQAnswer: true,
        timestamp: new Date(),
      });

      // Scroll to bottom
      this.uiManager.scrollToBottom();
    },

    // Load conversation from history
    loadConversation: async function (sessionId) {
      if (!sessionId) {
        console.error(
          "EchoAI: No session ID provided for conversation loading"
        );
        return;
      }

      try {
        this.stateManager.setState({ isLoading: true });

        // Load conversation data from API
        const conversation = await this.apiClient.loadConversation(sessionId);

        if (!conversation) {
          throw new Error("No conversation data received");
        }

        // Clear current messages and update conversation state
        this.stateManager.setState({
          messages: [],
          conversationId: sessionId,
          conversationStatus: conversation.status || "AI_HANDLING",
        });

        // Clear current chat display
        this.uiManager.clearMessages();

        // Add historical messages with proper formatting
        if (conversation.messages && conversation.messages.length > 0) {
          const sortedMessages = conversation.messages.sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
          );

          sortedMessages.forEach((msg) => {
            this.uiManager.addMessage(msg.content, msg.role, msg.imageUrl, {
              id: msg.id,
              timestamp: new Date(msg.createdAt),
              status: "delivered",
              metadata: msg.metadata,
            });
          });

          // Update state with loaded messages
          this.stateManager.setState({
            messages: sortedMessages.map((msg) => ({
              id: msg.id,
              content: msg.content,
              role: msg.role,
              timestamp: new Date(msg.createdAt),
              imageUrl: msg.imageUrl,
              status: "delivered",
              metadata: msg.metadata,
            })),
          });
        }

        // Update conversation metadata if available
        if (conversation.metadata) {
          this.stateManager.setState({
            intelligenceMetadata: conversation.metadata.intelligence,
            proactiveQuestions: conversation.metadata.proactiveQuestions || [],
            suggestedTopics: conversation.metadata.suggestedTopics || [],
            conversationActions:
              conversation.metadata.conversationActions || [],
          });
        }

        // Scroll to bottom of messages
        this.uiManager.scrollToBottom();

        // Update realtime connection for this conversation
        if (this.realtimeManager) {
          this.realtimeManager.authenticateConnection();
        }

        this.stateManager.setState({ isLoading: false });

        this.uiManager.showNotification(
          "Conversation loaded successfully",
          "success",
          2000
        );

        // Emit conversation loaded event
        this.eventManager.emit("conversation-loaded", {
          sessionId: sessionId,
          messageCount: conversation.messages?.length || 0,
        });
      } catch (error) {
        console.error("EchoAI: Failed to load conversation:", error);
        this.stateManager.setState({ isLoading: false });

        // Show specific error message based on error type
        let errorMessage = "Failed to load conversation";
        if (error.message.includes("404")) {
          errorMessage = "Conversation not found";
        } else if (error.message.includes("403")) {
          errorMessage = "Access denied to conversation";
        } else if (error.message.includes("network")) {
          errorMessage = "Network error loading conversation";
        }

        this.uiManager.showNotification(errorMessage, "error", 3000);

        // Emit conversation load error event
        this.eventManager.emit("conversation-load-error", {
          sessionId: sessionId,
          error: error.message,
        });
      }
    },

    setupTabKeyboardNavigation: function () {
      const elements = this.uiManager.elements;

      // Add roving tabindex support for tab navigation
      if (elements.tabs.length > 0) {
        // Set initial tabindex
        elements.tabs.forEach((tab, index) => {
          const isActive = tab.classList.contains("echoai-tab-active");
          tab.setAttribute("tabindex", isActive ? "0" : "-1");
        });
      }
    },

    // Method to programmatically switch tabs
    switchToTab: function (tabId) {
      console.log("EchoAI: switchToTab called with:", tabId);
      if (this.uiManager) {
        this.uiManager.switchTab(tabId);
      } else {
        console.error("EchoAI: uiManager not available");
      }
    },

    // Test method to debug tab switching
    testTabSwitch: function () {
      console.log("EchoAI: Testing tab switch functionality");
      console.log(
        "EchoAI: Available tabs:",
        this.uiManager?.elements?.tabs?.length || 0
      );
      console.log(
        "EchoAI: Available panels:",
        this.uiManager?.elements?.tabPanels?.length || 0
      );

      if (this.uiManager?.elements?.tabs) {
        this.uiManager.elements.tabs.forEach((tab, index) => {
          console.log(
            `Tab ${index}:`,
            tab.dataset.tab,
            tab.classList.contains("echoai-tab-active")
          );
        });
      }

      if (this.uiManager?.elements?.tabPanels) {
        this.uiManager.elements.tabPanels.forEach((panel, index) => {
          console.log(
            `Panel ${index}:`,
            panel.dataset.panel,
            panel.style.display
          );
        });
      }

      // Try switching to FAQ tab
      console.log("EchoAI: Attempting to switch to FAQ tab");
      this.switchToTab("faq");
    },

    // Force refresh tab state
    refreshTabState: function () {
      console.log("EchoAI: Forcing tab state refresh");
      const currentState = this.stateManager.getState();
      const activeTab = currentState.activeTab;

      if (this.uiManager) {
        this.uiManager.updateTabAccessibility(activeTab);
        console.log("EchoAI: Tab state refreshed for:", activeTab);
      }
    },

    // Method to refresh tab content
    refreshTabContent: function (tabId) {
      if (this.uiManager) {
        this.uiManager.refreshTabContent(tabId);
      }
    },

    // Direct test method for tab switching
    testDirectTabSwitch: function (tabId) {
      console.log("EchoAI: Testing direct tab switch to:", tabId);
      const tabs = document.querySelectorAll(".echoai-tab");
      const panels = document.querySelectorAll(".echoai-tab-panel");

      console.log("Found tabs:", tabs.length, "panels:", panels.length);

      if (this.uiManager) {
        this.uiManager.directSwitchTab(tabId, tabs, panels);
      }
    },

    setupDirectTabListeners: function () {
      console.log("EchoAI: Setting up direct tab listeners as backup");

      // Use direct DOM selection and native event listeners
      const tabs = this.uiManager.container.querySelectorAll(".echoai-tab");
      const panels =
        this.uiManager.container.querySelectorAll(".echoai-tab-panel");

      console.log(
        "EchoAI: Direct selection found tabs:",
        tabs.length,
        "panels:",
        panels.length
      );

      tabs.forEach((tab, index) => {
        const tabId = tab.dataset.tab;
        console.log(`EchoAI: Adding direct listener to tab: ${tabId}`);

        // Add new listener
        const clickHandler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log("EchoAI: Direct tab click:", tabId);

          // Direct tab switching without going through EventManager
          this.directSwitchTab(tabId, tabs, panels);
        };

        tab.addEventListener("click", clickHandler);

        // Store the handler for cleanup
        tab._echoaiClickHandler = clickHandler;
      });
    },

    directSwitchTab: function (targetTab, tabs, panels) {
      console.log("EchoAI: Direct tab switch to:", targetTab);

      // Update state
      this.stateManager.setState({ activeTab: targetTab });

      // Update tabs
      tabs.forEach((tab) => {
        const isActive = tab.dataset.tab === targetTab;
        tab.classList.toggle("echoai-tab-active", isActive);
        tab.setAttribute("aria-selected", isActive.toString());
        tab.setAttribute("tabindex", isActive ? "0" : "-1");
      });

      // Update panels
      panels.forEach((panel) => {
        const isActive = panel.dataset.panel === targetTab;
        console.log(`EchoAI: Panel ${panel.dataset.panel} active:`, isActive);

        if (isActive) {
          panel.style.display = "flex";
          panel.style.visibility = "visible";
          panel.classList.add("echoai-tab-panel-active");
          panel.setAttribute("aria-hidden", "false");
        } else {
          panel.style.display = "none";
          panel.style.visibility = "hidden";
          panel.classList.remove("echoai-tab-panel-active");
          panel.setAttribute("aria-hidden", "true");
        }
      });

      console.log("EchoAI: Direct tab switch completed");
    },

    setupStateSubscriptions: function () {
      // Subscribe to state changes for UI updates
      this.stateManager.subscribe("isOpen", (isOpen) => {
        this.uiManager.updateWidgetVisibility(isOpen);
      });

      this.stateManager.subscribe("activeTab", (activeTab) => {
        // Tab switching is handled by UIManager
      });

      this.stateManager.subscribe("isStreaming", (isStreaming) => {
        // Handle streaming state changes if needed
      });

      // Subscribe to conversation status changes
      this.stateManager.subscribe(
        "conversationStatus",
        (status, previousStatus) => {
          console.log(
            `EchoAI: Conversation status changed from ${previousStatus} to ${status}`
          );

          // Update UI based on status
          // if (this.uiManager) {
          //   this.uiManager.updateConversationStatus(status);
          // }

          // Update escalation button
          this.updateEscalationButton();
        }
      );

      // Subscribe to realtime connection status changes
      this.stateManager.subscribe(
        "realtimeConnected",
        (isConnected, wasConnected) => {
          console.log(
            `EchoAI: Realtime connection ${
              isConnected ? "established" : "lost"
            }`
          );

          // Update connection status in UI
          if (this.uiManager) {
            this.uiManager.updateConnectionStatus(isConnected);
          }
        }
      );

      // Subscribe to realtime errors
      this.stateManager.subscribe("realtimeError", (error, previousError) => {
        if (error && error !== previousError) {
          console.error("EchoAI: Realtime error:", error);

          // Connection issue detected - log only
          console.warn(
            "EchoAI: Connection issue detected. Attempting to reconnect..."
          );
        }
      });

      // Set up realtime event listeners
      this.setupRealtimeEventListeners();
    },

    setupRealtimeEventListeners: function () {
      if (!this.realtimeManager) return;

      // Listen for realtime connection events
      this.eventManager.on("realtime-connected", (data) => {
        console.log("EchoAI: Realtime connected via", data.connectionType);

        // Connected to live chat - log only
        console.log("EchoAI: Connected to live chat");
      });

      this.eventManager.on("realtime-disconnected", (data) => {
        console.log("EchoAI: Realtime disconnected:", data.reason);

        // Connection lost - log only
        console.warn("EchoAI: Connection lost. Attempting to reconnect...");
      });

      this.eventManager.on("realtime-error", (data) => {
        console.error("EchoAI: Realtime error:", data.error);
      });

      // Listen for incoming messages
      this.eventManager.on("message-received", (data) => {
        console.log("EchoAI: Message received from agent:", data.message);

        // Message is already added to UI by RealtimeManager
        // Just scroll to bottom and show notification if widget is closed
        if (this.uiManager) {
          this.uiManager.scrollToBottom();

          // New message received - no notification needed
        }
      });

      // Listen for conversation status changes
      this.eventManager.on("conversation-status-changed", (data) => {
        console.log("EchoAI: Conversation status changed:", data);

        // Conversation status changed - log only
        console.log(`EchoAI: Conversation status changed to ${data.status}`);
      });

      // Listen for message delivery events
      this.eventManager.on("message-delivered", (data) => {
        console.log("EchoAI: Message delivered:", data.messageId);
      });

      this.eventManager.on("message-delivery-failed", (data) => {
        console.warn("EchoAI: Message delivery failed:", data.messageId);

        // Message delivery failed - log only
        console.error(
          "EchoAI: Message delivery failed. Connection issue detected."
        );
      });
    },

    initializeSession: async function () {
      const currentState = this.stateManager.getState();
      if (currentState.conversationId) return currentState.conversationId;

      try {
        const sessionId = this.loadStoredConversationId();

        console.log("Stored Conversation ID: ", sessionId);

        if (sessionId) {
          // Load messages for the stored conversation ID
          await this.loadStoredConversationMessages(sessionId);
        }

        this.stateManager.setState({ conversationId: sessionId });
        return sessionId;
      } catch (error) {
        console.error("EchoAI: Failed to initialize session:", error);
        return null;
      }
    },

    sendStreamingMessage: async function (message, imageUrl) {
      console.log("EchoAI: sendStreamingMessage called with:", {
        message,
        imageUrl,
      });
      this.stateManager.setState({ isStreaming: true });

      let assistantMessageId = `assistant-${Date.now()}`;
      let fullResponse = "";
      let enhancedData = null;
      let streamingStarted = false;

      // Show typing indicator initially
      this.uiManager.showTyping();

      // Add cancel button to UI
      this.uiManager.showStreamingControls();

      try {
        // Create streaming message container
        this.uiManager.addStreamingMessage(assistantMessageId);
        streamingStarted = true;

        // Use enhanced API client with better error handling
        await this.apiClient.createStreamingConnection(
          message,
          imageUrl,
          // onToken callback
          (token) => {
            // Hide typing indicator on first token
            if (fullResponse === "") {
              this.uiManager.hideTyping();
            }

            fullResponse += token;
            this.uiManager.updateStreamingMessage(
              assistantMessageId,
              fullResponse
            );
          },
          // onEnhancedData callback
          (data) => {
            enhancedData = data;
          },
          // onComplete callback
          () => {
            // Streaming complete
            this.uiManager.finalizeStreamingMessage(
              assistantMessageId,
              fullResponse
            );

            // Handle enhanced features
            if (enhancedData && this.config.enableEnhancedFeatures) {
              this.handleEnhancedResponse(enhancedData);
            }

            // Update conversation ID if provided
            if (enhancedData && enhancedData.conversation_id) {
              this.stateManager.setState({
                conversationId: enhancedData.conversation_id,
              });
            }

            this.stateManager.setState({ isStreaming: false });
            this.uiManager.hideStreamingControls();
          },
          // onError callback
          (error) => {
            console.error("EchoAI: Streaming error:", error);

            if (error.message === "Streaming cancelled") {
              // User cancelled - remove the streaming message
              if (streamingStarted) {
                this.uiManager.removeStreamingMessage(assistantMessageId);
              }
            } else {
              // Other error - try fallback to regular messaging
              if (streamingStarted) {
                this.uiManager.removeStreamingMessage(assistantMessageId);
              }

              // Attempt fallback to regular messaging
              this.attemptFallbackMessage(message, imageUrl, error);
            }

            this.stateManager.setState({ isStreaming: false });
            this.uiManager.hideStreamingControls();
          }
        );
      } catch (error) {
        console.error("EchoAI: Streaming setup error:", error);

        if (streamingStarted) {
          this.uiManager.removeStreamingMessage(assistantMessageId);
        }

        // Attempt fallback to regular messaging
        this.attemptFallbackMessage(message, imageUrl, error);

        this.stateManager.setState({ isStreaming: false });
        this.uiManager.hideStreamingControls();
      }
    },

    sendRegularMessage: async function (message, imageUrl) {
      console.log("EchoAI: sendRegularMessage called with:", {
        message,
        imageUrl,
      });

      this.stateManager.setState({ isLoading: true });

      // Show typing indicator
      this.uiManager.showTyping();

      try {
        const response = await this.apiClient.sendMessage(
          message,
          imageUrl,
          false
        );

        // Hide typing indicator
        this.uiManager.hideTyping();

        // Add assistant response to UI
        this.uiManager.addMessage(response.response, "assistant", null, {
          timestamp: new Date(),
        });

        // Handle enhanced features if available
        if (response.enhanced_data && this.config.enableEnhancedFeatures) {
          this.handleEnhancedResponse(response.enhanced_data);
        }

        // Update conversation ID if provided
        if (response.conversation_id) {
          this.stateManager.setState({
            conversationId: response.conversation_id,
          });
        }

        this.stateManager.setState({ isLoading: false });
      } catch (error) {
        console.error("EchoAI: Regular message error:", error);
        this.uiManager.hideTyping();
        this.stateManager.setState({ isLoading: false });

        this.uiManager.addMessage(
          "Sorry, I encountered an error. Please try again.",
          "assistant"
        );
      }
    },

    attemptFallbackMessage: async function (message, imageUrl, originalError) {
      console.log("EchoAI: Attempting fallback message due to:", originalError);

      try {
        await this.sendRegularMessage(message, imageUrl);
      } catch (fallbackError) {
        console.error("EchoAI: Fallback message also failed:", fallbackError);

        this.uiManager.hideTyping();
        this.stateManager.setState({ isLoading: false });

        this.uiManager.addMessage(
          "Sorry, I'm having trouble connecting. Please try again later.",
          "assistant"
        );
      }
    },

    // Enhanced Intelligence Features Implementation
    handleEnhancedResponse: function (enhancedData) {
      console.log("EchoAI: Processing enhanced response data:", enhancedData);
      console.log("handleEnhancedResponse called!");

      // Update state with enhanced features
      this.stateManager.setState({
        proactiveQuestions: enhancedData.proactive_questions || [],
        suggestedTopics: enhancedData.suggested_topics || [],
        conversationActions: enhancedData.conversation_actions || [],
        intelligenceMetadata: enhancedData.intelligence_metadata || null,
      });

      // Show intelligence panel if enhanced features are enabled
      console.log("Intelligence config:", this.config.intelligenceConfig);
      if (this.config.intelligenceConfig?.enabled) {
        console.log("Calling showIntelligencePanel with data:", enhancedData);
        this.showIntelligencePanel(enhancedData);
      } else {
        console.log("Intelligence panel not enabled or config missing");
      }

      // Check for automatic escalation triggers
      if (this.config.escalationConfig?.enabled) {
        this.checkEscalationTriggers(enhancedData);
      }

      // Emit enhanced data event for external listeners
      this.eventManager.emit("enhanced-data-received", enhancedData);
    },

    showIntelligencePanel: function (enhancedData) {
      // Remove existing intelligence panel
      this.hideIntelligencePanel();

      const chatPanel = this.container.querySelector('[data-panel="chat"]');
      if (!chatPanel) return;

      // Create intelligence panel
      const intelligencePanel = document.createElement("div");
      intelligencePanel.className = "echoai-intelligence-panel";
      intelligencePanel.id = "echoai-intelligence-panel";

      // Set fixed height to 2/3 of chat area with scrolling
      const chatArea = chatPanel.querySelector(".echoai-messages") || chatPanel;
      const chatHeight = chatArea.offsetHeight || 400; // fallback height
      const panelHeight = Math.floor((chatHeight * 2) / 3);

      intelligencePanel.style.height = `${panelHeight}px`;
      intelligencePanel.style.overflowY = "auto";
      intelligencePanel.style.maxHeight = `${panelHeight}px`;

      let panelContent = ``;
      let hasContent = false;

      // Proactive Questions Section
      if (
        this.config.intelligenceConfig?.showProactiveQuestions &&
        enhancedData.proactive_questions &&
        enhancedData.proactive_questions.length > 0
      ) {
        panelContent += `
          <div class="echoai-intelligence-section">
            <h4>Suggested Questions</h4>
            <div class="echoai-question-buttons">
              ${enhancedData.proactive_questions
                .map(
                  (question, index) => `
                <button 
                  class="echoai-proactive-btn" 
                  data-question="${this.escapeHtml(question)}"
                  data-index="${index}"
                  aria-label="Ask: ${this.escapeHtml(question)}"
                >
                  ${this.escapeHtml(question)}
                </button>
              `
                )
                .join("")}
            </div>
          </div>
        `;
        hasContent = true;
      }

      // Suggested Topics Section
      if (
        this.config.intelligenceConfig?.showSuggestedTopics &&
        enhancedData.suggested_topics &&
        enhancedData.suggested_topics.length > 0
      ) {
        panelContent += `
          <div class="echoai-intelligence-section">
            <h4>Related Topics</h4>
            <div class="echoai-topic-buttons">
              ${enhancedData.suggested_topics
                .map(
                  (topic, index) => `
                <button 
                  class="echoai-topic-btn" 
                  data-topic="${this.escapeHtml(topic)}"
                  data-index="${index}"
                  aria-label="Explore topic: ${this.escapeHtml(topic)}"
                >
                  ${this.escapeHtml(topic)}
                </button>
              `
                )
                .join("")}
            </div>
          </div>
        `;
        hasContent = true;
      }

      // Conversation Actions Section
      if (
        this.config.intelligenceConfig?.showConversationActions &&
        enhancedData.conversation_actions &&
        enhancedData.conversation_actions.length > 0
      ) {
        panelContent += `
          <div class="echoai-intelligence-section">
            <h4>Suggested Actions</h4>
            <div class="echoai-action-buttons">
              ${enhancedData.conversation_actions
                .map(
                  (action, index) => `
                <button 
                  class="echoai-action-btn" 
                  data-action="${this.escapeHtml(action.action || action)}"
                  data-confidence="${action.confidence_score || 0}"
                  data-index="${index}"
                  aria-label="Action: ${this.escapeHtml(
                    action.action || action
                  )} (${Math.round(
                    (action.confidence_score || 0) * 100
                  )}% confidence)"
                >
                  ${this.escapeHtml(action.action || action)}
                  ${
                    action.confidence_score
                      ? `<span class="echoai-confidence-score">${Math.round(
                          action.confidence_score * 100
                        )}%</span>`
                      : ""
                  }
                </button>
              `
                )
                .join("")}
            </div>
          </div>
        `;
        hasContent = true;
      }

      // Intelligence Metrics Section (for debugging)
      if (
        this.config.intelligenceConfig?.showIntelligenceMetrics &&
        enhancedData.intelligence_metadata
      ) {
        const metadata = enhancedData.intelligence_metadata;
        panelContent += `
          <div class="echoai-intelligence-section echoai-debug-section">
            <h4>Intelligence Metrics</h4>
            <div class="echoai-intelligence-metrics">
              ${
                metadata.confidence_score
                  ? `<div class="echoai-metric">Confidence: ${Math.round(
                      metadata.confidence_score * 100
                    )}%</div>`
                  : ""
              }
              ${
                metadata.sentiment
                  ? `<div class="echoai-metric">Sentiment: ${this.escapeHtml(
                      metadata.sentiment
                    )}</div>`
                  : ""
              }
              ${
                metadata.risk_score
                  ? `<div class="echoai-metric">Risk Score: ${Math.round(
                      metadata.risk_score * 100
                    )}%</div>`
                  : ""
              }
              ${
                metadata.escalation_likelihood
                  ? `<div class="echoai-metric">Escalation Risk: ${Math.round(
                      metadata.escalation_likelihood * 100
                    )}%</div>`
                  : ""
              }
              ${
                enhancedData.sources_count
                  ? `<div class="echoai-metric">Sources Used: ${enhancedData.sources_count}</div>`
                  : ""
              }
            </div>
          </div>
        `;
      }

      // Always show panel with toggle button
      intelligencePanel.innerHTML = `
        <div class="echoai-intelligence-header">
          <span class="echoai-intelligence-title">AI Suggestions</span>
          <button class="echoai-intelligence-toggle" aria-label="Toggle suggestions" aria-expanded="true">
            <svg class="echoai-toggle-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6,9 12,15 18,9"></polyline>
            </svg>
          </button>
        </div>
        <div class="echoai-intelligence-content" style="overflow-y: auto; flex: 1;">
          ${
            hasContent && panelContent.trim()
              ? panelContent
              : '<div class="echoai-intelligence-section"><p>No suggestions available at the moment.</p></div>'
          }
        </div>
      `;

      // Insert panel before input container
      const inputContainer = chatPanel.querySelector(".echoai-input-container");
      if (inputContainer) {
        chatPanel.insertBefore(intelligencePanel, inputContainer);
      } else {
        chatPanel.appendChild(intelligencePanel);
      }

      // Set up toggle functionality
      console.log("About to call setupIntelligenceToggle");
      this.setupIntelligenceToggle(intelligencePanel);

      // Set up event listeners for intelligence panel
      this.setupIntelligencePanelEventListeners(
        intelligencePanel,
        enhancedData
      );

      // Animate panel appearance
      requestAnimationFrame(() => {
        intelligencePanel.style.opacity = "0";
        intelligencePanel.style.transform = "translateY(10px)";
        intelligencePanel.style.transition = "all 0.3s ease";

        requestAnimationFrame(() => {
          intelligencePanel.style.opacity = "1";
          intelligencePanel.style.transform = "translateY(0)";
        });
      });

      // Auto-hide panel after a delay if configured
      if (this.config.intelligenceConfig?.autoHideDelay) {
        setTimeout(() => {
          this.hideIntelligencePanel();
        }, this.config.intelligenceConfig.autoHideDelay);
      }
    },

    setupIntelligenceToggle: function (panel) {
      console.log("setupIntelligenceToggle called with panel:", panel);
      console.log("Panel HTML:", panel.innerHTML);

      const toggleButton = panel.querySelector(".echoai-intelligence-toggle");
      const content = panel.querySelector(".echoai-intelligence-content");
      const toggleIcon = panel.querySelector(".echoai-toggle-icon");

      console.log("Setting up toggle:", { toggleButton, content, toggleIcon });

      if (!toggleButton || !content || !toggleIcon) {
        console.log("Missing elements for toggle setup");
        return;
      }

      // Use direct addEventListener instead of eventManager
      toggleButton.addEventListener("click", () => {
        console.log("Toggle clicked!");
        const isExpanded =
          toggleButton.getAttribute("aria-expanded") === "true";

        if (isExpanded) {
          // Collapse
          content.style.maxHeight = content.scrollHeight + "px";
          requestAnimationFrame(() => {
            content.style.maxHeight = "0";
            content.style.opacity = "0";
            content.style.paddingTop = "0";
            content.style.paddingBottom = "0";
          });
          toggleIcon.style.transform = "rotate(-90deg)";
          toggleButton.setAttribute("aria-expanded", "false");
          toggleButton.setAttribute("aria-label", "Show suggestions");
        } else {
          // Expand
          content.style.maxHeight = "0";
          content.style.opacity = "0";
          content.style.paddingTop = "0";
          content.style.paddingBottom = "0";

          requestAnimationFrame(() => {
            content.style.maxHeight = content.scrollHeight + "px";
            content.style.opacity = "1";
            content.style.paddingTop = "";
            content.style.paddingBottom = "";
          });

          // Reset max-height after animation
          setTimeout(() => {
            content.style.maxHeight = "none";
          }, 300);

          toggleIcon.style.transform = "rotate(0deg)";
          toggleButton.setAttribute("aria-expanded", "true");
          toggleButton.setAttribute("aria-label", "Hide suggestions");
        }
      });

      // Keyboard support
      this.eventManager.addEventListener(toggleButton, "keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleButton.click();
        }
      });
    },

    setupIntelligencePanelEventListeners: function (panel, enhancedData) {
      // Proactive question buttons
      const questionButtons = panel.querySelectorAll(".echoai-proactive-btn");
      questionButtons.forEach((button) => {
        this.eventManager.addEventListener(button, "click", () => {
          const question = button.getAttribute("data-question");
          if (question) {
            this.handleProactiveQuestionClick(question);
          }
        });

        // Keyboard support
        this.eventManager.addEventListener(button, "keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            button.click();
          }
        });
      });

      // Topic buttons
      const topicButtons = panel.querySelectorAll(".echoai-topic-btn");
      topicButtons.forEach((button) => {
        this.eventManager.addEventListener(button, "click", () => {
          const topic = button.getAttribute("data-topic");
          if (topic) {
            this.handleTopicClick(topic);
          }
        });

        // Keyboard support
        this.eventManager.addEventListener(button, "keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            button.click();
          }
        });
      });

      // Action buttons
      const actionButtons = panel.querySelectorAll(".echoai-action-btn");
      actionButtons.forEach((button) => {
        this.eventManager.addEventListener(button, "click", () => {
          const action = button.getAttribute("data-action");
          const confidence =
            parseFloat(button.getAttribute("data-confidence")) || 0;
          if (action) {
            this.handleConversationActionClick(action, confidence);
          }
        });

        // Keyboard support
        this.eventManager.addEventListener(button, "keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            button.click();
          }
        });
      });
    },

    handleProactiveQuestionClick: function (question) {
      console.log("EchoAI: Proactive question clicked:", question);

      // Add question as user message and send it
      this.uiManager.addMessage(question, "user");

      // Clear input and send the question
      if (this.elements && this.elements.input) {
        this.elements.input.value = "";
      }

      // Send the question as a message
      if (this.sendMessage) {
        this.sendMessage(question);
      }

      // Hide intelligence panel after selection
      this.hideIntelligencePanel();

      // Emit event for analytics
      this.eventManager.emit("proactive-question-clicked", { question });
    },

    handleTopicClick: function (topic) {
      console.log("EchoAI: Topic clicked:", topic);

      // Create a question about the topic
      const topicQuestion = `Tell me more about ${topic}`;

      // Add as user message and send
      this.uiManager.addMessage(topicQuestion, "user");

      // Clear input
      if (this.elements && this.elements.input) {
        this.elements.input.value = "";
      }

      // Send the topic question
      if (this.sendMessage) {
        this.sendMessage(topicQuestion);
      }

      // Hide intelligence panel after selection
      this.hideIntelligencePanel();

      // Emit event for analytics
      this.eventManager.emit("topic-clicked", {
        topic,
        question: topicQuestion,
      });
    },

    handleConversationActionClick: function (action, confidence) {
      console.log(
        "EchoAI: Conversation action clicked:",
        action,
        "confidence:",
        confidence
      );

      // Handle different types of actions
      switch (action.toLowerCase()) {
        case "escalate":
        case "escalate to human":
        case "request human support":
          this.handleEscalation("intelligence_suggestion");
          break;

        case "collect contact info":
        case "collect lead information":
          this.showLeadCollectionDialog();
          break;

        case "schedule callback":
        case "schedule meeting":
          this.handleSchedulingAction(action);
          break;

        case "provide documentation":
        case "share resources":
          this.handleResourceSharingAction(action);
          break;

        default:
          // Generic action - send as a message
          const actionMessage = `I'd like to ${action.toLowerCase()}`;
          this.uiManager.addMessage(actionMessage, "user");

          if (this.sendMessage) {
            this.sendMessage(actionMessage);
          }
          break;
      }

      // Hide intelligence panel after action
      this.hideIntelligencePanel();

      // Emit event for analytics
      this.eventManager.emit("conversation-action-clicked", {
        action,
        confidence,
      });
    },

    handleSchedulingAction: function (action) {
      // This could integrate with a scheduling system
      const schedulingMessage = `I'd like to ${action.toLowerCase()}. What are your available times?`;
      this.uiManager.addMessage(schedulingMessage, "user");

      if (this.sendMessage) {
        this.sendMessage(schedulingMessage);
      }
    },

    handleResourceSharingAction: function (action) {
      // This could trigger showing relevant documentation or resources
      const resourceMessage = `Could you ${action.toLowerCase()} that might help me?`;
      this.uiManager.addMessage(resourceMessage, "user");

      if (this.sendMessage) {
        this.sendMessage(resourceMessage);
      }
    },

    hideIntelligencePanel: function () {
      const existingPanel = document.getElementById(
        "echoai-intelligence-panel"
      );
      if (existingPanel) {
        // Animate out
        existingPanel.style.transition = "all 0.3s ease";
        existingPanel.style.opacity = "0";
        existingPanel.style.transform = "translateY(-10px)";

        setTimeout(() => {
          if (existingPanel.parentNode) {
            existingPanel.parentNode.removeChild(existingPanel);
          }
        }, 300);
      }
    },

    checkEscalationTriggers: function (enhancedData) {
      if (!this.config.escalationConfig?.enabled) return;

      const metadata = enhancedData.intelligence_metadata;
      if (!metadata) return;

      const escalationThreshold =
        this.config.escalationConfig?.escalationThreshold || 0.7;

      // Check various escalation triggers
      let shouldEscalate = false;
      let escalationReason = "";

      // High risk score
      if (metadata.risk_score && metadata.risk_score >= escalationThreshold) {
        shouldEscalate = true;
        escalationReason = "High risk conversation detected";
      }

      // High escalation likelihood
      if (
        metadata.escalation_likelihood &&
        metadata.escalation_likelihood >= escalationThreshold
      ) {
        shouldEscalate = true;
        escalationReason = "High escalation probability detected";
      }

      // Negative sentiment with high confidence
      if (
        metadata.sentiment === "negative" &&
        metadata.sentiment_score &&
        metadata.sentiment_score >= escalationThreshold
      ) {
        shouldEscalate = true;
        escalationReason = "Negative sentiment detected";
      }

      // Low confidence in AI response
      if (
        enhancedData.confidence_score &&
        enhancedData.confidence_score <= 1 - escalationThreshold
      ) {
        shouldEscalate = true;
        escalationReason = "Low AI confidence in response";
      }

      if (shouldEscalate) {
        console.log(
          "EchoAI: Automatic escalation triggered:",
          escalationReason
        );

        // Show escalation suggestion instead of auto-escalating
        this.showEscalationSuggestion(escalationReason, metadata);

        // Emit event for analytics
        this.eventManager.emit("escalation-triggered", {
          reason: escalationReason,
          metadata: metadata,
          automatic: true,
        });
      }
    },

    showEscalationSuggestion: function (reason, metadata) {
      // Create escalation suggestion banner
      const chatPanel = this.container.querySelector('[data-panel="chat"]');
      if (!chatPanel) return;

      // Remove existing suggestion
      const existingSuggestion = chatPanel.querySelector(
        ".echoai-escalation-suggestion"
      );
      if (existingSuggestion) {
        existingSuggestion.remove();
      }

      const suggestionBanner = document.createElement("div");
      suggestionBanner.className = "echoai-escalation-suggestion";
      suggestionBanner.innerHTML = `
        <div class="echoai-suggestion-content">
          <div class="echoai-suggestion-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
          </div>
          <div class="echoai-suggestion-text">
            <div class="echoai-suggestion-title">Would you like to speak with a human agent?</div>
            <div class="echoai-suggestion-reason">${this.escapeHtml(
              reason
            )}</div>
          </div>
          <div class="echoai-suggestion-actions">
            <button class="echoai-suggestion-btn echoai-suggestion-accept">Yes, connect me</button>
            <button class="echoai-suggestion-btn echoai-suggestion-dismiss">No, continue</button>
          </div>
        </div>
      `;

      // Insert at the top of the chat panel
      const messagesContainer = chatPanel.querySelector(".echoai-messages");
      if (messagesContainer) {
        chatPanel.insertBefore(suggestionBanner, messagesContainer);
      } else {
        chatPanel.insertBefore(suggestionBanner, chatPanel.firstChild);
      }

      // Set up event listeners
      const acceptBtn = suggestionBanner.querySelector(
        ".echoai-suggestion-accept"
      );
      const dismissBtn = suggestionBanner.querySelector(
        ".echoai-suggestion-dismiss"
      );

      this.eventManager.addEventListener(acceptBtn, "click", () => {
        this.handleEscalation("automatic_trigger");
        suggestionBanner.remove();
      });

      this.eventManager.addEventListener(dismissBtn, "click", () => {
        suggestionBanner.remove();

        // Emit dismissal event
        this.eventManager.emit("escalation-suggestion-dismissed", {
          reason: reason,
          metadata: metadata,
        });
      });

      // Auto-dismiss after 30 seconds
      setTimeout(() => {
        if (suggestionBanner.parentNode) {
          suggestionBanner.remove();
        }
      }, 30000);

      // Animate in
      requestAnimationFrame(() => {
        suggestionBanner.style.opacity = "0";
        suggestionBanner.style.transform = "translateY(-10px)";
        suggestionBanner.style.transition = "all 0.3s ease";

        requestAnimationFrame(() => {
          suggestionBanner.style.opacity = "1";
          suggestionBanner.style.transform = "translateY(0)";
        });
      });
    },

    showLeadCollectionDialog: function () {
      // Create lead collection dialog
      const dialog = document.createElement("div");
      dialog.className = "echoai-lead-collection-dialog";
      dialog.innerHTML = `
        <div class="echoai-dialog-overlay">
          <div class="echoai-dialog-content">
            <div class="echoai-dialog-header">
              <h3>Contact Information</h3>
              <button class="echoai-dialog-close" aria-label="Close dialog">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div class="echoai-dialog-body">
              <p>Please provide your contact information so we can better assist you:</p>
              <form class="echoai-lead-form">
                ${
                  this.config.leadCollectionConfig?.collectEmail !== false
                    ? `
                  <div class="echoai-form-group">
                    <label for="echoai-lead-email">Email Address *</label>
                    <input type="email" id="echoai-lead-email" name="email" required>
                  </div>
                `
                    : ""
                }
                ${
                  this.config.leadCollectionConfig?.collectPhone
                    ? `
                  <div class="echoai-form-group">
                    <label for="echoai-lead-phone">Phone Number</label>
                    <input type="tel" id="echoai-lead-phone" name="phone">
                  </div>
                `
                    : ""
                }
                ${
                  this.config.leadCollectionConfig?.collectCompany
                    ? `
                  <div class="echoai-form-group">
                    <label for="echoai-lead-company">Company</label>
                    <input type="text" id="echoai-lead-company" name="company">
                  </div>
                `
                    : ""
                }
              </form>
            </div>
            <div class="echoai-dialog-footer">
              <button class="echoai-btn echoai-btn-secondary echoai-cancel-lead">Cancel</button>
              <button class="echoai-btn echoai-btn-primary echoai-submit-lead">Submit</button>
            </div>
          </div>
        </div>
      `;

      // Add to document
      document.body.appendChild(dialog);

      // Set up event handlers
      const closeDialog = () => {
        dialog.classList.add("echoai-dialog-hiding");
        setTimeout(() => {
          if (dialog.parentNode) {
            dialog.parentNode.removeChild(dialog);
          }
        }, 300);
      };

      const closeBtn = dialog.querySelector(".echoai-dialog-close");
      const cancelBtn = dialog.querySelector(".echoai-cancel-lead");
      const submitBtn = dialog.querySelector(".echoai-submit-lead");
      const form = dialog.querySelector(".echoai-lead-form");

      this.eventManager.addEventListener(closeBtn, "click", closeDialog);
      this.eventManager.addEventListener(cancelBtn, "click", closeDialog);

      this.eventManager.addEventListener(submitBtn, "click", async () => {
        const formData = new FormData(form);
        const leadData = Object.fromEntries(formData.entries());

        // Validate required fields
        if (
          this.config.leadCollectionConfig?.collectEmail !== false &&
          !leadData.email
        ) {
          this.uiManager.showNotification(
            "Email address is required",
            "error",
            3000
          );
          return;
        }

        try {
          submitBtn.disabled = true;
          submitBtn.textContent = "Submitting...";

          // Store lead data in state
          this.stateManager.setState({ leadCollectionData: leadData });

          // Emit lead collection event
          this.eventManager.emit("lead-collected", { leadData });

          closeDialog();

          this.uiManager.showNotification(
            "Thank you! Your information has been saved.",
            "success",
            4000
          );

          // Add system message
          this.uiManager.addMessage(
            "Thank you for providing your contact information. We'll use this to better assist you.",
            "assistant",
            null,
            { isSystemMessage: true }
          );
        } catch (error) {
          console.error("EchoAI: Lead collection failed:", error);
          this.uiManager.showNotification(
            "Failed to save your information. Please try again.",
            "error",
            4000
          );

          submitBtn.disabled = false;
          submitBtn.textContent = "Submit";
        }
      });

      // Show with animation
      requestAnimationFrame(() => {
        dialog.classList.add("echoai-dialog-visible");
      });

      // Focus first input
      setTimeout(() => {
        const firstInput = form.querySelector("input");
        if (firstInput) {
          firstInput.focus();
        }
      }, 100);
    },

    // Utility method for HTML escaping
    escapeHtml: function (text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    },

    attemptFallbackMessage: async function (message, imageUrl, originalError) {
      console.log(
        "EchoAI: Attempting fallback to regular messaging:",
        originalError.message
      );

      try {
        this.stateManager.setState({ isLoading: true });
        this.uiManager.showTyping();

        // Send regular message via API
        const response = await this.apiClient.sendMessage(
          message,
          imageUrl,
          false
        );

        // Add assistant response
        this.uiManager.addMessage(response.response, "assistant");

        // Handle enhanced features if available
        if (response && this.config.enableEnhancedFeatures) {
          this.handleEnhancedResponse(response);
        }

        // Update conversation ID if provided
        if (response.conversation_id) {
          this.stateManager.setState({
            conversationId: response.conversation_id,
          });
        }

        this.uiManager.hideTyping();
        this.stateManager.setState({ isLoading: false });
      } catch (fallbackError) {
        console.error("EchoAI: Fallback messaging also failed:", fallbackError);
        this.uiManager.hideTyping();
        this.stateManager.setState({ isLoading: false });

        // Show error message
        this.uiManager.addMessage(
          "I'm having trouble connecting right now. Please try again in a moment.",
          "assistant"
        );

        // Show notification
        this.uiManager.showNotification(
          "Connection error. Please check your internet and try again.",
          "error",
          5000
        );
      }
    },

    cancelStreaming: function () {
      this.apiClient.cancelStreaming();
      this.stateManager.setState({ isStreaming: false });
      this.uiManager.hideStreamingControls();
    },

    sendRegularMessage: async function (message, imageUrl) {
      this.stateManager.setState({ isLoading: true });
      this.uiManager.showTyping();

      try {
        const data = await this.apiClient.sendMessage(message, imageUrl, false);
        console.log("EchoAI: Received API response:", data);

        this.uiManager.hideTyping();

        if (data.response) {
          console.log("EchoAI: Adding assistant message:", data.response);
          this.uiManager.addMessage(data.response, "assistant");
        } else {
          console.error("EchoAI: No response field in API data:", data);
          this.uiManager.addMessage(
            "Sorry, I didn't receive a proper response. Please try again.",
            "assistant"
          );
        }

        // Handle enhanced features
        if (data.proactive_questions && this.config.enableEnhancedFeatures) {
          this.handleEnhancedResponse(data);
        }

        // Update session ID if provided
        if (data.sessionId) {
          this.stateManager.setState({ conversationId: data.sessionId });
        }
      } catch (error) {
        this.uiManager.hideTyping();
        throw error;
      } finally {
        this.stateManager.setState({ isLoading: false });
      }
    },

    handleEnhancedResponse: function (enhancedData) {
      // Update state with enhanced data
      this.stateManager.setState({
        proactiveQuestions: enhancedData.proactive_questions || [],
        suggestedTopics: enhancedData.suggested_topics || [],
        conversationActions: enhancedData.conversation_actions || [],
        intelligenceMetadata: enhancedData.intelligence_metadata || null,
      });

      // Use UIManager's enhanced intelligence panel method
      this.uiManager.updateIntelligencePanel(enhancedData);

      // Check for escalation risk
      if (
        enhancedData.intelligence_metadata &&
        enhancedData.intelligence_metadata.escalation_risk >
          this.config.escalationConfig.escalationThreshold
      ) {
        this.handleEscalation("auto_detected");
      }
    },

    handleFileSelection: function (file) {
      // Validate the file
      const validation = this.uiManager.validateImageFile(file);

      if (!validation.isValid) {
        // Show validation errors
        validation.errors.forEach((error) => {
          this.uiManager.showUploadError(error);
        });
        return;
      }

      // Show preview immediately
      this.uiManager.showImagePreview(file);
    },

    loadFAQs: async function () {
      if (!this.config.chatbotId) return;

      const faqList = document.getElementById("echoai-faq-list");
      if (!faqList) return;

      try {
        // Show loading state
        faqList.innerHTML =
          '<div class="echoai-loading"><div class="echoai-loading-spinner"></div><div class="echoai-loading-text">Loading FAQs...</div></div>';

        const faqs = await this.apiClient.loadFAQs();
        this.stateManager.setState({ faqs });

        if (!faqs || faqs.length === 0) {
          faqList.innerHTML =
            '<div class="echoai-no-content"><div class="echoai-no-content-icon">â“</div><div class="echoai-no-content-title">No FAQs available</div><div class="echoai-no-content-message">Check back later for frequently asked questions.</div></div>';
          return;
        }

        faqList.innerHTML = faqs
          .map(
            (faq, index) => `
          <div class="echoai-faq-item" 
               data-faq-id="${faq.id}" 
               data-faq-index="${index}"
               tabindex="0" 
               role="button" 
               aria-expanded="false"
               aria-controls="faq-answer-${index}"
               aria-label="FAQ: ${this.escapeHtml(faq.question)}">
            <div class="echoai-faq-question">
              <span class="echoai-faq-question-text">${this.escapeHtml(
                faq.question
              )}</span>
              <span class="echoai-faq-toggle">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6,9 12,15 18,9"></polyline>
                </svg>
              </span>
            </div>
            <div class="echoai-faq-answer" id="faq-answer-${index}" style="display: none;">
              <div class="echoai-faq-answer-content">
                ${this.escapeHtml(faq.answer)}
              </div>
              ${
                faq.category
                  ? `<div class="echoai-faq-category">${this.escapeHtml(
                      faq.category
                    )}</div>`
                  : ""
              }
            </div>
          </div>
        `
          )
          .join("");

        // Add click handlers for FAQ items (accordion functionality)
        const faqItems = faqList.querySelectorAll(".echoai-faq-item");
        faqItems.forEach((item) => {
          // Click handler for accordion toggle
          this.eventManager.addEventListener(item, "click", (e) => {
            this.toggleFAQItem(item);
          });

          // Double-click handler to use in chat
          this.eventManager.addEventListener(item, "dblclick", (e) => {
            const question = item.querySelector(
              ".echoai-faq-question-text"
            ).textContent;
            const answerContent = item.querySelector(
              ".echoai-faq-answer-content"
            );
            const answer = answerContent ? answerContent.textContent : "";
            this.selectFAQ(question, answer);
          });

          // Keyboard support for accordion
          this.eventManager.addEventListener(item, "keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              this.toggleFAQItem(item);
            }
          });
        });

        // Add search functionality
        const searchInput = this.container.querySelector(
          ".echoai-faq-search-input"
        );
        if (searchInput) {
          this.eventManager.addEventListener(searchInput, "input", (e) => {
            const query = e.target.value.toLowerCase();
            const faqItems =
              this.container.querySelectorAll(".echoai-faq-item");

            faqItems.forEach((item) => {
              const question = item
                .querySelector(".echoai-faq-question-text")
                .textContent.toLowerCase();
              const answerContent = item.querySelector(
                ".echoai-faq-answer-content"
              );
              const answer = answerContent
                ? answerContent.textContent.toLowerCase()
                : "";

              if (question.includes(query) || answer.includes(query)) {
                item.style.display = "block";
                // If searching and there's a match, expand the item to show the answer
                if (query.trim() && answer.includes(query)) {
                  this.toggleFAQItem(item, true); // Force expand
                }
              } else {
                item.style.display = "none";
              }
            });
          });
        }
      } catch (error) {
        console.error("EchoAI: Failed to load FAQs:", error);
        faqList.innerHTML =
          '<div class="echoai-error"><div class="echoai-error-icon">âš ï¸</div><div class="echoai-error-title">Failed to load FAQs</div><div class="echoai-error-message">Please try again later or contact support.</div></div>';
      }
    },

    toggleFAQItem: function (item, forceExpand = false) {
      const answer = item.querySelector(".echoai-faq-answer");
      const toggle = item.querySelector(".echoai-faq-toggle svg");
      const isExpanded = item.getAttribute("aria-expanded") === "true";

      if (isExpanded && !forceExpand) {
        // Collapse
        answer.style.display = "none";
        item.setAttribute("aria-expanded", "false");
        toggle.style.transform = "rotate(0deg)";
        item.classList.remove("echoai-faq-expanded");
      } else if (!isExpanded || forceExpand) {
        // Expand
        answer.style.display = "block";
        item.setAttribute("aria-expanded", "true");
        toggle.style.transform = "rotate(180deg)";
        item.classList.add("echoai-faq-expanded");

        // Animate the expansion
        answer.style.opacity = "0";
        answer.style.transform = "translateY(-10px)";

        requestAnimationFrame(() => {
          answer.style.transition = "opacity 0.3s ease, transform 0.3s ease";
          answer.style.opacity = "1";
          answer.style.transform = "translateY(0)";
        });
      }
    },

    selectFAQ: function (question, answer) {
      // Switch to chat tab
      this.uiManager.switchTab("chat");

      // Add FAQ question and answer to chat
      this.uiManager.addMessage(question, "user");
      setTimeout(() => {
        this.uiManager.addMessage(answer, "assistant");
      }, 500);
    },

    loadConversation: async function (sessionId) {
      if (!sessionId) {
        console.error(
          "EchoAI: No session ID provided for conversation loading"
        );
        return;
      }

      try {
        // Switch to chat tab
        this.uiManager.switchTab("chat");

        // Show loading state
        this.stateManager.setState({ isLoading: true });

        // Load conversation messages
        const response = await this.apiClient.request(
          `/api/chat/messages?conversationId=${sessionId}&chatbotId=${this.config.chatbotId}&userEmail=${this.config.userEmail}`
        );

        if (response.ok) {
          const data = await response.json();
          const messages = data.messages || [];

          // Clear current conversation
          this.stateManager.setState({
            conversationId: sessionId,
            messages: [],
          });

          // Clear and regenerate the entire chat panel to ensure proper structure
          const chatPanel = this.container.querySelector('[data-panel="chat"]');
          if (chatPanel) {
            // Store the current active state
            const isActive = chatPanel.classList.contains(
              "echoai-tab-panel-active"
            );

            // Regenerate the chat panel HTML
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = this.uiManager.generateChatPanel();
            const newChatPanel = tempDiv.firstElementChild;

            // Preserve the active state
            if (isActive) {
              newChatPanel.classList.add("echoai-tab-panel-active");
              newChatPanel.style.display = "block";
            }

            // Replace the old panel with the new one
            chatPanel.parentNode.replaceChild(newChatPanel, chatPanel);

            // Re-cache all elements
            this.uiManager.cacheElements();

            // Re-setup event listeners
            this.setupEventListeners();
          }

          // Add loaded messages
          messages.forEach((msg) => {
            this.uiManager.addMessage(msg.content, msg.role, msg.imageUrl, {
              id: msg.id,
              timestamp: new Date(msg.createdAt),
              status: "delivered",
            });
          });

          console.log(
            "âœ… Loaded conversation:",
            sessionId,
            "with",
            messages.length,
            "messages"
          );

          // Update header to show new conversation button
          this.updateHeader();

          // Focus the input
          setTimeout(() => {
            if (this.uiManager.elements.input) {
              this.uiManager.elements.input.focus();
            }
          }, 100);
        } else {
          throw new Error(`Failed to load conversation: ${response.status}`);
        }
      } catch (error) {
        console.error("EchoAI: Error loading conversation:", error);
        this.uiManager.showNotification(
          "This conversation is no longer available",
          "error"
        );
      } finally {
        this.stateManager.setState({ isLoading: false });
      }
    },

    loadConversationHistory: async function (search = "") {
      if (!this.config.userEmail) return;

      const historyList = document.getElementById("echoai-history-list");
      if (!historyList) return;

      try {
        // Show loading state
        historyList.innerHTML =
          '<div class="echoai-loading"><div class="echoai-loading-spinner"></div><div class="echoai-loading-text">Loading conversation history...</div></div>';

        const history = await this.apiClient.loadConversationHistory(
          1,
          20,
          search
        );
        this.stateManager.setState({ conversationHistory: history });

        if (!history || history.length === 0) {
          historyList.innerHTML =
            '<div class="echoai-no-content"><div class="echoai-no-content-icon">ðŸ’¬</div><div class="echoai-no-content-title">No conversation history</div><div class="echoai-no-content-message">Start a conversation to see your chat history here.</div></div>';
          return;
        }

        historyList.innerHTML = history
          .map(
            (item) => `
          <div class="echoai-history-item" data-session-id="${
            item.sessionId || item.id
          }" tabindex="0" role="button">
            <div class="echoai-history-preview">${this.escapeHtml(
              item.preview || item.lastMessage || "No messages"
            )}</div>
            <div class="echoai-history-meta">
              <span class="echoai-history-date">${new Date(
                item.timestamp || item.createdAt
              ).toLocaleDateString()}</span>
              <span class="echoai-history-count">${
                item.messageCount || 0
              } messages</span>
            </div>
          </div>
        `
          )
          .join("");

        // Add click handlers for history items
        const historyItems = historyList.querySelectorAll(
          ".echoai-history-item"
        );
        historyItems.forEach((item) => {
          this.eventManager.addEventListener(item, "click", () => {
            const sessionId = item.getAttribute("data-session-id");
            if (sessionId) {
              this.loadConversation(sessionId);
            }
          });

          // Keyboard support
          this.eventManager.addEventListener(item, "keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              item.click();
            }
          });
        });

        // Add search functionality
        const searchInput = this.container.querySelector(
          ".echoai-history-search-input"
        );
        if (searchInput) {
          let searchTimeout;
          this.eventManager.addEventListener(searchInput, "input", (e) => {
            const query = e.target.value.toLowerCase();

            // Debounce search
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
              this.loadConversationHistory(query);
            }, 300);
          });
        }
      } catch (error) {
        console.error("EchoAI: Failed to load conversation history:", error);
        historyList.innerHTML =
          '<div class="echoai-error"><div class="echoai-error-icon">âš ï¸</div><div class="echoai-error-title">Failed to load history</div><div class="echoai-error-message">Unable to load your conversation history. Please try again.</div></div>';
      }
    },

    loadChatbotSettings: async function () {
      console.log("EchoAI: Loading enhanced chatbot settings...");

      // Set fallback values first
      this.welcomeMessage =
        this.config.welcomeMessage || "Hello! How can I help you today?";

      // Apply embedded settings immediately as fallback
      const fallbackSettings = {
        name: this.config.chatbotName || "AI Assistant",
        primaryColor: this.config.primaryColor || "#3b82f6",
        welcomeMessage: this.welcomeMessage,
      };

      this.uiManager.applySettings(fallbackSettings);

      try {
        const chatbot = await this.apiClient.loadChatbotSettings();
        console.log("EchoAI: Received enhanced settings:", chatbot);

        // Apply updated settings from API
        this.uiManager.applySettings(chatbot);
        this.welcomeMessage = chatbot.welcomeMessage;
      } catch (error) {
        console.log(
          "EchoAI: Failed to load from API, using embedded settings:",
          error.message
        );
      }
    },

    addWelcomeMessage: function () {
      const welcomeMsg =
        this.welcomeMessage || "Hello! How can I help you today?";
      this.uiManager.addMessage(welcomeMsg, "assistant");
    },

    startNewConversation: function () {
      console.log("Starting new conversation...");

      // Cancel any ongoing streaming
      if (this.stateManager.getState().isStreaming) {
        this.apiClient.cancelStreaming();
        this.stateManager.setState({ isStreaming: false });
      }

      // Clear conversation state
      this.stateManager.setState({
        conversationId: null,
        messages: [],
        proactiveQuestions: [],
        suggestedTopics: [],
        conversationActions: [],
        intelligenceMetadata: null,
      });

      window.EchoAI.clearStoredConversation();

      // Clear messages UI
      if (this.uiManager.elements.messagesContainer) {
        this.uiManager.elements.messagesContainer.innerHTML = "";
      }

      // Add welcome message
      if (this.welcomeMessage) {
        this.addWelcomeMessage();
      }

      // Update header to remove new conversation button
      this.updateHeader();

      console.log("New conversation started");
    },

    updateHeader: function () {
      const header = this.container.querySelector(".echoai-header");
      if (header) {
        header.innerHTML = this.uiManager.generateHeader();

        // Re-attach event listeners
        const closeBtn = header.querySelector(".echoai-close-btn");
        const newConversationBtn = header.querySelector(
          ".echoai-new-conversation-btn"
        );

        if (closeBtn) {
          this.eventManager.addEventListener(closeBtn, "click", () => {
            this.stateManager.setState({ isOpen: false });
            this.uiManager.updateWidgetVisibility(false);
          });
        }

        if (newConversationBtn) {
          this.eventManager.addEventListener(
            newConversationBtn,
            "click",
            () => {
              this.startNewConversation();
            }
          );
        }
      }
    },

    loadStyles: function () {
      if (document.getElementById("echoai-enhanced-styles")) return;

      const styles = document.createElement("style");
      styles.id = "echoai-enhanced-styles";
      styles.textContent = this.getStyles();
      document.head.appendChild(styles);
    },

    getStyles: function () {
      return `
        /* EchoAI Enhanced Widget Styles */
        
        /* CSS Custom Properties */
        :root {
          --echoai-primary: var(--echoai-primary-color, #3b82f6);
          --echoai-primary-hover: var(--echoai-primary-hover, #2563eb);
          --echoai-primary-light: var(--echoai-primary-light, #eff6ff);
          --echoai-text: #374151;
          --echoai-text-light: #6b7280;
          --echoai-text-muted: #9ca3af;
          --echoai-bg: #ffffff;
          --echoai-bg-secondary: #f8fafc;
          --echoai-border: #e5e7eb;
          --echoai-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
          --echoai-radius: 16px;
          --echoai-radius-sm: 8px;
          --echoai-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          --echoai-transition: all 0.2s ease;
          --echoai-z-index: 9999;
        }

        /* Base Styles */
        .echoai-enhanced-widget-container * {
          box-sizing: border-box;
          font-family: var(--echoai-font);
        }

        .echoai-sr-only {
          position: absolute !important;
          width: 1px !important;
          height: 1px !important;
          padding: 0 !important;
          margin: -1px !important;
          overflow: hidden !important;
          clip: rect(0, 0, 0, 0) !important;
          white-space: nowrap !important;
          border: 0 !important;
        }

        /* Widget Container */
        .echoai-enhanced-widget {
          width: 350px;
          height: 530px;
          max-height: 530px;
          background: var(--echoai-bg);
          border-radius: var(--echoai-radius);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          margin-bottom: 8px;
          border: 0;
          transition: var(--echoai-transition);
        }

        .echoai-chat-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          max-height: 100%;
          overflow: hidden;
        }

        /* Header */
        .echoai-header {
          background: var(--echoai-primary);
          color: white;
          width: 100%;
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-radius: 16px 16px 0 0;
          flex-shrink: 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          min-height: 60px;
          box-sizing: border-box;
        }

        .echoai-header-content {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
        }

        .echoai-header-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .echoai-bot-avatar {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .echoai-header-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .echoai-bot-name {
          font-weight: 500;
          font-size: 16px;
          margin: 0;
          line-height: 1.2;
        }

        .echoai-bot-status {
          font-size: 12px;
          opacity: 0.9;
          margin: 0;
          line-height: 1.2;
        }

        .echoai-new-conversation-btn,
        .echoai-close-btn {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          padding: 6px;
          border-radius: 4px;
          transition: var(--echoai-transition);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
        }

        .echoai-new-conversation-btn:hover,
        .echoai-close-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .echoai-close-btn:focus,
        .echoai-new-conversation-btn:focus {
          outline: 2px solid rgba(255, 255, 255, 0.5);
          outline-offset: 2px;
        }

        /* Tabs */
        .echoai-tabs {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          background: transparent;
          border-bottom: 1px solid var(--echoai-border);
          padding: 0;
          margin: 0;
        }

        .echoai-tab {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 12px 8px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: var(--echoai-text-light);
          transition: var(--echoai-transition);
          border-radius: 4px 4px 4px 4px;
          margin: 2px 2px;
          position: relative;
        }

        .echoai-tab:hover {
          background: rgba(0, 0, 0, 0.05);
          color: var(--echoai-text);
        }

        .echoai-tab:focus {
          outline: 2px solid var(--echoai-primary);
          outline-offset: -2px;
        }

        .echoai-tab-active {
          background: var(--echoai-primary);
          color: var(--echoai-bg);
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
        }

        .echoai-tab-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-height: 0;
        }

        .echoai-tab-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-height: 0;
        }

        /* Messages */
        .echoai-messages {
          flex: 1;
          padding: 16px;
          overflow-y: auto;
          overflow-x: hidden;
          display: flex;
          flex-direction: column;
          background: linear-gradient(to bottom, var(--echoai-bg), rgba(248, 250, 252, 0.95));
          scroll-behavior: smooth;
          gap: 8px;
          min-height: 0;
          max-height: 100%;
        }

        .echoai-messages::-webkit-scrollbar {
          width: 8px;
        }

        .echoai-messages::-webkit-scrollbar-track {
          background: transparent;
          border-radius: 4px;
        }

        .echoai-messages::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, rgba(156, 163, 175, 0.3), rgba(156, 163, 175, 0.6));
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .echoai-messages::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, rgba(156, 163, 175, 0.5), rgba(156, 163, 175, 0.8));
        }

        .echoai-messages {
          scrollbar-width: thin;
          scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
        }

        /* Message Groups */
        .echoai-message-group {
          display: flex;
          gap: 12px;
          transition: var(--echoai-transition);
          margin-bottom: 8px;
          animation: echoai-message-appear 0.3s ease-out;
        }

        .echoai-message-group.flex-row-reverse {
          flex-direction: row-reverse;
        }

        .echoai-message-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          transition: var(--echoai-transition);
        }

        .echoai-message-content {
          flex: 1;
          min-width: 0;
        }

        .echoai-message-bubble {
          display: inline-block;
          max-width: 95%;
          border-radius: 16px;
          padding: 12px 16px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          transition: var(--echoai-transition);
          position: relative;
          border: 1px solid transparent;
        }

        .echoai-message-text {
          font-size: 14px;
          line-height: 1.6;
          word-wrap: break-word;
          overflow-wrap: break-word;
          white-space: pre-wrap;
        }

        .echoai-message-image {
          margin-bottom: 12px;
        }

        .echoai-message-image img {
          max-width: 100%;
          height: auto;
          object-fit: cover;
          border-radius: 12px;
          max-height: 200px;
        }

        .echoai-message-footer {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
          font-size: 12px;
          color: var(--echoai-text-muted);
        }

        .echoai-message-actions {
          display: flex;
          align-items: center;
          gap: 4px;
          opacity: 0;
          transition: var(--echoai-transition);
          margin-left: auto;
        }

        .echoai-message-group:hover .echoai-message-actions {
          opacity: 0;
        }

        .echoai-message-action {
          width: 20px;
          height: 20px;
          padding: 0;
          background: none;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: var(--echoai-transition);
          color: var(--echoai-text-muted);
        }

        .echoai-message-action:hover {
          background: var(--echoai-bg-secondary);
          color: var(--echoai-text);
        }

        /* Input Container */
        .echoai-input-container {
          padding: 16px;
          border-top: 1px solid var(--echoai-border);
          background: var(--echoai-bg);
          flex-shrink: 0;
          margin-top: auto;
        }

        .echoai-input-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .echoai-input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid var(--echoai-border);
          border-radius: 8px;
          outline: none;
          font-size: 14px;
          transition: var(--echoai-transition);
          background: var(--echoai-bg);
          color: var(--echoai-text);
        }

        .echoai-input:focus {
          border-color: var(--echoai-primary);
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }

        .echoai-input::placeholder {
          color: var(--echoai-text-muted);
        }

        .echoai-upload-btn,
        .echoai-escalate-btn,
        .echoai-send-btn {
          height: 40px;
          padding: 0 12px;
          border: 1px solid var(--echoai-border);
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: var(--echoai-transition);
          flex-shrink: 0;
          font-size: 14px;
        }

        .echoai-upload-btn,
        .echoai-escalate-btn {
          background: var(--echoai-bg);
          color: var(--echoai-text-light);
        }

        .echoai-upload-btn:hover,
        .echoai-escalate-btn:hover {
          background: var(--echoai-bg-secondary);
          color: var(--echoai-text);
          border-color: var(--echoai-text-light);
        }

        .echoai-send-btn {
          background: var(--echoai-primary);
          color: white;
          border-color: var(--echoai-primary);
        }

        .echoai-send-btn:hover {
          background: var(--echoai-primary-hover);
          border-color: var(--echoai-primary-hover);
        }

        .echoai-send-btn:disabled {
          background: var(--echoai-text-muted);
          border-color: var(--echoai-text-muted);
          cursor: not-allowed;
          opacity: 0.5;
        }

        /* Toggle Button */
        .echoai-toggle-btn {
          width: 56px;
          height: 56px;
          background: var(--echoai-primary);
          color: white;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          transition: all 0.2s ease;
          z-index: var(--echoai-z-index);
        }

        .echoai-toggle-btn:hover {
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          transform: translateY(-1px);
        }

        .echoai-toggle-btn:focus {
          outline: 2px solid var(--echoai-primary);
          outline-offset: 2px;
        }

        /* Loading States */
        .echoai-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          color: var(--echoai-text-muted);
        }

        .echoai-loading-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid var(--echoai-border);
          border-top: 2px solid var(--echoai-primary);
          border-radius: 50%;
          animation: echoai-spin 1s linear infinite;
          margin-bottom: 8px;
        }

        .echoai-loading-text {
          font-size: 14px;
        }

        /* Error States */
        .echoai-error,
        .echoai-no-content {
          padding: 20px;
          text-align: center;
          color: var(--echoai-text-muted);
        }

        .echoai-error-icon,
        .echoai-no-content-icon {
          font-size: 32px;
          margin-bottom: 8px;
        }

        .echoai-error-title,
        .echoai-no-content-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--echoai-text);
          margin-bottom: 4px;
        }

        .echoai-error-message,
        .echoai-no-content-message {
          font-size: 14px;
          line-height: 1.5;
        }

        /* FAQ and History Items */
        .echoai-faq-item,
        .echoai-history-item {
          border: 1px solid var(--echoai-border);
          border-radius: 12px;
          margin-bottom: 12px;
          cursor: pointer;
          transition: var(--echoai-transition);
          background: var(--echoai-bg);
          overflow: hidden;
        }

        .echoai-faq-item:hover,
        .echoai-history-item:hover {
          background: var(--echoai-bg-secondary);
          border-color: var(--echoai-primary);
          transform: translateY(-1px);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        .echoai-faq-item:focus,
        .echoai-history-item:focus {
          outline: 2px solid var(--echoai-primary);
          outline-offset: 2px;
        }

        .echoai-faq-expanded {
          border-color: var(--echoai-primary);
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
        }

        .echoai-faq-question {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          font-weight: 600;
          color: var(--echoai-text);
          font-size: 14px;
          line-height: 1.5;
          margin: 0;
        }

        .echoai-faq-question-text {
          flex: 1;
          margin-right: 12px;
        }

        .echoai-faq-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--echoai-bg-secondary);
          transition: all 0.3s ease;
          flex-shrink: 0;
        }

        .echoai-faq-toggle svg {
          transition: transform 0.3s ease;
          color: var(--echoai-text-muted);
        }

        .echoai-faq-item:hover .echoai-faq-toggle {
          background: var(--echoai-primary);
        }

        .echoai-faq-item:hover .echoai-faq-toggle svg {
          color: white;
        }

        .echoai-faq-answer {
          padding: 8px 16px 16px 16px;
          font-size: 14px;
          color: var(--echoai-text-light);
          line-height: 1.6;
          white-space: pre-wrap;
          border-top: 1px solid var(--echoai-border);
          margin-top: 0;
        }

        .echoai-faq-answer-content {
          padding-top: 0;
          margin-bottom: 8px;
        }

        .echoai-faq-category {
          display: inline-block;
          padding: 4px 8px;
          background: var(--echoai-primary-light);
          color: var(--echoai-primary);
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
          margin-top: 8px;
        }

        /* History Item Specific Styles */
        .echoai-history-item {
          padding: 16px;
        }

        .echoai-history-question {
          font-weight: 500;
          color: var(--echoai-text);
          margin-bottom: 4px;
          font-size: 14px;
          line-height: 1.4;
        }

        .echoai-history-answer {
          font-size: 12px;
          color: var(--echoai-text-muted);
          margin-bottom: 8px;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100%;
        }

        .echoai-history-meta {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: var(--echoai-text-muted);
        }

        /* Animations */
        @keyframes echoai-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes echoai-message-appear {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes echoai-accordion-expand {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Intelligence Panel */
        .echoai-intelligence-panel {
          border-top: 1px solid var(--echoai-border);
          background: rgba(249, 250, 251, 0.3);
          padding: 0px 4px 0px 4px;
          height: 130px;
          margin-bottom: 0;
          flex-shrink: 0;
          overflow-y: auto; /* enables vertical scroll */
          /* Firefox */
          scrollbar-width: thin;
          scrollbar-color: var(--echoai-border) transparent;
        }

        /* Chrome, Edge, Safari */
        .echoai-intelligence-panel::-webkit-scrollbar {
          width: 6px; /* thin width */
        }

        .echoai-intelligence-panel::-webkit-scrollbar-track {
          background: transparent; /* optional */
        }

        .echoai-intelligence-panel::-webkit-scrollbar-thumb {
          background-color: var(--echoai-border);
          border-radius: 10px;
        }

        .echoai-intelligence-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: rgba(249, 250, 251, 0.5);
          border-bottom: 1px solid var(--echoai-border);
        }

        .echoai-intelligence-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--echoai-text);
        }

        .echoai-intelligence-toggle {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: var(--echoai-transition);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--echoai-text-muted);
        }

        .echoai-intelligence-toggle:hover {
          background: var(--echoai-bg-secondary);
          color: var(--echoai-text);
        }

        .echoai-intelligence-toggle:focus {
          outline: 2px solid var(--echoai-primary);
          outline-offset: 2px;
        }

        .echoai-toggle-icon {
          transition: transform 0.3s ease;
        }

        .echoai-intelligence-content {
          padding: 16px;
          overflow: hidden;
          transition: all 0.3s ease;
        }

        .echoai-intelligence-section {
          margin-bottom: 12px;
        }

        .echoai-intelligence-section:last-child {
          margin-bottom: 0;
        }

        .echoai-intelligence-section h4 {
          font-size: 12px;
          font-weight: 600;
          color: var(--echoai-text-muted);
          margin: 0 0 8px 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .echoai-question-buttons,
        .echoai-topic-buttons,
        .echoai-action-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .echoai-proactive-btn,
        .echoai-topic-btn,
        .echoai-action-btn {
          padding: 6px 12px;
          background: var(--echoai-bg);
          border: 1px solid var(--echoai-border);
          border-radius: 16px;
          cursor: pointer;
          font-size: 12px;
          color: var(--echoai-text);
          transition: var(--echoai-transition);
          font-weight: 500;
        }

        .echoai-proactive-btn:hover,
        .echoai-topic-btn:hover,
        .echoai-action-btn:hover {
          background: var(--echoai-primary);
          color: white;
          border-color: var(--echoai-primary);
          transform: translateY(-1px);
        }

        /* Search Inputs */
        .echoai-faq-search,
        .echoai-history-search {
          padding: 16px;
          border-bottom: 1px solid var(--echoai-border);
        }

        .echoai-search-input-container {
          position: relative;
        }

        .echoai-faq-search-input,
        .echoai-history-search-input {
          width: 100%;
          padding: 8px 12px 8px 36px;
          border: 1px solid var(--echoai-border);
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          transition: var(--echoai-transition);
          background: var(--echoai-bg);
        }

        .echoai-search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--echoai-text-muted);
          font-size: 16px;
        }

        .echoai-faq-search-input:focus,
        .echoai-history-search-input:focus {
          border-color: var(--echoai-primary);
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }

        /* Content Containers */
        .echoai-faq-container,
        .echoai-history-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        .echoai-faq-content,
        .echoai-history-list {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .echoai-faq-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .echoai-faq-header {
          padding: 16px 16px 0 16px;
        }

        .echoai-faq-title {
          font-size: 18px;
          font-weight: 600;
          color: var(--echoai-text);
          margin: 0 0 4px 0;
        }

        .echoai-faq-subtitle {
          font-size: 14px;
          color: var(--echoai-text-muted);
          margin: 0;
        }

        /* Dialogs */
        .echoai-escalation-dialog,
        .echoai-lead-collection-dialog {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.5);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .echoai-escalation-dialog.echoai-dialog-visible,
        .echoai-lead-collection-dialog.echoai-dialog-visible {
          opacity: 1;
        }

        .echoai-dialog-content {
          background: var(--echoai-bg);
          border-radius: var(--echoai-radius);
          box-shadow: var(--echoai-shadow);
          max-width: 400px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
        }

        .echoai-dialog-header {
          padding: 20px 20px 0 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .echoai-dialog-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--echoai-text);
        }

        .echoai-dialog-close {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: var(--echoai-transition);
        }

        .echoai-dialog-close:hover {
          background: var(--echoai-bg-secondary);
        }

        .echoai-dialog-body {
          padding: 20px;
        }

        .echoai-dialog-footer {
          padding: 0 20px 20px 20px;
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .echoai-btn {
          padding: 8px 16px;
          border-radius: var(--echoai-radius-sm);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: var(--echoai-transition);
          border: 1px solid transparent;
        }

        .echoai-btn-primary {
          background: var(--echoai-primary);
          color: white;
        }

        .echoai-btn-primary:hover {
          background: var(--echoai-primary-hover);
        }

        .echoai-btn-secondary {
          background: var(--echoai-bg);
          color: var(--echoai-text);
          border-color: var(--echoai-border);
        }

        .echoai-btn-secondary:hover {
          background: var(--echoai-bg-secondary);
        }

        /* Form Elements */
        .echoai-escalation-reason,
        .echoai-lead-form input,
        .echoai-lead-form textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid var(--echoai-border);
          border-radius: var(--echoai-radius-sm);
          font-size: 14px;
          font-family: var(--echoai-font);
          outline: none;
          transition: var(--echoai-transition);
        }

        .echoai-escalation-reason:focus,
        .echoai-lead-form input:focus,
        .echoai-lead-form textarea:focus {
          border-color: var(--echoai-primary);
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }

        .echoai-form-group {
          margin-bottom: 16px;
        }

        .echoai-form-group label {
          display: block;
          margin-bottom: 4px;
          font-size: 14px;
          font-weight: 500;
          color: var(--echoai-text);
        }

        /* Notifications */
        .echoai-notification {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10001;
          padding: 12px 16px;
          border-radius: var(--echoai-radius-sm);
          font-size: 14px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          transform: translateX(100%);
          transition: transform 0.3s ease;
          max-width: 300px;
        }

        .echoai-notification-visible {
          transform: translateX(0);
        }

        .echoai-notification-info {
          background: var(--echoai-primary);
          color: white;
        }

        .echoai-notification-success {
          background: #22c55e;
          color: white;
        }

        .echoai-notification-warning {
          background: #f59e0b;
          color: white;
        }

        .echoai-notification-error {
          background: #ef4444;
          color: white;
        }

        /* Streaming Controls */
        .echoai-streaming-controls {
          padding: 8px 16px;
          background: var(--echoai-bg-secondary);
          border-top: 1px solid var(--echoai-border);
          display: flex;
          justify-content: center;
        }

        .echoai-cancel-streaming-btn {
          padding: 6px 12px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: var(--echoai-radius-sm);
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: var(--echoai-transition);
        }

        .echoai-cancel-streaming-btn:hover {
          background: #dc2626;
        }

        /* Streaming Message */
        .echoai-streaming .echoai-message-text {
          position: relative;
        }

        .echoai-streaming-cursor {
          animation: echoai-blink 1s infinite;
        }

        @keyframes echoai-blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }

        /* Enhanced Message Styling */
        .echoai-message-group[data-role="user"] .echoai-message-bubble {
          background: var(--echoai-primary);
          color: white;
          border-top-right-radius: 6px;
        }

        .echoai-message-group[data-role="assistant"] .echoai-message-bubble,
        .echoai-message-group[data-role="agent"] .echoai-message-bubble {
          background: #f8fafc;
          border: 1px solid rgba(0, 0, 0, 0.05);
          color: #0f172a;
          border-top-left-radius: 6px;
        }

        .echoai-message-group[data-role="agent"] .echoai-message-bubble {
          background: #f0fdf4;
          border-color: rgba(34, 197, 94, 0.2);
        }

        /* Agent Badge */
        .echoai-agent-badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
          background: #f0fdf4;
          color: #166534;
          border: 1px solid #bbf7d0;
          margin-top: 8px;
        }

        .echoai-agent-badge svg {
          width: 12px;
          height: 12px;
          margin-right: 4px;
        }

        /* Human Agent Status Indicator */
        .echoai-human-agent-status {
          margin-bottom: 16px;
          padding: 12px;
          background: rgba(34, 197, 94, 0.05);
          border: 1px solid rgba(34, 197, 94, 0.2);
          border-radius: 12px;
        }

        .echoai-human-agent-status .echoai-status-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .echoai-human-agent-status .echoai-status-dot {
          width: 8px;
          height: 8px;
          background: #22c55e;
          border-radius: 50%;
          animation: echoai-pulse 2s infinite;
        }

        .echoai-human-agent-status .echoai-status-title {
          font-size: 14px;
          font-weight: 500;
          color: #166534;
        }

        .echoai-human-agent-status .echoai-status-message {
          font-size: 12px;
          color: #15803d;
          margin-top: 4px;
        }

        @keyframes echoai-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* Responsive Design */
        @media (max-width: 480px) {
          .echoai-enhanced-widget {
            width: calc(100vw - 32px);
            height: calc(100vh - 100px);
            max-width: 380px;
            max-height: 600px;
            margin: 16px;
          }

          .echoai-message-group {
            gap: 8px;
          }

          .echoai-message-bubble {
            max-width: 100%;
            padding: 10px 14px;
          }

          .echoai-dialog-content {
            margin: 20px;
            width: calc(100% - 40px);
          }

          .echoai-tabs {
            grid-template-columns: repeat(3, 1fr);
          }

          .echoai-tab {
            padding: 10px 6px;
            font-size: 13px;
          }

          .echoai-faq-question {
            padding: 12px;
          }

          .echoai-faq-question-text {
            font-size: 13px;
            margin-right: 8px;
          }

          .echoai-faq-answer {
            padding: 6px 12px 12px 12px;
          }

          .echoai-faq-answer-content {
            padding-top: 0;
            font-size: 13px;
          }

          .echoai-history-item {
            padding: 12px;
          }

          .echoai-history-question {
            font-size: 13px;
          }

          .echoai-history-answer {
            font-size: 11px;
          }
          }
        }
      `;
    },
  };
})();

// Expose the widget to the global scope
window.EchoAI = EchoAIWidget;
