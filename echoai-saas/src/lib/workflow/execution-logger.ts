/**
 * Workflow Execution Logger
 * 
 * Provides comprehensive logging and error handling for workflow executions
 * with structured logging, performance metrics, and error recovery.
 */

import type { ExecutionLog, ExecutionResult, TriggerEvent } from '../workflow-execution-engine';
import type { AutomationWorkflow, WorkflowExecution, ExecutionStatus } from '../../types/database';

export interface LogEntry {
  id: string;
  executionId: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  nodeId?: string;
  nodeType?: string;
  data?: Record<string, unknown>;
  duration?: number; // milliseconds
  error?: ErrorDetails;
}

export interface ErrorDetails {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  retryable: boolean;
  context?: Record<string, unknown>;
}

export interface ExecutionMetrics {
  executionId: string;
  workflowId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
  retriesAttempted: number;
  memoryUsage?: number;
  cpuTime?: number;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  retryableErrors: string[];
}

export class WorkflowExecutionLogger {
  private logs: Map<string, LogEntry[]> = new Map();
  private metrics: Map<string, ExecutionMetrics> = new Map();
  private retryPolicies: Map<string, RetryPolicy> = new Map();

  constructor() {
    // Set default retry policies
    this.setDefaultRetryPolicies();
  }

  /**
   * Starts logging for a new execution
   */
  startExecution(
    executionId: string,
    workflowId: string,
    triggerEvent: TriggerEvent,
    workflow: AutomationWorkflow
  ): void {
    const startTime = new Date();
    
    // Initialize logs array
    this.logs.set(executionId, []);
    
    // Initialize metrics
    this.metrics.set(executionId, {
      executionId,
      workflowId,
      startTime,
      totalNodes: workflow.flowDefinition.nodes.length,
      completedNodes: 0,
      failedNodes: 0,
      retriesAttempted: 0
    });

    this.log(executionId, 'info', 'Workflow execution started', undefined, undefined, {
      workflowId,
      workflowName: workflow.name,
      triggerType: triggerEvent.type,
      triggerData: triggerEvent.data,
      totalNodes: workflow.flowDefinition.nodes.length
    });
  }

  /**
   * Logs a message for an execution
   */
  log(
    executionId: string,
    level: LogEntry['level'],
    message: string,
    nodeId?: string,
    nodeType?: string,
    data?: Record<string, unknown>,
    error?: Error,
    duration?: number
  ): void {
    const logs = this.logs.get(executionId) || [];
    
    const logEntry: LogEntry = {
      id: this.generateLogId(),
      executionId,
      timestamp: new Date(),
      level,
      message,
      nodeId,
      nodeType,
      data,
      duration,
      error: error ? this.serializeError(error) : undefined
    };

    logs.push(logEntry);
    this.logs.set(executionId, logs);

    // Update metrics
    this.updateMetrics(executionId, level, nodeId, duration);

    // Console logging for development
    this.consoleLog(logEntry);

    // In production, you would send this to your logging service
    this.persistLog(logEntry);
  }

  /**
   * Logs node execution start
   */
  logNodeStart(executionId: string, nodeId: string, nodeType: string, config: Record<string, unknown>): void {
    this.log(
      executionId,
      'info',
      `Starting ${nodeType} node execution`,
      nodeId,
      nodeType,
      { config }
    );
  }

  /**
   * Logs node execution success
   */
  logNodeSuccess(
    executionId: string,
    nodeId: string,
    nodeType: string,
    result: Record<string, unknown>,
    duration: number
  ): void {
    this.log(
      executionId,
      'info',
      `${nodeType} node completed successfully`,
      nodeId,
      nodeType,
      { result },
      undefined,
      duration
    );

    // Update completed nodes count
    const metrics = this.metrics.get(executionId);
    if (metrics) {
      metrics.completedNodes++;
      this.metrics.set(executionId, metrics);
    }
  }

  /**
   * Logs node execution failure
   */
  logNodeFailure(
    executionId: string,
    nodeId: string,
    nodeType: string,
    error: Error,
    duration: number,
    willRetry: boolean = false
  ): void {
    this.log(
      executionId,
      willRetry ? 'warn' : 'error',
      `${nodeType} node ${willRetry ? 'failed (will retry)' : 'failed'}`,
      nodeId,
      nodeType,
      { willRetry },
      error,
      duration
    );

    // Update failed nodes count
    const metrics = this.metrics.get(executionId);
    if (metrics) {
      if (!willRetry) {
        metrics.failedNodes++;
      }
      this.metrics.set(executionId, metrics);
    }
  }

