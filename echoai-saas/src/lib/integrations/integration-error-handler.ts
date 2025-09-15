/**
 * Integration Error Handler
 * 
 * Provides comprehensive error handling for integration services
 * with provider-specific error messages and suggested actions.
 */

import { IntegrationErrorCode } from './hubspot-connection-validator';

export class IntegrationErrorHandler {
  /**
   * Get user-friendly error message for a specific provider and error code
   */
  static getErrorMessage(provider: string, errorCode: IntegrationErrorCode): string {
    const messages = {
      hubspot: {
        [IntegrationErrorCode.AUTH_EXPIRED]: 'Your HubSpot authentication has expired. Please reconnect your account.',
        [IntegrationErrorCode.AUTH_INVALID]: 'Your HubSpot authentication is invalid. Please reconnect your account.',
        [IntegrationErrorCode.AUTH_REQUIRED]: 'HubSpot authentication is required. Please connect your account.',
        [IntegrationErrorCode.INSUFFICIENT_PERMISSIONS]: 'Your HubSpot account lacks the necessary permissions. Please ensure you have access to the required features.',
        [IntegrationErrorCode.SCOPE_MISSING]: 'Required HubSpot permissions are missing. Please reconnect with the necessary scopes.',
        [IntegrationErrorCode.RATE_LIMITED]: 'HubSpot API rate limit reached. Please try again in a few minutes.',
        [IntegrationErrorCode.SERVICE_UNAVAILABLE]: 'HubSpot service is temporarily unavailable. Please try again later.',
        [IntegrationErrorCode.API_ERROR]: 'HubSpot API error occurred. Please try again.',
        [IntegrationErrorCode.INVALID_CONFIG]: 'HubSpot integration configuration is invalid. Please check your settings.',
        [IntegrationErrorCode.MISSING_CONFIG]: 'HubSpot integration configuration is missing. Please complete the setup.',
        [IntegrationErrorCode.NETWORK_ERROR]: 'Network connection to HubSpot failed. Please check your internet connection.',
        [IntegrationErrorCode.TIMEOUT]: 'HubSpot request timed out. Please try again.',
        [IntegrationErrorCode.CONNECTION_FAILED]: 'Failed to connect to HubSpot. Please try again.'
      },
      google: {
        [IntegrationErrorCode.AUTH_EXPIRED]: 'Your Google authentication has expired. Please reconnect your account.',
        [IntegrationErrorCode.AUTH_INVALID]: 'Your Google authentication is invalid. Please reconnect your account.',
        [IntegrationErrorCode.AUTH_REQUIRED]: 'Google authentication is required. Please connect your account.',
        [IntegrationErrorCode.INSUFFICIENT_PERMISSIONS]: 'Insufficient Google Drive/Sheets permissions. Please ensure you\'ve granted the necessary access.',
        [IntegrationErrorCode.SCOPE_MISSING]: 'Required Google permissions are missing. Please reconnect with the necessary scopes.',
        [IntegrationErrorCode.RATE_LIMITED]: 'Google API rate limit reached. Please try again later.',
        [IntegrationErrorCode.SERVICE_UNAVAILABLE]: 'Google Sheets service is temporarily unavailable. Please try again later.',
        [IntegrationErrorCode.API_ERROR]: 'Google API error occurred. Please try again.',
        [IntegrationErrorCode.INVALID_CONFIG]: 'Google integration configuration is invalid. Please check your settings.',
        [IntegrationErrorCode.MISSING_CONFIG]: 'Google integration configuration is missing. Please complete the setup.',
        [IntegrationErrorCode.NETWORK_ERROR]: 'Network connection to Google failed. Please check your internet connection.',
        [IntegrationErrorCode.TIMEOUT]: 'Google request timed out. Please try again.',
        [IntegrationErrorCode.CONNECTION_FAILED]: 'Failed to connect to Google Sheets. Please try again.'
      },
      slack: {
        [IntegrationErrorCode.AUTH_EXPIRED]: 'Your Slack authentication has expired. Please reconnect your workspace.',
        [IntegrationErrorCode.AUTH_INVALID]: 'Your Slack authentication is invalid. Please reconnect your workspace.',
        [IntegrationErrorCode.AUTH_REQUIRED]: 'Slack authentication is required. Please connect your workspace.',
        [IntegrationErrorCode.INSUFFICIENT_PERMISSIONS]: 'Insufficient Slack permissions. Please ensure the app has the necessary permissions in your workspace.',
        [IntegrationErrorCode.SCOPE_MISSING]: 'Required Slack permissions are missing. Please reinstall the app with the necessary scopes.',
        [IntegrationErrorCode.RATE_LIMITED]: 'Slack API rate limit reached. Please try again in a few minutes.',
        [IntegrationErrorCode.SERVICE_UNAVAILABLE]: 'Slack service is temporarily unavailable. Please try again later.',
        [IntegrationErrorCode.API_ERROR]: 'Slack API error occurred. Please try again.',
        [IntegrationErrorCode.INVALID_CONFIG]: 'Slack integration configuration is invalid. Please check your settings.',
        [IntegrationErrorCode.MISSING_CONFIG]: 'Slack integration configuration is missing. Please complete the setup.',
        [IntegrationErrorCode.NETWORK_ERROR]: 'Network connection to Slack failed. Please check your internet connection.',
        [IntegrationErrorCode.TIMEOUT]: 'Slack request timed out. Please try again.',
        [IntegrationErrorCode.CONNECTION_FAILED]: 'Failed to connect to Slack. Please try again.'
      }
    };

    const providerMessages = messages[provider as keyof typeof messages];
    if (!providerMessages) {
      return 'An unexpected error occurred with your integration. Please try again.';
    }

    return providerMessages[errorCode] || 'An unexpected error occurred. Please try again.';
  }

