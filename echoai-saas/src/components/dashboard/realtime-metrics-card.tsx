'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Activity,
  Clock
} from 'lucide-react'
import { useRealtimeAnalytics } from '@/hooks/useRealtimeAnalytics'
import { format } from 'date-fns'

interface RealtimeMetricsCardProps {
  chatbotId?: string
  userId?: string
  metric: 'conversations' | 'sentiment' | 'resolution' | 'automation' | 'users'
  className?: string
}

export function RealtimeMetricsCard({ 
  chatbotId, 
  userId, 
  metric, 
  className 
}: RealtimeMetricsCardProps) {
  const { metrics, isLoading, lastUpdated } = useRealtimeAnalytics({
    chatbotId,
    userId,
    refreshInterval: 10000 // Update every 10 seconds for real-time feel
  })

  const getMetricConfig = () => {
    switch (metric) {
      case 'conversations':
        return {
          title: 'Total Conversations',
          value: metrics.totalConversations,
          description: 'Active conversations',
          icon: Activity,
          format: (val: number) => val.toString(),
          trend: null // Could be calculated with historical data
        }
      case 'sentiment':
        return {
          title: 'Average Sentiment',
          value: metrics.averageSentiment,
          description: 'Customer satisfaction',
          icon: metrics.averageSentiment > 0.2 ? TrendingUp : 
                metrics.averageSentiment < -0.2 ? TrendingDown : Minus,
          format: (val: number) => val.toFixed(2),
          trend: metrics.averageSentiment > 0.2 ? 'positive' : 
                 metrics.averageSentiment < -0.2 ? 'negative' : 'neutral'
        }
      case 'resolution':
        return {
          title: 'Resolution Rate',
          value: metrics.resolutionRate,
          description: 'Resolved conversations',
          icon: metrics.resolutionRate > 80 ? TrendingUp : 
                metrics.resolutionRate < 50 ? TrendingDown : Minus,
          format: (val: number) => `${val.toFixed(1)}%`,
          trend: metrics.resolutionRate > 80 ? 'positive' : 
                 metrics.resolutionRate < 50 ? 'negative' : 'neutral'
        }
      case 'automation':
        return {
          title: 'Automation Triggers',
          value: metrics.automationTriggers,
          description: 'Workflows executed',
          icon: Activity,
          format: (val: number) => val.toString(),
          trend: null
        }
      case 'users':
        return {
          title: 'Active Users',
          value: metrics.activeUsers,
          description: 'Currently engaged',
          icon: Activity,
          format: (val: number) => val.toString(),
          trend: null
        }
      default:
        return {
          title: 'Unknown Metric',
          value: 0,
          description: '',
          icon: Activity,
          format: (val: number) => val.toString(),
          trend: null
        }
    }
  }

  const config = getMetricConfig()
  const IconComponent = config.icon

  const getTrendColor = (trend: string | null) => {
    switch (trend) {
      case 'positive':
        return 'text-green-600'
      case 'negative':
        return 'text-red-600'
      case 'neutral':
        return 'text-yellow-600'
      default:
        return 'text-muted-foreground'
    }
  }

  const getTrendBadgeVariant = (trend: string | null) => {
    switch (trend) {
      case 'positive':
        return 'default' as const
      case 'negative':
        return 'destructive' as const
      case 'neutral':
        return 'secondary' as const
      default:
        return 'outline' as const
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{config.title}</CardTitle>
        <div className="flex items-center gap-2">
          {config.trend && (
            <Badge variant={getTrendBadgeVariant(config.trend)} className="text-xs">
              {config.trend}
            </Badge>
          )}
          <IconComponent className={`h-4 w-4 ${getTrendColor(config.trend)}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-2xl font-bold">
            {isLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              config.format(config.value)
            )}
          </div>
          
          <CardDescription className="flex items-center justify-between">
            <span>{config.description}</span>
            {lastUpdated && (
              <div className="flex items-center gap-1 text-xs">
                <div className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse" />
                <Clock className="h-3 w-3" />
                {format(lastUpdated, 'HH:mm:ss')}
              </div>
            )}
          </CardDescription>

          {/* Real-time indicator */}
          <div className="flex items-center gap-2 pt-1">
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-muted-foreground">Live</span>
            </div>
            
            {/* Additional context based on metric */}
            {metric === 'sentiment' && (
              <div className="flex gap-1">
                {metrics.averageSentiment > 0.2 && (
                  <Badge variant="outline" className="text-xs">😊 Positive</Badge>
                )}
                {metrics.averageSentiment >= -0.2 && metrics.averageSentiment <= 0.2 && (
                  <Badge variant="outline" className="text-xs">😐 Neutral</Badge>
                )}
                {metrics.averageSentiment < -0.2 && (
                  <Badge variant="outline" className="text-xs">😞 Negative</Badge>
                )}
              </div>
            )}
            
            {metric === 'resolution' && (
              <div className="flex gap-1">
                {metrics.resolutionRate > 80 && (
                  <Badge variant="outline" className="text-xs">🎯 Excellent</Badge>
                )}
                {metrics.resolutionRate >= 50 && metrics.resolutionRate <= 80 && (
                  <Badge variant="outline" className="text-xs">👍 Good</Badge>
                )}
                {metrics.resolutionRate < 50 && (
                  <Badge variant="outline" className="text-xs">⚠️ Needs Attention</Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}