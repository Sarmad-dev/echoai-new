/**
 * Workflow Trigger Handlers
 * 
 * Implements the core trigger types for automation workflows:
 * - NewConversation: Triggered when a new conversation starts
 * - IntentDetected: Triggered when specific keywords/intents are detected
 * - NegativeSentiment: Triggered when sentiment score falls below threshold
 * - ImageUploaded: Triggered when user uploads an image
 * - HighValueLead: Triggered when high-value lead indicators are detected
 */

import type { TriggerEvent, WorkflowContext } from '../workflow-execution-engine';
import type { Message, ConversationSession } from '../../types/database';

export interface TriggerHandler {
  type: string;
  evaluate(event: TriggerEvent, config: TriggerConfig): Promise<boolean>;
  extractContext(event: TriggerEvent, config: TriggerConfig): Promise<Record<string, any>>;
}

export interface TriggerConfig {
  threshold?: number;
  keywords?: string[];
  conditions?: Record<string, any>;
  leadScoreThreshold?: number;
  sentimentThreshold?: number;
  intentKeywords?: string[];
  valueIndicators?: string[];
}

/**
 * New Conversation Trigger
 * Fires when a new conversation session is created
 */
export class NewConversationTrigger implements TriggerHandler {
  type = 'new_conversation';

  async evaluate(event: TriggerEvent, config: TriggerConfig): Promise<boolean> {
    // Check if this is a new conversation event
    const isNewConversation = (
      event.type === 'new_conversation' ||
      event.type === 'conversation_started' ||
      event.data.trigger_type === 'new_conversation' ||
      event.data.is_first_message === true ||
      event.data.message_count === 1
    );

    if (!isNewConversation) {
      return false;
    }

    // Additional conditions can be checked here
    if (config.conditions) {
      // Check if user is new vs returning
      if (config.conditions.newUsersOnly && event.data.isReturningUser) {
        return false;
      }
      
      // Check time-based conditions
      if (config.conditions.businessHoursOnly) {
        const hour = new Date().getHours();
        if (hour < 9 || hour > 17) {
          return false;
        }
      }
    }

    return true;
  }

  async extractContext(event: TriggerEvent, config: TriggerConfig): Promise<Record<string, any>> {
    return {
      conversationId: event.conversationId || event.data.conversation_id,
      userId: event.userId || event.data.user_id,
      userEmail: event.data.userEmail || event.data.user_email,
      isNewUser: event.data.isNewUser || event.data.is_new_user,
      isFirstMessage: event.data.is_first_message,
      messageCount: event.data.message_count,
      timestamp: event.data.timestamp || new Date().toISOString(),
      triggerType: this.type
    };
  }
}

/**
 * Intent Detection Trigger
 * Fires when specific keywords or intents are detected in messages
 */
export class IntentDetectedTrigger implements TriggerHandler {
  type = 'intent_detected';

  async evaluate(event: TriggerEvent, config: TriggerConfig): Promise<boolean> {
    if (event.type !== 'message_received' && event.type !== 'new_conversation' && event.type !== 'message_created') {
      return false;
    }

    const message = (event.data.message || event.data.content || '') as string;
    if (!message || !config.keywords || config.keywords.length === 0) {
      return false;
    }

    const messageText = message.toLowerCase();
    
    // Check if any of the configured keywords are present
    return config.keywords.some(keyword => {
      if (!keyword) return false;
      return messageText.includes(keyword.toLowerCase());
    });
  }

  async extractContext(event: TriggerEvent, config: TriggerConfig): Promise<Record<string, any>> {
    const message = (event.data.message || event.data.content || '') as string;
    const matchedKeywords = config.keywords?.filter(keyword => {
      if (!message || !keyword) return false;
      return message.toLowerCase().includes(keyword.toLowerCase());
    }) || [];

    return {
      conversationId: event.conversationId,
      messageId: event.messageId,
      message,
      matchedKeywords,
      confidence: this.calculateConfidence(message, matchedKeywords),
      timestamp: new Date().toISOString(),
      triggerType: this.type
    };
  }

  private calculateConfidence(message: string, matchedKeywords: string[]): number {
    // Simple confidence calculation based on keyword matches
    if (!message || matchedKeywords.length === 0) {
      return 0;
    }
    
    const totalWords = message.split(/\s+/).filter(word => word.length > 0).length;
    const keywordMatches = matchedKeywords.length;
    
    if (totalWords === 0) {
      return keywordMatches > 0 ? 1.0 : 0;
    }
    
    return Math.min(keywordMatches / totalWords * 2, 1.0);
  }
}

/**
 * Negative Sentiment Trigger
 * Fires when message sentiment score falls below configured threshold
 */
export class NegativeSentimentTrigger implements TriggerHandler {
  type = 'negative_sentiment';

