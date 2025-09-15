'use client'

import { Message } from '@/types/database'
import { formatDistanceToNow } from 'date-fns'
import { User, Bot, Headphones } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MessageDisplayProps {
  message: Message
  className?: string
}

export function MessageDisplay({ message, className }: MessageDisplayProps) {
  const getMessageIcon = () => {
    switch (message.role) {
      case 'user':
        return <User className="h-4 w-4 text-blue-600" />
      case 'assistant':
        return <Bot className="h-4 w-4 text-green-600" />
      case 'agent':
        return <Headphones className="h-4 w-4 text-purple-600" />
      default:
        return <User className="h-4 w-4 text-gray-600" />
    }
  }

  const getMessageBgColor = () => {
    switch (message.role) {
      case 'user':
        return 'bg-muted'
      case 'assistant':
        return 'bg-primary/10'
      case 'agent':
        return 'bg-purple-50 border border-purple-200'
      default:
        return 'bg-muted'
    }
  }

  const getAvatarBgColor = () => {
    switch (message.role) {
      case 'user':
        return 'bg-blue-100'
      case 'assistant':
        return 'bg-green-100'
      case 'agent':
        return 'bg-purple-100'
      default:
        return 'bg-gray-100'
    }
  }

  const getRoleLabel = () => {
    switch (message.role) {
      case 'user':
        return 'Customer'
      case 'assistant':
        return 'AI Assistant'
      case 'agent':
        return 'Support Agent'
      default:
        return 'Unknown'
    }
  }

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", getAvatarBgColor())}>
        {getMessageIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-foreground">
            {getRoleLabel()}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
          </span>
          {message.sentiment && (
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full",
              message.sentiment === 'positive' && "bg-green-100 text-green-700",
              message.sentiment === 'negative' && "bg-red-100 text-red-700",
              message.sentiment === 'neutral' && "bg-gray-100 text-gray-700"
            )}>
              {message.sentiment}
            </span>
          )}
        </div>
        <div className={cn("rounded-lg p-3", getMessageBgColor())}>
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
          {message.imageUrl && (
            <div className="mt-2">
              <img 
                src={message.imageUrl} 
                alt="Message attachment" 
                className="max-w-xs rounded-lg border"
              />
            </div>
          )}
        </div>
        {message.sentimentScore !== undefined && message.sentimentScore !== null && (
          <div className="mt-1 text-xs text-muted-foreground">
            Sentiment Score: {message.sentimentScore.toFixed(2)}
          </div>
        )}
      </div>
    </div>
  )
}