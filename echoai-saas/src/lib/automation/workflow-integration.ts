/**
 * Workflow Integration for Escalation and Triage Systems
 * 
 * Connects the escalation triggers and conversation triage systems
 * with the workflow automation platform for seamless integration.
 * 
 * This module provides:
 * - Event bridging between automation systems and workflows
 * - Trigger event generation for escalation and triage scenarios
 * - Integration with the workflow execution engine
 */

import { escalationTriggerSystem } from './escalation-triggers';
import { conversationTriageEngine } from './conversation-triage';
import { WorkflowExecutionEngine, type TriggerEvent } from '../workflow-execution-engine';
import { WorkflowService } from '../workflow-service';
import type { ConversationStatus } from '../../types/database';

// Create singleton instances
const workflowExecutionEngine = new WorkflowExecutionEngine();
const workflowService = new WorkflowService();

export interface AutomationEvent {
  type: 'message_received' | 'sentiment_analyzed' | 'conversation_timeout' | 'escalation_triggered' | 'triage_completed';
  conversationId: string;
  messageId?: string;
  data: {
    message?: string;
    sentimentScore?: number;
    messageCount?: number;
    waitTimeMinutes?: number;
    escalationReason?: string;
    triageReason?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    [key: string]: any;
  };
  timestamp: Date;
}

/**
 * Workflow Integration Manager
 * Coordinates between automation systems and workflow execution
 */
export class WorkflowIntegrationManager {
  /**
   * Processes an automation event and triggers relevant workflows
   */
  async processAutomationEvent(event: AutomationEvent): Promise<void> {
    try {
      console.log(`Processing automation event: ${event.type} for conversation ${event.conversationId}`);

      // Convert automation event to trigger event format
      const triggerEvent = this.convertToTriggerEvent(event);

      // Process escalation triggers if applicable
      if (this.shouldProcessEscalation(event)) {
        await this.processEscalationTriggers(event, triggerEvent);
      }

      // Process triage triggers if applicable
      if (this.shouldProcessTriage(event)) {
        await this.processTriageTriggers(event, triggerEvent);
      }

      // Execute workflows that match this trigger event
      await this.executeMatchingWorkflows(triggerEvent);

    } catch (error) {
      console.error('Error processing automation event:', error);
    }
  }

  /**
   * Processes message events for escalation and triage evaluation
   */
  async processMessageEvent(
    conversationId: string,
    messageId: string,
    messageContent: string,
    sentimentScore?: number,
    messageCount?: number
  ): Promise<void> {
    const event: AutomationEvent = {
      type: 'message_received',
      conversationId,
      messageId,
      data: {
        message: messageContent,
        sentimentScore,
        messageCount
      },
      timestamp: new Date()
    };

    await this.processAutomationEvent(event);
  }

  /**
   * Processes sentiment analysis events
   */
  async processSentimentEvent(
    conversationId: string,
    messageId: string,
    sentimentScore: number,
    messageContent: string
  ): Promise<void> {
    const event: AutomationEvent = {
      type: 'sentiment_analyzed',
      conversationId,
      messageId,
      data: {
        sentimentScore,
        message: messageContent
      },
      timestamp: new Date()
    };

    await this.processAutomationEvent(event);
  }

  /**
   * Processes conversation timeout events
   */
  async processTimeoutEvent(
    conversationId: string,
    waitTimeMinutes: number
  ): Promise<void> {
    const event: AutomationEvent = {
      type: 'conversation_timeout',
      conversationId,
      data: {
        waitTimeMinutes
      },
      timestamp: new Date()
    };

    await this.processAutomationEvent(event);
  }

  /**
   * Converts automation event to workflow trigger event format
   */
  private convertToTriggerEvent(event: AutomationEvent): TriggerEvent {
    return {
      type: event.type,
      conversationId: event.conversationId,
      messageId: event.messageId,
      userId: event.data.userId,
      data: {
        ...event.data,
        timestamp: event.timestamp.toISOString()
      }
    };
  }

  /**
   * Determines if event should be processed for escalation
   */
  private shouldProcessEscalation(event: AutomationEvent): boolean {
    return (
      event.type === 'message_received' ||
      event.type === 'sentiment_analyzed' ||
      event.type === 'conversation_timeout'
    ) && (
      event.data.sentimentScore !== undefined ||
      event.data.waitTimeMinutes !== undefined ||
      (event.data.message ? this.hasEscalationKeywords(event.data.message) : false)
    );
  }

  /**
   * Determines if event should be processed for triage
   */
  private shouldProcessTriage(event: AutomationEvent): boolean {
    return (
      event.type === 'message_received' ||
      event.type === 'sentiment_analyzed' ||
      event.type === 'conversation_timeout'
    ) && (
      event.data.sentimentScore !== undefined ||
      event.data.messageCount !== undefined ||
      event.data.waitTimeMinutes !== undefined ||
      (event.data.message ? this.hasTriageKeywords(event.data.message) : false)
    );
  }

