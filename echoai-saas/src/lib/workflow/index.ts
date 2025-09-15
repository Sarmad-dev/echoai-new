/**
 * Workflow System Exports
 * 
 * Central export point for all workflow-related functionality
 */

// Core workflow compiler
export { WorkflowCompiler } from '../workflow-compiler';
export type { 
  ValidationResult as WorkflowCompilerValidationResult, 
  ValidationError, 
  ValidationWarning,
  WorkflowContext,
  TriggerNodeData,
  ActionNodeData,
  ConditionNodeData
} from '../workflow-compiler';

// Workflow execution engine
export { 
  WorkflowExecutionEngine, 
  DefaultActionExecutor,
  EnhancedActionExecutor 
} from '../workflow-execution-engine';
export type { 
  ExecutionResult, 
  ExecutionLog, 
  TriggerEvent, 
  ActionExecutor, 
  ActionResult 
} from '../workflow-execution-engine';

// Trigger handlers
export {
  TriggerRegistry,
  TriggerEventProcessor,
  NewConversationTrigger,
  IntentDetectedTrigger,
  NegativeSentimentTrigger,
  ImageUploadedTrigger,
  HighValueLeadTrigger,
  EscalationTrigger,
  ConversationTriageTrigger
} from './triggers';
export type {
  TriggerHandler,
  TriggerConfig
} from './triggers';

// Action handlers
export {
  ActionRegistry,
  AddNoteAction,
  TagConversationAction,
  SendSlackMessageAction,
  CreateHubSpotContactAction,
  AutoApproveReturnAction
} from './actions';
export type {
  ActionHandler,
  ActionConfig,
  ActionConfigSchema,
  ValidationResult
} from './actions';

// Execution logging
export { workflowLogger } from './execution-logger';
export type {
  LogEntry,
  ErrorDetails,
  ExecutionMetrics,
  RetryPolicy
} from './execution-logger';

// Workflow service
export { 
  WorkflowService, 
  workflowService, 
  createWorkflowService 
} from '../workflow-service';
export type { 
  WorkflowServiceConfig, 
  CreateWorkflowRequest, 
  UpdateWorkflowRequest, 
  WorkflowListOptions 
} from '../workflow-service';

// Re-export database types for convenience
export type {
  AutomationWorkflow,
  WorkflowExecution,
  ReactFlowDefinition,
  WorkflowNode,
  WorkflowEdge,
  XStateDefinition,
  ExecutionStatus
} from '../../types/database';