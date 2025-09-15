/**
 * EchoAI Widget Analytics and Monitoring Integration
 * Provides comprehensive tracking and monitoring capabilities
 */

class WidgetAnalytics {
  constructor(config = {}) {
    this.config = {
      enableAnalytics: true,
      enableErrorTracking: true,
      enablePerformanceMonitoring: true,
      enableUserTracking: true,
      analyticsProvider: 'google', // 'google', 'mixpanel', 'amplitude', 'custom'
      errorProvider: 'sentry', // 'sentry', 'bugsnag', 'rollbar', 'custom'
      ...config
    };

    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    this.eventQueue = [];
    this.isInitialized = false;

    this.init();
  }

  init() {
    if (this.config.enableAnalytics) {
      this.initializeAnalytics();
    }

    if (this.config.enableErrorTracking) {
      this.initializeErrorTracking();
    }

    if (this.config.enablePerformanceMonitoring) {
      this.initializePerformanceMonitoring();
    }

    this.setupWidgetEventListeners();
    this.isInitialized = true;

    // Process queued events
    this.processEventQueue();
  }

  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  initializeAnalytics() {
    switch (this.config.analyticsProvider) {
      case 'google':
        this.initializeGoogleAnalytics();
        break;
      case 'mixpanel':
        this.initializeMixpanel();
        break;
      case 'amplitude':
        this.initializeAmplitude();
        break;
      case 'custom':
        this.initializeCustomAnalytics();
        break;
    }
  }

  initializeGoogleAnalytics() {
    // Google Analytics 4 integration
    if (typeof gtag !== 'undefined') {
      this.analytics = {
        track: (event, properties) => {
          gtag('event', event, {
            custom_map: properties,
            session_id: this.sessionId
          });
        }
      };
    }
  }

  initializeMixpanel() {
    if (typeof mixpanel !== 'undefined') {
      this.analytics = {
        track: (event, properties) => {
          mixpanel.track(event, {
            ...properties,
            session_id: this.sessionId,
            widget_version: window.EchoAI?.version || 'unknown'
          });
        }
      };
    }
  }

  initializeAmplitude() {
    if (typeof amplitude !== 'undefined') {
      this.analytics = {
        track: (event, properties) => {
          amplitude.getInstance().logEvent(event, {
            ...properties,
            session_id: this.sessionId
          });
        }
      };
    }
  }

  initializeCustomAnalytics() {
    // Custom analytics implementation
    this.analytics = {
      track: (event, properties) => {
        if (this.config.customAnalyticsHandler) {
          this.config.customAnalyticsHandler(event, properties);
        }
      }
    };
  }

  initializeErrorTracking() {
    switch (this.config.errorProvider) {
      case 'sentry':
        this.initializeSentry();
        break;
      case 'bugsnag':
        this.initializeBugsnag();
        break;
      case 'rollbar':
        this.initializeRollbar();
        break;
      case 'custom':
        this.initializeCustomErrorTracking();
        break;
    }
  }

  initializeSentry() {
    if (typeof Sentry !== 'undefined') {
      this.errorTracker = {
        captureException: (error, context) => {
          Sentry.captureException(error, {
            tags: {
              component: 'echoai-widget',
              session_id: this.sessionId
            },
            extra: context
          });
        },
        captureMessage: (message, level, context) => {
          Sentry.captureMessage(message, level, {
            tags: {
              component: 'echoai-widget',
              session_id: this.sessionId
            },
            extra: context
          });
        }
      };
    }
  }

  initializeBugsnag() {
    if (typeof Bugsnag !== 'undefined') {
      this.errorTracker = {
        captureException: (error, context) => {
          Bugsnag.notify(error, (event) => {
            event.addMetadata('widget', {
              session_id: this.sessionId,
              ...context
            });
          });
        }
      };
    }
  }

  initializeRollbar() {
    if (typeof Rollbar !== 'undefined') {
      this.errorTracker = {
        captureException: (error, context) => {
          Rollbar.error(error, {
            session_id: this.sessionId,
            ...context
          });
        }
      };
    }
  }

