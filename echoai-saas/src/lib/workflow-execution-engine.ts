/**
 * Workflow Execution Engine
 *
 * Handles the execution of XState machines with integration to external services
 * and database persistence of execution logs.
 */

import { Actor, AnyStateMachine } from "xstate";
import { type WorkflowContext } from "./workflow-compiler";
import { workflowLogger } from "./workflow/execution-logger";
import { ActionRegistry } from "./workflow/actions";
import { TriggerRegistry } from "./workflow/triggers";
import { performanceMonitor } from "./workflow/performance-monitor";
import { defaultRateLimiters } from "./workflow/rate-limiter";
import type { AutomationWorkflow, WorkflowNode } from "../types/database";
import { ExecutionStatus } from "../types/database";

// Execution result types
export interface ExecutionResult {
  executionId: string;
  status: ExecutionStatus;
  startedAt: Date;
  completedAt?: Date;
  logs: ExecutionLog[];
  error?: string;
}

export interface ExecutionLog {
  timestamp: Date;
  level: "info" | "warn" | "error";
  message: string;
  nodeId?: string;
  data?: Record<string, unknown>;
}

// Trigger event types
export interface TriggerEvent {
  type: string;
  data: Record<string, unknown>;
  conversationId?: string;
  messageId?: string;
  userId: string;
  chatbotId?: string; // Added for proper scoping
}

// Action execution services
export interface ActionExecutor {
  executeAction(
    actionType: string,
    config: Record<string, unknown>,
    context: WorkflowContext
  ): Promise<ActionResult>;
}

export interface ActionResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

// Dead Letter Queue types
export interface DeadLetterRecord {
  executionId: string;
  workflowId: string;
  triggerEvent: TriggerEvent;
  error: {
    message: string;
    stack?: string;
    name: string;
  };
  retryCount: number;
  addedAt: Date;
  lastRetryAt: Date;
}

export class WorkflowExecutionEngine {
  private actionExecutor: ActionExecutor;
  private activeExecutions: Map<string, Actor<AnyStateMachine>> = new Map();
  private retryAttempts: Map<string, Map<string, number>> = new Map(); // executionId -> nodeId -> attempts

  constructor(actionExecutor?: ActionExecutor) {
    this.actionExecutor = actionExecutor || new EnhancedActionExecutor();
  }

