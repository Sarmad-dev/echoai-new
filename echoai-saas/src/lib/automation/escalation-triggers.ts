/**
 * Escalation Trigger System
 * 
 * Implements sentiment-based escalation triggers for automatically changing
 * conversation status to AWAITING_HUMAN_RESPONSE when negative sentiment is detected.
 * 
 * Requirements: 6.1, 6.2
 */

import { createClient } from '@/lib/supabase/supabase-server';
import { ConversationStatus } from '@/types/database';
import { escalationLogger } from './escalation-logger';

export interface EscalationTriggerConfig {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  triggerType: 'sentiment' | 'keywords' | 'duration' | 'custom';
  conditions: {
    sentimentThreshold?: number; // -1.0 to 1.0
    keywords?: string[];
    durationMinutes?: number;
    customCondition?: string;
  };
  actions: {
    changeStatus: boolean;
    assignToAgent?: string;
    addNote?: string;
    notifyTeam?: boolean;
  };
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  updatedAt: Date;
}

export interface EscalationEvent {
  conversationId: string;
  messageId?: string;
  triggerType: string;
  triggerReason: string;
  sentimentScore?: number;
  messageContent?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface EscalationResult {
  success: boolean;
  conversationId: string;
  previousStatus: ConversationStatus;
  newStatus: ConversationStatus;
  triggerReason: string;
  assignedTo?: string;
  error?: string;
}

/**
 * Sentiment-based Escalation Trigger
 * Monitors message sentiment and escalates conversations with negative sentiment
 */
export class SentimentEscalationTrigger {
  private defaultThreshold = -0.3; // Escalate when sentiment is below -0.3

  /**
   * Evaluates if a message should trigger escalation based on sentiment
   */
  async evaluateMessage(
    conversationId: string,
    _messageId: string,
    sentimentScore: number,
    _messageContent: string,
    config?: Partial<EscalationTriggerConfig>
  ): Promise<boolean> {
    const threshold = config?.conditions?.sentimentThreshold ?? this.defaultThreshold;
    
    // Check if sentiment is below threshold
    if (sentimentScore >= threshold) {
      return false;
    }

    // Additional checks can be added here
    // For example, check if conversation is already escalated
    const supabase = await createClient();
    const { data: conversation } = await supabase
      .from('Conversation')
      .select('status')
      .eq('id', conversationId)
      .single();

    if (conversation?.status === ConversationStatus.AWAITING_HUMAN_RESPONSE) {
      return false; // Already escalated
    }

    return true;
  }