  async evaluate(event: TriggerEvent, config: TriggerConfig): Promise<boolean> {
    if (event.type !== 'sentiment_analyzed') {
      return false;
    }

    const sentimentScore = event.data.sentimentScore as number;
    const threshold = config.sentimentThreshold ?? -0.2;

    return sentimentScore < threshold;
  }

  async extractContext(event: TriggerEvent, config: TriggerConfig): Promise<Record<string, any>> {
    return {
      conversationId: event.conversationId,
      messageId: event.messageId,
      sentimentScore: event.data.sentimentScore,
      threshold: config.sentimentThreshold ?? -0.2,
      message: event.data.message,
      urgencyLevel: this.calculateUrgencyLevel(event.data.sentimentScore as number),
      timestamp: new Date().toISOString(),
      triggerType: this.type
    };
  }

  private calculateUrgencyLevel(sentimentScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (sentimentScore < -0.8) return 'critical';
    if (sentimentScore < -0.5) return 'high';
    if (sentimentScore < -0.2) return 'medium';
    return 'low';
  }
}

/**
 * Image Uploaded Trigger
 * Fires when user uploads an image in the conversation
 */
export class ImageUploadedTrigger implements TriggerHandler {
  type = 'image_uploaded';

  async evaluate(event: TriggerEvent, config: TriggerConfig): Promise<boolean> {
    if (event.type !== 'image_uploaded') {
      return false;
    }

    // Additional conditions can be checked here
    if (config.conditions) {
      // Check image type restrictions
      if (config.conditions.allowedTypes) {
        const imageType = event.data.imageType as string;
        if (!config.conditions.allowedTypes.includes(imageType)) {
          return false;
        }
      }

      // Check file size restrictions
      if (config.conditions.maxSizeBytes) {
        const fileSize = event.data.fileSize as number;
        if (fileSize > config.conditions.maxSizeBytes) {
          return false;
        }
      }
    }

    return true;
  }

  async extractContext(event: TriggerEvent, config: TriggerConfig): Promise<Record<string, any>> {
    return {
      conversationId: event.conversationId,
      messageId: event.messageId,
      imageUrl: event.data.imageUrl,
      imageType: event.data.imageType,
      fileSize: event.data.fileSize,
      fileName: event.data.fileName,
      timestamp: new Date().toISOString(),
      triggerType: this.type
    };
  }
}

/**
 * High Value Lead Trigger
 * Fires when conversation indicates high-value lead potential
 */
export class HighValueLeadTrigger implements TriggerHandler {
  type = 'high_value_lead';

  async evaluate(event: TriggerEvent, config: TriggerConfig): Promise<boolean> {
    if (event.type !== 'lead_scored') {
      return false;
    }

    const leadScore = event.data.leadScore as number;
    const threshold = config.leadScoreThreshold ?? 0.7;

    return leadScore >= threshold;
  }

  async extractContext(event: TriggerEvent, config: TriggerConfig): Promise<Record<string, any>> {
    const leadScore = event.data.leadScore as number;
    
    return {
      conversationId: event.conversationId,
      messageId: event.messageId,
      leadScore,
      threshold: config.leadScoreThreshold ?? 0.7,
      leadIndicators: event.data.leadIndicators || [],
      companySize: event.data.companySize,
      industry: event.data.industry,
      budget: event.data.budget,
      timeline: event.data.timeline,
      priority: this.calculatePriority(leadScore),
      timestamp: new Date().toISOString(),
      triggerType: this.type
    };
  }

  private calculatePriority(leadScore: number): 'low' | 'medium' | 'high' | 'urgent' {
    if (leadScore >= 0.9) return 'urgent';
    if (leadScore >= 0.8) return 'high';
    if (leadScore >= 0.7) return 'medium';
    return 'low';
  }
}

/**
 * Escalation Trigger
 * Fires when conversation needs to be escalated to human agents
 * Integrates with the escalation trigger system
 */
export class EscalationTrigger implements TriggerHandler {
  type = 'escalation_trigger';

  async evaluate(event: TriggerEvent, config: TriggerConfig): Promise<boolean> {
    // Handle sentiment-based escalation
    if (event.type === 'sentiment_analyzed' || event.type === 'message_received') {
      const sentimentScore = event.data.sentimentScore as number;
      if (sentimentScore !== undefined) {
        const threshold = config.sentimentThreshold ?? -0.3;
        return sentimentScore < threshold;
      }
    }

    // Handle keyword-based escalation
    if (event.type === 'message_received' || event.type === 'message_created') {
      const message = (event.data.message || event.data.content || '') as string;
      if (message && config.keywords && config.keywords.length > 0) {
        const messageText = message.toLowerCase();
        return config.keywords.some(keyword => 
          messageText.includes(keyword.toLowerCase())
        );
      }
    }

    // Handle duration-based escalation
    if (event.type === 'conversation_timeout' || event.type === 'response_timeout') {
      const waitTimeMinutes = event.data.waitTimeMinutes as number;
      const threshold = config.conditions?.responseTimeMinutes ?? 30;
      return waitTimeMinutes >= threshold;
    }

    return false;
  }

