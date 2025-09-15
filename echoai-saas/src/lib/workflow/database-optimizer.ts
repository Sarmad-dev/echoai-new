/**
 * Database Query Optimizer for Workflows
 *
 * Provides optimized database queries, caching, and indexing strategies
 * for workflow-related operations to improve performance.
 */

import { databaseService } from "../supabase/database-service";
import type {
  AutomationWorkflow,
  WorkflowExecution,
  ReactFlowDefinition,
} from "../../types/database";

export interface QueryCache {
  key: string;
  data: unknown;
  timestamp: Date;
  ttl: number; // Time to live in milliseconds
}

export interface QueryOptimizationConfig {
  enableCaching: boolean;
  defaultCacheTTL: number;
  maxCacheSize: number;
  enableQueryLogging: boolean;
  slowQueryThreshold: number; // milliseconds
}

export class WorkflowDatabaseOptimizer {
  private cache: Map<string, QueryCache> = new Map();
  private config: QueryOptimizationConfig;
  private queryStats: Map<
    string,
    {
      count: number;
      totalTime: number;
      averageTime: number;
      slowQueries: number;
    }
  > = new Map();

  constructor(config: Partial<QueryOptimizationConfig> = {}) {
    this.config = {
      enableCaching: true,
      defaultCacheTTL: 5 * 60 * 1000, // 5 minutes
      maxCacheSize: 1000,
      enableQueryLogging: true,
      slowQueryThreshold: 1000, // 1 second
      ...config,
    };

    // Clean up cache every 5 minutes
    setInterval(() => this.cleanupCache(), 5 * 60 * 1000);
  }

