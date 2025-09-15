import type { 
  Message, 
  ConversationSession, 
  WorkflowExecution,
  AnalyticsMetrics 
} from '@/types/database'

/**
 * Utility functions for analytics data processing and aggregation
 */

export interface TimeSeriesDataPoint {
  timestamp: string
  value: number
  label?: string
}

export interface AnalyticsFilters {
  chatbotId?: string
  userId?: string
  dateRange?: {
    start: Date
    end: Date
  }
  sentimentThreshold?: number
}

/**
 * Calculate sentiment distribution from messages
 */
export function calculateSentimentDistribution(messages: Message[]): {
  positive: number
  neutral: number
  negative: number
} {
  const messagesWithSentiment = messages.filter(m => 
    m.sentimentScore !== null && m.sentimentScore !== undefined
  )

  if (messagesWithSentiment.length === 0) {
    return { positive: 0, neutral: 0, negative: 0 }
  }

  const distribution = messagesWithSentiment.reduce(
    (acc, message) => {
      const score = message.sentimentScore!
      if (score > 0.2) acc.positive++
      else if (score < -0.2) acc.negative++
      else acc.neutral++
      return acc
    },
    { positive: 0, neutral: 0, negative: 0 }
  )

  // Convert to percentages
  const total = messagesWithSentiment.length
  return {
    positive: Math.round((distribution.positive / total) * 100),
    neutral: Math.round((distribution.neutral / total) * 100),
    negative: Math.round((distribution.negative / total) * 100)
  }
}

/**
 * Generate time series data for conversation volume
 */
export function generateConversationTimeSeries(
  sessions: ConversationSession[],
  intervalHours: number = 1
): TimeSeriesDataPoint[] {
  if (sessions.length === 0) return []

  // Find the date range
  const dates = sessions.map(s => new Date(s.createdAt))
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))

  // Generate time intervals
  const intervals: TimeSeriesDataPoint[] = []
  const intervalMs = intervalHours * 60 * 60 * 1000

  for (let time = minDate.getTime(); time <= maxDate.getTime(); time += intervalMs) {
    const intervalStart = new Date(time)
    const intervalEnd = new Date(time + intervalMs)
    
    const count = sessions.filter(session => {
      const sessionDate = new Date(session.createdAt)
      return sessionDate >= intervalStart && sessionDate < intervalEnd
    }).length

    intervals.push({
      timestamp: intervalStart.toISOString(),
      value: count,
      label: intervalStart.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    })
  }

  return intervals
}

/**
 * Calculate workflow execution trends
 */
export function calculateWorkflowTrends(executions: WorkflowExecution[]): {
  successTrend: TimeSeriesDataPoint[]
  volumeTrend: TimeSeriesDataPoint[]
  averageExecutionTime: number
} {
  if (executions.length === 0) {
    return {
      successTrend: [],
      volumeTrend: [],
      averageExecutionTime: 0
    }
  }

  // Group executions by hour
  const hourlyGroups = executions.reduce((acc, execution) => {
    const hour = new Date(execution.startedAt).toISOString().slice(0, 13) + ':00:00.000Z'
    if (!acc[hour]) {
      acc[hour] = []
    }
    acc[hour].push(execution)
    return acc
  }, {} as Record<string, WorkflowExecution[]>)

  // Generate trends
  const successTrend: TimeSeriesDataPoint[] = []
  const volumeTrend: TimeSeriesDataPoint[] = []

  Object.entries(hourlyGroups).forEach(([hour, executions]) => {
    const successful = executions.filter(e => e.status === 'COMPLETED').length
    const successRate = executions.length > 0 ? (successful / executions.length) * 100 : 0

    successTrend.push({
      timestamp: hour,
      value: successRate,
      label: new Date(hour).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    })

    volumeTrend.push({
      timestamp: hour,
      value: executions.length,
      label: new Date(hour).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    })
  })

  // Calculate average execution time
  const completedExecutions = executions.filter(e => 
    e.status === 'COMPLETED' && e.completedAt
  )
  
  const averageExecutionTime = completedExecutions.length > 0
    ? completedExecutions.reduce((sum, execution) => {
        const start = new Date(execution.startedAt).getTime()
        const end = new Date(execution.completedAt!).getTime()
        return sum + (end - start)
      }, 0) / completedExecutions.length
    : 0

  return {
    successTrend: successTrend.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    volumeTrend: volumeTrend.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    averageExecutionTime
  }
}

/**
 * Extract and analyze conversation patterns
 */
