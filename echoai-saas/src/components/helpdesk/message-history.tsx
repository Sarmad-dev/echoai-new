'use client'

import { useEffect, useRef } from 'react'
import { Message } from '@/types/database'
import { MessageDisplay } from './message-display'
import { TypingIndicator } from './typing-indicator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTypingIndicator } from '@/hooks/use-typing-indicator'

interface MessageHistoryProps {
  messages: Message[]
  loading?: boolean
  className?: string
  autoScroll?: boolean
  conversationId?: string
}

export function MessageHistory({ 
  messages, 
  loading = false, 
  className,
  autoScroll = true,
  conversationId
}: MessageHistoryProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Use typing indicator hook to show customer typing
  const { isCustomerTyping, isAgentTyping } = useTypingIndicator(
    conversationId || '',
    'agent'
  )

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      })
    }
  }, [messages.length, autoScroll])

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loading && messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'auto',
        block: 'end'
      })
    }
  }, [loading, messages.length])

  if (loading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading conversation...
        </div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">No messages yet</p>
          <p className="text-sm">This conversation hasn't started yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("h-full overflow-hidden", className)}>
      <ScrollArea className="h-full" ref={scrollAreaRef}>
        <div className="p-4 space-y-4">
          {messages.map((message, index) => (
            <MessageDisplay
              key={message.id}
              message={message}
              className={index === messages.length - 1 ? "animate-in fade-in-0 slide-in-from-bottom-2" : ""}
            />
          ))}
          
          {/* Typing indicators */}
          <TypingIndicator 
            isVisible={isCustomerTyping} 
            userType="customer" 
          />
          <TypingIndicator 
            isVisible={isAgentTyping} 
            userType="agent" 
          />
          
          {/* Invisible element to scroll to */}
          <div ref={messagesEndRef} className="h-1" />
        </div>
      </ScrollArea>
    </div>
  )
}