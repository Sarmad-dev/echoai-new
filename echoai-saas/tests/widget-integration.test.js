/**
 * EchoAI Widget Integration Tests
 * Comprehensive testing suite for widget functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost:3000',
  pretendToBeVisual: true,
  resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Event = dom.window.Event;
global.CustomEvent = dom.window.CustomEvent;

// Mock fetch
global.fetch = vi.fn();

// Mock WebSocket
global.WebSocket = vi.fn().mockImplementation(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1
}));

// Mock EventSource
global.EventSource = vi.fn().mockImplementation(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn(),
  readyState: 1
}));

describe('EchoAI Widget Integration Tests', () => {
  let EchoAI;
  let mockConfig;

  beforeEach(async () => {
    // Reset DOM
    document.body.innerHTML = '';
    
    // Mock configuration
    mockConfig = {
      apiKey: 'test-api-key',
      chatbotId: 'test-chatbot-id',
      apiUrl: 'https://test-api.com/api/enhanced-chat/widget'
    };

    // Reset fetch mock
    fetch.mockClear();
    
    // Load widget (simulate script loading)
    const widgetScript = await import('../public/enhanced-widget.js');
    EchoAI = global.EchoAI;
  });

  afterEach(() => {
    if (EchoAI && EchoAI.destroy) {
      EchoAI.destroy();
    }
    vi.clearAllMocks();
  });

  describe('Widget Initialization', () => {
    it('should initialize with valid configuration', () => {
      expect(() => {
        EchoAI.init(mockConfig);
      }).not.toThrow();
    });

    it('should throw error with invalid configuration', () => {
      expect(() => {
        EchoAI.init({});
      }).toThrow();
    });

    it('should create widget DOM elements', () => {
      EchoAI.init(mockConfig);
      
      const widgetContainer = document.querySelector('.echoai-widget');
      expect(widgetContainer).toBeTruthy();
    });

    it('should set up event listeners', () => {
      const onReady = vi.fn();
      
      EchoAI.init({
        ...mockConfig,
        onReady
      });

      // Simulate ready event
      EchoAI.emit('ready');
      expect(onReady).toHaveBeenCalled();
    });
  });

  describe('Widget API Methods', () => {
    beforeEach(() => {
      EchoAI.init(mockConfig);
    });

    it('should open widget', () => {
      EchoAI.open();
      
      const widget = document.querySelector('.echoai-widget');
      expect(widget.classList.contains('echoai-widget-open')).toBe(true);
    });

    it('should close widget', () => {
      EchoAI.open();
      EchoAI.close();
      
      const widget = document.querySelector('.echoai-widget');
      expect(widget.classList.contains('echoai-widget-open')).toBe(false);
    });

    it('should toggle widget visibility', () => {
      expect(EchoAI.isOpen()).toBe(false);
      
      EchoAI.toggle();
      expect(EchoAI.isOpen()).toBe(true);
      
      EchoAI.toggle();
      expect(EchoAI.isOpen()).toBe(false);
    });

    it('should send messages', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          message: 'Test response',
          conversationId: 'test-conv-id'
        })
      });

      await EchoAI.sendMessage('Hello, world!');
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/enhanced-chat/widget'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Hello, world!')
        })
      );
    });
  });

  describe('Message Handling', () => {
    beforeEach(() => {
      EchoAI.init(mockConfig);
    });

    it('should display user messages', () => {
      EchoAI.open();
      EchoAI.sendMessage('Test message');
      
      const messages = document.querySelectorAll('.echoai-message-user');
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].textContent).toContain('Test message');
    });

    it('should display agent messages', () => {
      EchoAI.open();
      
      // Simulate receiving a message
      EchoAI.emit('message-received', {
        content: 'Agent response',
        role: 'agent',
        timestamp: new Date()
      });
      
      const messages = document.querySelectorAll('.echoai-message-agent');
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].textContent).toContain('Agent response');
    });

    it('should handle message with images', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          message: 'Image received',
          conversationId: 'test-conv-id'
        })
      });

      await EchoAI.sendMessage('What is this?', { imageUrl });
      
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining(imageUrl)
        })
      );
    });
  });

  describe('Streaming Functionality', () => {
    beforeEach(() => {
      EchoAI.init({
        ...mockConfig,
        enableStreaming: true
      });
    });

    it('should handle streaming responses', async () => {
      const mockResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"token": "Hello"}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"token": " world"}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: [DONE]\n\n')
              })
              .mockResolvedValueOnce({
                done: true
              })
          })
        }
      };

      fetch.mockResolvedValueOnce(mockResponse);

      const onToken = vi.fn();
      EchoAI.on('stream-token', onToken);

      await EchoAI.sendMessage('Test streaming', null, true);

      expect(onToken).toHaveBeenCalledWith('Hello');
      expect(onToken).toHaveBeenCalledWith(' world');
    });

    it('should handle streaming errors', async () => {
      const mockResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockRejectedValue(new Error('Stream error'))
          })
        }
      };

      fetch.mockResolvedValueOnce(mockResponse);

      const onError = vi.fn();
      EchoAI.on('stream-error', onError);

      await expect(EchoAI.sendMessage('Test', null, true)).rejects.toThrow();
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('Image Upload', () => {
    beforeEach(() => {
      EchoAI.init({
        ...mockConfig,
        enableImageUpload: true
      });
    });

    it('should upload images', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          imageUrl: 'https://example.com/uploaded-image.jpg'
        })
      });

      const result = await EchoAI.uploadImage(mockFile);
      
      expect(result.imageUrl).toBe('https://example.com/uploaded-image.jpg');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/upload/image'),
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should validate file types', () => {
      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      
      expect(() => {
        EchoAI.validateImageFile(invalidFile);
      }).toThrow('Invalid file type');
    });

    it('should validate file size', () => {
      const largeFile = new File(['x'.repeat(20 * 1024 * 1024)], 'large.jpg', { 
        type: 'image/jpeg' 
      });
      
      expect(() => {
        EchoAI.validateImageFile(largeFile);
      }).toThrow('File too large');
    });
  });

  describe('FAQ Integration', () => {
    beforeEach(() => {
      EchoAI.init({
        ...mockConfig,
        enableFAQ: true
      });
    });

    it('should load FAQs', async () => {
      const mockFAQs = [
        { id: '1', question: 'What is EchoAI?', answer: 'AI chatbot platform' },
        { id: '2', question: 'How to integrate?', answer: 'Use our widget' }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFAQs)
      });

      const faqs = await EchoAI.loadFAQs();
      
      expect(faqs).toEqual(mockFAQs);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/faq'),
        expect.any(Object)
      );
    });

    it('should track FAQ usage', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      await EchoAI.trackFAQUsage('faq-1');
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/faq/track-usage'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('faq-1')
        })
      );
    });
  });

  describe('Conversation History', () => {
    beforeEach(() => {
      EchoAI.init({
        ...mockConfig,
        enableConversationHistory: true
      });
    });

    it('should load conversation history', async () => {
      const mockHistory = {
        conversations: [
          { id: '1', title: 'First conversation', createdAt: new Date() },
          { id: '2', title: 'Second conversation', createdAt: new Date() }
        ],
        totalCount: 2,
        page: 1
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockHistory)
      });

      const history = await EchoAI.loadConversationHistory();
      
      expect(history).toEqual(mockHistory);
    });

    it('should load specific conversation', async () => {
      const mockConversation = {
        id: 'conv-1',
        messages: [
          { content: 'Hello', role: 'user' },
          { content: 'Hi there!', role: 'agent' }
        ]
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConversation)
      });

      const conversation = await EchoAI.loadConversation('conv-1');
      
      expect(conversation).toEqual(mockConversation);
    });
  });

  describe('Real-time Features', () => {
    beforeEach(() => {
      EchoAI.init({
        ...mockConfig,
        enableRealtime: true
      });
    });

    it('should establish WebSocket connection', () => {
      expect(WebSocket).toHaveBeenCalledWith(
        expect.stringContaining('ws://')
      );
    });

    it('should handle connection events', () => {
      const onConnected = vi.fn();
      EchoAI.on('connected', onConnected);

      // Simulate WebSocket connection
      const wsInstance = WebSocket.mock.instances[0];
      const openHandler = wsInstance.addEventListener.mock.calls
        .find(call => call[0] === 'open')[1];
      
      openHandler();
      expect(onConnected).toHaveBeenCalled();
    });

    it('should handle real-time messages', () => {
      const onMessage = vi.fn();
      EchoAI.on('message-received', onMessage);

      // Simulate WebSocket message
      const wsInstance = WebSocket.mock.instances[0];
      const messageHandler = wsInstance.addEventListener.mock.calls
        .find(call => call[0] === 'message')[1];
      
      messageHandler({
        data: JSON.stringify({
          type: 'message',
          content: 'Real-time message',
          role: 'agent'
        })
      });

      expect(onMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Real-time message'
        })
      );
    });

    it('should handle conversation status updates', () => {
      const onStatusChange = vi.fn();
      EchoAI.on('conversation-status-changed', onStatusChange);

      // Simulate status update
      const wsInstance = WebSocket.mock.instances[0];
      const messageHandler = wsInstance.addEventListener.mock.calls
        .find(call => call[0] === 'message')[1];
      
      messageHandler({
        data: JSON.stringify({
          type: 'status',
          status: 'AWAITING_HUMAN_RESPONSE'
        })
      });

      expect(onStatusChange).toHaveBeenCalledWith('AWAITING_HUMAN_RESPONSE');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      EchoAI.init(mockConfig);
    });

    it('should handle API errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const onError = vi.fn();
      EchoAI.on('error', onError);

      await expect(EchoAI.sendMessage('Test')).rejects.toThrow();
      expect(onError).toHaveBeenCalled();
    });

    it('should handle WebSocket errors', () => {
      const onError = vi.fn();
      EchoAI.on('error', onError);

      // Simulate WebSocket error
      const wsInstance = WebSocket.mock.instances[0];
      const errorHandler = wsInstance.addEventListener.mock.calls
        .find(call => call[0] === 'error')[1];
      
      errorHandler(new Error('WebSocket error'));
      expect(onError).toHaveBeenCalled();
    });

    it('should gracefully degrade when features are unavailable', () => {
      // Mock unavailable WebSocket
      global.WebSocket = undefined;

      expect(() => {
        EchoAI.init({
          ...mockConfig,
          enableRealtime: true
        });
      }).not.toThrow();

      // Should fallback to polling or disable real-time features
      expect(EchoAI.isRealtimeEnabled()).toBe(false);
    });
  });

  describe('Performance', () => {
    beforeEach(() => {
      EchoAI.init(mockConfig);
    });

    it('should initialize within acceptable time', () => {
      const startTime = performance.now();
      EchoAI.init(mockConfig);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // 100ms threshold
    });

    it('should handle multiple rapid messages', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'Response' })
      });

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(EchoAI.sendMessage(`Message ${i}`));
      }

      await Promise.all(promises);
      expect(fetch).toHaveBeenCalledTimes(10);
    });

    it('should clean up resources on destroy', () => {
      const widget = document.querySelector('.echoai-widget');
      expect(widget).toBeTruthy();

      EchoAI.destroy();

      const widgetAfterDestroy = document.querySelector('.echoai-widget');
      expect(widgetAfterDestroy).toBeFalsy();
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      EchoAI.init(mockConfig);
      EchoAI.open();
    });

    it('should have proper ARIA labels', () => {
      const chatInput = document.querySelector('.echoai-input');
      expect(chatInput.getAttribute('aria-label')).toBeTruthy();

      const sendButton = document.querySelector('.echoai-send-button');
      expect(sendButton.getAttribute('aria-label')).toBeTruthy();
    });

    it('should support keyboard navigation', () => {
      const chatInput = document.querySelector('.echoai-input');
      
      // Simulate Enter key press
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      chatInput.dispatchEvent(enterEvent);

      // Should send message or trigger appropriate action
      expect(fetch).toHaveBeenCalled();
    });

    it('should have proper focus management', () => {
      EchoAI.open();
      
      const chatInput = document.querySelector('.echoai-input');
      expect(document.activeElement).toBe(chatInput);
    });

    it('should announce messages to screen readers', () => {
      const ariaLive = document.querySelector('[aria-live]');
      expect(ariaLive).toBeTruthy();

      EchoAI.emit('message-received', {
        content: 'New message',
        role: 'agent'
      });

      expect(ariaLive.textContent).toContain('New message');
    });
  });

  describe('Mobile Responsiveness', () => {
    beforeEach(() => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });

      EchoAI.init(mockConfig);
    });

    it('should adapt to mobile viewport', () => {
      EchoAI.open();
      
      const widget = document.querySelector('.echoai-widget');
      const computedStyle = window.getComputedStyle(widget);
      
      // Should use mobile-specific styles
      expect(widget.classList.contains('echoai-widget-mobile')).toBe(true);
    });

    it('should handle touch events', () => {
      const sendButton = document.querySelector('.echoai-send-button');
      
      const touchEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 }]
      });
      
      expect(() => {
        sendButton.dispatchEvent(touchEvent);
      }).not.toThrow();
    });
  });
}); 