"use client";

import React, { useState, useCallback, useRef } from "react";
import type { ChatMessage } from "@/components/enhanced-chat-widget";
import type { StreamingChatData } from "@/types/api";

interface UseStreamingChatOptions {
  apiKey: string;
  chatbotId?: string;
  conversationId?: string;
  userEmail?: string;
  enableEnhancedFeatures?: boolean;
  onError?: (error: string) => void;
  onMessageComplete?: (message: ChatMessage) => void;
  onEnhancedResponse?: (enhancedData: any) => void;
}

interface StreamingState {
  isStreaming: boolean;
  currentStreamingMessage: string;
  streamingMessageId: string | null;
  error: string | null;
}

export function useStreamingChat({
  apiKey,
  chatbotId,
  conversationId,
  userEmail,
  enableEnhancedFeatures = false,
  onError,
  onMessageComplete,
  onEnhancedResponse,
}: UseStreamingChatOptions) {
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    currentStreamingMessage: "",
    streamingMessageId: null,
    error: null,
  });

  const [currentConversationId, setCurrentConversationId] = useState<string | null>(conversationId || null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sentimentRef = useRef<string>("neutral");

  // Update conversation ID state when prop changes
  React.useEffect(() => {
    if (conversationId !== currentConversationId) {
      setCurrentConversationId(conversationId as string);
      console.log("🔄 Streaming hook updated conversation ID:", {
        old: currentConversationId,
        new: conversationId,
      });
    }
  }, [conversationId, currentConversationId]);

  const sendStreamingMessage = useCallback(
    async (content: string, imageUrl?: string): Promise<ChatMessage | null> => {
      if (!content.trim() || streamingState.isStreaming) return null;

      // Cancel any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      const streamingMessageId = `streaming-${Date.now()}`;

      setStreamingState({
        isStreaming: true,
        currentStreamingMessage: "",
        streamingMessageId,
        error: null,
      });

      try {
        const requestBody: any = {
          message: content,
          apiKey,
        };

        if (chatbotId) {
          requestBody.chatbotId = chatbotId;
        }

        if (userEmail) {
          requestBody.userEmail = userEmail;
        }

        if (currentConversationId) {
          requestBody.conversationId = currentConversationId;
        }

        if (imageUrl) {
          requestBody.imageUrl = imageUrl;
        }

        const endpoint = enableEnhancedFeatures
          ? "/api/enhanced-chat/widget"
          : "/api/chat";

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `HTTP error! status: ${response.status}`
          );
        }

        if (!response.body) {
          throw new Error("No response body for streaming");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullMessage = "";

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data: StreamingChatData = JSON.parse(line.slice(6));

                  if (data.type === "token" && data.content) {
                    fullMessage += data.content;
                    
                    // Debug logging for streaming tokens
                    console.log("🌊 Streaming Token Debug:", {
                      token: data.content,
                      tokenLength: data.content.length,
                      hasSpaces: data.content.includes(" "),
                      fullMessageSoFar: fullMessage,
                      fullMessageLength: fullMessage.length,
                      fullMessageSpaces: (fullMessage.match(/ /g) || []).length,
                    });
                    
                    setStreamingState((prev) => ({
                      ...prev,
                      currentStreamingMessage: fullMessage,
                    }));
                  } else if (data.type === "metadata") {
                    if (data.metadata?.conversation_id && data.metadata.conversation_id !== currentConversationId) {
                      console.log("🆔 Setting new conversation ID from streaming metadata:", data.metadata.conversation_id);
                      setCurrentConversationId(data.metadata.conversation_id);
                    }
                    if (data.metadata?.sentiment) {
                      sentimentRef.current = data.metadata.sentiment;
                    }
                  } else if (data.type === "done" && data.metadata) {
                    // Handle legacy metadata in done event
                    if (data.metadata.conversation_id && data.metadata.conversation_id !== currentConversationId) {
                      console.log("🆔 Setting conversation ID from done metadata:", data.metadata.conversation_id);
                      setCurrentConversationId(data.metadata.conversation_id);
                    }
                    if (data.metadata.sentiment) {
                      sentimentRef.current = data.metadata.sentiment;
                    }
                  } else if (
                    data.type === "enhanced_data" &&
                    enableEnhancedFeatures
                  ) {
                    // Handle enhanced response data
                    if (onEnhancedResponse) {
                      onEnhancedResponse(data.data);
                    }
                  } else if (data.type === "done") {
                    // Streaming complete
                    break;
                  }
                } catch (parseError) {
                  console.error("Error parsing streaming data:", parseError);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        // Debug logging for final streaming message
        console.log("🏁 Final Streaming Message Debug:", {
          fullMessage: fullMessage,
          messageLength: fullMessage.length,
          hasSpaces: fullMessage.includes(" "),
          spacesCount: (fullMessage.match(/ /g) || []).length,
          rawMessageJSON: JSON.stringify(fullMessage),
          firstFewChars: fullMessage.substring(0, 100),
        });

        // Create final message
        const finalMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          content: fullMessage,
          role: "assistant",
          createdAt: new Date(),
          sentiment: sentimentRef.current as
            | "positive"
            | "negative"
            | "neutral",
        };

        // Reset streaming state
        setStreamingState({
          isStreaming: false,
          currentStreamingMessage: "",
          streamingMessageId: null,
          error: null,
        });

        // Notify completion
        onMessageComplete?.(finalMessage);

        return finalMessage;
      } catch (error) {
        console.error("Streaming error:", error);

        let errorMessage = "Failed to send message";
        if (error instanceof Error) {
          if (error.name === "AbortError") {
            errorMessage = "Message sending was cancelled";
          } else {
            errorMessage = error.message;
          }
        }

        setStreamingState({
          isStreaming: false,
          currentStreamingMessage: "",
          streamingMessageId: null,
          error: errorMessage,
        });

        onError?.(errorMessage);
        return null;
      }
    },
    [
      apiKey,
      chatbotId,
      currentConversationId,
      userEmail,
      streamingState.isStreaming,
      enableEnhancedFeatures,
      onError,
      onMessageComplete,
      onEnhancedResponse,
    ]
  );

  const cancelStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setStreamingState({
      isStreaming: false,
      currentStreamingMessage: "",
      streamingMessageId: null,
      error: null,
    });
  }, []);

  const clearError = useCallback(() => {
    setStreamingState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...streamingState,
    sendStreamingMessage,
    cancelStreaming,
    clearError,
    conversationId: currentConversationId,
  };
}