  /**
   * Optimized workflow retrieval with caching
   */
  async getWorkflow(workflowId: string): Promise<AutomationWorkflow | null> {
    const cacheKey = `workflow:${workflowId}`;

    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached as AutomationWorkflow;
      }
    }

    const startTime = Date.now();

    try {
      const client = databaseService.getClient();

      const result = await databaseService.executeOptionalQuery(async () => {
        return await client
          .from("AutomationWorkflow")
          .select("*")
          .eq("id", workflowId)
          .single();
      }, "getWorkflowOptimized");

      const duration = Date.now() - startTime;
      this.recordQueryStats("getWorkflow", duration);

      if (result) {
        const workflow = this.transformWorkflowData(result);

        // Cache the result
        if (this.config.enableCaching) {
          this.setCache(cacheKey, workflow, this.config.defaultCacheTTL);
        }

        return workflow;
      }

      return null;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordQueryStats("getWorkflow", duration, true);
      throw error;
    }
  }

  /**
   * Optimized workflow listing with pagination and filtering
   */
  async listWorkflows(
    options: {
      userId?: string;
      chatbotId?: string;
      isActive?: boolean;
      limit?: number;
      offset?: number;
      includeInactive?: boolean;
    } = {}
  ): Promise<AutomationWorkflow[]> {
    const cacheKey = `workflows:${JSON.stringify(options)}`;

    // Check cache for frequently accessed lists
    if (this.config.enableCaching && options.limit && options.limit <= 50) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached as AutomationWorkflow[];
      }
    }

    const startTime = Date.now();

    try {
      const client = databaseService.getClient();

      let query = client.from("AutomationWorkflow").select("*");

      // Apply filters
      if (options.userId) {
        query = query.eq("userId", options.userId);
      }

      if (options.chatbotId) {
        query = query.eq("chatbotId", options.chatbotId);
      }

      if (options.isActive !== undefined) {
        query = query.eq("isActive", options.isActive);
      }

      // Apply ordering for consistent results
      query = query.order("updatedAt", { ascending: false });

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(
          options.offset,
          options.offset + (options.limit || 50) - 1
        );
      }

      console.log('About to execute database query with filters:', options);
      
      const result = await databaseService.executeQuery(
        async () => await query,
        "listWorkflowsOptimized"
      );

      const duration = Date.now() - startTime;
      this.recordQueryStats("listWorkflows", duration);

      console.log('Raw database result:', result);
      console.log('Result type:', typeof result);
      console.log('Result is array:', Array.isArray(result));
      
      // Handle different result formats from Supabase
      let workflows: AutomationWorkflow[] = [];
      
      if (Array.isArray(result)) {
        // Direct array result
        workflows = result.map(this.transformWorkflowData);
      } else if (result && typeof result === 'object' && 'data' in result) {
        // Wrapped result format
        const resultData = result as { data: Record<string, unknown>[] };
        workflows = (resultData.data || []).map(this.transformWorkflowData);
      } else {
        console.warn('Unexpected result format:', result);
        workflows = [];
      }

      // Cache smaller result sets
      if (this.config.enableCaching && workflows.length <= 50) {
        this.setCache(cacheKey, workflows, this.config.defaultCacheTTL);
      }

      return workflows;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordQueryStats("listWorkflows", duration, true);
      throw error;
    }
  }

  /**
   * Optimized execution history retrieval
   */
  async getExecutionHistory(
    options: {
      workflowId?: string;
      chatbotId?: string;
      userId?: string;
      status?: string;
      limit?: number;
      offset?: number;
      dateFrom?: Date;
      dateTo?: Date;
    } = {}
  ): Promise<{
    executions: WorkflowExecution[];
    total: number;
  }> {
    const startTime = Date.now();

    try {
      const client = databaseService.getClient();

      let query = client
        .from("WorkflowExecution")
        .select("*, AutomationWorkflow!inner(name, chatbotId)", {
          count: "exact",
        });

      // Apply filters
      if (options.workflowId) {
        query = query.eq("workflowId", options.workflowId);
      }

      if (options.chatbotId) {
        query = query.eq("AutomationWorkflow.chatbotId", options.chatbotId);
      }

      if (options.status) {
        query = query.eq("status", options.status);
      }

      if (options.dateFrom) {
        query = query.gte("startedAt", options.dateFrom.toISOString());
      }

      if (options.dateTo) {
        query = query.lte("startedAt", options.dateTo.toISOString());
      }

      // Apply ordering
      query = query.order("startedAt", { ascending: false });

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(
          options.offset,
          options.offset + (options.limit || 50) - 1
        );
      }

      const result = await databaseService.executeQuery(
        async () => await query,
        "getExecutionHistoryOptimized"
      );

      const duration = Date.now() - startTime;
      this.recordQueryStats("getExecutionHistory", duration);

      const resultData = result as unknown as {
        data: Record<string, unknown>[];
        count: number;
      };

      return {
        executions: resultData.data?.map(this.transformExecutionData) || [],
        total: resultData.count || 0,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordQueryStats("getExecutionHistory", duration, true);
      throw error;
    }
  }

  /**
   * Batch workflow operations for better performance
   */
  async batchUpdateWorkflows(
    updates: Array<{
      id: string;
      data: Partial<AutomationWorkflow>;
    }>
  ): Promise<void> {
    if (updates.length === 0) return;

    const startTime = Date.now();

    try {
      const client = databaseService.getClient();

      // Use batch upsert for better performance
      const upsertData = updates.map((update) => ({
        id: update.id,
        ...update.data,
        updatedAt: new Date().toISOString(),
      }));

      await databaseService.executeQuery(async () => {
        const result = await (
          client as unknown as {
            from: (table: string) => {
              upsert: (data: unknown[]) => Promise<unknown>;
            };
          }
        )
          .from("AutomationWorkflow")
          .upsert(upsertData);
        return { data: result, error: null };
      }, "batchUpdateWorkflows");

      const duration = Date.now() - startTime;
      this.recordQueryStats("batchUpdateWorkflows", duration);

      // Invalidate cache for updated workflows
      if (this.config.enableCaching) {
        updates.forEach((update) => {
          this.invalidateCache(`workflow:${update.id}`);
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordQueryStats("batchUpdateWorkflows", duration, true);
      throw error;
    }
  }

  /**
   * Optimized analytics queries
   */
  async getWorkflowAnalytics(
    options: {
      workflowId?: string;
      chatbotId?: string;
      userId?: string;
      dateFrom?: Date;
      dateTo?: Date;
    } = {}
  ): Promise<{
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    executionsByDay: Array<{ date: string; count: number }>;
    errorsByType: Array<{ error: string; count: number }>;
  }> {
    const cacheKey = `analytics:${JSON.stringify(options)}`;

    // Cache analytics for 10 minutes
    if (this.config.enableCaching) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached as {
          totalExecutions: number;
          successfulExecutions: number;
          failedExecutions: number;
          averageExecutionTime: number;
          executionsByDay: Array<{ date: string; count: number }>;
          errorsByType: Array<{ error: string; count: number }>;
        };
      }
    }

    const startTime = Date.now();

    try {
      const client = databaseService.getClient();

      // Build base query
      let baseQuery = client
        .from("WorkflowExecution")
        .select("status, startedAt, completedAt, error");

      if (options.workflowId) {
        baseQuery = baseQuery.eq("workflowId", options.workflowId);
      }

      if (options.chatbotId) {
        baseQuery = baseQuery.eq("chatbotId", options.chatbotId);
      }

      if (options.dateFrom) {
        baseQuery = baseQuery.gte("startedAt", options.dateFrom.toISOString());
      }

      if (options.dateTo) {
        baseQuery = baseQuery.lte("startedAt", options.dateTo.toISOString());
      }

      const result = await databaseService.executeQuery(
        async () => await baseQuery,
        "getWorkflowAnalytics"
      );

      const duration = Date.now() - startTime;
      this.recordQueryStats("getWorkflowAnalytics", duration);

      const executions =
        (result as unknown as { data: Record<string, unknown>[] }).data || [];

      // Process analytics
      const analytics = this.processAnalyticsData(executions);

      // Cache the result
      if (this.config.enableCaching) {
        this.setCache(cacheKey, analytics, 10 * 60 * 1000); // 10 minutes
      }

      return analytics;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordQueryStats("getWorkflowAnalytics", duration, true);
      throw error;
    }
  }

  /**
   * Gets query performance statistics
   */
  getQueryStats(): Array<{
    query: string;
    count: number;
    totalTime: number;
    averageTime: number;
    slowQueries: number;
  }> {
    return Array.from(this.queryStats.entries()).map(([query, stats]) => ({
      query,
      ...stats,
    }));
  }

  /**
   * Clears all caches
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Gets cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    memoryUsage: number;
  } {
    const size = this.cache.size;
    const memoryUsage = JSON.stringify(Array.from(this.cache.values())).length;

    return {
      size,
      hitRate: 0, // Would need to track hits/misses
      memoryUsage,
    };
  }

  // Private methods

  private transformWorkflowData(
    data: Record<string, unknown>
  ): AutomationWorkflow {
    // Parse JSON fields if they are strings
    let flowDefinition: ReactFlowDefinition = { nodes: [], edges: [] };
    let stateMachine: Record<string, unknown> = {
      id: "default",
      initial: "idle",
      states: {},
    };

    if (typeof data.flowDefinition === "string") {
      try {
        const parsed = JSON.parse(data.flowDefinition);
        if (parsed && typeof parsed === "object") {
          flowDefinition = parsed as ReactFlowDefinition;
        }
      } catch (error) {
        console.error("Failed to parse flowDefinition JSON:", error);
        // Keep default structure
      }
    } else if (data.flowDefinition && typeof data.flowDefinition === "object") {
      flowDefinition = data.flowDefinition as ReactFlowDefinition;
    }

    if (typeof data.stateMachine === "string") {
      try {
        const parsed = JSON.parse(data.stateMachine);
        if (parsed && typeof parsed === "object") {
          stateMachine = parsed as Record<string, unknown>;
        }
      } catch (error) {
        console.error("Failed to parse stateMachine JSON:", error);
        // Keep default structure
      }
    } else if (data.stateMachine && typeof data.stateMachine === "object") {
      stateMachine = data.stateMachine as Record<string, unknown>;
    }

    // Ensure flowDefinition has the required structure
    if (!flowDefinition || typeof flowDefinition !== "object") {
      flowDefinition = { nodes: [], edges: [] };
    }

    if (!Array.isArray(flowDefinition.nodes)) {
      flowDefinition.nodes = [];
    }

    if (!Array.isArray(flowDefinition.edges)) {
      flowDefinition.edges = [];
    }

    return {
      ...data,
      flowDefinition,
      stateMachine,
      createdAt: new Date(data.createdAt as string),
      updatedAt: new Date(data.updatedAt as string),
    } as unknown as AutomationWorkflow;
  }

  private transformExecutionData(
    data: Record<string, unknown>
  ): WorkflowExecution {
    return {
      ...data,
      startedAt: new Date(data.startedAt as string),
      completedAt: data.completedAt
        ? new Date(data.completedAt as string)
        : undefined,
    } as unknown as WorkflowExecution;
  }

  private processAnalyticsData(executions: Record<string, unknown>[]): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    executionsByDay: Array<{ date: string; count: number }>;
    errorsByType: Array<{ error: string; count: number }>;
  } {
    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter(
      (e) => e.status === "COMPLETED"
    ).length;
    const failedExecutions = executions.filter(
      (e) => e.status === "FAILED"
    ).length;

    // Calculate average execution time
    const completedExecutions = executions.filter(
      (e) => e.completedAt && e.startedAt
    );
    const averageExecutionTime =
      completedExecutions.length > 0
        ? completedExecutions.reduce((sum, e) => {
            const duration =
              new Date(e.completedAt as string).getTime() -
              new Date(e.startedAt as string).getTime();
            return sum + duration;
          }, 0) / completedExecutions.length
        : 0;

    // Group executions by day
    const executionsByDay = executions.reduce(
      (acc: Record<string, number>, e) => {
        const date = new Date(e.startedAt as string)
          .toISOString()
          .split("T")[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      },
      {}
    );

    // Group errors by type
    const errorsByType = executions
      .filter((e) => e.error)
      .reduce((acc: Record<string, number>, e) => {
        const error = (e.error as string) || "Unknown error";
        acc[error] = (acc[error] || 0) + 1;
        return acc;
      }, {});

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime,
      executionsByDay: Object.entries(executionsByDay).map(([date, count]) => ({
        date,
        count: Number(count),
      })),
      errorsByType: Object.entries(errorsByType).map(([error, count]) => ({
        error,
        count: Number(count),
      })),
    };
  }

  private getFromCache(key: string): unknown {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp.getTime() > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCache(key: string, data: unknown, ttl: number): void {
    // Check cache size limit
    if (this.cache.size >= this.config.maxCacheSize) {
      // Remove oldest entries
      const entries = Array.from(this.cache.entries());
      entries.sort(
        (a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime()
      );

      // Remove oldest 10% of entries
      const toRemove = Math.floor(entries.length * 0.1);
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
      }
    }

    this.cache.set(key, {
      key,
      data,
      timestamp: new Date(),
      ttl,
    });
  }

  private invalidateCache(key: string): void {
    this.cache.delete(key);

    // Also invalidate related cache entries
    if (key.startsWith("workflow:")) {
      // Invalidate workflow lists that might contain this workflow
      for (const cacheKey of Array.from(this.cache.keys())) {
        if (cacheKey.startsWith("workflows:")) {
          this.cache.delete(cacheKey);
        }
      }
    }
  }

  private recordQueryStats(
    queryName: string,
    duration: number,
    _isError = false
  ): void {
    if (!this.config.enableQueryLogging) return;

    const stats = this.queryStats.get(queryName) || {
      count: 0,
      totalTime: 0,
      averageTime: 0,
      slowQueries: 0,
    };

    stats.count++;
    stats.totalTime += duration;
    stats.averageTime = stats.totalTime / stats.count;

    if (duration > this.config.slowQueryThreshold) {
      stats.slowQueries++;
      console.warn(`Slow query detected: ${queryName} took ${duration}ms`);
    }

    this.queryStats.set(queryName, stats);
  }

  private cleanupCache(): void {
    const now = Date.now();

    for (const [key, cached] of Array.from(this.cache.entries())) {
      if (now - cached.timestamp.getTime() > cached.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton instance
export const databaseOptimizer = new WorkflowDatabaseOptimizer();