  /**
   * Executes a workflow based on a trigger event
   */
  async executeWorkflow(
    workflow: AutomationWorkflow,
    triggerEvent: TriggerEvent
  ): Promise<ExecutionResult> {
    const executionId = this.generateExecutionId();

    // Check rate limits before execution
    const rateLimitResult = defaultRateLimiters.perUser.checkLimit(
      triggerEvent.userId,
      triggerEvent.chatbotId
    );

    if (!rateLimitResult.allowed) {
      const error = new Error(
        `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`
      );

      // Log rate limit violation
      workflowLogger.logError(executionId, "Rate limit exceeded", error, {
        userId: triggerEvent.userId,
        chatbotId: triggerEvent.chatbotId,
        remaining: rateLimitResult.remaining,
        resetTime: rateLimitResult.resetTime,
      });

      return {
        executionId,
        status: ExecutionStatus.FAILED,
        startedAt: new Date(),
        completedAt: new Date(),
        logs: [
          {
            timestamp: new Date(),
            level: "error",
            message: error.message,
            data: { rateLimitResult },
          },
        ],
        error: error.message,
      };
    }

    // Start performance monitoring
    performanceMonitor.startExecution(
      executionId,
      workflow.id,
      workflow.chatbotId,
      workflow,
      triggerEvent
    );

    // Initialize retry tracking
    this.retryAttempts.set(executionId, new Map());

    try {
      // Start execution logging
      workflowLogger.startExecution(
        executionId,
        workflow.id,
        triggerEvent,
        workflow
      );

      // Create execution record
      await this.createExecutionRecord(
        workflow.id,
        executionId,
        triggerEvent,
        workflow.chatbotId
      );

      // Update status to RUNNING
      await this.updateExecutionStatus(executionId, ExecutionStatus.RUNNING);

      // Validate workflow structure before processing
      if (
        !workflow.flowDefinition ||
        !Array.isArray(workflow.flowDefinition.nodes)
      ) {
        const errorDetails = {
          workflowId: workflow.id,
          hasFlowDefinition: !!workflow.flowDefinition,
          flowDefinitionType: typeof workflow.flowDefinition,
          hasNodes: workflow.flowDefinition
            ? !!workflow.flowDefinition.nodes
            : false,
          nodesType: workflow.flowDefinition
            ? typeof workflow.flowDefinition.nodes
            : "undefined",
        };

        console.error("Invalid workflow structure detected:", errorDetails);

        throw new Error(
          `Invalid workflow structure: flowDefinition.nodes is not an array. Details: ${JSON.stringify(
            errorDetails
          )}`
        );
      }

      // Process trigger nodes first
      const triggerNodes = workflow.flowDefinition.nodes.filter(
        (node: WorkflowNode) => node.type === "trigger"
      );
      for (const triggerNode of triggerNodes) {
        await this.executeTriggerNode(executionId, triggerNode, triggerEvent);
      }

      // Find and execute action nodes
      const actionNodes = workflow.flowDefinition.nodes.filter(
        (node: WorkflowNode) => node.type === "action"
      );

      console.log(
        `Found ${actionNodes.length} action nodes to execute for workflow ${workflow.id}`
      );

      for (const actionNode of actionNodes) {
        console.log(
          `Executing action node ${actionNode.id} of type ${actionNode.data?.nodeType}`
        );

        await this.executeActionNodeWithRetry(executionId, actionNode, {
          triggerId: triggerEvent.type,
          triggerData: triggerEvent.data,
          executionId,
          userId: triggerEvent.userId,
          variables: {},
          errors: [],
        });
      }

      // Complete execution successfully
      const result = workflowLogger.completeExecution(
        executionId,
        ExecutionStatus.COMPLETED
      );

      // Update execution record in database
      await this.updateExecutionRecord(
        executionId,
        ExecutionStatus.COMPLETED,
        result.logs,
        result.completedAt || new Date()
      );

      // Complete performance monitoring
      performanceMonitor.completeExecution(executionId, result);

      // Record successful request for rate limiting
      defaultRateLimiters.perUser.recordRequest(
        triggerEvent.userId,
        true,
        triggerEvent.chatbotId
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorObj = error instanceof Error ? error : new Error(errorMessage);

      // Get retry count for this execution
      const executionRetries = this.retryAttempts.get(executionId);
      const totalRetries = executionRetries
        ? Array.from(executionRetries.values()).reduce(
            (sum, count) => sum + count,
            0
          )
        : 0;

      // Add to dead letter queue if this is a permanent failure
      if (totalRetries >= 3) {
        // Max retries exceeded
        await this.addToDeadLetterQueue(
          executionId,
          workflow.id,
          triggerEvent,
          errorObj,
          totalRetries
        );
      }

      // Complete execution with failure
      const result = workflowLogger.completeExecution(
        executionId,
        ExecutionStatus.FAILED,
        undefined,
        errorObj
      );

      // Update execution record in database
      await this.updateExecutionRecord(
        executionId,
        ExecutionStatus.FAILED,
        result.logs,
        result.completedAt || new Date(),
        errorMessage
      );

      // Complete performance monitoring with error
      performanceMonitor.completeExecution(executionId, result, errorObj);

      // Record failed request for rate limiting
      defaultRateLimiters.perUser.recordRequest(
        triggerEvent.userId,
        false,
        triggerEvent.chatbotId
      );

      return result;
    } finally {
      // Cleanup retry tracking
      this.retryAttempts.delete(executionId);
    }
  }

  /**
   * Simple expression evaluator (replace with more robust solution in production)
   * Currently unused but kept for future conditional logic implementation
   */

  private evaluateExpression(
    expression: string,
    context: Record<string, unknown>
  ): string {
    // This is a simplified implementation
    // In production, use a proper expression evaluator like JSONata or similar

    try {
      // Replace variables in expression
      let evaluatedExpression = expression;
      Object.entries(context).forEach(([key, value]) => {
        evaluatedExpression = evaluatedExpression.replace(
          new RegExp(`\\$\\{${key}\\}`, "g"),
          String(value)
        );
      });

      // Simple boolean evaluation
      if (
        evaluatedExpression.includes(">") ||
        evaluatedExpression.includes("<") ||
        evaluatedExpression.includes("==")
      ) {
        // Use Function constructor for safe evaluation (be careful in production)
        const result = new Function("return " + evaluatedExpression)();
        return result ? "TRUE" : "FALSE";
      }

      return "DEFAULT";
    } catch {
      throw new Error(`Invalid expression: ${expression}`);
    }
  }

  /**
   * Waits for workflow completion with timeout
   * Currently unused but kept for future XState integration
   */

  private async waitForCompletion(
    actor: Actor<AnyStateMachine>,
    executionId: string,
    timeoutMs: number
  ): Promise<{ status: ExecutionStatus; error?: string }> {
    return new Promise((resolve) => {
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({
            status: ExecutionStatus.FAILED,
            error: "Execution timeout",
          });
        }
      }, timeoutMs);

      // Subscribe to state changes
      const subscription = actor.subscribe({
        next: (state) => {
          if (resolved) return;

          if (state.matches("completed")) {
            resolved = true;
            clearTimeout(timeout);
            subscription.unsubscribe();
            resolve({ status: ExecutionStatus.COMPLETED });
          } else if (state.matches("failed")) {
            resolved = true;
            clearTimeout(timeout);
            subscription.unsubscribe();
            const error =
              state.context?.errors?.join("; ") || "Execution failed";
            resolve({ status: ExecutionStatus.FAILED, error });
          }
        },
        error: (error) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            subscription.unsubscribe();
            resolve({
              status: ExecutionStatus.FAILED,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        },
      });

      // Handle immediate completion (if already in final state)
      const currentState = actor.getSnapshot();
      if (currentState.matches("completed")) {
        resolved = true;
        clearTimeout(timeout);
        subscription.unsubscribe();
        resolve({ status: ExecutionStatus.COMPLETED });
      } else if (currentState.matches("failed")) {
        resolved = true;
        clearTimeout(timeout);
        subscription.unsubscribe();
        const error =
          currentState.context?.errors?.join("; ") || "Execution failed";
        resolve({ status: ExecutionStatus.FAILED, error });
      }
    });
  }

  /**
   * Extracts trigger type from event type string
   * Currently unused but kept for future trigger processing
   */

  private extractTriggerType(eventType: string): string {
    // Convert event types like 'new_conversation' to 'NEW_CONVERSATION'
    return eventType.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  }

  /**
   * Executes a trigger node
   */
  private async executeTriggerNode(
    executionId: string,
    triggerNode: WorkflowNode,
    triggerEvent: TriggerEvent
  ): Promise<void> {
    const startTime = Date.now();

    workflowLogger.logNodeStart(
      executionId,
      triggerNode.id,
      "trigger",
      triggerNode.data.config || {}
    );

    try {
      const trigger = TriggerRegistry.getTrigger(
        triggerNode.data.nodeType || "unknown"
      );
      if (!trigger) {
        throw new Error(`Unknown trigger type: ${triggerNode.data.nodeType}`);
      }

      // Evaluate trigger (should return true since we're already triggered)
      const shouldTrigger = await trigger.evaluate(
        triggerEvent,
        triggerNode.data.config || {}
      );
      const context = await trigger.extractContext(
        triggerEvent,
        triggerNode.data.config || {}
      );

      const duration = Date.now() - startTime;

      workflowLogger.logNodeSuccess(
        executionId,
        triggerNode.id,
        "trigger",
        { shouldTrigger, context },
        duration
      );
    } catch (error) {
      const duration = Date.now() - startTime;

      workflowLogger.logNodeFailure(
        executionId,
        triggerNode.id,
        "trigger",
        error instanceof Error ? error : new Error("Unknown error"),
        duration
      );

      throw error;
    }
  }

  /**
   * Executes an action node with retry logic
   */
  private async executeActionNodeWithRetry(
    executionId: string,
    actionNode: WorkflowNode,
    context: WorkflowContext
  ): Promise<void> {
    const nodeId = actionNode.id;
    const nodeType = actionNode.data.nodeType || "unknown";
    const maxRetries = 3; // Could be configurable per node type

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const isRetry = attempt > 1;

      if (isRetry) {
        const delay = workflowLogger.calculateRetryDelay(attempt - 1, nodeType);

        workflowLogger.logRetryAttempt(
          executionId,
          nodeId,
          nodeType,
          attempt - 1,
          delay
        );

        // Record retry attempt
        performanceMonitor.recordRetryAttempt(executionId);

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      try {
        await this.executeActionNode(executionId, actionNode, context);
        return; // Success, exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");

        const duration = Date.now();
        const willRetry =
          attempt <= maxRetries &&
          workflowLogger.isRetryableError(lastError, nodeType);

        workflowLogger.logNodeFailure(
          executionId,
          nodeId,
          nodeType,
          lastError,
          duration,
          willRetry
        );

        if (!willRetry) {
          throw lastError;
        }
      }
    }

    // If we get here, all retries failed
    throw lastError || new Error("Action execution failed after all retries");
  }

  /**
   * Executes a single action node
   */
  private async executeActionNode(
    executionId: string,
    actionNode: WorkflowNode,
    context: WorkflowContext
  ): Promise<void> {
    const startTime = Date.now();
    const nodeId = actionNode.id;
    const nodeType = actionNode.data.nodeType || "unknown";
    const config = actionNode.data.config || {};

    workflowLogger.logNodeStart(executionId, nodeId, nodeType, config);

    try {
      const actionResult = await this.actionExecutor.executeAction(
        nodeType,
        config,
        context
      );

      if (!actionResult.success) {
        throw new Error(actionResult.error || "Action execution failed");
      }

      const duration = Date.now() - startTime;

      workflowLogger.logNodeSuccess(
        executionId,
        nodeId,
        nodeType,
        actionResult.data || {},
        duration
      );

      // Record successful node completion
      performanceMonitor.recordNodeCompletion(executionId, nodeId, true);
    } catch (error) {
      // Record failed node completion
      performanceMonitor.recordNodeCompletion(executionId, nodeId, false);
      throw error; // Re-throw for retry logic to handle
    }
  }

  /**
   * Generates unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Creates execution record in database
   */
  private async createExecutionRecord(
    workflowId: string,
    executionId: string,
    triggerEvent: TriggerEvent,
    chatbotId?: string
  ): Promise<void> {
    try {
      // Import database service dynamically to avoid circular dependencies
      const { databaseService } = await import("./supabase/database-service");

      const client = databaseService.getClient();

      await databaseService.executeQuery(async () => {
        // Use type assertion to work around Supabase client typing issues
        const typedClient = client as any;
        return await typedClient
          .from("WorkflowExecution")
          .insert({
            id: executionId,
            workflowId,
            chatbotId: chatbotId || triggerEvent.chatbotId || "",
            triggerId: triggerEvent.type,
            triggerData: triggerEvent.data,
            status: ExecutionStatus.PENDING,
            startedAt: new Date().toISOString(),
          })
          .select()
          .single();
      }, "createExecutionRecord");

      workflowLogger.logInfo(
        executionId,
        "Execution record created in database",
        {
          workflowId,
          triggerId: triggerEvent.type,
        }
      );
    } catch (error) {
      // Log error but don't fail execution
      console.error("Failed to create execution record:", error);
      workflowLogger.logError(
        executionId,
        "Failed to create execution record",
        error
      );
    }
  }

  /**
   * Updates execution record with results
   */
  private async updateExecutionRecord(
    executionId: string,
    status: ExecutionStatus,
    logs: ExecutionLog[],
    completedAt: Date,
    error?: string
  ): Promise<void> {
    try {
      // Import database service dynamically to avoid circular dependencies
      const { databaseService } = await import("./supabase/database-service");

      const client = databaseService.getClient();

      const updateData: Record<string, unknown> = {
        status,
        executionLog: {
          logs,
          totalLogs: logs.length,
          lastUpdated: new Date().toISOString(),
        },
        completedAt: completedAt.toISOString(),
      };

      if (error) {
        (updateData.executionLog as Record<string, unknown>).error = error;
      }

      await databaseService.executeQuery(async () => {
        // Use type assertion to work around Supabase client typing issues
        const typedClient = client as any;
        return await typedClient
          .from("WorkflowExecution")
          .update(updateData)
          .eq("id", executionId)
          .select()
          .single();
      }, "updateExecutionRecord");

      workflowLogger.logInfo(
        executionId,
        "Execution record updated in database",
        {
          status,
          logsCount: logs.length,
          hasError: !!error,
        }
      );
    } catch (error) {
      // Log error but don't fail execution
      console.error("Failed to update execution record:", error);
      workflowLogger.logError(
        executionId,
        "Failed to update execution record",
        error
      );
    }
  }

  /**
   * Updates execution status only (for status transitions)
   */
  private async updateExecutionStatus(
    executionId: string,
    status: ExecutionStatus
  ): Promise<void> {
    try {
      // Import database service dynamically to avoid circular dependencies
      const { databaseService } = await import("./supabase/database-service");

      const client = databaseService.getClient();

      await databaseService.executeQuery(async () => {
        // Use type assertion to work around Supabase client typing issues
        const typedClient = client as any;
        return await typedClient
          .from("WorkflowExecution")
          .update({ status })
          .eq("id", executionId)
          .select()
          .single();
      }, "updateExecutionStatus");

      workflowLogger.logInfo(
        executionId,
        "Execution status updated in database",
        {
          status,
        }
      );
    } catch (error) {
      // Log error but don't fail execution
      console.error("Failed to update execution status:", error);
      workflowLogger.logError(
        executionId,
        "Failed to update execution status",
        error
      );
    }
  }

  /**
   * Stops a running workflow execution
   */
  async stopExecution(executionId: string): Promise<boolean> {
    const actor = this.activeExecutions.get(executionId);
    if (actor) {
      actor.stop();
      this.activeExecutions.delete(executionId);

      await this.updateExecutionRecord(
        executionId,
        ExecutionStatus.FAILED,
        [
          {
            timestamp: new Date(),
            level: "info",
            message: "Execution stopped by user",
          },
        ],
        new Date(),
        "Stopped by user"
      );

      return true;
    }

    // If not in active executions, return false
    return false;
  }

  /**
   * Gets status of active executions
   */
  getActiveExecutions(): string[] {
    return Array.from(this.activeExecutions.keys());
  }

  /**
   * Executes a workflow by ID using the workflow service
   */
  async executeWorkflowById(
    workflowId: string,
    triggerEvent: TriggerEvent
  ): Promise<ExecutionResult> {
    // Import workflow service dynamically to avoid circular dependencies
    const { workflowService } = await import("./workflow-service");

    const workflow = await workflowService.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    return await this.executeWorkflow(workflow, triggerEvent);
  }

  /**
   * Retrieves execution history from database
   */
  async getExecutionHistory(
    workflowId?: string,
    chatbotId?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    executions: Array<{
      id: string;
      workflowId: string;
      chatbotId: string;
      triggerId: string;
      triggerData?: Record<string, any>;
      status: ExecutionStatus;
      executionLog?: Record<string, any>;
      startedAt: Date;
      completedAt?: Date;
    }>;
    total: number;
  }> {
    try {
      // Import database service dynamically to avoid circular dependencies
      const { databaseService } = await import("./supabase/database-service");

      const client = databaseService.getClient();

      let query = client
        .from("WorkflowExecution")
        .select("*", { count: "exact" });

      // Apply filters
      if (workflowId) {
        query = query.eq("workflowId", workflowId);
      }

      if (chatbotId) {
        query = query.eq("chatbotId", chatbotId);
      }

      // Apply pagination and ordering
      query = query
        .order("startedAt", { ascending: false })
        .range(offset, offset + limit - 1);

      const result = await databaseService.executeQuery(
        async () => await query,
        "getExecutionHistory"
      );

      const resultData = result as unknown as {
        data: Record<string, unknown>[];
        count: number;
      };
      const executions = (resultData.data || []).map(
        (execution: Record<string, unknown>) => ({
          id: execution.id as string,
          workflowId: execution.workflowId as string,
          chatbotId: execution.chatbotId as string,
          triggerId: execution.triggerId as string,
          triggerData: execution.triggerData as
            | Record<string, unknown>
            | undefined,
          status: execution.status as ExecutionStatus,
          executionLog: execution.executionLog as
            | Record<string, unknown>
            | undefined,
          startedAt: new Date(execution.startedAt as string),
          completedAt: execution.completedAt
            ? new Date(execution.completedAt as string)
            : undefined,
        })
      );

      return {
        executions,
        total: resultData.count || 0,
      };
    } catch (error) {
      console.error("Failed to retrieve execution history:", error);
      return {
        executions: [],
        total: 0,
      };
    }
  }

  /**
   * Retrieves a specific execution record by ID
   */
  async getExecutionById(executionId: string): Promise<{
    id: string;
    workflowId: string;
    chatbotId: string;
    triggerId: string;
    triggerData?: Record<string, any>;
    status: ExecutionStatus;
    executionLog?: Record<string, any>;
    startedAt: Date;
    completedAt?: Date;
  } | null> {
    try {
      // Import database service dynamically to avoid circular dependencies
      const { databaseService } = await import("./supabase/database-service");

      const client = databaseService.getClient();

      const result = await databaseService.executeOptionalQuery(async () => {
        return await client
          .from("WorkflowExecution")
          .select("*")
          .eq("id", executionId)
          .single();
      }, "getExecutionById");

      if (!result) {
        return null;
      }

      // Handle the case where result might be wrapped in a data property
      const executionData =
        (result as { data?: Record<string, unknown> }).data ||
        (result as Record<string, unknown>);

      return {
        id: executionData.id as string,
        workflowId: executionData.workflowId as string,
        chatbotId: executionData.chatbotId as string,
        triggerId: executionData.triggerId as string,
        triggerData: executionData.triggerData as
          | Record<string, unknown>
          | undefined,
        status: executionData.status as ExecutionStatus,
        executionLog: executionData.executionLog as
          | Record<string, unknown>
          | undefined,
        startedAt: new Date(executionData.startedAt as string),
        completedAt: executionData.completedAt
          ? new Date(executionData.completedAt as string)
          : undefined,
      };
    } catch (error) {
      console.error("Failed to retrieve execution by ID:", error);
      return null;
    }
  }

  /**
   * Validates if a trigger event should execute a workflow
   */
  async shouldExecuteWorkflow(
    workflow: AutomationWorkflow,
    triggerEvent: TriggerEvent
  ): Promise<boolean> {
    if (!workflow.isActive) {
      return false;
    }

    // Validate workflow structure
    if (
      !workflow.flowDefinition ||
      !Array.isArray(workflow.flowDefinition.nodes)
    ) {
      console.warn(
        `Invalid workflow structure for workflow ${workflow.id}: flowDefinition.nodes is not an array`
      );
      return false;
    }

    // Check if any trigger nodes match the event
    const triggerNodes = workflow.flowDefinition.nodes.filter(
      (node: WorkflowNode) => node.type === "trigger"
    );

    for (const triggerNode of triggerNodes) {
      const trigger = TriggerRegistry.getTrigger(
        triggerNode.data.nodeType || "unknown"
      );

      if (trigger) {
        try {
          const shouldTrigger = await trigger.evaluate(
            triggerEvent,
            triggerNode.data.config || {}
          );
          if (shouldTrigger) {
            return true;
          }
        } catch (error) {
          console.warn(`Failed to evaluate trigger ${triggerNode.id}:`, error);
        }
      }
    }

    return false;
  }

  /**
   * Dead Letter Queue for permanently failed executions
   */
  private deadLetterQueue: Map<string, DeadLetterRecord> = new Map();

  /**
   * Adds a failed execution to the dead letter queue
   */
  private async addToDeadLetterQueue(
    executionId: string,
    workflowId: string,
    triggerEvent: TriggerEvent,
    error: Error,
    retryCount: number
  ): Promise<void> {
    const deadLetterRecord: DeadLetterRecord = {
      executionId,
      workflowId,
      triggerEvent,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      retryCount,
      addedAt: new Date(),
      lastRetryAt: new Date(),
    };

    this.deadLetterQueue.set(executionId, deadLetterRecord);

    // Persist to database for monitoring
    try {
      await this.persistDeadLetterRecord(deadLetterRecord);
    } catch (dbError) {
      console.error("Failed to persist dead letter record:", dbError);
    }

    // Send error notification
    await this.sendErrorNotification(deadLetterRecord);
  }

  /**
   * Persists dead letter record to database
   */
  private async persistDeadLetterRecord(
    record: DeadLetterRecord
  ): Promise<void> {
    try {
      const { databaseService } = await import("./supabase/database-service");
      const client = databaseService.getClient();

      await databaseService.executeQuery(async () => {
        // Use type assertion to work around Supabase client typing issues
        const typedClient = client as any;
        return await typedClient.from("DeadLetterQueue").insert({
          executionId: record.executionId,
          workflowId: record.workflowId,
          triggerEvent: record.triggerEvent,
          error: record.error,
          retryCount: record.retryCount,
          addedAt: record.addedAt.toISOString(),
          lastRetryAt: record.lastRetryAt.toISOString(),
        });
      }, "persistDeadLetterRecord");
    } catch (error) {
      console.error("Failed to persist dead letter record:", error);
      // Don't throw - this is a monitoring feature, not critical
    }
  }

  /**
   * Sends error notification for critical failures
   */
  private async sendErrorNotification(record: DeadLetterRecord): Promise<void> {
    try {
      // Log critical error
      console.error("Workflow execution permanently failed:", {
        executionId: record.executionId,
        workflowId: record.workflowId,
        error: record.error,
        retryCount: record.retryCount,
      });

      // In a production system, you would send notifications via:
      // - Email alerts
      // - Slack notifications
      // - PagerDuty alerts
      // - Custom webhook notifications

      // For now, we'll create a notification record in the database
      const { databaseService } = await import("./supabase/database-service");
      const client = databaseService.getClient();

      await databaseService.executeOptionalQuery(async () => {
        // Use type assertion to work around Supabase client typing issues
        const typedClient = client as any;
        return await typedClient.from("ErrorNotifications").insert({
          type: "WORKFLOW_EXECUTION_FAILED",
          severity: "CRITICAL",
          title: `Workflow execution permanently failed: ${record.workflowId}`,
          message: `Execution ${record.executionId} failed after ${record.retryCount} retries. Error: ${record.error.message}`,
          metadata: {
            executionId: record.executionId,
            workflowId: record.workflowId,
            triggerEvent: record.triggerEvent,
            error: record.error,
          },
          createdAt: new Date().toISOString(),
        });
      }, "sendErrorNotification");
    } catch (error) {
      console.error("Failed to send error notification:", error);
      // Don't throw - this is a monitoring feature
    }
  }

  /**
   * Retrieves dead letter queue entries for monitoring
   */
  async getDeadLetterQueue(limit: number = 100): Promise<DeadLetterRecord[]> {
    try {
      const { databaseService } = await import("./supabase/database-service");
      const client = databaseService.getClient();

      const result = await databaseService.executeOptionalQuery(async () => {
        // Use type assertion to work around Supabase client typing issues
        const typedClient = client as any;
        return await typedClient
          .from("DeadLetterQueue")
          .select("*")
          .order("addedAt", { ascending: false })
          .limit(limit);
      }, "getDeadLetterQueue");

      return (result as { data?: DeadLetterRecord[] })?.data || [];
    } catch (error) {
      console.error("Failed to retrieve dead letter queue:", error);
      return [];
    }
  }

  /**
   * Retries a failed execution from the dead letter queue
   */
  async retryFromDeadLetterQueue(executionId: string): Promise<boolean> {
    const record = this.deadLetterQueue.get(executionId);
    if (!record) {
      return false;
    }

    try {
      // Remove from dead letter queue
      this.deadLetterQueue.delete(executionId);

      // Attempt to retry the execution
      // This would need the original workflow object, which we'd need to fetch
      console.log(`Retrying execution ${executionId} from dead letter queue`);

      return true;
    } catch (error) {
      console.error(`Failed to retry execution ${executionId}:`, error);
      // Re-add to dead letter queue
      this.deadLetterQueue.set(executionId, record);
      return false;
    }
  }
}

