/**
 * Event Processing Pipeline
 * 
 * Handles the processing of events from FastAPI through the workflow system
 */

import { workflowService } from './workflow-service';
import type { TriggerEvent, ExecutionResult } from './workflow-execution-engine';
import type { AutomationWorkflow } from '../types/database';
import { workflowTriggerMatcher } from './workflow-trigger-matcher';

export interface EventProcessingPipelineConfig {
  maxConcurrentExecutions?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface ProcessingResult {
  eventId: string;
  processedAt: Date;
  matchedWorkflows: number;
  executionResults: ExecutionResult[];
  errors: string[];
}

export class EventProcessingPipeline {
  private config: EventProcessingPipelineConfig;
  private activeExecutions: Set<string> = new Set();
  private eventQueue: Array<{ event: any; timestamp: Date }> = [];
  private processing = false;

  constructor(config: EventProcessingPipelineConfig = {}) {
    this.config = {
      maxConcurrentExecutions: 10,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };
  }

  /**
   * Receives and processes an event from FastAPI
   */
  async receiveEvent(eventData: any): Promise<ProcessingResult> {
    try {
      // Convert FastAPI event format to internal TriggerEvent format
      const triggerEvent = this.convertToTriggerEvent(eventData);
      
      // Add to processing queue
      this.eventQueue.push({
        event: triggerEvent,
        timestamp: new Date()
      });
      
      // Start processing if not already running
      if (!this.processing) {
        this.startProcessing();
      }
      
      // Process this specific event
      return await this.processEvent(triggerEvent);
      
    } catch (error) {
      console.error('Error receiving event:', error);
      throw new Error(`Failed to receive event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Processes a single event through the workflow pipeline
   */
  private async processEvent(triggerEvent: TriggerEvent): Promise<ProcessingResult> {
    const eventId = this.generateEventId(triggerEvent);
    const processedAt = new Date();
    const errors: string[] = [];
    
    try {
      // Find matching workflows
      const matchedWorkflows = await this.matchTriggers(triggerEvent);
      
      if (matchedWorkflows.length === 0) {
        console.log(`No workflows matched for event type: ${triggerEvent.type}`);
        return {
          eventId,
          processedAt,
          matchedWorkflows: 0,
          executionResults: [],
          errors
        };
      }
      
      // Execute matched workflows
      const executionResults = await this.executeWorkflows(matchedWorkflows, triggerEvent);
      
      return {
        eventId,
        processedAt,
        matchedWorkflows: matchedWorkflows.length,
        executionResults,
        errors
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
      errors.push(errorMessage);
      console.error(`Error processing event ${eventId}:`, error);
      
      return {
        eventId,
        processedAt,
        matchedWorkflows: 0,
        executionResults: [],
        errors
      };
    }
  }

  /**
   * Matches events against workflow triggers using the enhanced trigger matching system
   */
  async matchTriggers(event: TriggerEvent): Promise<AutomationWorkflow[]> {
    try {
      // Get chatbot ID from event for scoping
      const chatbotId = this.extractChatbotId(event);
      
      console.log(`Matching triggers for event type: ${event.type}, chatbotId: ${chatbotId}`);
      
      if (!chatbotId) {
        console.warn('No chatbot ID found in event, cannot match workflows');
        return [];
      }
      
      // Load active workflows for the chatbot
      const workflows = await workflowService.listWorkflows({
        chatbotId,
        isActive: true
      });
      
      console.log(`Found ${workflows.length} active workflows for chatbot ${chatbotId}`);
      
      // Use the enhanced trigger matching system
      const matchedWorkflows: AutomationWorkflow[] = [];
      
      for (const workflow of workflows) {
        try {
          console.log(`Evaluating workflow ${workflow.id} (${workflow.name}) against event ${event.type}`);
          
          const matchResult = await workflowTriggerMatcher.evaluateWorkflowTrigger(workflow, event);
          
          console.log(`Workflow ${workflow.id} match result:`, {
            matches: matchResult.matches,
            confidence: matchResult.confidence,
            matchedConditions: matchResult.matchedConditions
          });
          
          if (matchResult.matches) {
            console.log(`✅ Workflow ${workflow.id} matched with confidence ${matchResult.confidence}`);
            matchedWorkflows.push(workflow);
          } else {
            console.log(`❌ Workflow ${workflow.id} did not match`);
          }
        } catch (error) {
          console.error(`Error evaluating workflow ${workflow.id} against event:`, error);
          // Continue with other workflows even if one fails
        }
      }
      
      console.log(`Total matched workflows: ${matchedWorkflows.length}`);
      return matchedWorkflows;
      
    } catch (error) {
      console.error('Error matching triggers:', error);
      throw new Error(`Failed to match triggers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Executes matched workflows concurrently
   */
  async executeWorkflows(
    workflows: AutomationWorkflow[],
    triggerEvent: TriggerEvent
  ): Promise<ExecutionResult[]> {
    const executionPromises: Promise<ExecutionResult>[] = [];
    
    for (const workflow of workflows) {
      // Check concurrent execution limit
      if (this.activeExecutions.size >= this.config.maxConcurrentExecutions!) {
        console.warn(`Max concurrent executions reached (${this.config.maxConcurrentExecutions}), queuing workflow`);
        // In a production system, you'd want to implement proper queuing
        continue;
      }
      
      const executionId = `${workflow.id}_${Date.now()}`;
      this.activeExecutions.add(executionId);
      
      const executionPromise = this.executeWorkflowWithRetry(workflow, triggerEvent)
        .finally(() => {
          this.activeExecutions.delete(executionId);
        });
      
      executionPromises.push(executionPromise);
    }
    
    // Wait for all executions to complete
    const results = await Promise.allSettled(executionPromises);
    
    // Extract successful results and log failures
    const executionResults: ExecutionResult[] = [];
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        executionResults.push(result.value);
      } else {
        console.error('Workflow execution failed:', result.reason);
      }
    }
    
    return executionResults;
  }

  /**
   * Executes a workflow with retry logic
   */
  private async executeWorkflowWithRetry(
    workflow: AutomationWorkflow,
    triggerEvent: TriggerEvent,
    attempt = 1
  ): Promise<ExecutionResult> {
    try {
      return await workflowService.executeWorkflow(workflow.id, triggerEvent);
      
    } catch (error) {
      console.error(`Workflow execution attempt ${attempt} failed for ${workflow.id}:`, error);
      
      if (attempt < this.config.retryAttempts!) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay! * attempt));
        return this.executeWorkflowWithRetry(workflow, triggerEvent, attempt + 1);
      }
      
