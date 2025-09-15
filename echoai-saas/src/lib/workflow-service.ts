/**
 * Workflow Service
 *
 * Handles database operations for automation workflows including
 * saving, loading, and managing workflow persistence.
 */

import { WorkflowCompiler, type ValidationResult } from "./workflow-compiler";
import {
  WorkflowExecutionEngine,
  DefaultActionExecutor,
  type TriggerEvent,
  type ExecutionResult,
} from "./workflow-execution-engine";
import { databaseService, DatabaseError } from "./supabase/database-service";
import {
  safeExecute,
  isDatabaseRetryable,
  ErrorMonitor,
  CircuitBreaker,
  type ErrorContext,
} from "./error-handling";
import { databaseOptimizer } from "./workflow/database-optimizer";
import type {
  AutomationWorkflow,
  ReactFlowDefinition,
  XStateDefinition,
} from "../types/database";

// Error handling
export class WorkflowServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>,
    public originalError?: Error
  ) {
    super(message);
    this.name = "WorkflowServiceError";
  }

  /**
   * Create a user-friendly error message for display
   */
  getUserMessage(): string {
    switch (this.code) {
      case "WORKFLOW_NOT_FOUND":
        return "The requested workflow could not be found.";
      case "CHATBOT_ACCESS_DENIED":
        return "You do not have permission to access this chatbot or it does not exist.";
      case "VALIDATION_FAILED":
        return "The workflow configuration is invalid. Please check your workflow design.";
      case "WORKFLOW_INACTIVE":
        return "This workflow is currently disabled and cannot be executed.";
      case "DATABASE_ERROR":
        return "A database error occurred. Please try again later.";
      case "PERMISSION_DENIED":
        return "You do not have permission to perform this action.";
      case "DUPLICATE_WORKFLOW":
        return "A workflow with this name already exists for this chatbot.";
      case "INVALID_REQUEST":
        return "The request contains invalid data. Please check your input.";
      default:
        return this.message;
    }
  }

  /**
   * Check if this is a user-facing error that should be displayed
   */
  isUserFacing(): boolean {
    const userFacingCodes = [
      "WORKFLOW_NOT_FOUND",
      "CHATBOT_ACCESS_DENIED",
      "VALIDATION_FAILED",
      "WORKFLOW_INACTIVE",
      "PERMISSION_DENIED",
      "DUPLICATE_WORKFLOW",
      "INVALID_REQUEST",
    ];
    return userFacingCodes.includes(this.code);
  }
}

// Service interfaces
export interface WorkflowServiceConfig {
  databaseUrl?: string;
  enableValidation?: boolean;
  maxExecutionTime?: number;
}

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  flowDefinition: ReactFlowDefinition;
  userId: string;
  chatbotId: string;
  isActive?: boolean;
}

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  flowDefinition?: ReactFlowDefinition;
  isActive?: boolean;
}

export interface WorkflowListOptions {
  userId?: string;
  chatbotId?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

export class WorkflowService {
  private executionEngine: WorkflowExecutionEngine;
  private config: WorkflowServiceConfig;
  private circuitBreaker: CircuitBreaker;
  private errorMonitor: ErrorMonitor;

  constructor(config: WorkflowServiceConfig = {}) {
    this.config = {
      enableValidation: true,
      maxExecutionTime: 30000,
      ...config,
    };

    // Initialize execution engine with default action executor
    this.executionEngine = new WorkflowExecutionEngine(
      new DefaultActionExecutor()
    );

    // Initialize error handling components
    this.circuitBreaker = new CircuitBreaker(5, 60000); // 5 failures, 1 minute recovery
    this.errorMonitor = ErrorMonitor.getInstance();
  }

