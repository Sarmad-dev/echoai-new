/**
 * Workflow Performance Monitor
 * 
 * Provides comprehensive monitoring, metrics collection, and performance
 * optimization for the workflow execution system.
 */

import type { ExecutionResult, TriggerEvent } from '../workflow-execution-engine';
import type { AutomationWorkflow } from '../../types/database';

export interface PerformanceMetrics {
  executionId: string;
  workflowId: string;
  chatbotId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // milliseconds
  status: 'running' | 'completed' | 'failed' | 'timeout';
  nodeCount: number;
  completedNodes: number;
  failedNodes: number;
  retryCount: number;
  memoryUsage?: number; // MB
  cpuTime?: number; // milliseconds
  triggerType: string;
  error?: string;
}

export interface WorkflowAnalytics {
  workflowId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  medianExecutionTime: number;
  p95ExecutionTime: number;
  errorRate: number;
  lastExecuted?: Date;
  mostCommonErrors: Array<{ error: string; count: number }>;
  performanceTrend: 'improving' | 'stable' | 'degrading';
}

export interface SystemMetrics {
  totalWorkflows: number;
  activeWorkflows: number;
  totalExecutions: number;
  executionsPerMinute: number;
  averageExecutionTime: number;
  systemErrorRate: number;
  memoryUsage: number;
  cpuUsage: number;
  queueDepth: number;
  activeExecutions: number;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: AlertCondition;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldownPeriod: number; // minutes
  lastTriggered?: Date;
}

export interface AlertCondition {
  metric: 'execution_time' | 'error_rate' | 'queue_depth' | 'memory_usage' | 'cpu_usage';
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  timeWindow: number; // minutes
}

export interface Alert {
  id: string;
  ruleId: string;
  severity: AlertRule['severity'];
  message: string;
  triggeredAt: Date;
  resolvedAt?: Date;
  metadata: Record<string, unknown>;
}

