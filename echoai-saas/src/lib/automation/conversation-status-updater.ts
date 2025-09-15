/**
 * Conversation Status Update Mechanism
 * 
 * Provides centralized mechanism for updating conversation status
 * with proper validation, logging, and real-time notifications.
 * 
 * Requirements: 6.1, 6.2
 */

import { createClient } from '@/lib/supabase/supabase-server';
import { ConversationStatus } from '@/types/database';

export interface StatusUpdateRequest {
  conversationId: string;
  newStatus: ConversationStatus;
  reason: string;
  triggeredBy: 'automation' | 'agent' | 'system';
  agentId?: string;
  metadata?: Record<string, any>;
}

export interface StatusUpdateResult {
  success: boolean;
  conversationId: string;
  previousStatus: ConversationStatus;
  newStatus: ConversationStatus;
  updatedAt: Date;
  triggeredBy: string;
  reason: string;
  error?: string;
}

export interface StatusUpdateLog {
  id: string;
  conversationId: string;
  previousStatus: ConversationStatus;
  newStatus: ConversationStatus;
  reason: string;
  triggeredBy: string;
  agentId?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

/**
 * Conversation Status Updater
 * Handles all conversation status changes with proper validation and logging
 */
export class ConversationStatusUpdater {

  /**
   * Updates conversation status with validation and logging
   */
  async updateStatus(request: StatusUpdateRequest): Promise<StatusUpdateResult> {
    try {
      // Validate the status transition
      const validationResult = await this.validateStatusTransition(
        request.conversationId,
        request.newStatus
      );

      if (!validationResult.isValid) {
        return {
          success: false,
          conversationId: request.conversationId,
          previousStatus: validationResult.currentStatus,
          newStatus: request.newStatus,
          updatedAt: new Date(),
          triggeredBy: request.triggeredBy,
          reason: request.reason,
          error: validationResult.error
        };
      }

      const previousStatus = validationResult.currentStatus;

      // Update the conversation status
      const supabase = await createClient();
      const { error: updateError } = await supabase
        .from('Conversation')
        .update({
          status: request.newStatus,
          assignedTo: request.agentId || null,
          updatedAt: new Date().toISOString()
        })
        .eq('id', request.conversationId);

      if (updateError) {
        return {
          success: false,
          conversationId: request.conversationId,
          previousStatus,
          newStatus: request.newStatus,
          updatedAt: new Date(),
          triggeredBy: request.triggeredBy,
          reason: request.reason,
          error: updateError.message
        };
      }

      const updatedAt = new Date();

      // Log the status change
      await this.logStatusChange({
        conversationId: request.conversationId,
        previousStatus,
        newStatus: request.newStatus,
        reason: request.reason,
        triggeredBy: request.triggeredBy,
        agentId: request.agentId,
        metadata: request.metadata,
        timestamp: updatedAt
      });

      // Broadcast real-time update
      await this.broadcastStatusUpdate(request.conversationId, {
        previousStatus,
        newStatus: request.newStatus,
        triggeredBy: request.triggeredBy,
        reason: request.reason,
        updatedAt
      });

      return {
        success: true,
        conversationId: request.conversationId,
        previousStatus,
        newStatus: request.newStatus,
        updatedAt,
        triggeredBy: request.triggeredBy,
        reason: request.reason
      };
    } catch (error) {
      return {
        success: false,
        conversationId: request.conversationId,
        previousStatus: ConversationStatus.AI_HANDLING,
        newStatus: request.newStatus,
        updatedAt: new Date(),
        triggeredBy: request.triggeredBy,
        reason: request.reason,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validates if a status transition is allowed
   */
  private async validateStatusTransition(
    conversationId: string,
    newStatus: ConversationStatus
  ): Promise<{
    isValid: boolean;
    currentStatus: ConversationStatus;
    error?: string;
  }> {
    try {
      // Get current conversation status
      const supabase = await createClient();
      const { data: conversation, error } = await supabase
        .from('Conversation')
        .select('status')
        .eq('id', conversationId)
        .single();

      if (error || !conversation) {
        return {
          isValid: false,
          currentStatus: ConversationStatus.AI_HANDLING,
          error: 'Conversation not found'
        };
      }

      const currentStatus = conversation.status as ConversationStatus;

      // Define valid status transitions
      const validTransitions: Record<ConversationStatus, ConversationStatus[]> = {
        [ConversationStatus.AI_HANDLING]: [
          ConversationStatus.AWAITING_HUMAN_RESPONSE,
          ConversationStatus.RESOLVED
        ],
        [ConversationStatus.AWAITING_HUMAN_RESPONSE]: [
          ConversationStatus.AI_HANDLING,
          ConversationStatus.RESOLVED
        ],
        [ConversationStatus.RESOLVED]: [
          ConversationStatus.AI_HANDLING,
          ConversationStatus.AWAITING_HUMAN_RESPONSE
        ]
      };

      // Check if transition is valid
      const allowedTransitions = validTransitions[currentStatus] || [];
      if (!allowedTransitions.includes(newStatus) && currentStatus !== newStatus) {
        return {
          isValid: false,
          currentStatus,
          error: `Invalid status transition from ${currentStatus} to ${newStatus}`
        };
      }

      return {
        isValid: true,
        currentStatus
      };
    } catch (error) {
      return {
        isValid: false,
        currentStatus: ConversationStatus.AI_HANDLING,
        error: error instanceof Error ? error.message : 'Validation error'
      };
    }
  }

  /**
   * Logs status change for audit trail and analytics
   */
  private async logStatusChange(log: Omit<StatusUpdateLog, 'id'>): Promise<void> {
    try {
      // In a real implementation, this would save to a status_change_logs table
      const logEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        ...log
      };

      console.log('Status change logged:', logEntry);

      // TODO: Implement database logging
      // await this.supabase.from('status_change_logs').insert(logEntry);
    } catch (error) {
      console.error('Failed to log status change:', error);
    }
  }

  /**
   * Broadcasts status update via Supabase Realtime
   */
  private async broadcastStatusUpdate(
    conversationId: string,
    update: {
      previousStatus: ConversationStatus;
      newStatus: ConversationStatus;
      triggeredBy: string;
      reason: string;
      updatedAt: Date;
    }
  ): Promise<void> {
    try {
      // Supabase Realtime will automatically broadcast the conversation update
      // due to the database trigger on the Conversation table
      // This method can be used for additional custom broadcasting if needed
      
      console.log('Broadcasting status update:', {
        conversationId,
        ...update
      });

      // Additional custom broadcasting logic can be added here
      // For example, sending notifications to specific channels or users
    } catch (error) {
      console.error('Failed to broadcast status update:', error);
    }
  }

  /**
   * Gets status change history for a conversation
   */
  async getStatusHistory(conversationId: string): Promise<StatusUpdateLog[]> {
    try {
      // In a real implementation, this would query the status_change_logs table
      // For now, return mock data
      return [
        {
          id: 'log_1',
          conversationId,
          previousStatus: ConversationStatus.AI_HANDLING,
          newStatus: ConversationStatus.AWAITING_HUMAN_RESPONSE,
          reason: 'Negative sentiment detected',
          triggeredBy: 'automation',
          timestamp: new Date(Date.now() - 3600000) // 1 hour ago
        },
        {
          id: 'log_2',
          conversationId,
          previousStatus: ConversationStatus.AWAITING_HUMAN_RESPONSE,
          newStatus: ConversationStatus.RESOLVED,
          reason: 'Issue resolved by agent',
          triggeredBy: 'agent',
          agentId: 'agent_123',
          timestamp: new Date(Date.now() - 1800000) // 30 minutes ago
        }
      ];
    } catch (error) {
      console.error('Failed to get status history:', error);
      return [];
    }
  }

  /**
   * Gets status change analytics
   */
  async getStatusAnalytics(_timeframe: 'day' | 'week' | 'month' = 'week'): Promise<{
    totalStatusChanges: number;
    changesByStatus: Record<string, number>;
    changesByTrigger: Record<string, number>;
    averageTimeInStatus: Record<ConversationStatus, number>;
    escalationRate: number;
    resolutionRate: number;
  }> {
    try {
      // In a real implementation, this would query status change logs and calculate metrics
      // For now, return mock analytics
      return {
        totalStatusChanges: 156,
        changesByStatus: {
          [ConversationStatus.AI_HANDLING]: 45,
          [ConversationStatus.AWAITING_HUMAN_RESPONSE]: 67,
          [ConversationStatus.RESOLVED]: 44
        },
        changesByTrigger: {
          automation: 89,
          agent: 52,
          system: 15
        },
        averageTimeInStatus: {
          [ConversationStatus.AI_HANDLING]: 12.5, // minutes
          [ConversationStatus.AWAITING_HUMAN_RESPONSE]: 25.3,
          [ConversationStatus.RESOLVED]: 0 // Terminal status
        },
        escalationRate: 0.43, // 43% of conversations get escalated
        resolutionRate: 0.78 // 78% of conversations get resolved
      };
    } catch (error) {
      console.error('Failed to get status analytics:', error);
      return {
        totalStatusChanges: 0,
        changesByStatus: {},
        changesByTrigger: {},
        averageTimeInStatus: {
          [ConversationStatus.AI_HANDLING]: 0,
          [ConversationStatus.AWAITING_HUMAN_RESPONSE]: 0,
          [ConversationStatus.RESOLVED]: 0
        },
        escalationRate: 0,
        resolutionRate: 0
      };
    }
  }

  /**
   * Bulk update multiple conversation statuses
   */
  async bulkUpdateStatus(requests: StatusUpdateRequest[]): Promise<StatusUpdateResult[]> {
    const results: StatusUpdateResult[] = [];

    for (const request of requests) {
      const result = await this.updateStatus(request);
      results.push(result);
    }

    return results;
  }
}

// Export singleton instance
export const conversationStatusUpdater = new ConversationStatusUpdater();