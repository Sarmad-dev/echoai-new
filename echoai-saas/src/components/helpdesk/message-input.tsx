'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTypingIndicator } from '@/hooks/use-typing-indicator'

interface MessageInputProps {
  onSendMessage: (content: string) => Promise<void>
  disabled?: boolean
  placeholder?: string
  className?: string
  conversationId?: string
}

export function MessageInput({ 
  onSendMessage, 
  disabled = false, 
  placeholder = "Type your message here...",
  className,
  conversationId
}: MessageInputProps) {
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  // Use typing indicator hook
  const { startTyping, stopTyping } = useTypingIndicator(
    conversationId || '',
    'agent'
  )

  const handleSend = async () => {
    const trimmedMessage = message.trim()
    if (!trimmedMessage || isSending) return

    try {
      setIsSending(true)
      
      // Stop typing indicator before sending
      if (conversationId) {
        stopTyping()
      }
      
      await onSendMessage(trimmedMessage)
      setMessage('')
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setMessage(newValue)
    
    // Handle typing indicators
    if (conversationId) {
      if (newValue.length > 0 && message.length === 0) {
        // Started typing
        startTyping()
      } else if (newValue.length === 0 && message.length > 0) {
        // Stopped typing
        stopTyping()
      } else if (newValue.length > 0) {
        // Continue typing
        startTyping()
      }
    }
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }

  // Focus textarea when component mounts
  useEffect(() => {
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus()
    }
  }, [disabled])

  const isMessageValid = message.trim().length > 0 && message.trim().length <= 2000
  const characterCount = message.length
  const isNearLimit = characterCount > 1800

  return (
    <div className={cn("border-t bg-background", className)}>
      <div className="p-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isSending}
              className={cn(
                "min-h-[60px] max-h-[200px] resize-none",
                "focus:ring-2 focus:ring-primary focus:border-transparent",
                isNearLimit && "border-orange-300 focus:ring-orange-500"
              )}
              maxLength={2000}
            />
            <div className="flex justify-between items-center mt-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Press Ctrl+Enter to send</span>
              </div>
              <div className={cn(
                "text-xs",
                isNearLimit ? "text-orange-600" : "text-muted-foreground",
                characterCount >= 2000 && "text-red-600"
              )}>
                {characterCount}/2000
              </div>
            </div>
          </div>
          <Button
            onClick={handleSend}
            disabled={disabled || isSending || !isMessageValid}
            size="sm"
            className="self-end mb-8"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {/* Message status feedback */}
        {isSending && (
          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Sending message...
          </div>
        )}
      </div>
    </div>
  )
}