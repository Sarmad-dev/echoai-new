/**
 * Comprehensive Error Handling Utilities
 *
 * Provides centralized error handling, retry logic, and monitoring
 * for the EchoAI automation platform.
 */

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryCondition?: (error: unknown) => boolean;
}

export interface ErrorContext {
  operation: string;
  userId?: string;
  chatbotId?: string;
  workflowId?: string;
  executionId?: string;
  metadata?: Record<string, unknown>;
}

export class RetryableError extends Error {
  constructor(message: string, public isRetryable: boolean = true) {
    super(message);
    this.name = "RetryableError";
  }
}

export class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentError";
  }
}

/**
 * Executes a function with exponential backoff retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {},
  context?: ErrorContext
): Promise<T> {
  const config: RetryOptions = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
    ...options,
  };

  let lastError: Error = new Error("Operation failed after all retry attempts");

  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry for permanent errors
      if (error instanceof PermanentError) {
        throw error;
      }

      // Check custom retry condition
      if (config.retryCondition && !config.retryCondition(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt > config.maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      let delay =
        config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);

      // Add jitter to prevent thundering herd
      if (config.jitter) {
        delay += Math.random() * 1000;
      }

      // Cap at max delay
      delay = Math.min(delay, config.maxDelay);

      console.warn(
        `Operation failed on attempt ${attempt}/${
          config.maxRetries + 1
        }, retrying in ${delay}ms:`,
        {
          error: lastError.message,
          context,
        }
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Determines if an error is transient and should be retried
 */
export function isTransientError(error: unknown): boolean {
  if (!error) return false;

  // Check error types
  if (error instanceof PermanentError) return false;
  if (error instanceof RetryableError) return error.isRetryable;

  // Check error messages for common transient patterns
  const message = (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') 
    ? error.message.toLowerCase() 
    : "";
  const transientPatterns = [
    "timeout",
    "connection",
    "network",
    "temporary",
    "rate limit",
    "throttle",
    "service unavailable",
    "internal server error",
    "bad gateway",
    "gateway timeout",
  ];

  return transientPatterns.some((pattern) => message.includes(pattern));
}

/**
 * Database-specific retry condition
 */
export function isDatabaseRetryable(error: unknown): boolean {
  if (!isTransientError(error)) return false;

  // Database-specific error codes that are retryable
  const retryableCodes = [
    "CONNECTION_ERROR",
    "TIMEOUT",
    "TEMPORARY_FAILURE",
    "RATE_LIMITED",
  ];

  const errorCode = (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') 
    ? error.code 
    : '';
  return retryableCodes.includes(errorCode) || isTransientError(error);
}

/**
 * Workflow execution retry condition
 */
export function isWorkflowRetryable(error: unknown): boolean {
  if (!isTransientError(error)) return false;

  // Don't retry validation or configuration errors
  const nonRetryablePatterns = [
    "validation",
    "configuration",
    "invalid",
    "unauthorized",
    "forbidden",
    "not found",
  ];

  const message = (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') 
    ? error.message.toLowerCase() 
    : "";
  return !nonRetryablePatterns.some((pattern) => message.includes(pattern));
}

/**
 * Circuit breaker for preventing cascading failures
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";

  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = "HALF_OPEN";
      } else {
        throw new PermanentError("Circuit breaker is OPEN");
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = "CLOSED";
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = "OPEN";
    }
  }

  getState(): string {
    return this.state;
  }

  getFailureCount(): number {
    return this.failures;
  }
}

/**
 * Error monitoring and alerting
 */
export class ErrorMonitor {
  private static instance: ErrorMonitor;
  private errorCounts = new Map<string, number>();
  private lastReset = Date.now();
  private readonly resetInterval = 3600000; // 1 hour

  static getInstance(): ErrorMonitor {
    if (!ErrorMonitor.instance) {
      ErrorMonitor.instance = new ErrorMonitor();
    }
    return ErrorMonitor.instance;
  }

  recordError(error: Error, context?: ErrorContext): void {
    const key = `${context?.operation || "unknown"}:${error.name}`;

    // Reset counts periodically
    if (Date.now() - this.lastReset > this.resetInterval) {
      this.errorCounts.clear();
      this.lastReset = Date.now();
    }

    const count = (this.errorCounts.get(key) || 0) + 1;
    this.errorCounts.set(key, count);

    // Log error with context
    console.error("Error recorded:", {
      error: {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      context,
      count,
    });

    // Alert on high error rates
    if (count >= 10) {
      this.sendAlert(error, context, count);
    }
  }

  private async sendAlert(
    error: Error,
    context?: ErrorContext,
    count?: number
  ): Promise<void> {
    try {
      // In production, send to monitoring service
      console.error("HIGH ERROR RATE ALERT:", {
        error: error.message,
        context,
        count,
        timestamp: new Date().toISOString(),
      });

      // Could integrate with services like:
      // - Sentry
      // - DataDog
      // - New Relic
      // - Custom webhook
    } catch (alertError) {
      console.error("Failed to send error alert:", alertError);
    }
  }

  getErrorStats(): Record<string, number> {
    return Object.fromEntries(this.errorCounts);
  }
}

/**
 * Utility function to wrap operations with comprehensive error handling
 */
export async function safeExecute<T>(
  operation: () => Promise<T>,
  options: {
    retryOptions?: Partial<RetryOptions>;
    context?: ErrorContext;
    circuitBreaker?: CircuitBreaker;
    monitor?: boolean;
  } = {}
): Promise<T> {
  const { retryOptions, context, circuitBreaker, monitor = true } = options;
  const errorMonitor = monitor ? ErrorMonitor.getInstance() : null;

  const wrappedOperation = async () => {
    try {
      if (circuitBreaker) {
        return await circuitBreaker.execute(operation);
      } else {
        return await operation();
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (errorMonitor) {
        errorMonitor.recordError(err, context);
      }

      throw err;
    }
  };

  if (retryOptions) {
    return await withRetry(wrappedOperation, retryOptions, context);
  } else {
    return await wrappedOperation();
  }
}
