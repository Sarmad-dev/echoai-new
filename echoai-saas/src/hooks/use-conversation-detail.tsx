'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/supabase'
import { Conversation, Message, ConversationStatus } from '@/types/database'

interface UseConversationDetailReturn {
  conversation: Conversation | null
  messages: Message[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  updateConversationStatus: (status: ConversationStatus, assignedTo?: string | null) => Promise<void>
  sendMessage: (content: string) => Promise<void>
}

export function useConversationDetail(conversationId: string): UseConversationDetailReturn {
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchConversationData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch conversation details from API
      const conversationResponse = await fetch(`/api/helpdesk/conversation/${conversationId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!conversationResponse.ok) {
        const errorData = await conversationResponse.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${conversationResponse.status}: Failed to fetch conversation`)
      }

      const conversationData = await conversationResponse.json()

      // Fetch messages from API
      const messagesResponse = await fetch(`/api/helpdesk/conversation/${conversationId}/messages?limit=100&sortOrder=asc`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!messagesResponse.ok) {
        const errorData = await messagesResponse.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${messagesResponse.status}: Failed to fetch messages`)
      }

      const messagesData = await messagesResponse.json()
      const messages = messagesData.messages || []

      setConversation(conversationData)
      setMessages(messages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  const refetch = useCallback(async () => {
    await fetchConversationData()
  }, [conversationId])

  const updateConversationStatus = useCallback(async (status: ConversationStatus, assignedTo?: string | null) => {
    try {
      const response = await fetch(`/api/helpdesk/conversation/${conversationId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          assignedTo,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to update conversation status`)
      }

      const updatedConversation = await response.json()
      setConversation(updatedConversation)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update conversation status'
      setError(errorMessage)
      throw err
    }
  }, [conversationId])

  const sendMessage = useCallback(async (content: string) => {
    try {
      const response = await fetch('/api/helpdesk/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId,
          content,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to send message`)
      }

      // Message will be added via real-time subscription
      // But we can also refetch to ensure consistency
      await refetch()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message'
      setError(errorMessage)
      throw err
    }
  }, [conversationId, refetch])

  useEffect(() => {
    if (!conversationId) return

    fetchConversationData()

    // Set up real-time subscription for conversation updates
    const conversationChannel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Conversation',
          filter: `id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('🔄 Conversation updated via realtime:', payload.new)
          setConversation(payload.new as Conversation)
        }
      )
      .subscribe()

    // Set up real-time subscription for new messages
    const messagesChannel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Message',
          filter: `conversationId=eq.${conversationId}`,
        },
        (payload) => {
          console.log('📨 New message via realtime:', payload.new)
          setMessages(prev => [...prev, payload.new as Message])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Message',
          filter: `conversationId=eq.${conversationId}`,
        },
        (payload) => {
          console.log('📝 Message updated via realtime:', payload.new)
          setMessages(prev => 
            prev.map(msg => 
              msg.id === payload.new.id ? payload.new as Message : msg
            )
          )
        }
      )
      .subscribe()

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(conversationChannel)
      supabase.removeChannel(messagesChannel)
    }
  }, [conversationId])

  return {
    conversation,
    messages,
    loading,
    error,
    refetch,
    updateConversationStatus,
    sendMessage,
  }
}