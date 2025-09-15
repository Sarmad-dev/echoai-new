/**
 * Escalation Logging and Analytics System
 * 
 * Provides comprehensive logging and analytics for escalation triggers
 * to track performance, identify patterns, and optimize automation rules.
 * 
 * Requirements: 6.1, 6.2
 */

import { createClient } from '@/lib/supabase/supabase-server';
import { ConversationStatus } from '@/types/database';

export interface EscalationLogEntry {
  id: string;
  conversationId: string;
  messageId?: string;
  triggerType: string;
  triggerReason: string;
  sentimentScore?: number;
  messageContent?: string;
  configId?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  previousStatus: ConversationStatus;
  newStatus: ConversationStatus;
  success: boolean;
  error?: string;
  responseTime?: number; // milliseconds
  agentId?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface EscalationMetrics {
  totalEscalations: number;
  successfulEscalations: number;
  failedEscalations: number;
  averageResponseTime: number;
  escalationsByTrigger: Record<string, number>;
  escalationsByPriority: Record<string, number>;
  escalationsByHour: Record<string, number>;
  resolutionRate: number;
  topTriggerReasons: Array<{
    reason: string;
    count: number;
    successRate: number;
  }>;
}

export interface EscalationTrend {
  date: string;
  escalations: number;
  resolutions: number;
  averageSentiment: number;
}

/**
 * Escalation Logger
 * Handles logging of escalation events and provides analytics
 */
export class EscalationLogger {
  /**
   * Logs an escalation event
   */
  async logEscalation(entry: Omit<EscalationLogEntry, 'id' | 'timestamp'>): Promise<string> {
    try {
      const logEntry: EscalationLogEntry = {
        ...entry,
        id: `escalation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date()
      };

      // In a real implementation, this would save to escalation_logs table
      console.log('Escalation logged:', {
        id: logEntry.id,
        conversationId: logEntry.conversationId,
        triggerType: logEntry.triggerType,
        triggerReason: logEntry.triggerReason,
        success: logEntry.success,
        priority: logEntry.priority,
        timestamp: logEntry.timestamp
      });

      // TODO: Implement database logging
      // const supabase = await createClient();
      // await supabase.from('escalation_logs').insert(logEntry);

      return logEntry.id;
    } catch (error) {
      console.error('Failed to log escalation:', error);
      throw error;
    }
  }

  /**
   * Gets escalation metrics for a given time period
   */
  async getEscalationMetrics(
    timeframe: 'hour' | 'day' | 'week' | 'month' = 'week',
    chatbotId?: string
  ): Promise<EscalationMetrics> {
    try {
      // In a real implementation, this would query the escalation_logs table
      // For now, return mock metrics based on timeframe
      const mockMetrics: EscalationMetrics = {
        totalEscalations: this.getMockCount(timeframe, 'total'),
        successfulEscalations: this.getMockCount(timeframe, 'success'),
        failedEscalations: this.getMockCount(timeframe, 'failed'),
        averageResponseTime: this.getMockResponseTime(timeframe),
        escalationsByTrigger: {
          sentiment: this.getMockCount(timeframe, 'sentiment'),
          keywords: this.getMockCount(timeframe, 'keywords'),
          duration: this.getMockCount(timeframe, 'duration'),
          custom: this.getMockCount(timeframe, 'custom')
        },
        escalationsByPriority: {
          low: this.getMockCount(timeframe, 'low'),
          medium: this.getMockCount(timeframe, 'medium'),
          high: this.getMockCount(timeframe, 'high'),
          critical: this.getMockCount(timeframe, 'critical')
        },
        escalationsByHour: this.getMockHourlyData(timeframe),
        resolutionRate: this.getMockResolutionRate(timeframe),
        topTriggerReasons: [
          {
            reason: 'Negative sentiment detected',
            count: this.getMockCount(timeframe, 'sentiment'),
            successRate: 0.92
          },
          {
            reason: 'Complaint keywords found',
            count: this.getMockCount(timeframe, 'keywords'),
            successRate: 0.87
          },
          {
            reason: 'Long response time',
            count: this.getMockCount(timeframe, 'duration'),
            successRate: 0.78
          }
        ]
      };

      return mockMetrics;
    } catch (error) {
      console.error('Failed to get escalation metrics:', error);
      throw error;
    }
  }

  /**
   * Gets escalation trends over time
   */
  async getEscalationTrends(
    days: number = 7,
    chatbotId?: string
  ): Promise<EscalationTrend[]> {
    try {
      // In a real implementation, this would query escalation logs and conversation data
      const trends: EscalationTrend[] = [];
      const now = new Date();

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        
        trends.push({
          date: date.toISOString().split('T')[0],
          escalations: Math.floor(Math.random() * 20) + 5,
          resolutions: Math.floor(Math.random() * 15) + 3,
          averageSentiment: (Math.random() * 0.4) - 0.2 // -0.2 to 0.2
        });
      }

      return trends;
    } catch (error) {
      console.error('Failed to get escalation trends:', error);
      throw error;
    }
  }

  /**
   * Gets escalation logs with filtering and pagination
   */
  async getEscalationLogs(options: {
    conversationId?: string;
    triggerType?: string;
    priority?: string;
    success?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    logs: EscalationLogEntry[];
    total: number;
  }> {
    try {
      // In a real implementation, this would query the escalation_logs table with filters
      const mockLogs: EscalationLogEntry[] = [
        {
          id: 'log_1',
          conversationId: 'conv_123',
          messageId: 'msg_456',
          triggerType: 'sentiment',
          triggerReason: 'Negative sentiment detected (score: -0.65)',
          sentimentScore: -0.65,
          messageContent: 'This service is terrible and I want my money back!',
          configId: 'sentiment-negative',
          priority: 'high',
          previousStatus: ConversationStatus.AI_HANDLING,
          newStatus: ConversationStatus.AWAITING_HUMAN_RESPONSE,
          success: true,
          responseTime: 1250,
          timestamp: new Date(Date.now() - 3600000) // 1 hour ago
        },
        {
          id: 'log_2',
          conversationId: 'conv_124',
          messageId: 'msg_457',
          triggerType: 'keywords',
          triggerReason: 'Complaint keywords detected: complaint, frustrated',
          messageContent: 'I have a complaint about your service, I am very frustrated',
          configId: 'keywords-complaint',
          priority: 'medium',
          previousStatus: ConversationStatus.AI_HANDLING,
          newStatus: ConversationStatus.AWAITING_HUMAN_RESPONSE,
          success: true,
          responseTime: 890,
          timestamp: new Date(Date.now() - 7200000) // 2 hours ago
        }
      ];

      // Apply filters (mock implementation)
      let filteredLogs = mockLogs;
      
      if (options.conversationId) {
        filteredLogs = filteredLogs.filter(log => log.conversationId === options.conversationId);
      }
      
      if (options.triggerType) {
        filteredLogs = filteredLogs.filter(log => log.triggerType === options.triggerType);
      }
      
      if (options.priority) {
        filteredLogs = filteredLogs.filter(log => log.priority === options.priority);
      }
      
      if (options.success !== undefined) {
        filteredLogs = filteredLogs.filter(log => log.success === options.success);
      }

      // Apply pagination
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      const paginatedLogs = filteredLogs.slice(offset, offset + limit);

      return {
        logs: paginatedLogs,
        total: filteredLogs.length
      };
    } catch (error) {
      console.error('Failed to get escalation logs:', error);
      throw error;
    }
  }

  /**
   * Gets escalation performance by configuration
   */
  async getConfigurationPerformance(configId: string): Promise<{
    totalTriggers: number;
    successfulEscalations: number;
    failedEscalations: number;
    averageResponseTime: number;
    successRate: number;
    recentTriggers: EscalationLogEntry[];
  }> {
    try {
      // In a real implementation, this would query escalation logs for the specific config
      return {
        totalTriggers: 45,
        successfulEscalations: 42,
        failedEscalations: 3,
        averageResponseTime: 1150, // milliseconds
        successRate: 0.933, // 93.3%
        recentTriggers: await this.getEscalationLogs({ 
          limit: 10 
        }).then(result => result.logs)
      };
    } catch (error) {
      console.error('Failed to get configuration performance:', error);
      throw error;
    }
  }

  /**
   * Exports escalation data for analysis
   */
  async exportEscalationData(
    format: 'json' | 'csv',
    options: {
      startDate?: Date;
      endDate?: Date;
      triggerType?: string;
      priority?: string;
    } = {}
  ): Promise<string> {
    try {
      const { logs } = await this.getEscalationLogs(options);

      if (format === 'json') {
        return JSON.stringify(logs, null, 2);
      } else if (format === 'csv') {
        const headers = [
          'ID', 'Conversation ID', 'Trigger Type', 'Trigger Reason', 
          'Priority', 'Success', 'Response Time', 'Timestamp'
        ];
        
        const csvRows = [
          headers.join(','),
          ...logs.map(log => [
            log.id,
            log.conversationId,
            log.triggerType,
            `"${log.triggerReason}"`,
            log.priority,
            log.success,
            log.responseTime || '',
            log.timestamp.toISOString()
          ].join(','))
        ];

        return csvRows.join('\n');
      }

      throw new Error('Unsupported export format');
    } catch (error) {
      console.error('Failed to export escalation data:', error);
      throw error;
    }
  }

  // Helper methods for mock data generation
  private getMockCount(timeframe: string, type: string): number {
    const multipliers = {
      hour: 1,
      day: 24,
      week: 168,
      month: 720
    };

    const baseValues = {
      total: 6,
      success: 5,
      failed: 1,
      sentiment: 4,
      keywords: 1,
      duration: 1,
      custom: 0,
      low: 1,
      medium: 3,
      high: 2,
      critical: 0
    };

    const multiplier = multipliers[timeframe as keyof typeof multipliers] || 1;
    const baseValue = baseValues[type as keyof typeof baseValues] || 0;
    
    return Math.floor(baseValue * multiplier * (0.8 + Math.random() * 0.4));
  }

  private getMockResponseTime(timeframe: string): number {
    // Response time in milliseconds
    const baseTimes = {
      hour: 800,
      day: 950,
      week: 1150,
      month: 1300
    };

    return baseTimes[timeframe as keyof typeof baseTimes] || 1000;
  }

  private getMockHourlyData(timeframe: string): Record<string, number> {
    const hours: Record<string, number> = {};
    const hoursToGenerate = timeframe === 'day' ? 24 : 7;

    for (let i = 0; i < hoursToGenerate; i++) {
      const hour = timeframe === 'day' ? i.toString().padStart(2, '0') : i.toString();
      hours[hour] = Math.floor(Math.random() * 10) + 1;
    }

    return hours;
  }

  private getMockResolutionRate(timeframe: string): number {
    const baseRates = {
      hour: 0.95,
      day: 0.88,
      week: 0.85,
      month: 0.82
    };

    return baseRates[timeframe as keyof typeof baseRates] || 0.85;
  }
}

// Export singleton instance
export const escalationLogger = new EscalationLogger();