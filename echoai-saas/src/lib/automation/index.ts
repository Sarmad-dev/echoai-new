/**
 * Automation System Exports
 * 
 * Central export point for all automation-related functionality including
 * escalation triggers, conversation triage, and workflow integration.
 */

// Escalation trigger system
export {
  SentimentEscalationTrigger,
  EscalationConfigManager,
  EscalationTriggerSystem,
  escalationTriggerSystem
} from './escalation-triggers';
export type {
  EscalationTriggerConfig,
  EscalationEvent,
  EscalationResult
} from './escalation-triggers';

// Conversation triage system
export {
  ConversationTriageEngine,
  conversationTriageEngine
} from './conversation-triage';
export type {
  TriageRule,
  TriageResult,
  PriorityQueueItem,
  NotificationEvent
} from './conversation-triage';

// Conversation status updater
export { conversationStatusUpdater } from './conversation-status-updater';
export type {
  StatusUpdateRequest,
  StatusUpdateResult
} from './conversation-status-updater';

// Escalation logger
export { escalationLogger } from './escalation-logger';
export type {
  EscalationLogEntry,
  EscalationMetrics,
  EscalationTrend
} from './escalation-logger';

// Workflow integration
export {
  WorkflowIntegrationManager,
  workflowIntegrationManager,
  processMessageForAutomation,
  processSentimentForAutomation,
  processTimeoutForAutomation
} from './workflow-integration';
export type {
  AutomationEvent
} from './workflow-integration';

// Re-export workflow system for convenience
export {
  TriggerRegistry,
  ActionRegistry
} from '../workflow';