  /**
   * Get suggested action for resolving an error
   */
  static getSuggestedAction(errorCode: IntegrationErrorCode): string {
    const actions = {
      [IntegrationErrorCode.AUTH_EXPIRED]: 'Click the "Reconnect" button to authenticate again.',
      [IntegrationErrorCode.AUTH_INVALID]: 'Click the "Reconnect" button to authenticate again.',
      [IntegrationErrorCode.AUTH_REQUIRED]: 'Click the "Connect" button to authenticate with the service.',
      [IntegrationErrorCode.INSUFFICIENT_PERMISSIONS]: 'Check your account permissions and try reconnecting with the necessary access.',
      [IntegrationErrorCode.SCOPE_MISSING]: 'Reconnect your account and ensure all required permissions are granted.',
      [IntegrationErrorCode.RATE_LIMITED]: 'Wait a few minutes before trying again. Consider upgrading your plan for higher rate limits.',
      [IntegrationErrorCode.SERVICE_UNAVAILABLE]: 'Check the service status page and try again later.',
      [IntegrationErrorCode.API_ERROR]: 'Try again in a few moments. If the issue persists, contact support.',
      [IntegrationErrorCode.INVALID_CONFIG]: 'Review your integration settings and update any invalid configurations.',
      [IntegrationErrorCode.MISSING_CONFIG]: 'Complete the integration setup by providing all required configuration.',
      [IntegrationErrorCode.NETWORK_ERROR]: 'Check your internet connection and try again.',
      [IntegrationErrorCode.TIMEOUT]: 'Try again with a stable internet connection.',
      [IntegrationErrorCode.CONNECTION_FAILED]: 'Try again or contact support if the issue persists.'
    };

    return actions[errorCode] || 'Please try again or contact support if the issue persists.';
  }

  /**
   * Get error severity level
   */
  static getErrorSeverity(errorCode: IntegrationErrorCode): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap = {
      [IntegrationErrorCode.AUTH_EXPIRED]: 'medium' as const,
      [IntegrationErrorCode.AUTH_INVALID]: 'high' as const,
      [IntegrationErrorCode.AUTH_REQUIRED]: 'medium' as const,
      [IntegrationErrorCode.INSUFFICIENT_PERMISSIONS]: 'high' as const,
      [IntegrationErrorCode.SCOPE_MISSING]: 'high' as const,
      [IntegrationErrorCode.RATE_LIMITED]: 'low' as const,
      [IntegrationErrorCode.SERVICE_UNAVAILABLE]: 'medium' as const,
      [IntegrationErrorCode.API_ERROR]: 'medium' as const,
      [IntegrationErrorCode.INVALID_CONFIG]: 'high' as const,
      [IntegrationErrorCode.MISSING_CONFIG]: 'high' as const,
      [IntegrationErrorCode.NETWORK_ERROR]: 'low' as const,
      [IntegrationErrorCode.TIMEOUT]: 'low' as const,
      [IntegrationErrorCode.CONNECTION_FAILED]: 'medium' as const
    };