  /**
   * Logs retry attempt
   */
  logRetryAttempt(
    executionId: string,
    nodeId: string,
    nodeType: string,
    attemptNumber: number,
    delay: number
  ): void {
    this.log(
      executionId,
      'warn',
      `Retrying ${nodeType} node (attempt ${attemptNumber})`,
      nodeId,
      nodeType,
      { attemptNumber, delay }
    );

    // Update retry count
    const metrics = this.metrics.get(executionId);
    if (metrics) {
      metrics.retriesAttempted++;
      this.metrics.set(executionId, metrics);
    }
  }

  /**
   * Completes execution logging
   */
  completeExecution(
    executionId: string,
    status: ExecutionStatus,
    finalResult?: Record<string, unknown>,
    error?: Error
  ): ExecutionResult {
    const endTime = new Date();
    const logs = this.logs.get(executionId) || [];
    const metrics = this.metrics.get(executionId);

    if (metrics) {
      metrics.endTime = endTime;
      metrics.duration = endTime.getTime() - metrics.startTime.getTime();
      this.metrics.set(executionId, metrics);
    }

    this.log(
      executionId,
      status === 'COMPLETED' ? 'info' : 'error',
      `Workflow execution ${status.toLowerCase()}`,
      undefined,
      undefined,
      {
        status,
        duration: metrics?.duration,
        completedNodes: metrics?.completedNodes,
        failedNodes: metrics?.failedNodes,
        retriesAttempted: metrics?.retriesAttempted,
        finalResult
      },
      error
    );

    // Create execution result
    const result: ExecutionResult = {
      executionId,
      status,
      startedAt: metrics?.startTime || new Date(),
      completedAt: endTime,
      logs: logs.map(this.convertToExecutionLog),
      error: error?.message
    };

    // Persist final execution record
    this.persistExecutionResult(result, metrics);

    // Cleanup in-memory data
    this.cleanup(executionId);

    return result;
  }

  /**
   * Gets current logs for an execution
   */
  getLogs(executionId: string): LogEntry[] {
    return this.logs.get(executionId) || [];
  }

  /**
   * Gets execution metrics
   */
  getMetrics(executionId: string): ExecutionMetrics | undefined {
    return this.metrics.get(executionId);
  }

  /**
   * Determines if an error is retryable
   */
  isRetryableError(error: Error, nodeType: string): boolean {
    const retryPolicy = this.retryPolicies.get(nodeType) || this.retryPolicies.get('default');
    if (!retryPolicy) return false;

    // Check if error type is in retryable list
    const errorName = error.name || error.constructor.name;
    const errorMessage = error.message.toLowerCase();
    
    return retryPolicy.retryableErrors.includes(errorName) ||
           retryPolicy.retryableErrors.includes('*') ||
           this.isNetworkError(error) ||
           this.isTemporaryError(error) ||
           errorMessage.includes('network') ||
           errorMessage.includes('timeout') ||
           errorMessage.includes('rate limit');
  }

  /**
   * Calculates retry delay based on policy
   */
  calculateRetryDelay(attemptNumber: number, nodeType: string): number {
    const retryPolicy = this.retryPolicies.get(nodeType) || this.retryPolicies.get('default')!;
    
    let delay: number;
    
    switch (retryPolicy.backoffStrategy) {
      case 'exponential':
        delay = retryPolicy.baseDelay * Math.pow(2, attemptNumber - 1);
        break;
      case 'linear':
        delay = retryPolicy.baseDelay * attemptNumber;
        break;
      case 'fixed':
      default:
        delay = retryPolicy.baseDelay;
        break;
    }

    return Math.min(delay, retryPolicy.maxDelay);
  }

  /**
   * Sets retry policy for a node type
   */
  setRetryPolicy(nodeType: string, policy: RetryPolicy): void {
    this.retryPolicies.set(nodeType, policy);
  }

  /**
   * Convenience method for logging info messages
   */
  logInfo(executionId: string, message: string, data?: Record<string, unknown>): void {
    this.log(executionId, 'info', message, undefined, undefined, data);
  }

  /**
   * Convenience method for logging error messages
   */
  logError(executionId: string, message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    this.log(executionId, 'error', message, undefined, undefined, data, errorObj);
  }

