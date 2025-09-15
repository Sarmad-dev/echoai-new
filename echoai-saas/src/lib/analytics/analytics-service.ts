import { databaseService } from "@/lib/supabase/database-service";
import { AnalyticsMetrics, ConversationAnalytics, WorkflowAnalytics, ConversationSession, Message, WorkflowExecution, AutomationWorkflow } from "@/types/database";
import { subDays, startOfDay, endOfDay } from "date-fns";

/**
 * Analytics Service with caching and performance optimization
 */
export class AnalyticsService {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get cached data or execute query if cache miss/expired
   */
  private async getCachedData<T>(
    key: string,
    queryFn: () => Promise<T>,
    ttl: number = this.DEFAULT_TTL
  ): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < cached.ttl) {
      return cached.data as T;
    }

    const data = await queryFn();
    this.cache.set(key, { data, timestamp: now, ttl });
    
    return data;
  }

  /**
   * Calculate comprehensive analytics metrics
   */
  async calculateMetrics(filters: {
    chatbotId?: string;
    userId?: string;
    dateRange?: { start: Date; end: Date };
    conversationType?: string;
  }): Promise<AnalyticsMetrics> {
    const cacheKey = `metrics:${JSON.stringify(filters)}`;
    
    return this.getCachedData(cacheKey, async () => {
      const { dateRange, chatbotId, conversationType } = filters;
      const client = databaseService.getClient();

      // Default to last 30 days if no date range provided
      const startDate = dateRange?.start || startOfDay(subDays(new Date(), 30));
      const endDate = dateRange?.end || endOfDay(new Date());

      // Build queries with filters
      let sessionQuery = client
        .from("ConversationSession")
        .select("*")
        .gte("createdAt", startDate.toISOString())
        .lte("createdAt", endDate.toISOString());

      const messageQuery = client
        .from("Message")
        .select("*")
        .gte("createdAt", startDate.toISOString())
        .lte("createdAt", endDate.toISOString());

      let workflowQuery = client
        .from("WorkflowExecution")
        .select("*")
        .gte("startedAt", startDate.toISOString())
        .lte("startedAt", endDate.toISOString());

      // Apply filters
      if (chatbotId) {
        sessionQuery = sessionQuery.eq("chatbotId", chatbotId);
        workflowQuery = workflowQuery.eq("chatbotId", chatbotId);
      }

      if (conversationType === "active") {
        sessionQuery = sessionQuery.eq("isActive", true);
      } else if (conversationType === "resolved") {
        sessionQuery = sessionQuery.eq("isActive", false);
      }

      // Execute queries in parallel
      const [sessionsResult, messagesResult, workflowsResult] = await Promise.all([
        databaseService.executeQuery(async () => await sessionQuery, "getAnalyticsSessions"),
        databaseService.executeQuery(async () => await messageQuery, "getAnalyticsMessages"),
        databaseService.executeQuery(async () => await workflowQuery, "getAnalyticsWorkflows")
      ]);

      return this.computeMetrics(
        sessionsResult as ConversationSession[], 
        messagesResult as Message[], 
        workflowsResult as WorkflowExecution[], 
        chatbotId
      );
    });
  }

  /**
   * Compute metrics from raw data
   */
  private computeMetrics(
    sessions: ConversationSession[],
    messages: Message[],
    workflows: WorkflowExecution[],
    chatbotId?: string
  ): AnalyticsMetrics {
    // Filter messages by session if chatbot filter is applied
    const filteredMessages = chatbotId 
      ? messages.filter(msg => sessions.some(session => session.id === msg.sessionId))
      : messages;

    // Total Conversations
    const totalConversations = sessions.length;

    // Average Sentiment
    const messagesWithSentiment = filteredMessages.filter(m => 
      m.sentimentScore !== null && m.sentimentScore !== undefined
    );
    const averageSentiment = messagesWithSentiment.length > 0
      ? messagesWithSentiment.reduce((sum, m) => sum + (m.sentimentScore || 0), 0) / messagesWithSentiment.length
      : 0;

    // Resolution Rate
    const resolvedSessions = sessions.filter(s => !s.isActive).length;
    const resolutionRate = totalConversations > 0 ? (resolvedSessions / totalConversations) * 100 : 0;

    // Automation Triggers
    const automationTriggers = workflows.length;

    // Active Users
    const activeUsers = new Set(
      sessions.filter(s => s.isActive).map(s => s.externalUserId)
    ).size;

    // Top Intents
    const intentCounts: Record<string, number> = {};
    filteredMessages.forEach(message => {
      if (message.metadata && message.metadata.intent) {
        const intent = message.metadata.intent;
        intentCounts[intent] = (intentCounts[intent] || 0) + 1;
      }
    });

    const topIntents = Object.entries(intentCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([intent, count]) => ({ intent, count }));

    return {
      totalConversations,
      averageSentiment: Math.round(averageSentiment * 100) / 100,
      resolutionRate: Math.round(resolutionRate * 100) / 100,
      automationTriggers,
      activeUsers,
      topIntents
    };
  }

  /**
   * Get conversation analytics with performance metrics
   */
  async getConversationAnalytics(filters: {
    chatbotId?: string;
    dateRange?: { start: Date; end: Date };
    limit?: number;
    offset?: number;
  }): Promise<ConversationAnalytics[]> {
    const cacheKey = `conversation-analytics:${JSON.stringify(filters)}`;
    
    return this.getCachedData(cacheKey, async () => {
      const { dateRange, chatbotId, limit = 100, offset = 0 } = filters;
      const client = databaseService.getClient();

      const startDate = dateRange?.start || startOfDay(subDays(new Date(), 30));
      const endDate = dateRange?.end || endOfDay(new Date());

      let query = client
        .from("ConversationSession")
        .select(`
          *,
          Message(*)
        `)
        .gte("createdAt", startDate.toISOString())
        .lte("createdAt", endDate.toISOString())
        .range(offset, offset + limit - 1);

      if (chatbotId) {
        query = query.eq("chatbotId", chatbotId);
      }

      const sessionsResult = await databaseService.executeQuery(
        async () => await query,
        "getConversationAnalytics"
      );

      return this.processConversationAnalytics(sessionsResult);
    });
  }

  /**
   * Process conversation analytics data
   */
  private processConversationAnalytics(sessions: (ConversationSession & { Message?: Message[] })[]): ConversationAnalytics[] {
    return sessions.map(session => {
      const messages = session.Message || [];
      const messageCount = messages.length;
      
      // Calculate average sentiment
      const messagesWithSentiment = messages.filter((m: Message) => m.sentimentScore !== null);
      const averageSentiment = messagesWithSentiment.length > 0
        ? messagesWithSentiment.reduce((sum: number, m: Message) => sum + (m.sentimentScore || 0), 0) / messagesWithSentiment.length
        : 0;

      // Calculate duration
      const startTime = new Date(session.createdAt).getTime();
      const endTime = session.updatedAt ? new Date(session.updatedAt).getTime() : Date.now();
      const duration = Math.round((endTime - startTime) / (1000 * 60)); // minutes

      return {
        conversationId: session.id,
        messageCount,
        averageSentiment: Math.round(averageSentiment * 100) / 100,
        duration,
        resolved: !session.isActive,
        automationTriggered: false // This would need workflow execution data
      };
    });
  }  /**

   * Get workflow analytics with performance metrics
   */
  async getWorkflowAnalytics(filters: {
    chatbotId?: string;
    userId?: string;
    dateRange?: { start: Date; end: Date };
    workflowId?: string;
  }): Promise<WorkflowAnalytics[]> {
    const cacheKey = `workflow-analytics:${JSON.stringify(filters)}`;
    
    return this.getCachedData(cacheKey, async () => {
      const { dateRange, chatbotId, userId, workflowId } = filters;
      const client = databaseService.getClient();

      let query = client
        .from("AutomationWorkflow")
        .select(`
          *,
          WorkflowExecution(*)
        `);

      if (chatbotId) {
        query = query.eq("chatbotId", chatbotId);
      }

      if (userId) {
        query = query.eq("userId", userId);
      }

      if (workflowId) {
        query = query.eq("id", workflowId);
      }

      const workflowsResult = await databaseService.executeQuery(
        async () => await query,
        "getWorkflowAnalytics"
      );

      return this.processWorkflowAnalytics(workflowsResult, dateRange);
    });
  }

  /**
   * Process workflow analytics data
   */
  private processWorkflowAnalytics(workflows: (AutomationWorkflow & { WorkflowExecution?: WorkflowExecution[] })[], dateRange?: { start: Date; end: Date }): WorkflowAnalytics[] {
    return workflows.map(workflow => {
      let executions = workflow.WorkflowExecution || [];

      // Apply date range filter to executions
      if (dateRange) {
        executions = executions.filter((exec: WorkflowExecution) => {
          const execDate = new Date(exec.startedAt);
          return execDate >= dateRange.start && execDate <= dateRange.end;
        });
      }

      const executionCount = executions.length;
      const successfulExecutions = executions.filter((exec: WorkflowExecution) => exec.status === "COMPLETED");
      const successRate = executionCount > 0 ? (successfulExecutions.length / executionCount) * 100 : 0;

      // Calculate average execution time
      const completedExecutions = executions.filter((exec: WorkflowExecution) => 
        exec.status === "COMPLETED" && exec.completedAt
      );
      
      const averageExecutionTime = completedExecutions.length > 0
        ? completedExecutions.reduce((sum: number, exec: WorkflowExecution) => {
            const start = new Date(exec.startedAt).getTime();
            const end = new Date(exec.completedAt!).getTime();
            return sum + (end - start);
          }, 0) / completedExecutions.length
        : 0;

      const lastExecuted = executions.length > 0
        ? new Date(Math.max(...executions.map((exec: WorkflowExecution) => new Date(exec.startedAt).getTime())))
        : undefined;

      return {
        workflowId: workflow.id,
        executionCount,
        successRate: Math.round(successRate * 100) / 100,
        averageExecutionTime: Math.round(averageExecutionTime),
        lastExecuted
      };
    });
  }

  /**
   * Clear cache for specific keys or all cache
   */
  clearCache(pattern?: string): void {
    if (pattern) {
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.includes(pattern));
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();