  /**
   * Creates a new workflow with validation and compilation
   */
  async createWorkflow(request: CreateWorkflowRequest): Promise<{
    workflow: AutomationWorkflow;
    validation: ValidationResult;
  }> {
    try {
      // Validate input parameters
      this.validateCreateWorkflowRequest(request);

      // Validate chatbot ownership
      await this.validateChatbotOwnership(request.userId, request.chatbotId);

      // Check for duplicate workflow names within the chatbot
      await this.validateUniqueWorkflowName(request.name, request.chatbotId);

      // Validate workflow if enabled
      let validation: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
      };

      if (this.config.enableValidation) {
        console.log(
          "WorkflowService: About to validate flow definition:",
          JSON.stringify(request.flowDefinition, null, 2)
        );
        validation = WorkflowCompiler.validateWorkflow(request.flowDefinition);

        if (!validation.isValid) {
          throw new WorkflowServiceError(
            `Workflow validation failed: ${validation.errors
              .map((e) => e.message)
              .join(", ")}`,
            "VALIDATION_FAILED",
            { errors: validation.errors }
          );
        }
      }

      // Compile to state machine
      const workflowId = this.generateWorkflowId();
      let stateMachine: XStateDefinition;

      try {
        stateMachine = WorkflowCompiler.compileToStateMachine(
          request.flowDefinition,
          workflowId
        );
      } catch (error) {
        throw new WorkflowServiceError(
          "Failed to compile workflow to state machine",
          "COMPILATION_FAILED",
          { workflowId },
          error as Error
        );
      }

      // Create workflow object
      const workflow: AutomationWorkflow = {
        id: workflowId,
        userId: request.userId,
        chatbotId: request.chatbotId,
        name: request.name,
        description: request.description,
        flowDefinition: request.flowDefinition,
        stateMachine,
        isActive: request.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save to database
      await this.saveWorkflowToDatabase(workflow);

      return { workflow, validation };
    } catch (error) {
      if (error instanceof WorkflowServiceError) {
        throw error;
      }

      if (error instanceof DatabaseError) {
        throw new WorkflowServiceError(
          "Failed to create workflow due to database error",
          "DATABASE_ERROR",
          { operation: "createWorkflow" },
          error
        );
      }

      // Handle unexpected errors
      console.error("Unexpected error in createWorkflow:", error);
      throw new WorkflowServiceError(
        "An unexpected error occurred while creating the workflow",
        "UNEXPECTED_ERROR",
        { operation: "createWorkflow" },
        error as Error
      );
    }
  }

  /**
   * Updates an existing workflow
   */
  async updateWorkflow(
    workflowId: string,
    updates: UpdateWorkflowRequest,
    userId?: string
  ): Promise<{
    workflow: AutomationWorkflow;
    validation?: ValidationResult;
  }> {
    try {
      // Validate input parameters
      if (!workflowId || workflowId.trim().length === 0) {
        throw new WorkflowServiceError(
          "Workflow ID is required",
          "INVALID_REQUEST",
          { workflowId }
        );
      }

      if (!updates || Object.keys(updates).length === 0) {
        throw new WorkflowServiceError(
          "At least one field must be updated",
          "INVALID_REQUEST",
          { updates }
        );
      }

      // Validate update fields
      if (updates.name !== undefined) {
        if (!updates.name || updates.name.trim().length === 0) {
          throw new WorkflowServiceError(
            "Workflow name cannot be empty",
            "INVALID_REQUEST",
            { field: "name" }
          );
        }

        if (updates.name.length > 100) {
          throw new WorkflowServiceError(
            "Workflow name must be 100 characters or less",
            "INVALID_REQUEST",
            { field: "name", maxLength: 100 }
          );
        }
      }

      if (
        updates.description !== undefined &&
        updates.description &&
        updates.description.length > 500
      ) {
        throw new WorkflowServiceError(
          "Workflow description must be 500 characters or less",
          "INVALID_REQUEST",
          { field: "description", maxLength: 500 }
        );
      }

      // Load existing workflow and validate access
      const existingWorkflow = userId
        ? await this.validateWorkflowAccess(workflowId, userId)
        : await this.loadWorkflowFromDatabase(workflowId);

      if (!existingWorkflow) {
        throw new WorkflowServiceError(
          `Workflow not found: ${workflowId}`,
          "WORKFLOW_NOT_FOUND",
          { workflowId }
        );
      }

      // Check for name uniqueness if name is being updated
      if (updates.name && updates.name !== existingWorkflow.name) {
        await this.validateUniqueWorkflowName(
          updates.name,
          existingWorkflow.chatbotId,
          workflowId
        );
      }

      // Apply updates
      const updatedWorkflow: AutomationWorkflow = {
        ...existingWorkflow,
        ...updates,
        updatedAt: new Date(),
      };

      let validation: ValidationResult | undefined;

      // If flow definition changed, revalidate and recompile
      if (updates.flowDefinition) {
        if (this.config.enableValidation) {
          validation = WorkflowCompiler.validateWorkflow(
            updates.flowDefinition
          );

          if (!validation.isValid) {
            throw new WorkflowServiceError(
              `Workflow validation failed: ${validation.errors
                .map((e) => e.message)
                .join(", ")}`,
              "VALIDATION_FAILED",
              { errors: validation.errors }
            );
          }
        }

        // Recompile state machine
        try {
          updatedWorkflow.stateMachine = WorkflowCompiler.compileToStateMachine(
            updates.flowDefinition,
            workflowId
          );
        } catch (error) {
          throw new WorkflowServiceError(
            "Failed to compile updated workflow to state machine",
            "COMPILATION_FAILED",
            { workflowId },
            error as Error
          );
        }
      }

      // Save to database
      await this.saveWorkflowToDatabase(updatedWorkflow);

      return { workflow: updatedWorkflow, validation };
    } catch (error) {
      if (error instanceof WorkflowServiceError) {
        throw error;
      }

      if (error instanceof DatabaseError) {
        throw new WorkflowServiceError(
          "Failed to update workflow due to database error",
          "DATABASE_ERROR",
          { workflowId, operation: "updateWorkflow" },
          error
        );
      }

      // Handle unexpected errors
      console.error("Unexpected error in updateWorkflow:", error);
      throw new WorkflowServiceError(
        "An unexpected error occurred while updating the workflow",
        "UNEXPECTED_ERROR",
        { workflowId, operation: "updateWorkflow" },
        error as Error
      );
    }
  }