  initializeCustomErrorTracking() {
    this.errorTracker = {
      captureException: (error, context) => {
        if (this.config.customErrorHandler) {
          this.config.customErrorHandler(error, context);
        }
      }
    };
  }

  initializePerformanceMonitoring() {
    // Performance monitoring setup
    this.performanceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.trackPerformanceMetric(entry);
      }
    });

    // Observe different types of performance entries
    try {
      this.performanceObserver.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
    } catch (e) {
      console.warn('Performance Observer not fully supported');
    }

    // Track Core Web Vitals
    this.trackCoreWebVitals();
  }

  trackCoreWebVitals() {
    // Largest Contentful Paint
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        this.track('core_web_vital', {
          metric: 'LCP',
          value: entry.startTime,
          rating: entry.startTime < 2500 ? 'good' : entry.startTime < 4000 ? 'needs_improvement' : 'poor'
        });
      }
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        this.track('core_web_vital', {
          metric: 'FID',
          value: entry.processingStart - entry.startTime,
          rating: entry.processingStart - entry.startTime < 100 ? 'good' : 
                  entry.processingStart - entry.startTime < 300 ? 'needs_improvement' : 'poor'
        });
      }
    }).observe({ entryTypes: ['first-input'] });

    // Cumulative Layout Shift
    let clsValue = 0;
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      
      this.track('core_web_vital', {
        metric: 'CLS',
        value: clsValue,
        rating: clsValue < 0.1 ? 'good' : clsValue < 0.25 ? 'needs_improvement' : 'poor'
      });
    }).observe({ entryTypes: ['layout-shift'] });
  }

  setupWidgetEventListeners() {
    if (typeof window.EchoAI === 'undefined') {
      // Queue setup for when EchoAI is available
      const checkEchoAI = () => {
        if (typeof window.EchoAI !== 'undefined') {
          this.attachEventListeners();
        } else {
          setTimeout(checkEchoAI, 100);
        }
      };
      checkEchoAI();
    } else {
      this.attachEventListeners();
    }
  }

  attachEventListeners() {
    const EchoAI = window.EchoAI;

    // Widget lifecycle events
    EchoAI.on('ready', () => {
      this.track('widget_ready', {
        load_time: Date.now() - this.startTime,
        version: EchoAI.version || 'unknown'
      });
    });

    EchoAI.on('open', () => {
      this.track('widget_opened', {
        timestamp: Date.now()
      });
    });

    EchoAI.on('close', () => {
      this.track('widget_closed', {
        session_duration: Date.now() - this.startTime
      });
    });

    // Message events
    EchoAI.on('message-sent', (message) => {
      this.track('message_sent', {
        message_length: message.content?.length || 0,
        has_image: !!message.imageUrl,
        message_type: message.type || 'text'
      });
    });

    EchoAI.on('message-received', (message) => {
      this.track('message_received', {
        message_length: message.content?.length || 0,
        response_time: message.responseTime || null,
        has_enhanced_data: !!message.enhancedData
      });
    });

    // Streaming events
    EchoAI.on('stream-start', () => {
      this.streamStartTime = Date.now();
      this.track('stream_started');
    });

    EchoAI.on('stream-complete', () => {
      const streamDuration = Date.now() - (this.streamStartTime || Date.now());
      this.track('stream_completed', {
        duration: streamDuration
      });
    });

    EchoAI.on('stream-error', (error) => {
      this.trackError('stream_error', error);
    });

    // Feature usage events
    EchoAI.on('image-uploaded', (result) => {
      this.track('image_uploaded', {
        file_size: result.fileSize,
        file_type: result.fileType,
        upload_duration: result.uploadDuration
      });
    });

    EchoAI.on('faq-clicked', (faq) => {
      this.track('faq_clicked', {
        faq_id: faq.id,
        faq_category: faq.category,
        question_length: faq.question?.length || 0
      });
    });

    EchoAI.on('conversation-history-opened', () => {
      this.track('conversation_history_opened');
    });

    EchoAI.on('conversation-loaded', (conversation) => {
      this.track('conversation_loaded', {
        conversation_id: conversation.id,
        message_count: conversation.messages?.length || 0
      });
    });

    // Connection events
    EchoAI.on('connected', () => {
      this.track('realtime_connected');
    });

    EchoAI.on('disconnected', () => {
      this.track('realtime_disconnected');
    });

    EchoAI.on('reconnecting', () => {
      this.track('realtime_reconnecting');
    });

    // Error events
    EchoAI.on('error', (error) => {
      this.trackError('widget_error', error);
    });

    // Conversation status events
    EchoAI.on('conversation-status-changed', (status) => {
      this.track('conversation_status_changed', {
        status: status,
        timestamp: Date.now()
      });
    });

    // Escalation events
    EchoAI.on('escalation-requested', (reason) => {
      this.track('escalation_requested', {
        reason: reason,
        timestamp: Date.now()
      });
    });
  }

  track(event, properties = {}) {
    const eventData = {
      event,
      properties: {
        ...properties,
        session_id: this.sessionId,
        timestamp: Date.now(),
        user_agent: navigator.userAgent,
        url: window.location.href,
        referrer: document.referrer
      }
    };

    if (!this.isInitialized) {
      this.eventQueue.push(eventData);
      return;
    }

    if (this.analytics) {
      this.analytics.track(event, eventData.properties);
    }

    // Also send to custom endpoint if configured
    if (this.config.customEndpoint) {
      this.sendToCustomEndpoint(eventData);
    }
  }

  trackError(event, error, context = {}) {
    const errorData = {
      message: error.message || 'Unknown error',
      stack: error.stack,
      name: error.name,
      ...context
    };

    // Track as analytics event
    this.track(event, {
      error_message: errorData.message,
      error_type: errorData.name,
      ...context
    });

    // Send to error tracking service
    if (this.errorTracker) {
      this.errorTracker.captureException(error, errorData);
    }
  }

  trackPerformanceMetric(entry) {
    const metricData = {
      name: entry.name,
      type: entry.entryType,
      duration: entry.duration,
      start_time: entry.startTime
    };

    if (entry.entryType === 'resource' && entry.name.includes('echoai')) {
      this.track('widget_resource_loaded', metricData);
    } else if (entry.entryType === 'measure') {
      this.track('performance_measure', metricData);
    }
  }

  sendToCustomEndpoint(eventData) {
    if (!this.config.customEndpoint) return;

    fetch(this.config.customEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventData)
    }).catch(error => {
      console.warn('Failed to send analytics to custom endpoint:', error);
    });
  }

  processEventQueue() {
    while (this.eventQueue.length > 0) {
      const eventData = this.eventQueue.shift();
      this.track(eventData.event, eventData.properties);
    }
  }

  // User identification methods
  identifyUser(userId, traits = {}) {
    if (this.analytics && this.analytics.identify) {
      this.analytics.identify(userId, traits);
    }

    this.track('user_identified', {
      user_id: userId,
      ...traits
    });
  }

  setUserProperties(properties) {
    if (this.analytics && this.analytics.setUserProperties) {
      this.analytics.setUserProperties(properties);
    }

    this.track('user_properties_set', properties);
  }

  // A/B testing support
  trackExperiment(experimentName, variant) {
    this.track('experiment_viewed', {
      experiment_name: experimentName,
      variant: variant
    });
  }

  // Custom event tracking
  trackCustomEvent(eventName, properties = {}) {
    this.track(`custom_${eventName}`, properties);
  }

  // Session management
  startNewSession() {
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    
    this.track('session_started', {
      session_id: this.sessionId
    });
  }

  endSession() {
    this.track('session_ended', {
      session_duration: Date.now() - this.startTime
    });
  }

  // Cleanup
  destroy() {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    this.endSession();
  }
}

// Export for use in widget
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WidgetAnalytics;
} else {
  window.WidgetAnalytics = WidgetAnalytics;
}

// Auto-initialize if EchoAI is already loaded
if (typeof window !== 'undefined' && window.EchoAI) {
  window.EchoAI.analytics = new WidgetAnalytics();
}