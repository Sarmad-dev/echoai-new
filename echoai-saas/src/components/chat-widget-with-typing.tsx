'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Send } from 'lucide-react'
import { useCustomerTypingIndicator } from '@/hooks/use-customer-typing-indicator'
import { CustomerTypingIndicator } from '@/components/customer-typing-indicator'

interface ChatWidgetWithTypingProps {
  conversationId: string
  apiKey: string
  onSendMessage: (message: string) => Promise<void>
}

export function ChatWidgetWithTyping({ 
  conversationId, 
  apiKey, 
  onSendMessage 
}: ChatWidgetWithTypingProps) {
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Use customer typing indicator
  const { startTyping, stopTyping, isAgentTyping } = useCustomerTypingIndicator(
    conversationId,
    apiKey
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setMessage(newValue)

    // Handle typing indicators
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

  const handleSend = async () => {
    const trimmedMessage = message.trim()
    if (!trimmedMessage || isSending) return

    try {
      setIsSending(true)
      
      // Stop typing indicator before sending
      stopTyping()
      
      await onSendMessage(trimmedMessage)
      setMessage('')
      
      // Focus back to input
      if (inputRef.current) {
        inputRef.current.focus()
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Chat Support</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Messages would go here */}
        <div className="min-h-[200px] border rounded-lg p-4">
          {/* Message history component would go here */}
          
          {/* Show agent typing indicator */}
          <CustomerTypingIndicator isAgentTyping={isAgentTyping} />
        </div>
        
        {/* Message input */}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={isSending}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={isSending || !message.trim()}
            size="sm"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Example usage:
// <ChatWidgetWithTyping 
//   conversationId="your-conversation-id"
//   apiKey="your-api-key"
//   onSendMessage={async (message) => {
//     // Send message to your chat API
//     await fetch('/api/chat', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ message, conversationId, apiKey })
//     })
//   }}
// />