/**
 * Enhanced action executor implementation using the action registry
 */
export class EnhancedActionExecutor implements ActionExecutor {
  async executeAction(
    actionType: string,
    config: Record<string, unknown>,
    context: WorkflowContext
  ): Promise<ActionResult> {
    const action = ActionRegistry.getAction(actionType);
    if (!action) {
      return {
        success: false,
        error: `Unknown action type: ${actionType}`,
      };
    }

    // Validate configuration before execution
    const validation = action.validateConfig(config);
    if (!validation.isValid) {
      return {
        success: false,
        error: `Invalid configuration: ${validation.errors.join(", ")}`,
      };
    }

    try {
      return await action.execute(config, context);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Action execution failed",
      };
    }
  }
}

/**
 * Default action executor implementation (legacy)
 */
export class DefaultActionExecutor implements ActionExecutor {
  async executeAction(
    actionType: string,
    config: Record<string, unknown>,
    context: WorkflowContext
  ): Promise<ActionResult> {
    // Use the ActionRegistry for proper action execution
    const actionHandler = ActionRegistry.getAction(actionType);

    if (actionHandler) {
      try {
        return await actionHandler.execute(config, context);
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Action execution failed",
        };
      }
    }

    // Fallback for unknown action types
    return {
      success: false,
      error: `Unknown action type: ${actionType}`,
    };
  }
}

export { WorkflowContext };