export function analyzeConversationPatterns(
  sessions: ConversationSession[],
  messages: Message[]
): {
  averageSessionDuration: number
  averageMessagesPerSession: number
  peakHours: number[]
  commonTopics: Array<{ topic: string; frequency: number }>
} {
  if (sessions.length === 0) {
    return {
      averageSessionDuration: 0,
      averageMessagesPerSession: 0,
      peakHours: [],
      commonTopics: []
    }
  }

  // Calculate average session duration
  const sessionDurations = sessions.map(session => {
    const start = new Date(session.createdAt).getTime()
    const end = session.updatedAt ? new Date(session.updatedAt).getTime() : Date.now()
    return end - start
  })
  
  const averageSessionDuration = sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length

  // Calculate average messages per session
  const sessionMessageCounts = sessions.map(session => 
    messages.filter(m => m.sessionId === session.id).length
  )
  
  const averageMessagesPerSession = sessionMessageCounts.length > 0
    ? sessionMessageCounts.reduce((sum, count) => sum + count, 0) / sessionMessageCounts.length
    : 0

  // Find peak hours
  const hourCounts = new Array(24).fill(0)
  sessions.forEach(session => {
    const hour = new Date(session.createdAt).getHours()
    hourCounts[hour]++
  })
  
  const maxCount = Math.max(...hourCounts)
  const peakHours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .filter(({ count }) => count === maxCount)
    .map(({ hour }) => hour)

  // Extract common topics from message metadata
  const topicCounts: Record<string, number> = {}
  messages.forEach(message => {
    if (message.metadata && message.metadata.topics) {
      const topics = Array.isArray(message.metadata.topics) 
        ? message.metadata.topics 
        : [message.metadata.topics]
      
      topics.forEach((topic: string) => {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1
      })
    }
  })

  const commonTopics = Object.entries(topicCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([topic, frequency]) => ({ topic, frequency }))

  return {
    averageSessionDuration: Math.round(averageSessionDuration / (1000 * 60)), // Convert to minutes
    averageMessagesPerSession: Math.round(averageMessagesPerSession * 10) / 10,
    peakHours,
    commonTopics
  }
}

/**
 * Calculate user engagement metrics
 */