    return severityMap[errorCode] || 'medium';
  }

  /**
   * Check if error requires user action
   */
  static requiresUserAction(errorCode: IntegrationErrorCode): boolean {
    const userActionRequired = [
      IntegrationErrorCode.AUTH_EXPIRED,
      IntegrationErrorCode.AUTH_INVALID,
      IntegrationErrorCode.AUTH_REQUIRED,
      IntegrationErrorCode.INSUFFICIENT_PERMISSIONS,
      IntegrationErrorCode.SCOPE_MISSING,
      IntegrationErrorCode.INVALID_CONFIG,
      IntegrationErrorCode.MISSING_CONFIG
    ];

    return userActionRequired.includes(errorCode);
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(errorCode: IntegrationErrorCode): boolean {
    const retryableErrors = [
      IntegrationErrorCode.RATE_LIMITED,
      IntegrationErrorCode.SERVICE_UNAVAILABLE,
      IntegrationErrorCode.API_ERROR,
      IntegrationErrorCode.NETWORK_ERROR,
      IntegrationErrorCode.TIMEOUT,
      IntegrationErrorCode.CONNECTION_FAILED
    ];

    return retryableErrors.includes(errorCode);
  }

  /**
   * Get retry delay in milliseconds for retryable errors
   */
  static getRetryDelay(errorCode: IntegrationErrorCode, attempt: number = 1): number {
    const baseDelays: Partial<Record<IntegrationErrorCode, number>> = {
      [IntegrationErrorCode.RATE_LIMITED]: 60000, // 1 minute
      [IntegrationErrorCode.SERVICE_UNAVAILABLE]: 30000, // 30 seconds
      [IntegrationErrorCode.API_ERROR]: 5000, // 5 seconds
      [IntegrationErrorCode.NETWORK_ERROR]: 2000, // 2 seconds
      [IntegrationErrorCode.TIMEOUT]: 3000, // 3 seconds
      [IntegrationErrorCode.CONNECTION_FAILED]: 5000 // 5 seconds
    };

    const baseDelay = baseDelays[errorCode] || 5000;
    
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    
    return Math.min(exponentialDelay + jitter, 300000); // Cap at 5 minutes
  }

  /**
   * Format error for logging
   */
  static formatErrorForLogging(
    provider: string,
    errorCode: IntegrationErrorCode,
    originalError?: Error,
    context?: Record<string, any>
  ): Record<string, any> {
    return {
      provider,
      errorCode,
      message: this.getErrorMessage(provider, errorCode),
      severity: this.getErrorSeverity(errorCode),
      requiresUserAction: this.requiresUserAction(errorCode),
      isRetryable: this.isRetryable(errorCode),
      originalError: originalError ? {
        name: originalError.name,
        message: originalError.message,
        stack: originalError.stack
      } : undefined,
      context,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create a standardized error response
   */
  static createErrorResponse(
    provider: string,
    errorCode: IntegrationErrorCode,
    originalError?: Error
  ) {
    return {
      success: false,
      error: this.getErrorMessage(provider, errorCode),
      errorCode,
      requiresAuth: [
        IntegrationErrorCode.AUTH_EXPIRED,
        IntegrationErrorCode.AUTH_INVALID,
        IntegrationErrorCode.AUTH_REQUIRED
      ].includes(errorCode),
      suggestedAction: this.getSuggestedAction(errorCode),
      severity: this.getErrorSeverity(errorCode),
      isRetryable: this.isRetryable(errorCode),
      retryDelay: this.isRetryable(errorCode) ? this.getRetryDelay(errorCode) : undefined
    };
  }
}