  async extractContext(event: TriggerEvent, config: TriggerConfig): Promise<Record<string, any>> {
    const context: Record<string, any> = {
      conversationId: event.conversationId,
      messageId: event.messageId,
      timestamp: new Date().toISOString(),
      triggerType: this.type,
      escalationReason: 'Unknown'
    };

    // Add sentiment-specific context
    if (event.data.sentimentScore !== undefined) {
      context.sentimentScore = event.data.sentimentScore;
      context.sentimentThreshold = config.sentimentThreshold ?? -0.3;
      context.escalationReason = `Negative sentiment detected (${event.data.sentimentScore})`;
      context.urgencyLevel = this.calculateUrgencyLevel(event.data.sentimentScore as number);
    }

    // Add keyword-specific context
    if (config.keywords && event.data.message) {
      const message = event.data.message as string;
      const matchedKeywords = config.keywords.filter(keyword =>
        message.toLowerCase().includes(keyword.toLowerCase())
      );
      if (matchedKeywords.length > 0) {
        context.matchedKeywords = matchedKeywords;
        context.escalationReason = `Critical keywords detected: ${matchedKeywords.join(', ')}`;
        context.urgencyLevel = 'critical';
      }
    }

    // Add duration-specific context
    if (event.data.waitTimeMinutes !== undefined) {
      context.waitTimeMinutes = event.data.waitTimeMinutes;
      context.responseTimeThreshold = config.conditions?.responseTimeMinutes ?? 30;
      context.escalationReason = `Response timeout (${event.data.waitTimeMinutes} minutes)`;
      context.urgencyLevel = 'medium';
    }

    return context;
  }

  private calculateUrgencyLevel(sentimentScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (sentimentScore < -0.7) return 'critical';
    if (sentimentScore < -0.5) return 'high';
    if (sentimentScore < -0.3) return 'medium';
    return 'low';
  }
}

/**
 * Conversation Triage Trigger
 * Fires when conversation meets triage criteria for prioritization
 * Integrates with the conversation triage system
 */
export class ConversationTriageTrigger implements TriggerHandler {
  type = 'conversation_triage';

  async evaluate(event: TriggerEvent, config: TriggerConfig): Promise<boolean> {
    // Check sentiment-based triage
    if (event.type === 'sentiment_analyzed' && event.data.sentimentScore !== undefined) {
      const sentimentScore = event.data.sentimentScore as number;
      const threshold = config.sentimentThreshold ?? -0.6;
      if (sentimentScore < threshold) {
        return true;
      }
    }

    // Check keyword-based triage
    if (event.type === 'message_received' || event.type === 'message_created') {
      const message = (event.data.message || event.data.content || '') as string;
      if (message && config.keywords && config.keywords.length > 0) {
        const messageText = message.toLowerCase();
        const hasKeyword = config.keywords.some(keyword =>
          messageText.includes(keyword.toLowerCase())
        );
        if (hasKeyword) {
          return true;
        }
      }
    }

    // Check message count-based triage
    if (event.data.messageCount !== undefined) {
      const messageCount = event.data.messageCount as number;
      const threshold = config.conditions?.messageCount ?? 5;
      if (messageCount >= threshold) {
        return true;
      }
    }

    // Check response time-based triage
    if (event.data.waitTimeMinutes !== undefined) {
      const waitTime = event.data.waitTimeMinutes as number;
      const threshold = config.conditions?.responseTimeMinutes ?? 30;
      if (waitTime >= threshold) {
        return true;
      }
    }

    return false;
  }

  async extractContext(event: TriggerEvent, config: TriggerConfig): Promise<Record<string, any>> {
    const context: Record<string, any> = {
      conversationId: event.conversationId,
      messageId: event.messageId,
      timestamp: new Date().toISOString(),
      triggerType: this.type,
      triageReason: 'Unknown',
      priority: 'medium'
    };

    // Determine triage reason and priority
    if (event.data.sentimentScore !== undefined) {
      const sentimentScore = event.data.sentimentScore as number;
      context.sentimentScore = sentimentScore;
      context.triageReason = 'High Priority Negative Sentiment';
      context.priority = sentimentScore < -0.8 ? 'critical' : 'high';
    }

    if (config.keywords && event.data.message) {
      const message = event.data.message as string;
      const matchedKeywords = config.keywords.filter(keyword =>
        message.toLowerCase().includes(keyword.toLowerCase())
      );
      if (matchedKeywords.length > 0) {
        context.matchedKeywords = matchedKeywords;
        context.triageReason = 'Critical Issue Keywords';
        context.priority = 'critical';
      }
    }

    if (event.data.messageCount !== undefined) {
      context.messageCount = event.data.messageCount;
      context.triageReason = 'Multiple Customer Messages';
      context.priority = 'medium';
    }

    if (event.data.waitTimeMinutes !== undefined) {
      context.waitTimeMinutes = event.data.waitTimeMinutes;
      context.triageReason = 'Long Response Time';
      context.priority = 'medium';
    }

    return context;
  }
}