  /**
   * Loads a workflow by ID (optimized)
   */
  async getWorkflow(
    workflowId: string,
    userId?: string
  ): Promise<AutomationWorkflow | null> {
    try {
      // Use optimized database queries with caching
      const workflow = await databaseOptimizer.getWorkflow(workflowId);

      // Validate chatbot ownership if userId provided and workflow exists
      if (workflow && userId) {
        await this.validateChatbotOwnership(userId, workflow.chatbotId);
      }

      return workflow;
    } catch (error) {
      if (error instanceof WorkflowServiceError) {
        throw error;
      }

      if (error instanceof DatabaseError) {
        throw new WorkflowServiceError(
          "Failed to retrieve workflow due to database error",
          "DATABASE_ERROR",
          { workflowId, operation: "getWorkflow" },
          error
        );
      }

      // Handle unexpected errors
      console.error("Unexpected error in getWorkflow:", error);
      throw new WorkflowServiceError(
        "An unexpected error occurred while retrieving the workflow",
        "UNEXPECTED_ERROR",
        { workflowId, operation: "getWorkflow" },
        error as Error
      );
    }
  }

  /**
   * Lists workflows with optional filtering (optimized)
   */
  async listWorkflows(
    options: WorkflowListOptions = {}
  ): Promise<AutomationWorkflow[]> {
    try {
      console.log('WorkflowService.listWorkflows called with options:', options);
      
      // Use optimized database queries with caching
      const workflows = await databaseOptimizer.listWorkflows(options);
      
      console.log(`WorkflowService.listWorkflows returning ${workflows.length} workflows`);
      return workflows;
    } catch (error) {
      console.error('WorkflowService.listWorkflows error:', error);
      
      if (error instanceof WorkflowServiceError) {
        throw error;
      }

      if (error instanceof DatabaseError) {
        throw new WorkflowServiceError(
          "Failed to list workflows due to database error",
          "DATABASE_ERROR",
          { options, operation: "listWorkflows" },
          error
        );
      }

      // Handle unexpected errors
      console.error("Unexpected error in listWorkflows:", error);
      throw new WorkflowServiceError(
        "An unexpected error occurred while listing workflows",
        "UNEXPECTED_ERROR",
        { options, operation: "listWorkflows" },
        error as Error
      );
    }
  }

