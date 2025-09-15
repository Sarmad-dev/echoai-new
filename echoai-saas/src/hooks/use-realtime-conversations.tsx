"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/supabase";
import { ConversationWithMetadata } from "@/components/helpdesk/conversation-table";
import { ConversationStatus } from "@/types/database";
import { RealtimeChannel } from "@supabase/supabase-js";

interface UseRealtimeConversationsOptions {
  initialConversations?: ConversationWithMetadata[];
  onConversationUpdate?: (conversation: ConversationWithMetadata) => void;
  onNewConversation?: (conversation: ConversationWithMetadata) => void;
  onConversationStatusChange?: (conversationId: string, status: ConversationStatus) => void;
}

interface ConnectionStatus {
  connected: boolean;
  error?: string;
  lastConnected?: Date;
  reconnectAttempts: number;
}

export function useRealtimeConversations({
  initialConversations = [],
  onConversationUpdate,
  onNewConversation,
  onConversationStatusChange,
}: UseRealtimeConversationsOptions = {}) {
  const [conversations, setConversations] = useState<ConversationWithMetadata[]>(initialConversations);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    reconnectAttempts: 0,
  });
  const [highlightedRows, setHighlightedRows] = useState<Set<string>>(new Set());
  
  const supabase = createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 2000; // 2 seconds

  // Function to highlight a row temporarily
  const highlightRow = useCallback((conversationId: string) => {
    setHighlightedRows(prev => new Set(prev).add(conversationId));
    
    // Remove highlight after 3 seconds
    setTimeout(() => {
      setHighlightedRows(prev => {
        const newSet = new Set(prev);
        newSet.delete(conversationId);
        return newSet;
      });
    }, 3000);
  }, []);

  // Function to update or add conversation
  const updateConversation = useCallback((updatedConversation: ConversationWithMetadata) => {
    setConversations(prev => {
      const existingIndex = prev.findIndex(c => c.id === updatedConversation.id);
      
      if (existingIndex >= 0) {
        // Update existing conversation
        const newConversations = [...prev];
        newConversations[existingIndex] = updatedConversation;
        
        // Highlight the updated row
        highlightRow(updatedConversation.id);
        
        // Call callback if provided
        onConversationUpdate?.(updatedConversation);
        
        return newConversations;
      } else {
        // Add new conversation
        const newConversations = [updatedConversation, ...prev];
        
        // Highlight the new row
        highlightRow(updatedConversation.id);
        
        // Call callback if provided
        onNewConversation?.(updatedConversation);
        
        return newConversations;
      }
    });
  }, [highlightRow, onConversationUpdate, onNewConversation]);

  // Function to handle conversation status changes
  const handleStatusChange = useCallback((conversationId: string, newStatus: ConversationStatus) => {
    setConversations(prev => 
      prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, status: newStatus, updatedAt: new Date() }
          : conv
      )
    );
    
    // Highlight the updated row
    highlightRow(conversationId);
    
    // Call callback if provided
    onConversationStatusChange?.(conversationId, newStatus);
  }, [highlightRow, onConversationStatusChange]);

  // Function to setup realtime subscription
  const setupRealtimeSubscription = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }

    const channel = supabase
      .channel('help-desk-conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Conversation',
          filter: 'status=in.(AI_HANDLING,AWAITING_HUMAN_RESPONSE,RESOLVED)',
        },
        async (payload) => {
          console.log('📡 Realtime conversation update:', payload);
          
          try {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const conversationData = payload.new;
              
              // Fetch additional metadata for the conversation
              const { data: messages } = await supabase
                .from('Message')
                .select('content, createdAt')
                .eq('conversationId', conversationData.id)
                .order('createdAt', { ascending: false })
                .limit(1);

              const { data: messageCount } = await supabase
                .from('Message')
                .select('id', { count: 'exact' })
                .eq('conversationId', conversationData.id);

              // Calculate duration in minutes
              const createdAt = new Date(conversationData.createdAt);
              const updatedAt = new Date(conversationData.updatedAt);
              const duration = Math.max(1, Math.round((updatedAt.getTime() - createdAt.getTime()) / (1000 * 60)));

              const conversationWithMetadata: ConversationWithMetadata = {
                id: conversationData.id,
                customerEmail: conversationData.customerEmail,
                source: conversationData.source,
                status: conversationData.status,
                assignedTo: conversationData.assignedTo,
                sentimentScore: conversationData.sentimentScore,
                duration,
                lastMessage: messages?.[0]?.content || 'No messages',
                lastMessageTimestamp: messages?.[0]?.createdAt ? new Date(messages[0].createdAt) : new Date(),
                messageCount: messageCount?.length || 0,
                createdAt: new Date(conversationData.createdAt),
                updatedAt: new Date(conversationData.updatedAt),
              };

              updateConversation(conversationWithMetadata);
              
              // Handle status changes specifically
              if (payload.eventType === 'UPDATE' && payload.old?.status !== conversationData.status) {
                handleStatusChange(conversationData.id, conversationData.status);
              }
            }
          } catch (error) {
            console.error('❌ Error processing realtime update:', error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Message',
        },
        async (payload) => {
          console.log('📨 New message received:', payload);
          
          try {
            const messageData = payload.new;
            const conversationId = messageData.conversationId;
            
            // Update the conversation's last message and timestamp
            setConversations(prev => 
              prev.map(conv => {
                if (conv.id === conversationId) {
                  const updatedConv = {
                    ...conv,
                    lastMessage: messageData.content,
                    lastMessageTimestamp: new Date(messageData.createdAt),
                    messageCount: conv.messageCount + 1,
                    updatedAt: new Date(),
                  };
                  
                  // Highlight the updated conversation
                  highlightRow(conversationId);
                  
                  return updatedConv;
                }
                return conv;
              })
            );
          } catch (error) {
            console.error('❌ Error processing new message:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('🔌 Realtime subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          setConnectionStatus({
            connected: true,
            lastConnected: new Date(),
            reconnectAttempts: 0,
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus(prev => ({
            connected: false,
            error: `Connection ${status.toLowerCase()}`,
            lastConnected: prev.lastConnected,
            reconnectAttempts: prev.reconnectAttempts,
          }));
          
          // Attempt to reconnect with current attempt count
          const currentAttempts = connectionStatus.reconnectAttempts;
          if (currentAttempts < maxReconnectAttempts) {
            reconnectTimeoutRef.current = setTimeout(() => {
              setConnectionStatus(prev => ({
                ...prev,
                reconnectAttempts: prev.reconnectAttempts + 1,
              }));
              setupRealtimeSubscription();
            }, reconnectDelay * (currentAttempts + 1));
          }
        } else if (status === 'CLOSED') {
          setConnectionStatus(prev => ({
            connected: false,
            lastConnected: prev.lastConnected,
            reconnectAttempts: prev.reconnectAttempts,
          }));
        }
      });

    channelRef.current = channel;
  }, [supabase, updateConversation, handleStatusChange, highlightRow]);

  // Function to manually reconnect
  const reconnect = useCallback(() => {
    setConnectionStatus(prev => ({
      ...prev,
      reconnectAttempts: 0,
      error: undefined,
    }));
    setupRealtimeSubscription();
  }, [setupRealtimeSubscription]);

  // Setup subscription on mount
  useEffect(() => {
    setupRealtimeSubscription();

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []); // Empty dependency array - only run on mount

  // Update conversations when initial data changes
  useEffect(() => {
    if (initialConversations.length > 0) {
      setConversations(initialConversations);
    }
  }, [initialConversations]);

  return {
    conversations,
    connectionStatus,
    highlightedRows,
    reconnect,
    setConversations,
  };
}