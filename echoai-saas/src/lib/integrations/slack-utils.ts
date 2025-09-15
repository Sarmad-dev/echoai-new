import { 
  SlackConnectionResponse, 
  SlackChannelOption, 
  SlackUserOption, 
  SlackIntegration,
  RetryConfig, 
  DEFAULT_RETRY_CONFIG 
} from '@/types/slack';
import { withRetry, ErrorContext, isTransientError } from '@/lib/error-handling';

/**
 * Enhanced error types for Slack operations
 */
export class SlackError extends Error {
  constructor(
    message: string,
    public errorType: string,
    public retryAfter?: number,
    public isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'SlackError';
  }
}

export class SlackRateLimitError extends SlackError {
  constructor(retryAfter: number) {
    super(
      `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
      'rate_limited',
      retryAfter,
      true
    );
    this.name = 'SlackRateLimitError';
  }
}

export class SlackAuthError extends SlackError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'auth_failed', undefined, false);
    this.name = 'SlackAuthError';
  }
}

export class SlackPermissionError extends SlackError {
  constructor(message: string = 'Permission denied') {
    super(message, 'permission_denied', undefined, false);
    this.name = 'SlackPermissionError';
  }
}

export class SlackServiceError extends SlackError {
  constructor(message: string = 'Service unavailable') {
    super(message, 'service_unavailable', undefined, true);
    this.name = 'SlackServiceError';
  }
}

export class SlackNetworkError extends SlackError {
  constructor(message: string = 'Network error') {
    super(message, 'network_error', undefined, true);
    this.name = 'SlackNetworkError';
  }
}

/**
 * Utility class for shared Slack integration functions with enhanced error handling
 */
export class SlackConnectionUtils {
  /**
   * Get all available Slack integrations for the current user
   */
  static async getAvailableIntegrations(): Promise<SlackIntegration[]> {
    const context: ErrorContext = {
      operation: 'slack_integrations_fetch'
    };

    try {
      return await withRetry(
        async () => {
          const response = await fetch('/api/integrations/slack/integrations', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw this.createErrorFromResponse(response.status, errorData);
          }

          const data = await response.json();
          return data.integrations || [];
        },
        {
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 10000,
          backoffMultiplier: 2,
          retryCondition: (error) => this.isRetryableSlackError(error)
        },
        context
      );
    } catch (error) {
      console.error('Error fetching Slack integrations:', error);
      return [];
    }
  }

  /**
   * Check Slack connection status with enhanced error handling
   */
  static async checkConnection(integrationId?: string): Promise<SlackConnectionResponse> {
    const context: ErrorContext = {
      operation: 'slack_connection_check'
    };

    try {
      return await withRetry(
        async () => {
          const url = integrationId 
            ? `/api/integrations/slack/status?integrationId=${encodeURIComponent(integrationId)}`
            : '/api/integrations/slack/status';
          
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw this.createErrorFromResponse(response.status, errorData);
          }

          const data = await response.json();
          return data;
        },
        {
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 10000,
          backoffMultiplier: 2,
          retryCondition: (error) => this.isRetryableSlackError(error)
        },
        context
      );
    } catch (error) {
      console.error('Error checking Slack connection:', error);
      
      if (error instanceof SlackError) {
        return {
          connected: false,
          error: error.message,
          errorType: error.errorType as any,
          retryAfter: error.retryAfter,
          lastChecked: new Date().toISOString()
        };
      }

      const categorizedError = this.categorizeError(error as Error);
      return {
        connected: false,
        error: this.getConnectionErrorMessage(categorizedError),
        errorType: categorizedError as any,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Load available Slack channels with enhanced error handling
   */
  static async loadChannels(integrationId?: string): Promise<SlackChannelOption[]> {
    const context: ErrorContext = {
      operation: 'slack_channels_load'
    };

    return await withRetry(
      async () => {
        const url = integrationId 
          ? `/api/integrations/slack/channels?integrationId=${encodeURIComponent(integrationId)}`
          : '/api/integrations/slack/channels';
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw this.createErrorFromResponse(response.status, errorData);
        }

        const data = await response.json();
        return data.channels || [];
      },
      {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 8000,
        backoffMultiplier: 2,
        retryCondition: (error) => this.isRetryableSlackError(error)
      },
      context
    );
  }

  /**
   * Load available Slack users with enhanced error handling
   */
  static async loadUsers(integrationId?: string): Promise<SlackUserOption[]> {
    const context: ErrorContext = {
      operation: 'slack_users_load'
    };

    return await withRetry(
      async () => {
        const url = integrationId 
          ? `/api/integrations/slack/users?integrationId=${encodeURIComponent(integrationId)}`
          : '/api/integrations/slack/users';
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw this.createErrorFromResponse(response.status, errorData);
        }

        const data = await response.json();
        return data.users || [];
      },
      {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 8000,
        backoffMultiplier: 2,
        retryCondition: (error) => this.isRetryableSlackError(error)
      },
      context
    );
  }

  /**
   * Format channel for display in UI
   */
  static formatChannelForDisplay(channel: SlackChannelOption): string {
    const prefix = channel.isPrivate ? '🔒' : '#';
    const memberInfo = channel.memberCount ? ` (${channel.memberCount} members)` : '';
    return `${prefix}${channel.name}${memberInfo}`;
  }

  /**
   * Format user for display in UI
   */
  static formatUserForDisplay(user: SlackUserOption): string {
    const email = user.email ? ` (${user.email})` : '';
    return `@${user.displayName || user.realName}${email}`;
  }

  /**
   * Get user-friendly error message based on error type with actionable guidance
   */
  static getConnectionErrorMessage(errorType: string): string {
    const errorMessages = {
      auth_failed: 'Slack authentication has expired. Please go to Settings > Integrations and reconnect your Slack account.',
      permission_denied: 'The Slack bot doesn\'t have the required permissions. Please check that the bot has access to channels and users in your Slack workspace settings.',
      rate_limited: 'Slack API rate limit reached. Please wait a few minutes before trying again. Consider reducing the frequency of requests.',
      service_unavailable: 'Slack service is temporarily unavailable. This is usually temporary - please try again in a few minutes.',
      network_error: 'Network connection error. Please check your internet connection and try again. If the problem persists, contact your network administrator.',
      integration_not_found: 'No Slack integration found. Please go to Settings > Integrations to set up your Slack connection.',
      workspace_mismatch: 'The selected Slack workspace is no longer available. Please select a different workspace or reconnect your integration.',
      unknown: 'An unexpected error occurred. Please try refreshing the page or contact support if the issue persists.'
    };

    return errorMessages[errorType as keyof typeof errorMessages] || errorMessages.unknown;
  }

  /**
   * Get recovery instructions for specific error types
   */
  static getRecoveryInstructions(errorType: string): string[] {
    const instructions = {
      auth_failed: [
        'Go to Settings > Integrations',
        'Find your Slack integration',
        'Click "Reconnect" or "Authorize"',
        'Complete the Slack authorization flow'
      ],
      permission_denied: [
        'Go to your Slack workspace settings',
        'Navigate to Apps > Manage',
        'Find the EchoAI bot',
        'Ensure it has permissions for channels and users',
        'Try the operation again'
      ],
      rate_limited: [
        'Wait for the rate limit to reset (usually 1-5 minutes)',
        'Reduce the frequency of requests',
        'Try again after the waiting period'
      ],
      service_unavailable: [
        'Wait a few minutes for Slack services to recover',
        'Check Slack status page for known issues',
        'Try the operation again'
      ],
      network_error: [
        'Check your internet connection',
        'Try refreshing the page',
        'Contact your network administrator if issues persist'
      ],
      integration_not_found: [
        'Go to Settings > Integrations',
        'Click "Add Integration"',
        'Select Slack and complete setup',
        'Return to configure your action'
      ]
    };

    return instructions[errorType as keyof typeof instructions] || [
      'Try refreshing the page',
      'Check your internet connection',
      'Contact support if the issue persists'
    ];
  }

  /**
   * Determine if connection should be retried based on error type
   */
  static shouldRetryConnection(errorType: string): boolean {
    return DEFAULT_RETRY_CONFIG.retryableErrors.includes(errorType);
  }

  /**
   * Implement retry logic with exponential backoff
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig = DEFAULT_RETRY_CONFIG
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === config.maxAttempts) {
          throw lastError;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        );

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Check if error is retryable
   */
  static isRetryableError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    return DEFAULT_RETRY_CONFIG.retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError.replace('_', ' '))
    );
  }

  /**
   * Parse error response and categorize error type with enhanced detection
   */
  static categorizeError(error: Error): string {
    const message = error.message.toLowerCase();
    
    // Authentication errors
    if (message.includes('unauthorized') || message.includes('401') || 
        message.includes('invalid_auth') || message.includes('token_revoked')) {
      return 'auth_failed';
    }
    
    // Permission errors
    if (message.includes('forbidden') || message.includes('403') || 
        message.includes('missing_scope') || message.includes('not_allowed')) {
      return 'permission_denied';
    }
    
    // Rate limiting
    if (message.includes('rate limit') || message.includes('429') || 
        message.includes('rate_limited') || message.includes('too_many_requests')) {
      return 'rate_limited';
    }
    
    // Service availability
    if (message.includes('service unavailable') || message.includes('502') || 
        message.includes('503') || message.includes('504') || 
        message.includes('bad gateway') || message.includes('gateway timeout')) {
      return 'service_unavailable';
    }
    
    // Network errors
    if (message.includes('network') || message.includes('fetch') || 
        message.includes('timeout') || message.includes('connection') ||
        message.includes('dns') || message.includes('unreachable')) {
      return 'network_error';
    }
    
    // Integration specific errors
    if (message.includes('integration not found') || message.includes('no integration')) {
      return 'integration_not_found';
    }
    
    if (message.includes('workspace') && message.includes('mismatch')) {
      return 'workspace_mismatch';
    }
    
    return 'unknown';
  }

  /**
   * Create appropriate error from HTTP response
   */
  static createErrorFromResponse(status: number, errorData: any): SlackError {
    const message = errorData?.error || errorData?.message || `HTTP ${status}`;
    const retryAfter = errorData?.retryAfter || (status === 429 ? 60 : undefined);

    switch (status) {
      case 401:
        return new SlackAuthError(message);
      case 403:
        return new SlackPermissionError(message);
      case 429:
        return new SlackRateLimitError(retryAfter || 60);
      case 502:
      case 503:
      case 504:
        return new SlackServiceError(message);
      default:
        if (status >= 500) {
          return new SlackServiceError(message);
        }
        return new SlackError(message, this.categorizeError(new Error(message)));
    }
  }

  /**
   * Check if a Slack error is retryable
   */
  static isRetryableSlackError(error: unknown): boolean {
    if (error instanceof SlackError) {
      return error.isRetryable;
    }
    
    if (error instanceof Error) {
      const errorType = this.categorizeError(error);
      return DEFAULT_RETRY_CONFIG.retryableErrors.includes(errorType);
    }
    
    return isTransientError(error);
  }

  /**
   * Enhanced retry with Slack-specific logic
   */
  static async withSlackRetry<T>(
    operation: () => Promise<T>,
    context?: ErrorContext
  ): Promise<T> {
    return await withRetry(
      operation,
      {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        jitter: true,
        retryCondition: (error) => this.isRetryableSlackError(error)
      },
      context
    );
  }

  /**
   * Handle rate limiting with proper backoff
   */
  static async handleRateLimit(retryAfter: number): Promise<void> {
    const waitTime = Math.min(retryAfter * 1000, 300000); // Max 5 minutes
    console.warn(`Rate limited. Waiting ${waitTime}ms before retry.`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  /**
   * Graceful degradation for connection failures
   */
  static async withGracefulDegradation<T>(
    operation: () => Promise<T>,
    fallback: T,
    context?: ErrorContext
  ): Promise<T> {
    try {
      return await this.withSlackRetry(operation, context);
    } catch (error) {
      console.warn('Operation failed, using fallback:', error);
      return fallback;
    }
  }

  /**
   * Check if cached data should be used during errors
   */
  static shouldUseCachedData(errorType: string): boolean {
    const cacheableErrors = ['rate_limited', 'service_unavailable', 'network_error'];
    return cacheableErrors.includes(errorType);
  }
}