export function calculateEngagementMetrics(
  sessions: ConversationSession[],
  messages: Message[]
): {
  returnUserRate: number
  averageResponseTime: number
  engagementScore: number
} {
  if (sessions.length === 0) {
    return {
      returnUserRate: 0,
      averageResponseTime: 0,
      engagementScore: 0
    }
  }

  // Calculate return user rate
  const userSessionCounts: Record<string, number> = {}
  sessions.forEach(session => {
    userSessionCounts[session.externalUserId] = (userSessionCounts[session.externalUserId] || 0) + 1
  })
  
  const returnUsers = Object.values(userSessionCounts).filter(count => count > 1).length
  const totalUsers = Object.keys(userSessionCounts).length
  const returnUserRate = totalUsers > 0 ? (returnUsers / totalUsers) * 100 : 0

  // Calculate average response time (simplified - time between user and assistant messages)
  const responseTimes: number[] = []
  sessions.forEach(session => {
    const sessionMessages = messages
      .filter(m => m.sessionId === session.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    for (let i = 0; i < sessionMessages.length - 1; i++) {
      const current = sessionMessages[i]
      const next = sessionMessages[i + 1]
      
      if (current.role === 'user' && next.role === 'assistant') {
        const responseTime = new Date(next.createdAt).getTime() - new Date(current.createdAt).getTime()
        responseTimes.push(responseTime)
      }
    }
  })

  const averageResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
    : 0

  // Calculate engagement score (composite metric)
  const avgMessagesPerSession = sessions.length > 0
    ? messages.length / sessions.length
    : 0
  
  const avgSentiment = messages
    .filter(m => m.sentimentScore !== null && m.sentimentScore !== undefined)
    .reduce((sum, m) => sum + (m.sentimentScore || 0), 0) / messages.length || 0

  // Engagement score: weighted combination of metrics (0-100 scale)
  const engagementScore = Math.min(100, Math.max(0,
    (avgMessagesPerSession * 10) + // More messages = higher engagement
    ((avgSentiment + 1) * 25) + // Positive sentiment = higher engagement
    (returnUserRate * 0.5) // Return users = higher engagement
  ))

  return {
    returnUserRate: Math.round(returnUserRate * 10) / 10,
    averageResponseTime: Math.round(averageResponseTime / 1000), // Convert to seconds
    engagementScore: Math.round(engagementScore * 10) / 10
  }
}

/**
 * Calculate comprehensive analytics metrics from raw data
 */
export function calculateComprehensiveMetrics(
  sessions: ConversationSession[],
  messages: Message[],
  executions: WorkflowExecution[]
): AnalyticsMetrics {
  // Total Conversations
  const totalConversations = sessions.length;

  // Average Sentiment
  const messagesWithSentiment = messages.filter(m => 
    m.sentimentScore !== null && m.sentimentScore !== undefined
  );
  const averageSentiment = messagesWithSentiment.length > 0
    ? messagesWithSentiment.reduce((sum, m) => sum + (m.sentimentScore || 0), 0) / messagesWithSentiment.length
    : 0;

  // Resolution Rate (percentage of conversations that are no longer active)
  const resolvedSessions = sessions.filter(s => !s.isActive).length;
  const resolutionRate = totalConversations > 0 ? (resolvedSessions / totalConversations) * 100 : 0;

  // Automation Triggers (total workflow executions)
  const automationTriggers = executions.length;

  // Active Users (unique external users in active sessions)
  const activeUsers = new Set(
    sessions.filter(s => s.isActive).map(s => s.externalUserId)
  ).size;

  // Top Intents from message metadata
  const intentCounts: Record<string, number> = {};
  messages.forEach(message => {
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
 * Calculate workflow performance metrics
 */
export function calculateWorkflowPerformanceMetrics(executions: WorkflowExecution[]): {
  totalExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  failureRate: number;
  executionsByStatus: Record<string, number>;
} {
  if (executions.length === 0) {
    return {
      totalExecutions: 0,
      successRate: 0,
      averageExecutionTime: 0,
      failureRate: 0,
      executionsByStatus: {}
    };
  }

  const totalExecutions = executions.length;
  const successfulExecutions = executions.filter(e => e.status === 'COMPLETED').length;
  const failedExecutions = executions.filter(e => e.status === 'FAILED').length;

  const successRate = (successfulExecutions / totalExecutions) * 100;
  const failureRate = (failedExecutions / totalExecutions) * 100;

  // Calculate average execution time for completed executions
  const completedExecutions = executions.filter(e => e.status === 'COMPLETED' && e.completedAt);
  const totalExecutionTime = completedExecutions.reduce((sum, execution) => {
    const startTime = new Date(execution.startedAt).getTime();
    const endTime = new Date(execution.completedAt!).getTime();
    return sum + (endTime - startTime);
  }, 0);

  const averageExecutionTime = completedExecutions.length > 0 
    ? totalExecutionTime / completedExecutions.length 
    : 0;

  // Count executions by status
  const executionsByStatus = executions.reduce((acc, execution) => {
    acc[execution.status] = (acc[execution.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalExecutions,
    successRate: Math.round(successRate * 100) / 100,
    averageExecutionTime: Math.round(averageExecutionTime),
    failureRate: Math.round(failureRate * 100) / 100,
    executionsByStatus
  };
}

/**
 * Generate analytics summary report
 */
export function generateAnalyticsSummary(
  metrics: AnalyticsMetrics,
  sessions: ConversationSession[],
  messages: Message[],
  executions: WorkflowExecution[]
): {
  summary: string
  insights: string[]
  recommendations: string[]
} {
  const patterns = analyzeConversationPatterns(sessions, messages)
  const engagement = calculateEngagementMetrics(sessions, messages)
  const sentiment = calculateSentimentDistribution(messages)
  const workflowMetrics = calculateWorkflowPerformanceMetrics(executions)

  // Generate summary
  const summary = `Analytics Summary: ${metrics.totalConversations} conversations with ${metrics.activeUsers} active users. Average sentiment: ${metrics.averageSentiment.toFixed(2)} (${sentiment.positive}% positive). ${metrics.automationTriggers} automation triggers executed with ${workflowMetrics.successRate}% success rate.`

  // Generate insights
  const insights: string[] = []
  
  if (metrics.averageSentiment > 0.3) {
    insights.push("Customer sentiment is predominantly positive")
  } else if (metrics.averageSentiment < -0.2) {
    insights.push("Customer sentiment shows concerning negative trends")
  }

  if (engagement.returnUserRate > 30) {
    insights.push(`High user retention with ${engagement.returnUserRate.toFixed(1)}% return rate`)
  }

  if (patterns.peakHours.length > 0) {
    insights.push(`Peak activity hours: ${patterns.peakHours.join(', ')}:00`)
  }

  if (metrics.resolutionRate > 80) {
    insights.push("Excellent conversation resolution rate")
  } else if (metrics.resolutionRate < 50) {
    insights.push("Low resolution rate may indicate support issues")
  }

  if (workflowMetrics.successRate > 90) {
    insights.push("Automation workflows are performing excellently")
  } else if (workflowMetrics.successRate < 70) {
    insights.push("Automation workflows need attention - high failure rate detected")
  }

  // Generate recommendations
  const recommendations: string[] = []

  if (metrics.averageSentiment < 0) {
    recommendations.push("Consider reviewing negative conversations to identify improvement areas")
  }

  if (engagement.averageResponseTime > 30) {
    recommendations.push("Response times could be improved for better user experience")
  }

  if (metrics.automationTriggers < metrics.totalConversations * 0.1) {
    recommendations.push("Consider creating more automation workflows to handle common scenarios")
  }

  if (patterns.averageMessagesPerSession < 3) {
    recommendations.push("Short conversations may indicate users aren't finding what they need")
  }

  if (workflowMetrics.failureRate > 20) {
    recommendations.push("High workflow failure rate detected - review error logs and optimize workflows")
  }

  if (workflowMetrics.averageExecutionTime > 30000) {
    recommendations.push("Workflow execution times are high - consider optimizing for better performance")
  }

  return {
    summary,
    insights,
    recommendations
  }
}