  /**
   * Processes escalation triggers for the event
   */
  private async processEscalationTriggers(
    event: AutomationEvent,
    triggerEvent: TriggerEvent
  ): Promise<void> {
    try {
      if (event.data.sentimentScore !== undefined && event.messageId) {
        const results = await escalationTriggerSystem.processMessage(
          event.conversationId,
          event.messageId,
          event.data.message || '',
          event.data.sentimentScore
        );

        // If escalation was triggered, create escalation event
        if (results.length > 0 && results.some(r => r.success)) {
          const escalationEvent: AutomationEvent = {
            type: 'escalation_triggered',
            conversationId: event.conversationId,
            messageId: event.messageId,
            data: {
              escalationReason: results[0].triggerReason,
              sentimentScore: event.data.sentimentScore,
              previousStatus: results[0].previousStatus,
              newStatus: results[0].newStatus
            },
            timestamp: new Date()
          };

          // Process the escalation event through workflows
          const escalationTriggerEvent = this.convertToTriggerEvent(escalationEvent);
          await this.executeMatchingWorkflows(escalationTriggerEvent);
        }
      }
    } catch (error) {
      console.error('Error processing escalation triggers:', error);
    }
  }

  /**
   * Processes triage triggers for the event
   */
  private async processTriageTriggers(
    event: AutomationEvent,
    triggerEvent: TriggerEvent
  ): Promise<void> {
    try {
      const results = await conversationTriageEngine.evaluateConversation(
        event.conversationId,
        event.data.message,
        event.data.sentimentScore,
        event.data
      );

      // If triage was triggered, create triage event
      if (results.length > 0 && results.some(r => r.success)) {
        const triageEvent: AutomationEvent = {
          type: 'triage_completed',
          conversationId: event.conversationId,
          messageId: event.messageId,
          data: {
            triageReason: results[0].reason,
            priority: results[0].priority,
            action: results[0].action
          },
          timestamp: new Date()
        };

        // Process the triage event through workflows
        const triageTriggerEvent = this.convertToTriggerEvent(triageEvent);
        await this.executeMatchingWorkflows(triageTriggerEvent);
      }
    } catch (error) {
      console.error('Error processing triage triggers:', error);
    }
  }

  /**
   * Executes workflows that match the trigger event
   */
  private async executeMatchingWorkflows(triggerEvent: TriggerEvent): Promise<void> {
    try {
      // Get active workflows that might match this trigger
      const workflows = await workflowService.listWorkflows({ isActive: true });

      for (const workflow of workflows) {
        try {
          // Execute workflow if it matches the trigger
          await workflowExecutionEngine.executeWorkflow(workflow, triggerEvent);
        } catch (error) {
          console.error(`Error executing workflow ${workflow.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error executing matching workflows:', error);
    }
  }

  /**
   * Checks if message contains escalation keywords
   */
  private hasEscalationKeywords(message: string): boolean {
    const escalationKeywords = [
      'urgent', 'emergency', 'critical', 'lawsuit', 'legal',
      'refund', 'cancel subscription', 'angry', 'frustrated',
      'terrible', 'awful', 'worst', 'hate'
    ];
    
    const messageText = message.toLowerCase();
    return escalationKeywords.some(keyword => messageText.includes(keyword));
  }

  /**
   * Checks if message contains triage keywords
   */
  private hasTriageKeywords(message: string): boolean {
    const triageKeywords = [
      'urgent', 'emergency', 'critical', 'important', 'asap',
      'immediately', 'now', 'today', 'help', 'problem',
      'issue', 'bug', 'error', 'broken', 'not working'
    ];
    
    const messageText = message.toLowerCase();
    return triageKeywords.some(keyword => messageText.includes(keyword));
  }

  /**
   * Gets escalation analytics integrated with workflow metrics
   */
  async getIntegratedAnalytics(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<{
    escalationMetrics: any;
    triageMetrics: any;
    workflowExecutions: number;
    automationEfficiency: number;
  }> {
    try {
      const [escalationMetrics, triageMetrics] = await Promise.all([
        escalationTriggerSystem.getEscalationAnalytics(timeframe),
        conversationTriageEngine.getTriageAnalytics(timeframe)
      ]);

      // Get workflow execution metrics (mock for now)
      const workflowExecutions = 245; // This would come from workflow execution logs
      const automationEfficiency = 0.78; // Calculated based on successful automations

      return {
        escalationMetrics,
        triageMetrics,
        workflowExecutions,
        automationEfficiency
      };
    } catch (error) {
      console.error('Error getting integrated analytics:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const workflowIntegrationManager = new WorkflowIntegrationManager();

/**
 * Convenience functions for common integration scenarios
 */

/**
 * Processes a new message through the integrated automation system
 */
export async function processMessageForAutomation(
  conversationId: string,
  messageId: string,
  messageContent: string,
  sentimentScore?: number,
  messageCount?: number
): Promise<void> {
  await workflowIntegrationManager.processMessageEvent(
    conversationId,
    messageId,
    messageContent,
    sentimentScore,
    messageCount
  );
}

/**
 * Processes sentiment analysis results through the automation system
 */
export async function processSentimentForAutomation(
  conversationId: string,
  messageId: string,
  sentimentScore: number,
  messageContent: string
): Promise<void> {
  await workflowIntegrationManager.processSentimentEvent(
    conversationId,
    messageId,
    sentimentScore,
    messageContent
  );
}

/**
 * Processes conversation timeouts through the automation system
 */
export async function processTimeoutForAutomation(
  conversationId: string,
  waitTimeMinutes: number
): Promise<void> {
  await workflowIntegrationManager.processTimeoutEvent(
    conversationId,
    waitTimeMinutes
  );
}