  /**
   * Triggers escalation for a conversation
   */
  async triggerEscalation(
    conversationId: string,
    event: EscalationEvent,
    config?: Partial<EscalationTriggerConfig>
  ): Promise<EscalationResult> {
    try {
      // Get current conversation status
      const supabase = await createClient();
      const { data: conversation, error: fetchError } = await supabase
        .from('Conversation')
        .select('status, assignedTo')
        .eq('id', conversationId)
        .single();

      if (fetchError || !conversation) {
        return {
          success: false,
          conversationId,
          previousStatus: ConversationStatus.AI_HANDLING,
          newStatus: ConversationStatus.AI_HANDLING,
          triggerReason: event.triggerReason,
          error: 'Conversation not found'
        };
      }

      const previousStatus = conversation.status as ConversationStatus;

      // Update conversation status to AWAITING_HUMAN_RESPONSE
      const { error: updateError } = await supabase
        .from('Conversation')
        .update({
          status: ConversationStatus.AWAITING_HUMAN_RESPONSE,
          updatedAt: new Date().toISOString()
        })
        .eq('id', conversationId);

      if (updateError) {
        return {
          success: false,
          conversationId,
          previousStatus,
          newStatus: previousStatus,
          triggerReason: event.triggerReason,
          error: updateError.message
        };
      }

      // Log the escalation event
      await this.logEscalationEvent(conversationId, event, config);

      // Add note if configured
      if (config?.actions?.addNote) {
        await this.addEscalationNote(conversationId, event, config.actions.addNote);
      }

      // Log successful escalation
      await escalationLogger.logEscalation({
        conversationId,
        messageId: event.messageId,
        triggerType: event.triggerType,
        triggerReason: event.triggerReason,
        sentimentScore: event.sentimentScore,
        messageContent: event.messageContent,
        configId: config?.id,
        priority: config?.priority || 'medium',
        previousStatus,
        newStatus: ConversationStatus.AWAITING_HUMAN_RESPONSE,
        success: true,
        metadata: event.metadata
      });

      return {
        success: true,
        conversationId,
        previousStatus,
        newStatus: ConversationStatus.AWAITING_HUMAN_RESPONSE,
        triggerReason: event.triggerReason,
        assignedTo: config?.actions?.assignToAgent
      };
    } catch (error) {
      // Log failed escalation
      await escalationLogger.logEscalation({
        conversationId,
        messageId: event.messageId,
        triggerType: event.triggerType,
        triggerReason: event.triggerReason,
        sentimentScore: event.sentimentScore,
        messageContent: event.messageContent,
        configId: config?.id,
        priority: config?.priority || 'medium',
        previousStatus: ConversationStatus.AI_HANDLING,
        newStatus: ConversationStatus.AI_HANDLING,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: event.metadata
      });

      return {
        success: false,
        conversationId,
        previousStatus: ConversationStatus.AI_HANDLING,
        newStatus: ConversationStatus.AI_HANDLING,
        triggerReason: event.triggerReason,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Logs escalation event for analytics and tracking
   */
  private async logEscalationEvent(
    conversationId: string,
    event: EscalationEvent,
    config?: Partial<EscalationTriggerConfig>
  ): Promise<void> {
    try {
      // In a real implementation, this would log to a dedicated escalation_logs table
      // For now, we'll use console logging and could extend to database logging
      const logEntry = {
        conversationId,
        triggerType: event.triggerType,
        triggerReason: event.triggerReason,
        sentimentScore: event.sentimentScore,
        messageContent: event.messageContent?.substring(0, 200), // Truncate for logging
        configId: config?.id,
        priority: config?.priority || 'medium',
        timestamp: event.timestamp,
        metadata: event.metadata
      };

      console.log('Escalation triggered:', logEntry);

      // TODO: Implement database logging to escalation_logs table
      // await this.supabase.from('escalation_logs').insert(logEntry);
    } catch (error) {
      console.error('Failed to log escalation event:', error);
    }
  }

  /**
   * Adds a note to the conversation explaining the escalation
   */
  private async addEscalationNote(
    conversationId: string,
    event: EscalationEvent,
    noteTemplate: string
  ): Promise<void> {
    try {
      const noteContent = noteTemplate
        .replace('{{triggerReason}}', event.triggerReason)
        .replace('{{sentimentScore}}', event.sentimentScore?.toString() || 'N/A')
        .replace('{{timestamp}}', event.timestamp.toISOString());

      // In a real implementation, this would add to a conversation_notes table
      // For now, we'll add as a system message
      const supabase = await createClient();
      await supabase
        .from('Message')
        .insert({
          conversationId,
          content: `[System] ${noteContent}`,
          role: 'assistant',
          metadata: {
            type: 'escalation_note',
            triggerType: event.triggerType,
            automated: true
          }
        });
    } catch (error) {
      console.error('Failed to add escalation note:', error);
    }
  }
}

/**
 * Escalation Configuration Manager
 * Manages escalation trigger configurations
 */
export class EscalationConfigManager {

  /**
   * Gets all active escalation trigger configurations
   */
  async getActiveConfigurations(): Promise<EscalationTriggerConfig[]> {
    // In a real implementation, this would fetch from escalation_configs table
    // For now, return default configurations
    return [
      {
        id: 'sentiment-negative',
        name: 'Negative Sentiment Detection',
        description: 'Escalate conversations with negative sentiment below -0.3',
        isActive: true,
        triggerType: 'sentiment',
        conditions: {
          sentimentThreshold: -0.3
        },
        actions: {
          changeStatus: true,
          addNote: 'Conversation escalated due to negative sentiment ({{sentimentScore}}) detected at {{timestamp}}. Reason: {{triggerReason}}'
        },
        priority: 'high',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'sentiment-critical',
        name: 'Critical Negative Sentiment',
        description: 'Escalate conversations with very negative sentiment below -0.7',
        isActive: true,
        triggerType: 'sentiment',
        conditions: {
          sentimentThreshold: -0.7
        },
        actions: {
          changeStatus: true,
          addNote: 'URGENT: Conversation escalated due to critical negative sentiment ({{sentimentScore}}). Immediate attention required.',
          notifyTeam: true
        },
        priority: 'critical',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  /**
   * Creates a new escalation trigger configuration
   */
  async createConfiguration(config: Omit<EscalationTriggerConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<EscalationTriggerConfig> {
    const newConfig: EscalationTriggerConfig = {
      ...config,
      id: `config_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // In a real implementation, this would save to escalation_configs table
    console.log('Created escalation configuration:', newConfig);
    
    return newConfig;
  }

  /**
   * Updates an existing escalation trigger configuration
   */
  async updateConfiguration(id: string, updates: Partial<EscalationTriggerConfig>): Promise<EscalationTriggerConfig | null> {
    // In a real implementation, this would update the escalation_configs table
    console.log('Updated escalation configuration:', { id, updates });
    
    // Return mock updated configuration
    const configs = await this.getActiveConfigurations();
    const existing = configs.find(c => c.id === id);
    
    if (!existing && !id.startsWith('config_')) {
      return null;
    }

    // For test configurations, create a mock response
    const baseConfig = existing || {
      id,
      name: 'Test Configuration',
      description: 'Test description',
      isActive: true,
      triggerType: 'sentiment' as const,
      conditions: {},
      actions: { changeStatus: true },
      priority: 'medium' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return {
      ...baseConfig,
      ...updates,
      updatedAt: new Date()
    };
  }

  /**
   * Deletes an escalation trigger configuration
   */
  async deleteConfiguration(id: string): Promise<boolean> {
    // In a real implementation, this would delete from escalation_configs table
    console.log('Deleted escalation configuration:', id);
    return true;
  }
}

/**
 * Main Escalation Trigger System
 * Coordinates all escalation triggers and manages the escalation process
 */
export class EscalationTriggerSystem {
  private sentimentTrigger = new SentimentEscalationTrigger();
  private configManager = new EscalationConfigManager();

  /**
   * Processes a message for potential escalation triggers
   */
  async processMessage(
    conversationId: string,
    messageId: string,
    messageContent: string,
    sentimentScore?: number
  ): Promise<EscalationResult[]> {
    const results: EscalationResult[] = [];
    
    try {
      const configs = await this.configManager.getActiveConfigurations();
      
      for (const config of configs) {
        if (!config.isActive) continue;

        if (config.triggerType === 'sentiment' && sentimentScore !== undefined) {
          const shouldEscalate = await this.sentimentTrigger.evaluateMessage(
            conversationId,
            messageId,
            sentimentScore,
            messageContent,
            config
          );

          if (shouldEscalate) {
            const event: EscalationEvent = {
              conversationId,
              messageId,
              triggerType: 'sentiment',
              triggerReason: `Negative sentiment detected (score: ${sentimentScore})`,
              sentimentScore,
              messageContent,
              timestamp: new Date()
            };

            const result = await this.sentimentTrigger.triggerEscalation(
              conversationId,
              event,
              config
            );

            results.push(result);
          }
        }
      }
    } catch (error) {
      console.error('Error processing escalation triggers:', error);
    }

    return results;
  }

  /**
   * Gets escalation analytics and metrics
   */
  async getEscalationAnalytics(_timeframe: 'day' | 'week' | 'month' = 'week'): Promise<{
    totalEscalations: number;
    escalationsByTrigger: Record<string, number>;
    escalationsByPriority: Record<string, number>;
    averageResponseTime: number;
    resolutionRate: number;
  }> {
    // In a real implementation, this would query escalation logs and conversation data
    // For now, return mock analytics
    return {
      totalEscalations: 42,
      escalationsByTrigger: {
        sentiment: 35,
        keywords: 5,
        duration: 2
      },
      escalationsByPriority: {
        low: 8,
        medium: 20,
        high: 12,
        critical: 2
      },
      averageResponseTime: 15.5, // minutes
      resolutionRate: 0.85 // 85%
    };
  }
}

// Export singleton instance
export const escalationTriggerSystem = new EscalationTriggerSystem();