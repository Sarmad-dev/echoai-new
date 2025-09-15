import { useState, useCallback, useEffect } from 'react';
import { SlackConnectionUtils, SlackError } from '@/lib/integrations/slack-utils';

export interface SlackErrorState {
  error?: string;
  errorType?: string;
  isRetryable?: boolean;
  retryAfter?: number;
  recoveryInstructions?: string[];
  retryCount: number;
  lastRetryAt?: Date;
}

export interface SlackErrorHandlingOptions {
  maxRetries?: number;
  autoRetry?: boolean;
  autoRetryDelay?: number;
  onMaxRetriesReached?: (error: SlackErrorState) => void;
  onRecovery?: () => void;
}

/**
 * Comprehensive error handling hook for Slack operations
 */
export function useSlackErrorHandling(options: SlackErrorHandlingOptions = {}) {
  const {
    maxRetries = 3,
    autoRetry = false,
    autoRetryDelay = 5000,
    onMaxRetriesReached,
    onRecovery
  } = options;

  const [errorState, setErrorState] = useState<SlackErrorState>({
    retryCount: 0
  });

  const [isRetrying, setIsRetrying] = useState(false);

  // Clear error state
  const clearError = useCallback(() => {
    setErrorState({ retryCount: 0 });
    setIsRetrying(false);
  }, []);

  // Handle error with comprehensive categorization
  const handleError = useCallback((error: unknown) => {
    let errorType: string;
    let errorMessage: string;
    let isRetryable: boolean;
    let retryAfter: number | undefined;

    if (error instanceof SlackError) {
      errorType = error.errorType;
      errorMessage = error.message;
      isRetryable = error.isRetryable;
      retryAfter = error.retryAfter;
    } else if (error instanceof Error) {
      errorType = SlackConnectionUtils.categorizeError(error);
      errorMessage = SlackConnectionUtils.getConnectionErrorMessage(errorType);
      isRetryable = SlackConnectionUtils.isRetryableSlackError(error);
    } else {
      errorType = 'unknown';
      errorMessage = 'An unexpected error occurred';
      isRetryable = false;
    }

    const recoveryInstructions = SlackConnectionUtils.getRecoveryInstructions(errorType);

    setErrorState(prev => ({
      error: errorMessage,
      errorType,
      isRetryable,
      retryAfter,
      recoveryInstructions,
      retryCount: prev.retryCount + 1,
      lastRetryAt: new Date()
    }));

    // Check if max retries reached
    if (errorState.retryCount >= maxRetries && onMaxRetriesReached) {
      onMaxRetriesReached({
        error: errorMessage,
        errorType,
        isRetryable,
        retryAfter,
        recoveryInstructions,
        retryCount: errorState.retryCount + 1,
        lastRetryAt: new Date()
      });
    }
  }, [errorState.retryCount, maxRetries, onMaxRetriesReached]);

  // Execute operation with error handling
  const executeWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    operationName?: string
  ): Promise<T | null> => {
    try {
      setIsRetrying(false);
      const result = await operation();
      
      // Clear error on success
      if (errorState.error) {
        clearError();
        onRecovery?.();
      }
      
      return result;
    } catch (error) {
      console.error(`Slack operation failed${operationName ? ` (${operationName})` : ''}:`, error);
      handleError(error);
      return null;
    }
  }, [errorState.error, clearError, handleError, onRecovery]);

  // Manual retry function
  const retry = useCallback(async <T>(
    operation: () => Promise<T>,
    operationName?: string
  ): Promise<T | null> => {
    if (!errorState.isRetryable || errorState.retryCount >= maxRetries) {
      return null;
    }

    setIsRetrying(true);
    
    // Wait for retry delay if specified
    if (errorState.retryAfter && errorState.retryAfter > 0) {
      await new Promise(resolve => setTimeout(resolve, errorState.retryAfter! * 1000));
    }

    return executeWithErrorHandling(operation, operationName);
  }, [errorState.isRetryable, errorState.retryCount, errorState.retryAfter, maxRetries, executeWithErrorHandling]);

  // Auto retry effect
  useEffect(() => {
    if (!autoRetry || !errorState.isRetryable || errorState.retryCount >= maxRetries || isRetrying) {
      return;
    }

    const delay = errorState.retryAfter ? errorState.retryAfter * 1000 : autoRetryDelay;
    
    const timer = setTimeout(() => {
      setIsRetrying(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [autoRetry, errorState.isRetryable, errorState.retryCount, errorState.retryAfter, maxRetries, autoRetryDelay, isRetrying]);

  // Check if operation can be retried
  const canRetry = errorState.isRetryable && errorState.retryCount < maxRetries && !isRetrying;

  // Check if we should show retry countdown
  const shouldShowCountdown = errorState.retryAfter && errorState.retryAfter > 0;

  return {
    errorState,
    isRetrying,
    canRetry,
    shouldShowCountdown,
    clearError,
    handleError,
    executeWithErrorHandling,
    retry
  };
}

/**
 * Specialized hook for connection status with automatic retry
 */
export function useSlackConnectionErrorHandling() {
  return useSlackErrorHandling({
    maxRetries: 3,
    autoRetry: true,
    autoRetryDelay: 5000
  });
}

/**
 * Specialized hook for data loading with limited retry
 */
export function useSlackDataErrorHandling() {
  return useSlackErrorHandling({
    maxRetries: 2,
    autoRetry: false
  });
}

/**
 * Hook for handling rate limiting with proper backoff
 */
export function useSlackRateLimitHandling() {
  const [rateLimitState, setRateLimitState] = useState<{
    isRateLimited: boolean;
    retryAfter: number;
    canRetry: boolean;
  }>({
    isRateLimited: false,
    retryAfter: 0,
    canRetry: true
  });

  const handleRateLimit = useCallback((retryAfter: number) => {
    setRateLimitState({
      isRateLimited: true,
      retryAfter,
      canRetry: false
    });

    // Start countdown
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, retryAfter - elapsed);
      
      setRateLimitState(prev => ({
        ...prev,
        retryAfter: remaining,
        canRetry: remaining === 0
      }));

      if (remaining === 0) {
        clearInterval(interval);
        setRateLimitState(prev => ({
          ...prev,
          isRateLimited: false
        }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const clearRateLimit = useCallback(() => {
    setRateLimitState({
      isRateLimited: false,
      retryAfter: 0,
      canRetry: true
    });
  }, []);

  return {
    rateLimitState,
    handleRateLimit,
    clearRateLimit
  };
}