/**
 * Trigger Registry
 * Central registry for all available trigger handlers
 */
export class TriggerRegistry {
  // Primary triggers - only one entry per unique trigger type
  private static triggers = new Map<string, TriggerHandler>([
    ['new_conversation', new NewConversationTrigger()],
    ['intent_detected', new IntentDetectedTrigger()],
    ['negative_sentiment', new NegativeSentimentTrigger()],
    ['high_value_lead', new HighValueLeadTrigger()],
    ['escalation_trigger', new EscalationTrigger()],
    ['conversation_triage', new ConversationTriageTrigger()]
  ]);

  // Alternative naming mappings for backward compatibility
  private static aliases = new Map<string, string>([
    ['NewConversation', 'new_conversation'],
    ['conversation_started', 'new_conversation'],
    ['IntentDetected', 'intent_detected'],
    ['NegativeSentiment', 'negative_sentiment'],
    ['sentiment_trigger', 'negative_sentiment'],
    ['ImageUploaded', 'image_uploaded'],
    ['HighValueLead', 'high_value_lead'],
    ['EscalationTrigger', 'escalation_trigger'],
    ['escalation', 'escalation_trigger'],
    ['sentiment_escalation', 'escalation_trigger'],
    ['ConversationTriage', 'conversation_triage'],
    ['triage', 'conversation_triage'],
    ['priority_triage', 'conversation_triage'],
    ['unknown', 'new_conversation'] // Fallback
  ]);

  static getTrigger(type: string): TriggerHandler | undefined {
    // First try direct lookup
    let trigger = this.triggers.get(type);
    if (trigger) {
      return trigger;
    }
    
    // Try alias lookup
    const aliasedType = this.aliases.get(type);
    if (aliasedType) {
      trigger = this.triggers.get(aliasedType);
      if (trigger) {
        return trigger;
      }
    }
    
    // Try case-insensitive match
    const lowerType = type.toLowerCase();
    for (const [key, handler] of Array.from(this.triggers.entries())) {
      if (key.toLowerCase() === lowerType) {
        return handler;
      }
    }
    
    // Check aliases case-insensitively
    for (const [alias, primaryType] of Array.from(this.aliases.entries())) {
      if (alias.toLowerCase() === lowerType) {
        return this.triggers.get(primaryType);
      }
    }
    
    // Return new conversation trigger as fallback for unknown types
    console.warn(`Unknown trigger type: ${type}, using new_conversation as fallback`);
    return this.triggers.get('new_conversation');
  }

  static getAllTriggers(): TriggerHandler[] {
    // Return unique triggers only (no duplicates)
    return Array.from(this.triggers.values());
  }

  static getTriggerTypes(): string[] {
    // Return only primary trigger types (no aliases/duplicates)
    return Array.from(this.triggers.keys());
  }

  static registerTrigger(trigger: TriggerHandler): void {
    this.triggers.set(trigger.type, trigger);
  }

  static getAliases(): string[] {
    return Array.from(this.aliases.keys());
  }
}

/**
 * Trigger Event Processor
 * Processes incoming events and determines which workflows should be triggered
 */
export class TriggerEventProcessor {
  async processEvent(
    event: TriggerEvent,
    workflows: Array<{ id: string; triggers: Array<{ type: string; config: TriggerConfig }> }>
  ): Promise<Array<{ workflowId: string; context: Record<string, any> }>> {
    const triggeredWorkflows: Array<{ workflowId: string; context: Record<string, any> }> = [];

    for (const workflow of workflows) {
      for (const triggerConfig of workflow.triggers) {
        const trigger = TriggerRegistry.getTrigger(triggerConfig.type);
        
        if (trigger) {
          try {
            const shouldTrigger = await trigger.evaluate(event, triggerConfig.config);
            
            if (shouldTrigger) {
              const context = await trigger.extractContext(event, triggerConfig.config);
              triggeredWorkflows.push({
                workflowId: workflow.id,
                context
              });
            }
          } catch (error) {
            console.error(`Error evaluating trigger ${triggerConfig.type}:`, error);
          }
        }
      }
    }

    return triggeredWorkflows;
  }
}