      // Max retries exceeded, throw error
      throw error;
    }
  }

  /**
   * Converts FastAPI event format to internal TriggerEvent format
   */
  private convertToTriggerEvent(eventData: any): TriggerEvent {
    const data = eventData.data || {};
    
    // Detect if this is a new conversation based on message data
    const triggerType = this.mapEventNameToTriggerType(eventData.name, data);
    
    console.log(`Converting event ${eventData.name} to trigger type: ${triggerType}`);
    
    return {
      type: triggerType,
      data: {
        ...data,
        eventName: eventData.name,
        timestamp: data.timestamp || new Date().toISOString()
      },
      conversationId: data.conversation_id,
      messageId: data.message_id,
      userId: data.user_id
    };
  }

  /**
   * Maps FastAPI event names to internal trigger types with intelligent detection
   */
  private mapEventNameToTriggerType(eventName: string, eventData?: any): string {
    const mapping: Record<string, string> = {
      'conversation.started': 'new_conversation',
      'message.created': 'message_created',
      'sentiment.trigger': 'sentiment_trigger',
      'intent.detected': 'intent_detected',
      'image.uploaded': 'image_uploaded'
    };
    
    // Direct mapping first
    if (mapping[eventName]) {
      return mapping[eventName];
    }
    
    // Intelligent detection for message.created events
    if (eventName === 'message.created' && eventData) {
      // Check if this is the first message in a conversation (new conversation)
      if (eventData.is_first_message || 
          eventData.message_count === 1 || 
          eventData.trigger_type === 'new_conversation') {
        console.log('Detected new conversation from message.created event');
        return 'new_conversation';
      }
      
      // Check for sentiment triggers
      if (eventData.sentiment || eventData.trigger_type?.includes('sentiment')) {
        const sentimentType = eventData.trigger_type || 'sentiment_trigger';
        console.log(`Detected sentiment trigger: ${sentimentType}`);
        return sentimentType;
      }
      
      // Check for intent detection
      if (eventData.intent || eventData.trigger_type === 'intent_detected') {
        console.log('Detected intent trigger');
        return 'intent_detected';
      }
      
      // Check for image uploads
      if (eventData.image_url || eventData.trigger_type === 'image_uploaded') {
        console.log('Detected image upload trigger');
        return 'image_uploaded';
      }
    }
    
    // Fallback to original event name
    return eventName;
  }

  /**
   * Extracts chatbot ID from event data
   */
  private extractChatbotId(event: TriggerEvent): string | null {
    return event.data.chatbot_id as string || 
           event.data.chatbotId as string || 
           null;
  }



  /**
   * Generates a unique event ID
   */
  private generateEventId(event: TriggerEvent): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `event_${event.type}_${timestamp}_${random}`;
  }

  /**
   * Starts processing queued events
   */
  private async startProcessing(): Promise<void> {
    if (this.processing) {
      return;
    }
    
    this.processing = true;
    
    try {
      while (this.eventQueue.length > 0) {
        const queuedEvent = this.eventQueue.shift();
        if (queuedEvent) {
          await this.processEvent(queuedEvent.event);
        }
      }
    } catch (error) {
      console.error('Error in event processing loop:', error);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Gets the health status of the pipeline
   */
  async getHealthStatus(): Promise<{
    status: string;
    activeExecutions: number;
    queuedEvents: number;
    maxConcurrentExecutions: number;
  }> {
    return {
      status: 'healthy',
      activeExecutions: this.activeExecutions.size,
      queuedEvents: this.eventQueue.length,
      maxConcurrentExecutions: this.config.maxConcurrentExecutions!
    };
  }
}