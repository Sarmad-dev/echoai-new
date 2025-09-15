import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/supabase'
import type { 
  AnalyticsMetrics, 
  ConversationAnalytics, 
  WorkflowAnalytics
} from '@/types/database'

export interface RealtimeAnalyticsData {
  metrics: AnalyticsMetrics
  conversationAnalytics: ConversationAnalytics[]
  workflowAnalytics: WorkflowAnalytics[]
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
}

export interface UseRealtimeAnalyticsOptions {
  chatbotId?: string
  userId?: string
  dateRange?: {
    start: Date
    end: Date
  }
  conversationType?: string
  refreshInterval?: number // milliseconds
  onConnectionChange?: (status: 'connected' | 'disconnected' | 'reconnecting') => void
}

export function useRealtimeAnalytics(options: UseRealtimeAnalyticsOptions = {}) {
  const [data, setData] = useState<RealtimeAnalyticsData>({
    metrics: {
      totalConversations: 0,
      averageSentiment: 0,
      resolutionRate: 0,
      automationTriggers: 0,
      activeUsers: 0,
      topIntents: []
    },
    conversationAnalytics: [],
    workflowAnalytics: [],
    isLoading: true,
    error: null,
    lastUpdated: null
  })

  const supabase = createClient()

  // Calculate analytics metrics using the analytics service via API
  const calculateMetrics = useCallback(async (): Promise<AnalyticsMetrics> => {
    try {
      const { chatbotId, userId, dateRange, conversationType } = options
      
      // Build query parameters
      const params = new URLSearchParams()
      
      if (chatbotId) params.append('chatbotId', chatbotId)
      if (userId) params.append('userId', userId)
      if (conversationType) params.append('conversationType', conversationType)
      
      if (dateRange) {
        const days = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))
        if (days <= 7) params.append('timeRange', '7d')
        else if (days <= 30) params.append('timeRange', '30d')
        else params.append('timeRange', '90d')
      }

      // Call analytics API
      const response = await fetch(`/api/analytics?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`Analytics API error: ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch analytics')
      }

      // Notify connection success
      options.onConnectionChange?.('connected')

      return result.data
    } catch (error) {
      console.error('Error calculating metrics:', error)
      // Notify connection failure
      options.onConnectionChange?.('disconnected')
      throw error
    }
  }, [options])

  // Calculate conversation analytics
  const calculateConversationAnalytics = useCallback(async (): Promise<ConversationAnalytics[]> => {
    try {
      const { chatbotId, dateRange } = options

      let query = supabase
        .from('ConversationSession')
        .select(`
          *,
          Message(*)
        `)

      if (chatbotId) {
        query = query.eq('chatbotId', chatbotId)
      }

      if (dateRange) {
        query = query
          .gte('createdAt', dateRange.start.toISOString())
          .lte('createdAt', dateRange.end.toISOString())
      }

      const { data: sessions, error } = await query

      if (error) throw error

      return (sessions || []).map((session: any) => {
        const messages = session.Message || []
        const messageCount = messages.length
        
        // Calculate average sentiment for this conversation
        const messagesWithSentiment = messages.filter((m: { sentimentScore: number | null }) => m.sentimentScore !== null)
        const averageSentiment = messagesWithSentiment.length > 0
          ? messagesWithSentiment.reduce((sum: number, m: { sentimentScore: number | null }) => sum + (m.sentimentScore || 0), 0) / messagesWithSentiment.length
          : 0

        // Calculate duration in minutes
        const startTime = new Date(session.createdAt).getTime()
        const endTime = session.updatedAt ? new Date(session.updatedAt).getTime() : Date.now()
        const duration = Math.round((endTime - startTime) / (1000 * 60))

        return {
          conversationId: session.id,
          messageCount,
          averageSentiment,
          duration,
          resolved: !session.isActive,
          automationTriggered: false // This would need to be calculated based on workflow executions
        }
      })
    } catch (error) {
      console.error('Error calculating conversation analytics:', error)
      return []
    }
  }, [options, supabase])

  // Calculate workflow analytics
  const calculateWorkflowAnalytics = useCallback(async (): Promise<WorkflowAnalytics[]> => {
    try {
      const { chatbotId, userId, dateRange } = options

      let query = supabase
        .from('AutomationWorkflow')
        .select(`
          *,
          WorkflowExecution(*)
        `)

      if (chatbotId) {
        query = query.eq('chatbotId', chatbotId)
      }

      if (userId) {
        query = query.eq('userId', userId)
      }

      const { data: workflows, error } = await query

      if (error) throw error

      return (workflows || []).map((workflow: any) => {
        let executions = workflow.WorkflowExecution || []

        // Apply date range filter to executions
        if (dateRange) {
          executions = executions.filter((exec: { startedAt: string }) => {
            const execDate = new Date(exec.startedAt)
            return execDate >= dateRange.start && execDate <= dateRange.end
          })
        }

        const executionCount = executions.length
        const successfulExecutions = executions.filter((exec: { status: string }) => exec.status === 'COMPLETED')
        const successRate = executionCount > 0 ? (successfulExecutions.length / executionCount) * 100 : 0

        // Calculate average execution time for completed executions
        const completedExecutions = executions.filter((exec: { status: string; completedAt: string | null }) => 
          exec.status === 'COMPLETED' && exec.completedAt
        )
        
        const averageExecutionTime = completedExecutions.length > 0
          ? completedExecutions.reduce((sum: number, exec: { startedAt: string; completedAt: string }) => {
              const start = new Date(exec.startedAt).getTime()
              const end = new Date(exec.completedAt).getTime()
              return sum + (end - start)
            }, 0) / completedExecutions.length
          : 0

        const lastExecuted = executions.length > 0
          ? new Date(Math.max(...executions.map((exec: { startedAt: string }) => new Date(exec.startedAt).getTime())))
          : undefined

        return {
          workflowId: workflow.id,
          executionCount,
          successRate,
          averageExecutionTime,
          lastExecuted
        }
      })
    } catch (error) {
      console.error('Error calculating workflow analytics:', error)
      return []
    }
  }, [options, supabase])

  // Refresh all analytics data
  const refreshData = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, isLoading: true, error: null }))

      const [metrics, conversationAnalytics, workflowAnalytics] = await Promise.all([
        calculateMetrics(),
        calculateConversationAnalytics(),
        calculateWorkflowAnalytics()
      ])

      setData({
        metrics,
        conversationAnalytics,
        workflowAnalytics,
        isLoading: false,
        error: null,
        lastUpdated: new Date()
      })
    } catch (error) {
      console.error('Error refreshing analytics data:', error)
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load analytics data'
      }))
    }
  }, [calculateMetrics, calculateConversationAnalytics, calculateWorkflowAnalytics])

  // Set up real-time subscriptions
  useEffect(() => {
    // Initial data load
    refreshData()

    // Set up real-time subscriptions for table changes
    const messageChannel = supabase
      .channel('analytics-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Message'
        },
        (payload: any) => {
          console.log('Message change detected:', payload)
          options.onConnectionChange?.('connected')
          // Debounce refresh to avoid too many updates
          setTimeout(refreshData, 1000)
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          options.onConnectionChange?.('connected')
        } else if (status === 'CHANNEL_ERROR') {
          options.onConnectionChange?.('disconnected')
        }
      })

    const sessionChannel = supabase
      .channel('analytics-sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ConversationSession'
        },
        (payload: any) => {
          console.log('Session change detected:', payload)
          options.onConnectionChange?.('connected')
          setTimeout(refreshData, 1000)
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          options.onConnectionChange?.('connected')
        } else if (status === 'CHANNEL_ERROR') {
          options.onConnectionChange?.('disconnected')
        }
      })

    const workflowChannel = supabase
      .channel('analytics-workflows')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'WorkflowExecution'
        },
        (payload: any) => {
          console.log('Workflow execution change detected:', payload)
          options.onConnectionChange?.('connected')
          setTimeout(refreshData, 1000)
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          options.onConnectionChange?.('connected')
        } else if (status === 'CHANNEL_ERROR') {
          options.onConnectionChange?.('disconnected')
        }
      })

    // Set up periodic refresh if specified (fallback for connection issues)
    let intervalId: NodeJS.Timeout | undefined
    if (options.refreshInterval && options.refreshInterval > 0) {
      intervalId = setInterval(() => {
        options.onConnectionChange?.('reconnecting')
        refreshData()
      }, options.refreshInterval)
    }

    // Cleanup function
    return () => {
      messageChannel.unsubscribe()
      sessionChannel.unsubscribe()
      workflowChannel.unsubscribe()
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [refreshData, supabase, options.refreshInterval, options]) // Include specific options properties that are used

  return {
    ...data,
    refreshData
  }
}