export class WorkflowPerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private workflowAnalytics: Map<string, WorkflowAnalytics> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private systemMetrics: SystemMetrics;
  private metricsHistory: PerformanceMetrics[] = [];
  private maxHistorySize = 10000;

  constructor() {
    this.systemMetrics = this.initializeSystemMetrics();
    this.setupDefaultAlertRules();
    this.startMetricsCollection();
  }

  /**
   * Starts monitoring a workflow execution
   */
  startExecution(
    executionId: string,
    workflowId: string,
    chatbotId: string,
    workflow: AutomationWorkflow,
    triggerEvent: TriggerEvent
  ): void {
    // Safely get node count with fallback
    let nodeCount = 0;
    try {
      if (workflow?.flowDefinition?.nodes && Array.isArray(workflow.flowDefinition.nodes)) {
        nodeCount = workflow.flowDefinition.nodes.length;
      }
    } catch (error) {
      console.warn(`Failed to get node count for workflow ${workflowId}:`, error);
      nodeCount = 0;
    }

    const metrics: PerformanceMetrics = {
      executionId,
      workflowId,
      chatbotId,
      startTime: new Date(),
      status: 'running',
      nodeCount,
      completedNodes: 0,
      failedNodes: 0,
      retryCount: 0,
      triggerType: triggerEvent.type,
    };

    this.metrics.set(executionId, metrics);
    this.updateSystemMetrics();
  }

  /**
   * Records node completion
   */
  recordNodeCompletion(executionId: string, nodeId: string, success: boolean): void {
    const metrics = this.metrics.get(executionId);
    if (!metrics) return;

    if (success) {
      metrics.completedNodes++;
    } else {
      metrics.failedNodes++;
    }

    this.metrics.set(executionId, metrics);
  }

  /**
   * Records retry attempt
   */
  recordRetryAttempt(executionId: string): void {
    const metrics = this.metrics.get(executionId);
    if (!metrics) return;

    metrics.retryCount++;
    this.metrics.set(executionId, metrics);
  }

  /**
   * Completes execution monitoring
   */
  completeExecution(
    executionId: string,
    result: ExecutionResult,
    error?: Error
  ): void {
    const metrics = this.metrics.get(executionId);
    if (!metrics) return;

    const endTime = new Date();
    metrics.endTime = endTime;
    metrics.duration = endTime.getTime() - metrics.startTime.getTime();
    metrics.status = result.status === 'COMPLETED' ? 'completed' : 'failed';
    
    if (error) {
      metrics.error = error.message;
    }

    // Record memory usage if available
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      metrics.memoryUsage = Math.round(memUsage.heapUsed / 1024 / 1024); // MB
    }

    this.metrics.set(executionId, metrics);
    this.addToHistory(metrics);
    this.updateWorkflowAnalytics(metrics);
    this.checkAlertRules(metrics);
    this.updateSystemMetrics();

    // Clean up completed execution from active metrics
    setTimeout(() => {
      this.metrics.delete(executionId);
    }, 60000); // Keep for 1 minute for potential queries
  }

  /**
   * Gets performance metrics for a specific execution
   */
  getExecutionMetrics(executionId: string): PerformanceMetrics | undefined {
    return this.metrics.get(executionId);
  }

  /**
   * Gets analytics for a specific workflow
   */
  getWorkflowAnalytics(workflowId: string): WorkflowAnalytics | undefined {
    return this.workflowAnalytics.get(workflowId);
  }

  /**
   * Gets system-wide metrics
   */
  getSystemMetrics(): SystemMetrics {
    return { ...this.systemMetrics };
  }

  /**
   * Gets performance history with filtering
   */
  getPerformanceHistory(
    workflowId?: string,
    chatbotId?: string,
    limit: number = 100
  ): PerformanceMetrics[] {
    let history = [...this.metricsHistory];

    if (workflowId) {
      history = history.filter(m => m.workflowId === workflowId);
    }

    if (chatbotId) {
      history = history.filter(m => m.chatbotId === chatbotId);
    }

    return history
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit);
  }

  /**
   * Gets active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values())
      .sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());
  }

  /**
   * Creates a custom alert rule
   */
  createAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const alertRule: AlertRule = { ...rule, id };
    this.alertRules.set(id, alertRule);
    return id;
  }

  /**
   * Updates an alert rule
   */
  updateAlertRule(id: string, updates: Partial<AlertRule>): boolean {
    const rule = this.alertRules.get(id);
    if (!rule) return false;

    this.alertRules.set(id, { ...rule, ...updates });
    return true;
  }

  /**
   * Deletes an alert rule
   */
  deleteAlertRule(id: string): boolean {
    return this.alertRules.delete(id);
  }

  /**
   * Gets performance insights and recommendations
   */
  getPerformanceInsights(workflowId?: string): {
    insights: string[];
    recommendations: string[];
    healthScore: number; // 0-100
  } {
    const insights: string[] = [];
    const recommendations: string[] = [];
    let healthScore = 100;

    const analytics = workflowId 
      ? this.workflowAnalytics.get(workflowId)
      : this.getAggregatedAnalytics();

    if (!analytics) {
      return { insights: ['No data available'], recommendations: [], healthScore: 0 };
    }

    // Error rate analysis
    if (analytics.errorRate > 0.1) {
      insights.push(`High error rate detected: ${(analytics.errorRate * 100).toFixed(1)}%`);
      recommendations.push('Review workflow logic and error handling');
      healthScore -= 20;
    }

    // Performance analysis
    if (analytics.averageExecutionTime > 30000) {
      insights.push(`Slow execution times: ${analytics.averageExecutionTime}ms average`);
      recommendations.push('Optimize workflow actions and reduce complexity');
      healthScore -= 15;
    }

    // Trend analysis
    if (analytics.performanceTrend === 'degrading') {
      insights.push('Performance is degrading over time');
      recommendations.push('Monitor resource usage and optimize bottlenecks');
      healthScore -= 10;
    }

    // Success rate analysis
    const successRate = analytics.totalExecutions > 0 
      ? analytics.successfulExecutions / analytics.totalExecutions 
      : 0;

    if (successRate < 0.9) {
      insights.push(`Low success rate: ${(successRate * 100).toFixed(1)}%`);
      recommendations.push('Review and fix common failure points');
      healthScore -= 25;
    }

    // System load analysis
    if (this.systemMetrics.executionsPerMinute > 100) {
      insights.push('High system load detected');
      recommendations.push('Consider implementing rate limiting or scaling');
      healthScore -= 5;
    }

    return {
      insights,
      recommendations,
      healthScore: Math.max(0, healthScore)
    };
  }

  /**
   * Exports metrics for external analysis
   */
  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    const data = {
      systemMetrics: this.systemMetrics,
      workflowAnalytics: Array.from(this.workflowAnalytics.values()),
      performanceHistory: this.metricsHistory,
      activeAlerts: this.getActiveAlerts(),
      exportedAt: new Date().toISOString()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    // CSV format for performance history
    const csvHeaders = [
      'executionId', 'workflowId', 'chatbotId', 'startTime', 'duration',
      'status', 'nodeCount', 'completedNodes', 'failedNodes', 'retryCount',
      'triggerType', 'error'
    ];

    const csvRows = this.metricsHistory.map(m => [
      m.executionId,
      m.workflowId,
      m.chatbotId,
      m.startTime.toISOString(),
      m.duration || '',
      m.status,
      m.nodeCount,
      m.completedNodes,
      m.failedNodes,
      m.retryCount,
      m.triggerType,
      m.error || ''
    ]);

    return [csvHeaders, ...csvRows].map(row => row.join(',')).join('\n');
  }

  // Private methods

  private initializeSystemMetrics(): SystemMetrics {
    return {
      totalWorkflows: 0,
      activeWorkflows: 0,
      totalExecutions: 0,
      executionsPerMinute: 0,
      averageExecutionTime: 0,
      systemErrorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      queueDepth: 0,
      activeExecutions: 0
    };
  }

  private setupDefaultAlertRules(): void {
    // High error rate alert
    this.createAlertRule({
      name: 'High Error Rate',
      condition: {
        metric: 'error_rate',
        operator: 'gt',
        timeWindow: 5
      },
      threshold: 0.1, // 10%
      severity: 'high',
      enabled: true,
      cooldownPeriod: 15
    });

    // Slow execution alert
    this.createAlertRule({
      name: 'Slow Execution Time',
      condition: {
        metric: 'execution_time',
        operator: 'gt',
        timeWindow: 10
      },
      threshold: 60000, // 60 seconds
      severity: 'medium',
      enabled: true,
      cooldownPeriod: 10
    });

    // High memory usage alert
    this.createAlertRule({
      name: 'High Memory Usage',
      condition: {
        metric: 'memory_usage',
        operator: 'gt',
        timeWindow: 5
      },
      threshold: 512, // 512 MB
      severity: 'high',
      enabled: true,
      cooldownPeriod: 5
    });
  }

  private addToHistory(metrics: PerformanceMetrics): void {
    this.metricsHistory.push({ ...metrics });

    // Maintain history size limit
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
    }
  }

  private updateWorkflowAnalytics(metrics: PerformanceMetrics): void {
    const existing = this.workflowAnalytics.get(metrics.workflowId) || {
      workflowId: metrics.workflowId,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      medianExecutionTime: 0,
      p95ExecutionTime: 0,
      errorRate: 0,
      mostCommonErrors: [],
      performanceTrend: 'stable' as const
    };

    existing.totalExecutions++;
    existing.lastExecuted = metrics.endTime;

    if (metrics.status === 'completed') {
      existing.successfulExecutions++;
    } else {
      existing.failedExecutions++;
      
      // Track common errors
      if (metrics.error) {
        const errorEntry = existing.mostCommonErrors.find(e => e.error === metrics.error);
        if (errorEntry) {
          errorEntry.count++;
        } else {
          existing.mostCommonErrors.push({ error: metrics.error, count: 1 });
        }
        
        // Keep only top 10 errors
        existing.mostCommonErrors.sort((a, b) => b.count - a.count);
        existing.mostCommonErrors = existing.mostCommonErrors.slice(0, 10);
      }
    }

    // Calculate execution time statistics
    const workflowHistory = this.metricsHistory
      .filter(m => m.workflowId === metrics.workflowId && m.duration)
      .map(m => m.duration!)
      .sort((a, b) => a - b);

    if (workflowHistory.length > 0) {
      existing.averageExecutionTime = workflowHistory.reduce((a, b) => a + b, 0) / workflowHistory.length;
      existing.medianExecutionTime = workflowHistory[Math.floor(workflowHistory.length / 2)];
      existing.p95ExecutionTime = workflowHistory[Math.floor(workflowHistory.length * 0.95)];
    }

    existing.errorRate = existing.totalExecutions > 0 
      ? existing.failedExecutions / existing.totalExecutions 
      : 0;

    // Determine performance trend
    if (workflowHistory.length >= 10) {
      const recent = workflowHistory.slice(-5);
      const older = workflowHistory.slice(-10, -5);
      
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
      
      if (recentAvg > olderAvg * 1.2) {
        existing.performanceTrend = 'degrading';
      } else if (recentAvg < olderAvg * 0.8) {
        existing.performanceTrend = 'improving';
      } else {
        existing.performanceTrend = 'stable';
      }
    }

    this.workflowAnalytics.set(metrics.workflowId, existing);
  }

  private updateSystemMetrics(): void {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    
    // Count recent executions
    const recentExecutions = this.metricsHistory.filter(
      m => m.startTime >= oneMinuteAgo
    );

    this.systemMetrics.executionsPerMinute = recentExecutions.length;
    this.systemMetrics.activeExecutions = this.metrics.size;
    this.systemMetrics.totalExecutions = this.metricsHistory.length;

    // Calculate average execution time
    const completedExecutions = this.metricsHistory.filter(m => m.duration);
    if (completedExecutions.length > 0) {
      this.systemMetrics.averageExecutionTime = 
        completedExecutions.reduce((sum, m) => sum + m.duration!, 0) / completedExecutions.length;
    }

    // Calculate error rate
    const failedExecutions = this.metricsHistory.filter(m => m.status === 'failed');
    this.systemMetrics.systemErrorRate = this.metricsHistory.length > 0
      ? failedExecutions.length / this.metricsHistory.length
      : 0;

    // Update memory usage if available
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      this.systemMetrics.memoryUsage = Math.round(memUsage.heapUsed / 1024 / 1024);
    }
  }

  private checkAlertRules(metrics: PerformanceMetrics): void {
    for (const rule of Array.from(this.alertRules.values())) {
      if (!rule.enabled) continue;

      // Check cooldown period
      if (rule.lastTriggered) {
        const cooldownEnd = new Date(rule.lastTriggered.getTime() + rule.cooldownPeriod * 60000);
        if (new Date() < cooldownEnd) continue;
      }

      const shouldAlert = this.evaluateAlertCondition(rule, metrics);
      
      if (shouldAlert) {
        this.triggerAlert(rule, metrics);
      }
    }
  }

  private evaluateAlertCondition(rule: AlertRule, metrics: PerformanceMetrics): boolean {
    const { condition, threshold } = rule;
    let value: number;

    switch (condition.metric) {
      case 'execution_time':
        value = metrics.duration || 0;
        break;
      case 'error_rate':
        const analytics = this.workflowAnalytics.get(metrics.workflowId);
        value = analytics?.errorRate || 0;
        break;
      case 'memory_usage':
        value = metrics.memoryUsage || 0;
        break;
      case 'queue_depth':
        value = this.systemMetrics.queueDepth;
        break;
      case 'cpu_usage':
        value = this.systemMetrics.cpuUsage;
        break;
      default:
        return false;
    }

    switch (condition.operator) {
      case 'gt':
        return value > threshold;
      case 'gte':
        return value >= threshold;
      case 'lt':
        return value < threshold;
      case 'lte':
        return value <= threshold;
      case 'eq':
        return value === threshold;
      default:
        return false;
    }
  }

  private triggerAlert(rule: AlertRule, metrics: PerformanceMetrics): void {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      severity: rule.severity,
      message: `${rule.name}: Threshold ${rule.threshold} exceeded for workflow ${metrics.workflowId}`,
      triggeredAt: new Date(),
      metadata: {
        workflowId: metrics.workflowId,
        executionId: metrics.executionId,
        threshold: rule.threshold,
        actualValue: this.getMetricValue(rule.condition.metric, metrics)
      }
    };

    this.activeAlerts.set(alertId, alert);
    
    // Update rule's last triggered time
    rule.lastTriggered = new Date();
    this.alertRules.set(rule.id, rule);

    // Log alert
    console.warn(`ALERT TRIGGERED: ${alert.message}`, alert.metadata);

    // In production, you would send notifications here
    this.sendAlertNotification(alert);
  }

  private getMetricValue(metric: AlertCondition['metric'], metrics: PerformanceMetrics): number {
    switch (metric) {
      case 'execution_time':
        return metrics.duration || 0;
      case 'error_rate':
        const analytics = this.workflowAnalytics.get(metrics.workflowId);
        return analytics?.errorRate || 0;
      case 'memory_usage':
        return metrics.memoryUsage || 0;
      case 'queue_depth':
        return this.systemMetrics.queueDepth;
      case 'cpu_usage':
        return this.systemMetrics.cpuUsage;
      default:
        return 0;
    }
  }

  private sendAlertNotification(alert: Alert): void {
    // In production, implement actual notification sending:
    // - Email notifications
    // - Slack/Teams messages
    // - PagerDuty alerts
    // - Webhook notifications
    
    console.log(`Sending ${alert.severity} alert notification:`, alert.message);
  }

  private getAggregatedAnalytics(): WorkflowAnalytics {
    const allAnalytics = Array.from(this.workflowAnalytics.values());
    
    if (allAnalytics.length === 0) {
      return {
        workflowId: 'system',
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        medianExecutionTime: 0,
        p95ExecutionTime: 0,
        errorRate: 0,
        mostCommonErrors: [],
        performanceTrend: 'stable'
      };
    }

    return {
      workflowId: 'system',
      totalExecutions: allAnalytics.reduce((sum, a) => sum + a.totalExecutions, 0),
      successfulExecutions: allAnalytics.reduce((sum, a) => sum + a.successfulExecutions, 0),
      failedExecutions: allAnalytics.reduce((sum, a) => sum + a.failedExecutions, 0),
      averageExecutionTime: allAnalytics.reduce((sum, a) => sum + a.averageExecutionTime, 0) / allAnalytics.length,
      medianExecutionTime: allAnalytics.reduce((sum, a) => sum + a.medianExecutionTime, 0) / allAnalytics.length,
      p95ExecutionTime: Math.max(...allAnalytics.map(a => a.p95ExecutionTime)),
      errorRate: allAnalytics.reduce((sum, a) => sum + a.errorRate, 0) / allAnalytics.length,
      mostCommonErrors: [],
      performanceTrend: 'stable'
    };
  }

  private startMetricsCollection(): void {
    // Update system metrics every 30 seconds
    setInterval(() => {
      this.updateSystemMetrics();
    }, 30000);

    // Clean up old metrics every hour
    setInterval(() => {
      const oneHourAgo = new Date(Date.now() - 3600000);
      this.metricsHistory = this.metricsHistory.filter(m => m.startTime >= oneHourAgo);
    }, 3600000);
  }
}

// Singleton instance
export const performanceMonitor = new WorkflowPerformanceMonitor();