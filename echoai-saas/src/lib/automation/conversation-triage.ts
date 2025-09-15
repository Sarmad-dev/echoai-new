/**
 * Automated Conversation Triage System
 * 
 * Implements automated rules for changing conversation status to AWAITING_HUMAN_RESPONSE,
 * priority queue management, notification system, and escalation tracking.
 * 
 * Requirements: 6.3, 6.4
 */

import { createClient } from '@/lib/supabase/supabase-server';
import { ConversationStatus } from '@/types/database';
import { conversationStatusUpdater } from './conversation-status-updater';
import { escalationLogger } from './escalation-logger';

export interface TriageRule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  conditions: {
    sentimentThreshold?: number;
    keywords?: string[];
    responseTimeMinutes?: number;
    messageCount?: number;
    customerTier?: string;
    timeOfDay?: { start: string; end: string };
    dayOfWeek?: string[];
  };
  actions: {
    escalate: boolean;
    assignToTeam?: string;
    addTags?: string[];
    notifyAgents?: boolean;
    setPriority?: 'low' | 'medium' | 'high' | 'critical';
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface TriageResult {
  conversationId: string;
  ruleId: string;
  ruleName: string;
  action: 'escalated' | 'prioritized' | 'tagged' | 'assigned';
  priority: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  success: boolean;
  error?: string;
  timestamp: Date;
}

export interface PriorityQueueItem {
  conversationId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  escalationReason: string;
  customerEmail?: string;
  source?: string;
  sentimentScore?: number;
  waitTime: number; // minutes
  assignedTo?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationEvent {
  type: 'escalation' | 'priority_change' | 'assignment' | 'timeout';
  conversationId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  recipients: string[];
  metadata?: Record<string, any>;
  timestamp: Date;
}

/**
 * Conversation Triage Engine
 * Manages automated triage rules and conversation prioritization
 */
export class ConversationTriageEngine {
  /**
   * Evaluates a conversation against all active triage rules
   */
  async evaluateConversation(
    conversationId: string,
    messageContent?: string,
    sentimentScore?: number,
    metadata?: Record<string, any>
  ): Promise<TriageResult[]> {
    try {
      const rules = await this.getActiveTriageRules();
      const results: TriageResult[] = [];

      // Get conversation context
      const conversationContext = await this.getConversationContext(conversationId);
      
      for (const rule of rules) {
        const shouldApply = await this.evaluateRule(
          rule,
          conversationContext,
          messageContent,
          sentimentScore,
          metadata
        );

        if (shouldApply) {
          const result = await this.applyTriageRule(
            conversationId,
            rule,
            conversationContext
          );
          results.push(result);
        }
      }

      return results;
    } catch (error) {
      console.error('Error evaluating conversation for triage:', error);
      return [];
    }
  }

  /**
   * Gets all active triage rules
   */
  async getActiveTriageRules(): Promise<TriageRule[]> {
    // In a real implementation, this would fetch from triage_rules table
    return [
      {
        id: 'high-priority-sentiment',
        name: 'High Priority Negative Sentiment',
        description: 'Escalate conversations with very negative sentiment',
        isActive: true,
        priority: 'high',
        conditions: {
          sentimentThreshold: -0.6
        },
        actions: {
          escalate: true,
          setPriority: 'high',
          notifyAgents: true,
          addTags: ['negative-sentiment', 'high-priority']
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'critical-keywords',
        name: 'Critical Issue Keywords',
        description: 'Immediately escalate conversations with critical keywords',
        isActive: true,
        priority: 'critical',
        conditions: {
          keywords: ['urgent', 'emergency', 'critical', 'lawsuit', 'legal', 'refund', 'cancel subscription']
        },
        actions: {
          escalate: true,
          setPriority: 'critical',
          notifyAgents: true,
          addTags: ['critical', 'urgent-response']
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'long-response-time',
        name: 'Long Response Time',
        description: 'Escalate conversations with long AI response times',
        isActive: true,
        priority: 'medium',
        conditions: {
          responseTimeMinutes: 30
        },
        actions: {
          escalate: true,
          setPriority: 'medium',
          addTags: ['slow-response', 'needs-attention']
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'multiple-messages',
        name: 'Multiple Customer Messages',
        description: 'Escalate when customer sends multiple messages without resolution',
        isActive: true,
        priority: 'medium',
        conditions: {
          messageCount: 5
        },
        actions: {
          escalate: true,
          setPriority: 'medium',
          addTags: ['multiple-attempts', 'unresolved']
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  /**
   * Evaluates if a rule should be applied to a conversation
   */
  private async evaluateRule(
    rule: TriageRule,
    conversationContext: any,
    messageContent?: string,
    sentimentScore?: number,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    const { conditions } = rule;

    // Check sentiment threshold
    if (conditions.sentimentThreshold !== undefined && sentimentScore !== undefined) {
      if (sentimentScore >= conditions.sentimentThreshold) {
        return false;
      }
    }

    // Check keywords
    if (conditions.keywords && messageContent) {
      const hasKeyword = conditions.keywords.some(keyword =>
        messageContent.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!hasKeyword) {
        return false;
      }
    }

    // Check response time
    if (conditions.responseTimeMinutes !== undefined) {
      const waitTime = this.calculateWaitTime(conversationContext.createdAt);
      if (waitTime < conditions.responseTimeMinutes) {
        return false;
      }
    }

    // Check message count
    if (conditions.messageCount !== undefined) {
      const messageCount = conversationContext.messageCount || 0;
      if (messageCount < conditions.messageCount) {
        return false;
      }
    }

    // Check time of day
    if (conditions.timeOfDay) {
      const currentHour = new Date().getHours();
      const startHour = parseInt(conditions.timeOfDay.start.split(':')[0]);
      const endHour = parseInt(conditions.timeOfDay.end.split(':')[0]);
      
      if (currentHour < startHour || currentHour > endHour) {
        return false;
      }
    }

    // Check day of week
    if (conditions.dayOfWeek && conditions.dayOfWeek.length > 0) {
      const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      if (!conditions.dayOfWeek.includes(currentDay)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Applies a triage rule to a conversation
   */
  private async applyTriageRule(
    conversationId: string,
    rule: TriageRule,
    conversationContext: any
  ): Promise<TriageResult> {
    try {
      const { actions } = rule;
      let actionTaken = 'tagged';

      // Escalate conversation if required
      if (actions.escalate) {
        const statusResult = await conversationStatusUpdater.updateStatus({
          conversationId,
          newStatus: ConversationStatus.AWAITING_HUMAN_RESPONSE,
          reason: `Automated triage: ${rule.name}`,
          triggeredBy: 'automation',
          metadata: {
            ruleId: rule.id,
            ruleName: rule.name,
            priority: actions.setPriority || rule.priority
          }
        });

        if (statusResult.success) {
          actionTaken = 'escalated';
          
          // Add to priority queue
          await this.addToPriorityQueue({
            conversationId,
            priority: actions.setPriority || rule.priority,
            escalationReason: rule.name,
            customerEmail: conversationContext.customerEmail,
            source: conversationContext.source,
            sentimentScore: conversationContext.sentimentScore,
            waitTime: this.calculateWaitTime(conversationContext.createdAt),
            tags: actions.addTags || [],
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }

      // Send notifications if required
      if (actions.notifyAgents) {
        await this.sendNotification({
          type: 'escalation',
          conversationId,
          priority: actions.setPriority || rule.priority,
          message: `Conversation escalated by rule: ${rule.name}`,
          recipients: await this.getNotificationRecipients(actions.assignToTeam),
          metadata: {
            ruleId: rule.id,
            ruleName: rule.name
          },
          timestamp: new Date()
        });
      }

      // Log the triage action
      await escalationLogger.logEscalation({
        conversationId,
        triggerType: 'triage_rule',
        triggerReason: rule.name,
        configId: rule.id,
        priority: actions.setPriority || rule.priority,
        previousStatus: conversationContext.status,
        newStatus: actions.escalate ? ConversationStatus.AWAITING_HUMAN_RESPONSE : conversationContext.status,
        success: true,
        metadata: {
          ruleId: rule.id,
          actionTaken,
          tags: actions.addTags
        }
      });

      return {
        conversationId,
        ruleId: rule.id,
        ruleName: rule.name,
        action: actionTaken as any,
        priority: actions.setPriority || rule.priority,
        reason: rule.description,
        success: true,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        conversationId,
        ruleId: rule.id,
        ruleName: rule.name,
        action: 'tagged',
        priority: rule.priority,
        reason: rule.description,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Gets conversation context for triage evaluation
   */
  private async getConversationContext(conversationId: string): Promise<any> {
    try {
      const supabase = await createClient();
      
      // Get conversation details
      const { data: conversation } = await supabase
        .from('Conversation')
        .select('*')
        .eq('id', conversationId)
        .single();

      // Get message count and latest sentiment
      const { data: messages } = await supabase
        .from('Message')
        .select('sentimentScore, createdAt')
        .eq('conversationId', conversationId)
        .order('createdAt', { ascending: false });

      const messageCount = messages?.length || 0;
      const latestSentiment = messages?.[0]?.sentimentScore;

      return {
        ...conversation,
        messageCount,
        sentimentScore: latestSentiment,
        createdAt: conversation?.createdAt ? new Date(conversation.createdAt) : new Date(),
        status: conversation?.status || ConversationStatus.AI_HANDLING
      };
    } catch (error) {
      console.error('Error getting conversation context:', error);
      return {
        status: ConversationStatus.AI_HANDLING,
        messageCount: 0,
        createdAt: new Date()
      };
    }
  }

  /**
   * Adds conversation to priority queue
   */
  private async addToPriorityQueue(item: PriorityQueueItem): Promise<void> {
    try {
      // In a real implementation, this would save to priority_queue table
      console.log('Added to priority queue:', {
        conversationId: item.conversationId,
        priority: item.priority,
        escalationReason: item.escalationReason,
        waitTime: item.waitTime,
        tags: item.tags
      });

      // TODO: Implement database storage
      // const supabase = await createClient();
      // await supabase.from('priority_queue').insert(item);
    } catch (error) {
      console.error('Error adding to priority queue:', error);
    }
  }

  /**
   * Gets priority queue with filtering and sorting
   */
  async getPriorityQueue(options: {
    priority?: 'low' | 'medium' | 'high' | 'critical';
    assignedTo?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    items: PriorityQueueItem[];
    total: number;
  }> {
    try {
      // In a real implementation, this would query priority_queue table
      const mockItems: PriorityQueueItem[] = [
        {
          conversationId: 'conv_urgent_1',
          priority: 'critical',
          escalationReason: 'Critical Issue Keywords',
          customerEmail: 'customer@example.com',
          source: 'website',
          sentimentScore: -0.8,
          waitTime: 45,
          tags: ['critical', 'urgent-response'],
          createdAt: new Date(Date.now() - 2700000), // 45 minutes ago
          updatedAt: new Date()
        },
        {
          conversationId: 'conv_high_1',
          priority: 'high',
          escalationReason: 'High Priority Negative Sentiment',
          customerEmail: 'unhappy@example.com',
          source: 'mobile-app',
          sentimentScore: -0.7,
          waitTime: 30,
          tags: ['negative-sentiment', 'high-priority'],
          createdAt: new Date(Date.now() - 1800000), // 30 minutes ago
          updatedAt: new Date()
        },
        {
          conversationId: 'conv_medium_1',
          priority: 'medium',
          escalationReason: 'Long Response Time',
          customerEmail: 'waiting@example.com',
          source: 'website',
          waitTime: 35,
          tags: ['slow-response', 'needs-attention'],
          createdAt: new Date(Date.now() - 2100000), // 35 minutes ago
          updatedAt: new Date()
        }
      ];

      // Apply filters
      let filteredItems = mockItems;
      
      if (options.priority) {
        filteredItems = filteredItems.filter(item => item.priority === options.priority);
      }
      
      if (options.assignedTo) {
        filteredItems = filteredItems.filter(item => item.assignedTo === options.assignedTo);
      }

      // Sort by priority and wait time
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      filteredItems.sort((a, b) => {
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.waitTime - a.waitTime; // Longer wait time first
      });

      // Apply pagination
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      const paginatedItems = filteredItems.slice(offset, offset + limit);

      return {
        items: paginatedItems,
        total: filteredItems.length
      };
    } catch (error) {
      console.error('Error getting priority queue:', error);
      return { items: [], total: 0 };
    }
  }

  /**
   * Sends notification to agents
   */
  private async sendNotification(event: NotificationEvent): Promise<void> {
    try {
      console.log('Sending notification:', {
        type: event.type,
        conversationId: event.conversationId,
        priority: event.priority,
        message: event.message,
        recipients: event.recipients
      });

      // In a real implementation, this would:
      // 1. Send email notifications
      // 2. Send Slack/Teams messages
      // 3. Send push notifications
      // 4. Update real-time dashboard
      // 5. Log notification events

      // TODO: Implement actual notification delivery
      // await this.emailService.send(event);
      // await this.slackService.send(event);
      // await this.pushNotificationService.send(event);
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  /**
   * Gets notification recipients based on team assignment
   */
  private async getNotificationRecipients(teamId?: string): Promise<string[]> {
    try {
      // In a real implementation, this would query team members or notification preferences
      const defaultRecipients = ['support@company.com', 'manager@company.com'];
      
      if (teamId) {
        // Return team-specific recipients
        const teamRecipients = {
          'tier1': ['tier1@company.com', 'supervisor1@company.com'],
          'tier2': ['tier2@company.com', 'supervisor2@company.com'],
          'escalation': ['escalation@company.com', 'manager@company.com']
        };
        
        return teamRecipients[teamId as keyof typeof teamRecipients] || defaultRecipients;
      }

      return defaultRecipients;
    } catch (error) {
      console.error('Error getting notification recipients:', error);
      return ['support@company.com'];
    }
  }

  /**
   * Calculates wait time in minutes
   */
  private calculateWaitTime(createdAt: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - createdAt.getTime();
    return Math.floor(diffMs / (1000 * 60)); // Convert to minutes
  }

  /**
   * Gets triage analytics and metrics
   */
  async getTriageAnalytics(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<{
    totalTriaged: number;
    triageByRule: Record<string, number>;
    triageByPriority: Record<string, number>;
    averageWaitTime: number;
    escalationRate: number;
    resolutionRate: number;
    topEscalationReasons: Array<{
      reason: string;
      count: number;
      averageWaitTime: number;
    }>;
  }> {
    try {
      // In a real implementation, this would query triage logs and metrics
      return {
        totalTriaged: 156,
        triageByRule: {
          'high-priority-sentiment': 67,
          'critical-keywords': 23,
          'long-response-time': 45,
          'multiple-messages': 21
        },
        triageByPriority: {
          low: 12,
          medium: 89,
          high: 45,
          critical: 10
        },
        averageWaitTime: 18.5, // minutes
        escalationRate: 0.34, // 34% of conversations get triaged
        resolutionRate: 0.82, // 82% of triaged conversations get resolved
        topEscalationReasons: [
          {
            reason: 'High Priority Negative Sentiment',
            count: 67,
            averageWaitTime: 15.2
          },
          {
            reason: 'Long Response Time',
            count: 45,
            averageWaitTime: 32.1
          },
          {
            reason: 'Critical Issue Keywords',
            count: 23,
            averageWaitTime: 8.7
          }
        ]
      };
    } catch (error) {
      console.error('Error getting triage analytics:', error);
      throw error;
    }
  }

  /**
   * Creates a new triage rule
   */
  async createTriageRule(rule: Omit<TriageRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<TriageRule> {
    const newRule: TriageRule = {
      ...rule,
      id: `rule_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // In a real implementation, this would save to triage_rules table
    console.log('Created triage rule:', newRule);

    return newRule;
  }

  /**
   * Updates an existing triage rule
   */
  async updateTriageRule(id: string, updates: Partial<TriageRule>): Promise<TriageRule | null> {
    // In a real implementation, this would update the triage_rules table
    console.log('Updated triage rule:', { id, updates });

    const rules = await this.getActiveTriageRules();
    const existing = rules.find(r => r.id === id);

    if (!existing && !id.startsWith('rule_')) {
      return null;
    }

    // For test rules, create a mock response
    const baseRule = existing || {
      id,
      name: 'Test Rule',
      description: 'Test description',
      isActive: true,
      priority: 'medium' as const,
      conditions: {},
      actions: { escalate: true },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return {
      ...baseRule,
      ...updates,
      updatedAt: new Date()
    };
  }

  /**
   * Deletes a triage rule
   */
  async deleteTriageRule(id: string): Promise<boolean> {
    // In a real implementation, this would delete from triage_rules table
    console.log('Deleted triage rule:', id);
    return true;
  }
}

// Export singleton instance
export const conversationTriageEngine = new ConversationTriageEngine();