  /**
   * Gets execution summary for analytics
   */
  getExecutionSummary(executionId: string): {
    logs: LogEntry[];
    metrics: ExecutionMetrics | undefined;
    errorSummary: {
      totalErrors: number;
      retryableErrors: number;
      fatalErrors: number;
      errorsByType: Record<string, number>;
    };
  } {
    const logs = this.getLogs(executionId);
    const metrics = this.getMetrics(executionId);
    
    const errorLogs = logs.filter(log => log.level === 'error' || log.level === 'fatal');
    const errorsByType: Record<string, number> = {};
    
    errorLogs.forEach(log => {
      if (log.error) {
        const errorType = log.error.name;
        errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
      }
    });

    return {
      logs,
      metrics,
      errorSummary: {
        totalErrors: errorLogs.length,
        retryableErrors: errorLogs.filter(log => log.error?.retryable).length,
        fatalErrors: errorLogs.filter(log => log.level === 'fatal').length,
        errorsByType
      }
    };
  }

  // Private methods

  private setDefaultRetryPolicies(): void {
    // Default retry policy
    this.retryPolicies.set('default', {
      maxRetries: 3,
      backoffStrategy: 'exponential',
      baseDelay: 1000,
      maxDelay: 30000,
      retryableErrors: ['NetworkError', 'TimeoutError', 'ServiceUnavailableError', 'Error']
    });

    // Action-specific policies
    this.retryPolicies.set('send_slack_message', {
      maxRetries: 5,
      backoffStrategy: 'exponential',
      baseDelay: 2000,
      maxDelay: 60000,
      retryableErrors: ['NetworkError', 'RateLimitError', 'ServiceUnavailableError']
    });

    this.retryPolicies.set('create_hubspot_contact', {
      maxRetries: 3,
      backoffStrategy: 'linear',
      baseDelay: 5000,
      maxDelay: 30000,
      retryableErrors: ['NetworkError', 'RateLimitError', 'ServiceUnavailableError']
    });
  }

  private updateMetrics(
    executionId: string,
    level: LogEntry['level'],
    nodeId?: string,
    duration?: number
  ): void {
    const metrics = this.metrics.get(executionId);
    if (!metrics) return;

    // Update performance metrics if available
    if (duration && nodeId) {
      // Track node performance (could be used for optimization)
    }

    this.metrics.set(executionId, metrics);
  }

  private serializeError(error: Error): ErrorDetails {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
      retryable: this.isRetryableError(error, 'default'),
      context: {
        timestamp: new Date().toISOString()
      }
    };
  }

  private isNetworkError(error: Error): boolean {
    return error.name === 'NetworkError' ||
           error.message.includes('network') ||
           error.message.includes('timeout') ||
           error.message.includes('ECONNRESET') ||
           error.message.includes('ENOTFOUND');
  }

  private isTemporaryError(error: Error): boolean {
    const temporaryMessages = [
      'service unavailable',
      'rate limit',
      'too many requests',
      'server error',
      'internal server error'
    ];
    
    const message = error.message.toLowerCase();
    return temporaryMessages.some(msg => message.includes(msg));
  }

  private convertToExecutionLog(logEntry: LogEntry): ExecutionLog {
    return {
      timestamp: logEntry.timestamp,
      level: logEntry.level as 'info' | 'warn' | 'error',
      message: logEntry.message,
      nodeId: logEntry.nodeId,
      data: logEntry.data
    };
  }

  private consoleLog(logEntry: LogEntry): void {
    const prefix = `[${logEntry.executionId}]${logEntry.nodeId ? `[${logEntry.nodeId}]` : ''}`;
    const message = `${prefix} ${logEntry.message}`;
    
    switch (logEntry.level) {
      case 'debug':
        console.debug(message, logEntry.data);
        break;
      case 'info':
        console.info(message, logEntry.data);
        break;
      case 'warn':
        console.warn(message, logEntry.data);
        break;
      case 'error':
      case 'fatal':
        console.error(message, logEntry.error, logEntry.data);
        break;
    }
  }

  private async persistLog(logEntry: LogEntry): Promise<void> {
    // In a real implementation, this would save to database or logging service
    // For now, we'll just store in memory
  }

  private async persistExecutionResult(
    result: ExecutionResult,
    metrics?: ExecutionMetrics
  ): Promise<void> {
    // In a real implementation, this would save to database
    console.log('Persisting execution result:', {
      executionId: result.executionId,
      status: result.status,
      duration: metrics?.duration,
      logCount: result.logs.length
    });
  }

  private cleanup(executionId: string): void {
    // Clean up in-memory data after a delay to allow for final queries
    setTimeout(() => {
      this.logs.delete(executionId);
      this.metrics.delete(executionId);
    }, 60000); // 1 minute delay
  }

  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const workflowLogger = new WorkflowExecutionLogger();