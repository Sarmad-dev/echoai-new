"use client"

import { useState, useCallback } from 'react'
import type { ChatMessage } from '@/components/enhanced-chat-widget'

interface UseChatOptions {
  apiKey: string
  chatbotId?: string
  onError?: (error: string) => void
}

interface ChatResponse {
  response: string
  sentiment: 'positive' | 'negative' | 'neutral'
  conversationId: string
}

export function useChat({ apiKey, chatbotId, onError }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: content.trim(),
      role: 'user',
      createdAt: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setError(null)

    try {
      const requestBody: {
        message: string;
        apiKey: string;
        conversationId?: string;
        chatbotId?: string;
      } = {
        message: userMessage.content,
        apiKey
      }
      
      // Only include conversationId if it exists
      if (conversationId) {
        requestBody.conversationId = conversationId
      }
      
      // Include chatbotId if provided
      if (chatbotId) {
        requestBody.chatbotId = chatbotId
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.log("Response: ", response)
        console.log("Error data: ", errorData)
        
        // Provide more specific error messages
        if (response.status === 400) {
          if (errorData.details && Array.isArray(errorData.details)) {
            const validationErrors = errorData.details.map((err: { message: string }) => err.message).join(', ')
            throw new Error(`Validation error: ${validationErrors}`)
          }
          throw new Error(errorData.error || 'Invalid request. Please check your input.')
        } else if (response.status === 401) {
          throw new Error('Invalid API key. Please check your authentication.')
        } else if (response.status === 429) {
          throw new Error('Too many requests. Please wait a moment and try again.')
        } else if (response.status === 503) {
          throw new Error('AI service is temporarily unavailable. Please try again later.')
        }
        
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`)
      }

      const data: ChatResponse = await response.json()
      
      if (!conversationId && data.conversationId) {
        setConversationId(data.conversationId)
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        role: 'assistant',
        createdAt: new Date(),
        sentiment: data.sentiment
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message'
      setError(errorMessage)
      onError?.(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [apiKey, chatbotId, conversationId, isLoading, onError])

  const clearMessages = useCallback(() => {
    setMessages([])
    setConversationId(null)
    setError(null)
  }, [])

  const addWelcomeMessage = useCallback((welcomeMessage: string) => {
    const message: ChatMessage = {
      id: 'welcome',
      content: welcomeMessage,
      role: 'assistant',
      createdAt: new Date()
    }
    setMessages([message])
  }, [])

  return {
    messages,
    isLoading,
    error,
    conversationId,
    sendMessage,
    clearMessages,
    addWelcomeMessage,
    setMessages
  }
}