  /**
   * Deletes a workflow
   */
  async deleteWorkflow(workflowId: string, userId?: string): Promise<boolean> {
    try {
      // Validate workflow access before deletion
      if (userId) {
        await this.validateWorkflowAccess(workflowId, userId);
      }

      return await this.deleteWorkflowFromDatabase(workflowId);
    } catch (error) {
      if (error instanceof WorkflowServiceError) {
        throw error;
      }

      if (error instanceof DatabaseError) {
        throw new WorkflowServiceError(
          "Failed to delete workflow due to database error",
          "DATABASE_ERROR",
          { workflowId, operation: "deleteWorkflow" },
          error
        );
      }

      // Handle unexpected errors
      console.error("Unexpected error in deleteWorkflow:", error);
      throw new WorkflowServiceError(
        "An unexpected error occurred while deleting the workflow",
        "UNEXPECTED_ERROR",
        { workflowId, operation: "deleteWorkflow" },
        error as Error
      );
    }
  }

  /**
   * Validates a workflow without saving
   */
  validateWorkflow(flowDefinition: ReactFlowDefinition): ValidationResult {
    return WorkflowCompiler.validateWorkflow(flowDefinition);
  }

  /**
   * Executes a workflow based on a trigger event
   */
  async executeWorkflow(
    workflowId: string,
    triggerEvent: TriggerEvent,
    userId?: string
  ): Promise<ExecutionResult> {
    try {
      // Validate input parameters
      if (!workflowId || workflowId.trim().length === 0) {
        throw new WorkflowServiceError(
          "Workflow ID is required for execution",
          "INVALID_REQUEST",
          { workflowId }
        );
      }

      if (!triggerEvent) {
        throw new WorkflowServiceError(
          "Trigger event is required for workflow execution",
          "INVALID_REQUEST",
          { workflowId }
        );
      }

      // Load workflow and validate access
      const workflow = userId
        ? await this.validateWorkflowAccess(workflowId, userId)
        : await this.loadWorkflowFromDatabase(workflowId);

      if (!workflow) {
        throw new WorkflowServiceError(
          `Workflow not found: ${workflowId}`,
          "WORKFLOW_NOT_FOUND",
          { workflowId }
        );
      }

      if (!workflow.isActive) {
        throw new WorkflowServiceError(
          `Workflow is not active: ${workflowId}`,
          "WORKFLOW_INACTIVE",
          { workflowId, isActive: workflow.isActive }
        );
      }

      // Execute workflow with timeout protection
      const executionPromise = this.executionEngine.executeWorkflow(
        workflow,
        triggerEvent
      );

      if (this.config.maxExecutionTime) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              new WorkflowServiceError(
                `Workflow execution timed out after ${this.config.maxExecutionTime}ms`,
                "EXECUTION_TIMEOUT",
                { workflowId, timeout: this.config.maxExecutionTime }
              )
            );
          }, this.config.maxExecutionTime);
        });

        return await Promise.race([executionPromise, timeoutPromise]);
      }

      return await executionPromise;
    } catch (error) {
      if (error instanceof WorkflowServiceError) {
        throw error;
      }

      if (error instanceof DatabaseError) {
        throw new WorkflowServiceError(
          "Failed to execute workflow due to database error",
          "DATABASE_ERROR",
          { workflowId, operation: "executeWorkflow" },
          error
        );
      }

      // Handle execution engine errors
      console.error("Unexpected error in executeWorkflow:", error);
      throw new WorkflowServiceError(
        "An unexpected error occurred during workflow execution",
        "EXECUTION_ERROR",
        { workflowId, operation: "executeWorkflow" },
        error as Error
      );
    }
  }

  /**
   * Stops a running workflow execution
   */
  async stopExecution(executionId: string): Promise<boolean> {
    return await this.executionEngine.stopExecution(executionId);
  }

  /**
   * Gets active executions
   */
  getActiveExecutions(): string[] {
    return this.executionEngine.getActiveExecutions();
  }

  /**
   * Compiles workflow to state machine (utility method)
   */
  compileWorkflow(
    flowDefinition: ReactFlowDefinition,
    workflowId: string
  ): XStateDefinition {
    return WorkflowCompiler.compileToStateMachine(flowDefinition, workflowId);
  }

  // Private helper methods

  private generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 11)}`;
  }

  /**
   * Validates the create workflow request parameters
   */
  private validateCreateWorkflowRequest(request: CreateWorkflowRequest): void {
    if (!request.name || request.name.trim().length === 0) {
      throw new WorkflowServiceError(
        "Workflow name is required",
        "INVALID_REQUEST",
        { field: "name" }
      );
    }

    if (request.name.length > 100) {
      throw new WorkflowServiceError(
        "Workflow name must be 100 characters or less",
        "INVALID_REQUEST",
        { field: "name", maxLength: 100 }
      );
    }

    if (!request.userId || request.userId.trim().length === 0) {
      throw new WorkflowServiceError("User ID is required", "INVALID_REQUEST", {
        field: "userId",
      });
    }

    if (!request.chatbotId || request.chatbotId.trim().length === 0) {
      throw new WorkflowServiceError(
        "Chatbot ID is required",
        "INVALID_REQUEST",
        { field: "chatbotId" }
      );
    }

    if (!request.flowDefinition) {
      throw new WorkflowServiceError(
        "Flow definition is required",
        "INVALID_REQUEST",
        { field: "flowDefinition" }
      );
    }

    if (request.description && request.description.length > 500) {
      throw new WorkflowServiceError(
        "Workflow description must be 500 characters or less",
        "INVALID_REQUEST",
        { field: "description", maxLength: 500 }
      );
    }
  }

  /**
   * Validates that a workflow name is unique within a chatbot
   */
  private async validateUniqueWorkflowName(
    name: string,
    chatbotId: string,
    excludeWorkflowId?: string
  ): Promise<void> {
    try {
      const client = databaseService.getClient();

      let query = client
        .from("AutomationWorkflow")
        .select("id")
        .eq("chatbotId", chatbotId)
        .eq("name", name);

      if (excludeWorkflowId) {
        query = query.neq("id", excludeWorkflowId);
      }

      const { data: result, error } = await query;

      if (error && error.code !== "PGRST116") {
        // PGRST116 is "no rows returned" which is what we want for uniqueness
        throw new WorkflowServiceError(
          "Failed to validate workflow name uniqueness",
          "DATABASE_ERROR",
          { name, chatbotId },
          error
        );
      }

      if (result && result.length > 0) {
        throw new WorkflowServiceError(
          `A workflow named "${name}" already exists for this chatbot`,
          "DUPLICATE_WORKFLOW",
          {
            name,
            chatbotId,
            existingWorkflowId: (result[0] as { id: string }).id,
          }
        );
      }
    } catch (error) {
      if (error instanceof WorkflowServiceError) {
        throw error;
      }

      if (error instanceof DatabaseError && error.code === "RECORD_NOT_FOUND") {
        // No duplicate found, which is what we want
        return;
      }

      throw new WorkflowServiceError(
        "Failed to validate workflow name uniqueness",
        "DATABASE_ERROR",
        { name, chatbotId },
        error as Error
      );
    }
  }

  /**
   * Validates that the user owns the specified chatbot with comprehensive error handling
   */
  private async validateChatbotOwnership(
    userId: string,
    chatbotId: string
  ): Promise<void> {
    if (!userId || !chatbotId) {
      throw new WorkflowServiceError(
        "User ID and Chatbot ID are required for ownership validation",
        "INVALID_REQUEST",
        { userId: !!userId, chatbotId: !!chatbotId }
      );
    }

    const context: ErrorContext = {
      operation: "validateChatbotOwnership",
      userId,
      chatbotId,
    };

    try {
      await safeExecute(
        async () => {
          const client = databaseService.getClient();

          const result = await databaseService.executeOptionalQuery(
            async () => {
              return await client
                .from("Chatbot")
                .select("id, name")
                .eq("id", chatbotId)
                .eq("userId", userId)
                .single();
            },
            "validateChatbotOwnership"
          );

          if (!result) {
            throw new WorkflowServiceError(
              "Chatbot not found or access denied",
              "CHATBOT_ACCESS_DENIED",
              { chatbotId, userId }
            );
          }
        },
        {
          retryOptions: {
            maxRetries: 3,
            baseDelay: 1000,
            retryCondition: isDatabaseRetryable,
          },
          context,
          circuitBreaker: this.circuitBreaker,
        }
      );
    } catch (error) {
      if (error instanceof WorkflowServiceError) {
        throw error;
      }

      if (error instanceof DatabaseError) {
        if (error.code === "RECORD_NOT_FOUND") {
          throw new WorkflowServiceError(
            "Chatbot not found or access denied",
            "CHATBOT_ACCESS_DENIED",
            { chatbotId, userId },
            error
          );
        }

        throw new WorkflowServiceError(
          "Failed to validate chatbot ownership due to database error",
          "DATABASE_ERROR",
          { chatbotId, userId },
          error
        );
      }

      throw new WorkflowServiceError(
        "An unexpected error occurred while validating chatbot ownership",
        "UNEXPECTED_ERROR",
        { chatbotId, userId },
        error as Error
      );
    }
  }

  /**
   * Validates workflow access by checking both workflow existence and chatbot ownership
   */
  private async validateWorkflowAccess(
    workflowId: string,
    userId: string
  ): Promise<AutomationWorkflow> {
    const workflow = await this.loadWorkflowFromDatabase(workflowId);
    if (!workflow) {
      throw new WorkflowServiceError(
        `Workflow not found: ${workflowId}`,
        "WORKFLOW_NOT_FOUND",
        { workflowId }
      );
    }

    await this.validateChatbotOwnership(userId, workflow.chatbotId);
    return workflow;
  }

  /**
   * Saves workflow to database using Supabase with comprehensive error handling
   */
  private async saveWorkflowToDatabase(
    workflow: AutomationWorkflow
  ): Promise<void> {
    const context: ErrorContext = {
      operation: "saveWorkflowToDatabase",
      workflowId: workflow.id,
      userId: workflow.userId,
      chatbotId: workflow.chatbotId,
    };

    try {
      await safeExecute(
        async () => {
          const client = databaseService.getClient();

          await databaseService.executeQuery(async () => {
            // Use explicit typing to work around Supabase client type issues
            const typedClient = client as unknown as {
              from: (table: string) => {
                upsert: (data: Record<string, unknown>) => {
                  select: () => {
                    single: () => Promise<{ data: unknown; error: unknown }>;
                  };
                };
              };
            };
            return await typedClient
              .from("AutomationWorkflow")
              .upsert({
                id: workflow.id,
                userId: workflow.userId,
                chatbotId: workflow.chatbotId,
                name: workflow.name,
                description: workflow.description,
                flowDefinition: workflow.flowDefinition,
                stateMachine: workflow.stateMachine,
                isActive: workflow.isActive,
                createdAt: workflow.createdAt.toISOString(),
                updatedAt: workflow.updatedAt.toISOString(),
              })
              .select()
              .single();
          }, "saveWorkflowToDatabase");
        },
        {
          retryOptions: {
            maxRetries: 3,
            baseDelay: 1000,
            retryCondition: isDatabaseRetryable,
          },
          context,
          circuitBreaker: this.circuitBreaker,
        }
      );
    } catch (error) {
      if (error instanceof DatabaseError) {
        if (error.code === "DUPLICATE_RECORD") {
          throw new WorkflowServiceError(
            "A workflow with this ID already exists",
            "DUPLICATE_WORKFLOW",
            { workflowId: workflow.id },
            error
          );
        }

        if (error.code === "FOREIGN_KEY_VIOLATION") {
          throw new WorkflowServiceError(
            "Invalid chatbot or user reference",
            "INVALID_REFERENCE",
            {
              workflowId: workflow.id,
              chatbotId: workflow.chatbotId,
              userId: workflow.userId,
            },
            error
          );
        }

        throw new WorkflowServiceError(
          "Failed to save workflow to database",
          "DATABASE_ERROR",
          { workflowId: workflow.id },
          error
        );
      }

      throw new WorkflowServiceError(
        "An unexpected error occurred while saving the workflow",
        "UNEXPECTED_ERROR",
        { workflowId: workflow.id },
        error as Error
      );
    }
  }

  /**
   * Loads workflow from database using Supabase
   */
  private async loadWorkflowFromDatabase(
    workflowId: string
  ): Promise<AutomationWorkflow | null> {
    try {
      if (!workflowId || workflowId.trim().length === 0) {
        throw new WorkflowServiceError(
          "Workflow ID is required",
          "INVALID_REQUEST",
          { workflowId }
        );
      }

      const client = databaseService.getClient();

      const result = await databaseService.executeOptionalQuery(async () => {
        return await client
          .from("AutomationWorkflow")
          .select("*")
          .eq("id", workflowId)
          .single();
      }, "loadWorkflowFromDatabase");

      if (!result) {
        return null;
      }

      // Convert string dates back to Date objects and validate data
      const workflowData = result as Record<string, unknown>;

      try {
        // Parse JSON fields if they are strings
        let flowDefinition: ReactFlowDefinition = { nodes: [], edges: [] };
        let stateMachine: Record<string, unknown> = { id: "default", initial: "idle", states: {} };

        if (typeof workflowData.flowDefinition === "string") {
          try {
            const parsed = JSON.parse(workflowData.flowDefinition);
            if (parsed && typeof parsed === "object") {
              flowDefinition = parsed as ReactFlowDefinition;
            }
          } catch (error) {
            console.error("Failed to parse flowDefinition JSON:", error);
            // Keep default structure
          }
        } else if (workflowData.flowDefinition && typeof workflowData.flowDefinition === "object") {
          flowDefinition = workflowData.flowDefinition as ReactFlowDefinition;
        }

        if (typeof workflowData.stateMachine === "string") {
          try {
            const parsed = JSON.parse(workflowData.stateMachine);
            if (parsed && typeof parsed === "object") {
              stateMachine = parsed as Record<string, unknown>;
            }
          } catch (error) {
            console.error("Failed to parse stateMachine JSON:", error);
            // Keep default structure
          }
        } else if (workflowData.stateMachine && typeof workflowData.stateMachine === "object") {
          stateMachine = workflowData.stateMachine as Record<string, unknown>;
        }

        // Ensure flowDefinition has the required structure
        if (!flowDefinition || typeof flowDefinition !== "object") {
          flowDefinition = { nodes: [], edges: [] };
        }

        if (!Array.isArray(flowDefinition.nodes)) {
          flowDefinition.nodes = [];
        }

        if (!Array.isArray(flowDefinition.edges)) {
          flowDefinition.edges = [];
        }

        return {
          ...workflowData,
          flowDefinition,
          stateMachine,
          createdAt: new Date(workflowData.createdAt as string),
          updatedAt: new Date(workflowData.updatedAt as string),
        } as unknown as AutomationWorkflow;
      } catch (dateError) {
        throw new WorkflowServiceError(
          "Invalid date format in workflow data",
          "DATA_CORRUPTION",
          {
            workflowId,
            createdAt: workflowData.createdAt,
            updatedAt: workflowData.updatedAt,
          },
          dateError as Error
        );
      }
    } catch (error) {
      if (error instanceof WorkflowServiceError) {
        throw error;
      }

      if (error instanceof DatabaseError) {
        throw new WorkflowServiceError(
          "Failed to load workflow from database",
          "DATABASE_ERROR",
          { workflowId },
          error
        );
      }

      // Handle unexpected errors
      console.error("Unexpected error in loadWorkflowFromDatabase:", error);
      throw new WorkflowServiceError(
        "An unexpected error occurred while loading the workflow",
        "UNEXPECTED_ERROR",
        { workflowId },
        error as Error
      );
    }
  }

  /**
   * Loads workflows from database with filtering using Supabase
   */
  private async loadWorkflowsFromDatabase(
    options: WorkflowListOptions
  ): Promise<AutomationWorkflow[]> {
    try {
      // Validate pagination parameters
      if (options.limit && (options.limit < 1 || options.limit > 1000)) {
        throw new WorkflowServiceError(
          "Limit must be between 1 and 1000",
          "INVALID_REQUEST",
          { limit: options.limit }
        );
      }

      if (options.offset && options.offset < 0) {
        throw new WorkflowServiceError(
          "Offset must be non-negative",
          "INVALID_REQUEST",
          { offset: options.offset }
        );
      }

      const client = databaseService.getClient();

      let query = client.from("AutomationWorkflow").select("*");

      // Apply filters
      if (options.userId) {
        query = query.eq("userId", options.userId);
      }

      if (options.chatbotId) {
        query = query.eq("chatbotId", options.chatbotId);
      }

      if (options.isActive !== undefined) {
        query = query.eq("isActive", options.isActive);
      }

      // Apply pagination
      if (options.offset) {
        query = query.range(
          options.offset,
          options.offset + (options.limit || 50) - 1
        );
      } else if (options.limit) {
        query = query.limit(options.limit);
      }

      // Order by creation date (newest first)
      query = query.order("createdAt", { ascending: false });

      const result = await databaseService.executeQuery(
        async () => await query,
        "loadWorkflowsFromDatabase"
      );

      // Convert string dates back to Date objects and validate data
      const workflows = result as Record<string, unknown>[];

      try {
        return workflows.map(
          (workflow: Record<string, unknown>) =>
            ({
              ...workflow,
              createdAt: new Date(workflow.createdAt as string),
              updatedAt: new Date(workflow.updatedAt as string),
            } as AutomationWorkflow)
        );
      } catch (dateError) {
        throw new WorkflowServiceError(
          "Invalid date format in workflow data",
          "DATA_CORRUPTION",
          { workflowCount: workflows.length },
          dateError as Error
        );
      }
    } catch (error) {
      if (error instanceof WorkflowServiceError) {
        throw error;
      }

      if (error instanceof DatabaseError) {
        throw new WorkflowServiceError(
          "Failed to load workflows from database",
          "DATABASE_ERROR",
          { options },
          error
        );
      }

      // Handle unexpected errors
      console.error("Unexpected error in loadWorkflowsFromDatabase:", error);
      throw new WorkflowServiceError(
        "An unexpected error occurred while loading workflows",
        "UNEXPECTED_ERROR",
        { options },
        error as Error
      );
    }
  }

  /**
   * Deletes workflow from database using Supabase
   */
  private async deleteWorkflowFromDatabase(
    workflowId: string
  ): Promise<boolean> {
    try {
      if (!workflowId || workflowId.trim().length === 0) {
        throw new WorkflowServiceError(
          "Workflow ID is required for deletion",
          "INVALID_REQUEST",
          { workflowId }
        );
      }

      const client = databaseService.getClient();

      await databaseService.executeQuery(async () => {
        return await client
          .from("AutomationWorkflow")
          .delete()
          .eq("id", workflowId)
          .select()
          .single();
      }, "deleteWorkflowFromDatabase");

      return true;
    } catch (error) {
      if (error instanceof DatabaseError) {
        if (error.code === "RECORD_NOT_FOUND") {
          // Workflow doesn't exist, consider deletion successful
          console.warn(
            `Attempted to delete non-existent workflow: ${workflowId}`
          );
          return true;
        }

        console.error("Failed to delete workflow:", error);
        throw new WorkflowServiceError(
          "Failed to delete workflow from database",
          "DATABASE_ERROR",
          { workflowId },
          error
        );
      }

      if (error instanceof WorkflowServiceError) {
        throw error;
      }

      // Handle unexpected errors
      console.error("Unexpected error in deleteWorkflowFromDatabase:", error);
      throw new WorkflowServiceError(
        "An unexpected error occurred while deleting the workflow",
        "UNEXPECTED_ERROR",
        { workflowId },
        error as Error
      );
    }
  }
}

/**
 * Singleton instance for application use
 */
export const workflowService = new WorkflowService();

/**
 * Factory function for creating workflow service with custom config
 */
export function createWorkflowService(
  config: WorkflowServiceConfig
): WorkflowService {
  return new WorkflowService(config);
}
