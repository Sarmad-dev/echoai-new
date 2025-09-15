'use client'

import { cn } from '@/lib/utils'

interface CustomerTypingIndicatorProps {
  isAgentTyping: boolean
  className?: string
}

export function CustomerTypingIndicator({ isAgentTyping, className }: CustomerTypingIndicatorProps) {
  if (!isAgentTyping) return null

  return (
    <div className={cn(
      "flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground animate-in fade-in-0 slide-in-from-bottom-2",
      className
    )}>
      <div className="flex items-center gap-1">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
        </div>
        <span className="ml-2">Agent is typing...</span>
      </div>
    </div>
  )
}