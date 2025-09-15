"use client";

import * as React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Send,
  Bot,
  AlertCircle,
  Upload,
  X,
  MessageCircle,
  HelpCircle,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useThemeDetection } from "@/hooks/use-theme-detection";
import { generateColorTheme, getContrastTextColor } from "@/lib/color-utils";
import { useDropzone } from "react-dropzone";
import { AccordionFAQ } from "@/components/accordion-faq";
import { ConversationHistory } from "@/components/conversation-history";
import { EnhancedMessageDisplay } from "@/components/enhanced-message-display";
import { useAutoScroll, useScrollPerformance } from "@/hooks/use-smooth-scroll";
import { useVirtualScroll } from "@/hooks/use-virtual-scroll";
import { useStreamingChat } from "@/hooks/use-streaming-chat";
import { createClient } from "@/lib/supabase/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";
import { ConversationStatus } from "@/types/database";

export interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant" | "agent";
  createdAt: Date;
  sentiment?: "positive" | "negative" | "neutral";
  imageUrl?: string;
  status?: "delivered" | "pending" | "failed";
}

export interface UserSettings {
  chatbotName: string;
  welcomeMessage: string;
  primaryColor: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

export interface ConversationHistoryItem {
  id: string;
  sessionId: string;
  preview: string;
  createdAt: Date;
  messageCount: number;
  chatbotName?: string;
}

export interface StreamingConfig {
  enabled: boolean;
  typingSpeed?: number;
  showTypingIndicator?: boolean;
  enableTokenAnimation?: boolean;
}

export interface ProactiveAction {
  action_type: string;
  priority: number;
  content: string;
  reasoning: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface ConversationIntelligence {
  conversation_id: string;
  user_id: string;
  chatbot_id?: string;
  context_understanding: number;
  proactive_score: number;
  helpfulness_score: number;
  conversation_flow_score: number;
  user_satisfaction_prediction: number;
  escalation_risk: number;
  lead_potential: number;
  topics_covered: string[];
  user_goals_identified: string[];
  knowledge_gaps_found: string[];
}

export interface EnhancedResponse {
  response: string;
  proactive_questions: string[];
  suggested_topics: string[];
  conversation_actions: ProactiveAction[];
  intelligence_metadata: ConversationIntelligence;
  context_used: boolean;
  sources_count: number;
  confidence_score: number;
  sentiment: string;
  sentiment_score?: number;
  conversation_id: string;
  session_id?: string;
  lead_analysis?: Record<string, any>;
}

export interface LeadCollectionConfig {
  enabled: boolean;
  collectEmail?: boolean;
  collectPhone?: boolean;
  collectCompany?: boolean;
  progressiveCollection?: boolean;
}

export interface EscalationConfig {
  enabled: boolean;
  showEscalationButton?: boolean;
  escalationThreshold?: number;
  humanAgentAvailable?: boolean;
}

export interface IntelligenceConfig {
  enabled: boolean;
  showProactiveQuestions?: boolean;
  showSuggestedTopics?: boolean;
  showConversationActions?: boolean;
  showIntelligenceMetrics?: boolean;
}

export interface EnhancedChatWidgetProps {
  apiKey: string;
  settings?: UserSettings;
  chatbotId?: string;
  userEmail?: string;
  className?: string;
  enableImageUpload?: boolean;
  enableFAQ?: boolean;
  enableHistory?: boolean;
  streamingConfig?: StreamingConfig;
  leadCollectionConfig?: LeadCollectionConfig;
  escalationConfig?: EscalationConfig;
  intelligenceConfig?: IntelligenceConfig;
  enableEnhancedFeatures?: boolean;
  onError?: (error: string) => void;
  onLeadCollected?: (leadData: Record<string, any>) => void;
  onEscalationRequested?: (escalationData: Record<string, any>) => void;
}

export function EnhancedChatWidget({
  apiKey,
  settings: providedSettings,
  chatbotId,
  userEmail,
  className,
  enableImageUpload = true,
  enableFAQ = true,
  enableHistory = true,
  streamingConfig = {
    enabled: true,
    typingSpeed: 25,
    showTypingIndicator: true,
    enableTokenAnimation: true,
  },
  leadCollectionConfig = {
    enabled: true,
    collectEmail: true,
    collectPhone: false,
    collectCompany: true,
    progressiveCollection: true,
  },
  escalationConfig = {
    enabled: true,
    showEscalationButton: true,
    escalationThreshold: 0.7,
    humanAgentAvailable: true,
  },
  intelligenceConfig = {
    enabled: true,
    showProactiveQuestions: true,
    showSuggestedTopics: true,
    showConversationActions: true,
    showIntelligenceMetrics: false,
  },
  enableEnhancedFeatures = true,
  onError,
  onLeadCollected,
  onEscalationRequested,
}: EnhancedChatWidgetProps) {
  const [inputValue, setInputValue] = useState("");
  const [isMinimized, setIsMinimized] = useState(true);
  const [settings, setSettings] = useState<UserSettings | null>(
    providedSettings || null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isConversationLoaded, setIsConversationLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [conversationHistory, setConversationHistory] = useState<
    ConversationHistoryItem[]
  >([]);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Enhanced features state
  const [proactiveQuestions, setProactiveQuestions] = useState<string[]>([]);
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [conversationActions, setConversationActions] = useState<
    ProactiveAction[]
  >([]);
  const [intelligenceMetadata, setIntelligenceMetadata] =
    useState<ConversationIntelligence | null>(null);
  const [showEscalationDialog, setShowEscalationDialog] = useState(false);
  const [leadCollectionData, setLeadCollectionData] = useState<
    Record<string, any>
  >({});
  const [showLeadCollection, setShowLeadCollection] = useState(false);
  const [escalationReason, setEscalationReason] = useState("");
  const [isEscalating, setIsEscalating] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [conversationStatus, setConversationStatus] =
    useState<ConversationStatus>(ConversationStatus.AI_HANDLING);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

  const { isDarkMode } = useThemeDetection();
  const supabase = createClient();

  // Enhanced features handlers
  const handleEnhancedResponse = useCallback(
    (enhancedData: EnhancedResponse) => {
      if (
        intelligenceConfig.showProactiveQuestions &&
        enhancedData.proactive_questions
      ) {
        setProactiveQuestions(enhancedData.proactive_questions);
      }

      if (
        intelligenceConfig.showSuggestedTopics &&
        enhancedData.suggested_topics
      ) {
        setSuggestedTopics(enhancedData.suggested_topics);
      }

      if (
        intelligenceConfig.showConversationActions &&
        enhancedData.conversation_actions
      ) {
        setConversationActions(enhancedData.conversation_actions);
      }

      if (
        intelligenceConfig.showIntelligenceMetrics &&
        enhancedData.intelligence_metadata
      ) {
        setIntelligenceMetadata(enhancedData.intelligence_metadata);
      }

      // Check for escalation risk
      if (
        escalationConfig.enabled &&
        enhancedData.intelligence_metadata?.escalation_risk >
          (escalationConfig.escalationThreshold || 0.7)
      ) {
        setShowEscalationDialog(true);
      }

      // Check for lead potential
      if (
        leadCollectionConfig.enabled &&
        enhancedData.intelligence_metadata?.lead_potential > 0.6 &&
        !showLeadCollection
      ) {
        setShowLeadCollection(true);
      }

      // Handle lead analysis
      if (enhancedData.lead_analysis && onLeadCollected) {
        onLeadCollected(enhancedData.lead_analysis);
      }
    },
    [
      intelligenceConfig,
      escalationConfig,
      leadCollectionConfig,
      showLeadCollection,
      onLeadCollected,
    ]
  );

  // Streaming chat functionality
  const {
    isStreaming,
    currentStreamingMessage,
    streamingMessageId,
    sendStreamingMessage,
    cancelStreaming,
    clearError: clearStreamingError,
    conversationId: streamingConversationId,
  } = useStreamingChat({
    apiKey,
    chatbotId,
    conversationId: conversationId || undefined,
    userEmail: userEmail || undefined,
    enableEnhancedFeatures,
    onError,
    onMessageComplete: (message) => {
      setMessages((prev) => [...prev, message]);
    },
    onEnhancedResponse: enableEnhancedFeatures
      ? handleEnhancedResponse
      : undefined,
  });

  // Conversation storage key
  const getConversationStorageKey = useCallback(() => {
    return `chat-conversation-${chatbotId}-${userEmail}`;
  }, [chatbotId, userEmail]);

  // Save conversation ID to localStorage
  const saveConversationToStorage = useCallback(
    (conversationId: string) => {
      if (!userEmail || !chatbotId || !conversationId) {
        console.log("❌ Cannot save conversation - missing data:", {
          userEmail,
          chatbotId,
          conversationId,
        });
        return;
      }

      try {
        const conversationData = {
          conversationId,
          createdAt: Date.now(),
          userEmail,
          chatbotId,
        };
        const storageKey = getConversationStorageKey();
        localStorage.setItem(storageKey, JSON.stringify(conversationData));
        console.log("✅ Saved conversation to localStorage:", {
          storageKey,
          conversationId,
        });
      } catch (error) {
        console.error("Failed to save conversation to storage:", error);
      }
    },
    [userEmail, chatbotId, getConversationStorageKey]
  );

  // Update conversation ID when streaming provides one
  React.useEffect(() => {
    if (streamingConversationId && streamingConversationId !== conversationId) {
      // Only update if we have a valid conversation ID and we're not in the middle of starting a new conversation
      // Check if this is a legitimate new conversation ID from a fresh message
      if (conversationId !== null || messages.length > 1) {
        console.log("🔄 Updating conversation ID from streaming:", {
          old: conversationId,
          new: streamingConversationId,
        });
        setConversationId(streamingConversationId);
        // Save the new conversation ID to localStorage
        saveConversationToStorage(streamingConversationId);
      } else {
        console.log(
          "🚫 Ignoring streaming conversation ID update during new conversation start:",
          {
            streamingConversationId,
            currentConversationId: conversationId,
            messageCount: messages.length,
          }
        );
      }
    }
  }, [
    streamingConversationId,
    conversationId,
    saveConversationToStorage,
    messages.length,
  ]);

  // Auto-scroll functionality
  useAutoScroll(
    [messages, isLoading, isStreaming, currentStreamingMessage], // Dependencies that trigger auto-scroll
    messagesContainerRef as React.RefObject<HTMLElement>,
    {
      enabled: !isMinimized && activeTab === "chat",
      delay: 100,
      threshold: 100,
      behavior: "smooth",
    }
  );

  // Scroll performance monitoring
  const scrollPerformance = useScrollPerformance(
    messagesContainerRef as React.RefObject<HTMLElement>
  );

  // Virtual scrolling for messages (when there are many messages)
  const shouldUseVirtualScrollForMessages = messages.length > 50;
  const estimatedMessageHeight = 120; // Approximate height per message

  const messagesVirtualScroll = useVirtualScroll(messages, {
    itemHeight: estimatedMessageHeight,
    containerHeight: 350, // Height of messages container
    overscan: 3,
    enabled: shouldUseVirtualScrollForMessages,
  });

  // Load chatbot settings if chatbotId is provided
  useEffect(() => {
    if (chatbotId && !providedSettings) {
      const loadChatbotSettings = async () => {
        try {
          const response = await fetch(`/api/chatbots/${chatbotId}`);
          if (response.ok) {
            const chatbot = await response.json();

            setSettings({
              chatbotName: chatbot.name,
              welcomeMessage: chatbot.welcomeMessage,
              primaryColor: chatbot.primaryColor,
            });
          }
        } catch (error) {
          console.error("Failed to load chatbot settings:", error);
          onError?.("Failed to load chatbot settings");
        }
      };
      loadChatbotSettings();
    }
  }, [chatbotId, providedSettings, onError]);

  // Function definitions
  const addWelcomeMessage = useCallback((welcomeMessage: string) => {
    const welcomeMsg: ChatMessage = {
      id: `welcome-${Date.now()}`,
      content: welcomeMessage,
      role: "assistant",
      createdAt: new Date(),
    };
    setMessages([welcomeMsg]);
  }, []);

  // Load conversation ID from localStorage
  const loadStoredConversationId = useCallback(() => {
    if (!userEmail || !chatbotId) return null;

    try {
      const stored = localStorage.getItem(getConversationStorageKey());
      if (stored) {
        const conversationData = JSON.parse(stored);
        // Check if conversation is not too old (7 days)
        const conversationAge = Date.now() - conversationData.createdAt;
        if (conversationAge < 7 * 24 * 60 * 60 * 1000) {
          return conversationData.conversationId;
        } else {
          // Remove expired conversation
          localStorage.removeItem(getConversationStorageKey());
        }
      }
    } catch (error) {
      console.error("Failed to load stored conversation:", error);
      localStorage.removeItem(getConversationStorageKey());
    }
    return null;
  }, [userEmail, chatbotId, getConversationStorageKey]);

  // Load messages from database using conversation ID
  const loadConversationMessages = useCallback(
    async (conversationId: string) => {
      try {
        const response = await fetch(
          `/api/chat/messages?conversationId=${conversationId}&chatbotId=${chatbotId}&userEmail=${userEmail}`
        );

        if (response.ok) {
          const data = await response.json();
          return data.messages || [];
        } else if (response.status === 404) {
          // Conversation not found
          console.log("Conversation not found");
          return null;
        } else {
          console.error(
            "Failed to load conversation messages:",
            response.status
          );
          return null;
        }
      } catch (error) {
        console.error("Failed to load conversation messages:", error);
        return null;
      }
    },
    [userEmail, chatbotId]
  );

  // Load conversation status from database
  const loadConversationStatus = useCallback(async (conversationId: string) => {
    try {
      const response = await fetch(
        `/api/chat/conversation-status?conversationId=${conversationId}`
      );

      if (response.ok) {
        const data = await response.json();
        return data.status || ConversationStatus.AI_HANDLING;
      } else {
        console.error("Failed to load conversation status:", response.status);
        return ConversationStatus.AI_HANDLING;
      }
    } catch (error) {
      console.error("Failed to load conversation status:", error);
      return ConversationStatus.AI_HANDLING;
    }
  }, []);

  // Update conversation status
  const updateConversationStatus = useCallback(
    async (newStatus: ConversationStatus) => {
      if (!conversationId) return;

      try {
        const response = await fetch("/api/chat/conversation-status", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversationId: conversationId,
            status: newStatus,
          }),
        });

        if (response.ok) {
          setConversationStatus(newStatus);
        } else {
          console.error(
            "Failed to update conversation status:",
            response.status
          );
        }
      } catch (error) {
        console.error("Failed to update conversation status:", error);
      }
    },
    [conversationId]
  );

  const initializeConversation = useCallback(async () => {
    if (!userEmail || !chatbotId || isConversationLoaded) return;

    try {
      // First, try to load conversation ID from localStorage
      const storedConversationId = loadStoredConversationId();

      if (storedConversationId) {
        // Try to load messages for this conversation from database
        const messages = await loadConversationMessages(storedConversationId);

        if (messages !== null) {
          // Successfully loaded existing conversation from database
          setConversationId(storedConversationId);
          setMessages(messages);

          // Load conversation status
          const status = await loadConversationStatus(storedConversationId);
          setConversationStatus(status);

          setIsConversationLoaded(true);
          console.log(
            "Resumed existing conversation:",
            storedConversationId,
            "with",
            messages.length,
            "messages from database, status:",
            status
          );
          return;
        } else {
          // Conversation not found in database, clear from storage
          localStorage.removeItem(getConversationStorageKey());
        }
      }

      // Add welcome message if available
      if (settings?.welcomeMessage) {
        addWelcomeMessage(settings.welcomeMessage);
      }

      console.log("Starting new conversation");
    } catch (error) {
      console.error("Failed to initialize conversation:", error);
      onError?.("Failed to initialize conversation");
    }
  }, [
    userEmail,
    chatbotId,
    isConversationLoaded,
    loadStoredConversationId,
    loadConversationMessages,
    getConversationStorageKey,
    settings?.welcomeMessage,
    onError,
    addWelcomeMessage,
    saveConversationToStorage,
  ]);

  const loadFAQs = useCallback(async () => {
    if (!chatbotId) return;

    try {
      const response = await fetch(`/api/faq?chatbotId=${chatbotId}`);
      if (response.ok) {
        const data = await response.json();
        setFaqs(data);
      }
    } catch (error) {
      console.error("Failed to load FAQs:", error);
    }
  }, [chatbotId]);

  const loadConversationHistory = useCallback(
    async (search?: string) => {
      if (!userEmail) return;

      setIsLoadingHistory(true);
      try {
        const params = new URLSearchParams({
          userEmail: userEmail,
        });

        if (search && search.trim()) {
          params.append("search", search.trim());
        }

        const response = await fetch(`/api/chat/history?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          console.log("Conversation History: ", data);
          setConversationHistory(data);
        }
      } catch (error) {
        console.error("Failed to load conversation history:", error);
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [userEmail]
  );

  // Initialize conversation when widget opens
  useEffect(() => {
    if (!isMinimized && !isConversationLoaded && userEmail && chatbotId) {
      initializeConversation();
    }
  }, [
    isMinimized,
    isConversationLoaded,
    userEmail,
    chatbotId,
    initializeConversation,
  ]);

  // Save conversation ID to localStorage whenever it changes
  useEffect(() => {
    if (conversationId) {
      saveConversationToStorage(conversationId);
    }
  }, [conversationId, saveConversationToStorage]);

  // Setup realtime subscription when conversation ID is available
  useEffect(() => {
    if (conversationId && !isMinimized) {
      setupRealtimeSubscription();
    } else {
      cleanupRealtimeSubscription();
    }

    return () => {
      cleanupRealtimeSubscription();
    };
  }, [conversationId, isMinimized]);

  // Periodic connection health check
  useEffect(() => {
    if (!conversationId || isMinimized) return;

    const healthCheckInterval = setInterval(() => {
      // Check if connection is stale (no activity for 30 seconds)
      if (!realtimeConnected && conversationId) {
        console.log(
          "🏥 Health check: Connection appears down, attempting recovery..."
        );
        handleConnectionRecovery();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(healthCheckInterval);
  }, [conversationId, isMinimized, realtimeConnected]);

  // Load FAQs when widget opens
  useEffect(() => {
    if (!isMinimized && enableFAQ && chatbotId && faqs.length === 0) {
      loadFAQs();
    }
  }, [isMinimized, enableFAQ, chatbotId, faqs.length, loadFAQs]);

  // Load conversation history when widget opens
  useEffect(() => {
    if (
      !isMinimized &&
      enableHistory &&
      userEmail &&
      conversationHistory.length === 0
    ) {
      loadConversationHistory();
    }
  }, [
    isMinimized,
    enableHistory,
    userEmail,
    conversationHistory.length,
    loadConversationHistory,
  ]);

  // Handle history search with debouncing
  useEffect(() => {
    if (!enableHistory || !userEmail) return;

    const timeoutId = setTimeout(() => {
      if (activeTab === "history") {
        loadConversationHistory(historySearch);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [
    historySearch,
    activeTab,
    enableHistory,
    userEmail,
    loadConversationHistory,
  ]);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    if (messagesEndRef.current && messagesEndRef.current.scrollIntoView) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Focus input when widget opens
  useEffect(() => {
    if (!isMinimized && activeTab === "chat") {
      setTimeout(() => {
        inputRef.current?.focus();
        scrollToBottom();
      }, 100);
    }
  }, [isMinimized, activeTab]);

  // Image upload handling
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedImage(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".webp"],
    },
    maxFiles: 1,
    disabled: isLoading || isStreaming,
  });

  const removeImage = () => {
    setUploadedImage(null);
    setImagePreview(null);
  };

  // Clear current conversation and start new one
  const startNewConversation = useCallback(async () => {
    if (userEmail && chatbotId) {
      console.log("🔄 Starting new conversation...");

      // Clear localStorage
      localStorage.removeItem(getConversationStorageKey());
      console.log("🗑️ Cleared localStorage for conversation");

      // Cancel any ongoing streaming to prevent state conflicts
      if (isStreaming) {
        cancelStreaming();
        console.log("🛑 Cancelled ongoing streaming");
      }

      // Reset all conversation-related state
      setConversationId(null);
      setMessages([]);
      setProactiveQuestions([]);
      setSuggestedTopics([]);
      setConversationActions([]);
      setIntelligenceMetadata(null);
      setConversationStatus(ConversationStatus.AI_HANDLING);

      // Clear any streaming errors
      clearStreamingError();

      // Add welcome message immediately for new conversation
      if (settings?.welcomeMessage) {
        const welcomeMsg: ChatMessage = {
          id: `welcome-${Date.now()}`,
          content: settings.welcomeMessage,
          role: "assistant",
          createdAt: new Date(),
        };
        setMessages([welcomeMsg]);
      }

      // Mark conversation as loaded
      setIsConversationLoaded(true);
      console.log("✅ New conversation initialized");
    }
  }, [
    userEmail,
    chatbotId,
    getConversationStorageKey,
    settings?.welcomeMessage,
    isStreaming,
    cancelStreaming,
    clearStreamingError,
    saveConversationToStorage,
  ]);

  // Setup realtime subscription for agent messages
  const setupRealtimeSubscription = useCallback(() => {
    if (!conversationId) return;

    // Clean up existing subscription
    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.unsubscribe();
    }

    const channel = supabase
      .channel(`widget-messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Message",
          filter: `conversationId=eq.${conversationId}`,
        },
        (payload) => {
          console.log("📨 Widget received new message:", payload);

          try {
            const messageData = payload.new;

            // Detect message type and handle appropriately
            const messageType = detectMessageType(messageData);

            if (messageType === "agent") {
              const agentMessage: ChatMessage = {
                id: messageData.id,
                content: messageData.content,
                role: "agent",
                createdAt: new Date(messageData.createdAt),
                sentiment: messageData.sentiment,
                status: "delivered", // Mark as delivered when received via realtime
                imageUrl: messageData.imageUrl,
              };

              setMessages((prev) => {
                // Check if message already exists to avoid duplicates
                const exists = prev.some((msg) => msg.id === messageData.id);
                if (exists) {
                  console.log(
                    "⚠️ Agent message already exists, skipping:",
                    messageData.id
                  );
                  return prev;
                }

                console.log("✅ Added agent message to widget:", agentMessage);
                return [...prev, agentMessage];
              });

              // Send delivery confirmation back to help desk
              sendMessageDeliveryConfirmation(messageData.id);
            } else if (messageType === "assistant" && !isStreaming) {
              // Handle AI assistant messages that might come through realtime
              // Only add if not currently streaming (to avoid conflicts with streaming chat)
              const assistantMessage: ChatMessage = {
                id: messageData.id,
                content: messageData.content,
                role: "assistant",
                createdAt: new Date(messageData.createdAt),
                sentiment: messageData.sentiment,
                status: "delivered",
                imageUrl: messageData.imageUrl,
              };

              setMessages((prev) => {
                const exists = prev.some((msg) => msg.id === messageData.id);
                if (exists) {
                  console.log(
                    "⚠️ Assistant message already exists, skipping:",
                    messageData.id
                  );
                  return prev;
                }

                console.log(
                  "✅ Added assistant message to widget via realtime:",
                  assistantMessage
                );
                return [...prev, assistantMessage];
              });
            } else if (messageType === "user") {
              // User messages are typically handled by the local chat flow
              // But we might want to sync them for consistency
              console.log(
                "📝 User message received via realtime (already handled locally)"
              );
            }
          } catch (error) {
            console.error("❌ Error processing message in widget:", error);
            setRealtimeError("Failed to receive message");

            // Attempt to recover by re-establishing connection
            setTimeout(() => {
              if (realtimeError) {
                setupRealtimeSubscription();
              }
            }, 3000);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "Conversation",
          filter: `id=eq.${conversationId}`,
        },
        (payload) => {
          console.log("🔄 Conversation status updated:", payload);

          try {
            const conversationData = payload.new;

            // Handle conversation status changes that might affect the widget
            if (conversationData.status === "AWAITING_HUMAN_RESPONSE") {
              console.log("👤 Conversation taken over by human agent");
              setConversationStatus(ConversationStatus.AWAITING_HUMAN_RESPONSE);
            } else if (conversationData.status === "AI_HANDLING") {
              console.log("🤖 Conversation returned to AI");
              setConversationStatus(ConversationStatus.AI_HANDLING);
            } else if (conversationData.status === "RESOLVED") {
              console.log("✅ Conversation resolved");
              setConversationStatus(ConversationStatus.RESOLVED);
            }
          } catch (error) {
            console.error("❌ Error processing conversation update:", error);
          }
        }
      )
      .subscribe((status) => {
        console.log("🔌 Widget realtime subscription status:", status);

        if (status === "SUBSCRIBED") {
          setRealtimeConnected(true);
          setRealtimeError(null);
          console.log("✅ Widget connected to realtime updates");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeConnected(false);
          setRealtimeError(
            `Connection ${status.toLowerCase().replace("_", " ")}`
          );
          console.error("❌ Widget realtime connection failed:", status);

          // Attempt to reconnect after a delay
          setTimeout(() => {
            console.log("🔄 Attempting to reconnect widget realtime...");
            setupRealtimeSubscription();
          }, 5000);
        } else if (status === "CLOSED") {
          setRealtimeConnected(false);
          console.log("🔌 Widget realtime connection closed");
        }
      });

    realtimeChannelRef.current = channel;
  }, [conversationId, supabase, realtimeError]);

  // Detect message type for appropriate rendering
  const detectMessageType = useCallback(
    (messageData: any): "user" | "assistant" | "agent" => {
      // Validate role field
      if (
        messageData.role &&
        ["user", "assistant", "agent"].includes(messageData.role)
      ) {
        return messageData.role;
      }

      // Fallback detection based on content patterns or metadata
      if (
        messageData.metadata?.isAgentMessage ||
        messageData.metadata?.agentId
      ) {
        return "agent";
      }

      if (
        messageData.metadata?.isAIResponse ||
        messageData.sentimentScore !== undefined
      ) {
        return "assistant";
      }

      // Default to user if unclear
      return "user";
    },
    []
  );

  // Send message delivery confirmation with retry logic
  const sendMessageDeliveryConfirmation = useCallback(
    async (messageId: string, retryCount = 0) => {
      const maxRetries = 3;

      try {
        const response = await fetch(
          "/api/helpdesk/message/delivery-confirmation",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messageId,
              conversationId,
              deliveredAt: new Date().toISOString(),
              clientInfo: {
                userAgent: navigator.userAgent,
                createdAt: Date.now(),
                widgetVersion: "1.0.0",
                connectionType: realtimeConnected ? "realtime" : "polling",
              },
            }),
          }
        );

        if (response.ok) {
          console.log("✅ Message delivery confirmed:", messageId);

          // Update message status in local state
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId
                ? { ...msg, status: "delivered" as const }
                : msg
            )
          );
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        console.error("❌ Error confirming message delivery:", error);

        // Retry logic
        if (retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
          console.log(
            `🔄 Retrying delivery confirmation in ${delay}ms (attempt ${
              retryCount + 1
            }/${maxRetries})`
          );

          setTimeout(() => {
            sendMessageDeliveryConfirmation(messageId, retryCount + 1);
          }, delay);
        } else {
          console.error(
            "❌ Failed to confirm message delivery after all retries:",
            messageId
          );

          // Mark message as failed in local state
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId ? { ...msg, status: "failed" as const } : msg
            )
          );
        }
      }
    },
    [conversationId, realtimeConnected]
  );

  // Handle failed message delivery
  const handleFailedMessageDelivery = useCallback(
    (messageId: string) => {
      console.warn(
        "⚠️ Message delivery failed, attempting recovery:",
        messageId
      );

      // Try to re-establish connection
      if (!realtimeConnected) {
        handleConnectionRecovery();
      }

      // Show user-friendly error
      setError(
        "Some messages may not have been delivered. Connection restored."
      );

      // Clear error after a few seconds
      setTimeout(() => {
        setError(null);
      }, 5000);
    },
    [realtimeConnected]
  );

  // Handle connection recovery
  const handleConnectionRecovery = useCallback(() => {
    if (!realtimeConnected && conversationId && !isMinimized) {
      console.log("🔄 Attempting to recover realtime connection...");
      setRealtimeError(null);
      setupRealtimeSubscription();
    }
  }, [
    realtimeConnected,
    conversationId,
    isMinimized,
    setupRealtimeSubscription,
  ]);

  // Cleanup realtime subscription
  const cleanupRealtimeSubscription = useCallback(() => {
    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.unsubscribe();
      realtimeChannelRef.current = null;
    }
    setRealtimeConnected(false);
    setRealtimeError(null);
  }, []);

  const sendMessage = async (messageContent?: string) => {
    const content = messageContent || inputValue.trim();
    if (!content && !uploadedImage) return;
    if (isLoading || isStreaming) return;
    if (conversationStatus === ConversationStatus.AWAITING_HUMAN_RESPONSE)
      return;

    setError(null);
    clearStreamingError();

    try {
      let imageUrl = null;

      // Upload image if present
      if (uploadedImage) {
        setIsLoading(true);
        const formData = new FormData();
        formData.append("image", uploadedImage);

        const uploadResponse = await fetch("/api/upload/image", {
          method: "POST",
          body: formData,
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          imageUrl = uploadData.url;
        }
        setIsLoading(false);
      }

      // Add user message to UI
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        content: content,
        role: "user",
        createdAt: new Date(),
        imageUrl,
      };
      setMessages((prev) => [...prev, userMessage]);

      // Clear input immediately for better UX
      setInputValue("");
      removeImage();

      if (streamingConfig.enabled) {
        // Use streaming response
        await sendStreamingMessage(content, imageUrl);
      } else {
        // Use enhanced or regular response based on configuration
        setIsLoading(true);

        const endpoint = enableEnhancedFeatures
          ? "/api/enhanced-chat/widget"
          : "/api/chat";

        const requestBody: any = {
          message: content,
          apiKey,
          chatbotId,
          conversationId: conversationId, // Use proper conversation ID
          userEmail,
        };

        // Only include imageUrl if it's not null
        if (imageUrl) {
          requestBody.imageUrl = imageUrl;
        }

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (response.ok) {
          const data = await response.json();

          // Debug logging for AI response
          console.log("🚀 AI Response Debug:", {
            fullResponse: data,
            responseContent: data.response,
            responseLength: data.response?.length,
            hasSpaces: data.response?.includes(" "),
            spacesCount: (data.response?.match(/ /g) || []).length,
            rawResponseJSON: JSON.stringify(data.response),
            firstFewChars: data.response?.substring(0, 100),
          });

          // Handle enhanced response
          if (enableEnhancedFeatures && data.proactive_questions) {
            handleEnhancedResponse(data as EnhancedResponse);
          }

          // Add assistant response
          const assistantMessage: ChatMessage = {
            id: `assistant-${Date.now()}`,
            content: data.response,
            role: "assistant",
            createdAt: new Date(),
            sentiment: data.sentiment,
          };
          setMessages((prev) => [...prev, assistantMessage]);

          // Update conversation ID if provided (for first message or session creation)
          if (data.conversation_id && data.conversation_id !== conversationId) {
            console.log("🔄 Updating conversation ID from API response:", {
              old: conversationId,
              new: data.conversation_id,
            });
            setConversationId(data.conversation_id);
            // Save the new conversation ID to localStorage
            saveConversationToStorage(data.conversation_id);
          } else if (data.session_id && data.session_id !== conversationId) {
            console.log("🔄 Updating conversation ID from session ID:", {
              old: conversationId,
              new: data.session_id,
            });
            setConversationId(data.session_id);
            // Save the new conversation ID to localStorage
            saveConversationToStorage(data.session_id);
          }
        } else {
          throw new Error("Failed to send message");
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setError("Failed to send message. Please try again.");
      onError?.("Failed to send message");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFAQClick = (faq: FAQ) => {
    setActiveTab("chat");

    // Add user question to messages
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      content: faq.question,
      role: "user",
      createdAt: new Date(),
    };

    // Add FAQ answer as assistant response
    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      content: faq.answer,
      role: "assistant",
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
  };

  const handleProactiveQuestionClick = useCallback((question: string) => {
    sendMessage(question);
    setProactiveQuestions([]);
  }, []);

  const handleSuggestedTopicClick = useCallback((topic: string) => {
    const topicMessage = `Tell me more about ${topic}`;
    sendMessage(topicMessage);
    setSuggestedTopics([]);
  }, []);

  const handleConversationActionClick = useCallback(
    (action: ProactiveAction) => {
      if (action.action_type === "escalate") {
        setShowEscalationDialog(true);
      } else if (action.action_type === "ask_followup") {
        sendMessage(action.content);
      } else if (action.action_type === "suggest_topic") {
        handleSuggestedTopicClick(action.content);
      }

      // Remove the action after clicking
      setConversationActions((prev) => prev.filter((a) => a !== action));
    },
    [handleSuggestedTopicClick]
  );

  const handleEscalation = useCallback(
    async (reason: string) => {
      setIsEscalating(true);
      try {
        const response = await fetch("/api/escalation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            chatbot_id: chatbotId,
            escalation_type: "user_request",
            reason: reason,
            user_email: userEmail,
          }),
        });

        if (response.ok) {
          const escalationData = await response.json();

          // Update conversation status
          setConversationStatus(ConversationStatus.AWAITING_HUMAN_RESPONSE);

          // Add system message about escalation
          const escalationMessage: ChatMessage = {
            id: `escalation-${Date.now()}`,
            content: escalationConfig.humanAgentAvailable
              ? "I've connected you with a human agent. They'll be with you shortly."
              : "I've recorded your request for human assistance. Someone will contact you soon.",
            role: "assistant",
            createdAt: new Date(),
          };
          setMessages((prev) => [...prev, escalationMessage]);

          if (onEscalationRequested) {
            onEscalationRequested(escalationData);
          }
        }
      } catch (error) {
        console.error("Escalation failed:", error);
        onError?.("Failed to escalate conversation");
      } finally {
        setIsEscalating(false);
        setShowEscalationDialog(false);
        setEscalationReason("");
      }
    },
    [
      conversationId,
      chatbotId,
      userEmail,
      escalationConfig,
      onEscalationRequested,
      onError,
    ]
  );

  const handleEscalationButtonClick = useCallback(async () => {
    if (!conversationId) return;

    if (
      conversationStatus === ConversationStatus.AWAITING_HUMAN_RESPONSE ||
      conversationStatus === ConversationStatus.AI_HANDLING
    ) {
      // Return to AI handling
      setIsEscalating(true);
      try {
        const response = await fetch("/api/chat/conversation-status", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversationId: conversationId,
            status:
              conversationStatus === ConversationStatus.AI_HANDLING
                ? ConversationStatus.AWAITING_HUMAN_RESPONSE
                : ConversationStatus.AI_HANDLING,
          }),
        });

        if (response.ok) {
          setConversationStatus(ConversationStatus.AI_HANDLING);

          // Add system message about returning to AI
          const returnMessage: ChatMessage = {
            id: `return-ai-${Date.now()}`,
            content:
              conversationStatus === ConversationStatus.AWAITING_HUMAN_RESPONSE
                ? "You're now back to chatting with the AI assistant. How can I help you?"
                : "You chat has been assigned to human. He will contact you shortly",
            role: "assistant",
            createdAt: new Date(),
          };
          setMessages((prev) => [...prev, returnMessage]);
        }
      } catch (error) {
        console.error("Failed to return to AI:", error);
        onError?.("Failed to return to AI assistance");
      } finally {
        setIsEscalating(false);
      }
    } else if (conversationStatus === ConversationStatus.RESOLVED) {
      // Start new conversation
      startNewConversation();
    }
  }, [conversationId, conversationStatus, onError, startNewConversation]);

  const handleLeadDataSubmit = useCallback(
    async (leadData: Record<string, any>) => {
      try {
        const response = await fetch("/api/lead", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            chatbot_id: chatbotId,
            contact_info: leadData,
            collection_strategy: "conversational",
          }),
        });

        if (response.ok) {
          const result = await response.json();
          setLeadCollectionData(leadData);
          setShowLeadCollection(false);

          if (onLeadCollected) {
            onLeadCollected(result);
          }

          // Add confirmation message
          const confirmationMessage: ChatMessage = {
            id: `lead-confirmation-${Date.now()}`,
            content:
              "Thank you for providing your information! I'll make sure someone follows up with you soon.",
            role: "assistant",
            createdAt: new Date(),
          };
          setMessages((prev) => [...prev, confirmationMessage]);
        }
      } catch (error) {
        console.error("Lead collection failed:", error);
        onError?.("Failed to save your information");
      }
    },
    [conversationId, chatbotId, onLeadCollected, onError]
  );

  const loadConversation = async (historyItem: ConversationHistoryItem) => {
    try {
      // Load messages for this conversation
      const messages = await loadConversationMessages(historyItem.id);

      if (messages !== null) {
        setConversationId(historyItem.id);
        setMessages(messages);
        setActiveTab("chat");
        console.log(
          "Loaded conversation:",
          historyItem.id,
          "with",
          messages.length,
          "messages"
        );
      } else {
        onError?.("This conversation is no longer available");
      }
    } catch (error) {
      console.error("Error loading conversation:", error);
      onError?.("Failed to load conversation");
    }
  };

  // Don't render if settings are not loaded yet
  if (!settings) {
    return null;
  }

  // Ensure we have a valid primary color, fallback to blue if not
  const primaryColor = settings.primaryColor || "#3b82f6";

  // Apply custom primary color theme
  const customStyles = generateColorTheme(primaryColor) as React.CSSProperties;
  const textColor = getContrastTextColor(primaryColor);

  if (isMinimized) {
    return (
      <div
        className={cn("fixed bottom-4 right-4 z-50", className)}
        style={customStyles}
      >
        <Button
          onClick={() => setIsMinimized(false)}
          className="rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-all duration-200"
          style={{
            background: primaryColor,
            color: textColor,
          }}
        >
          <Bot className="w-6 h-6" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .enhanced-messages-container::-webkit-scrollbar {
          width: 8px;
        }
        .enhanced-messages-container::-webkit-scrollbar-track {
          background: transparent;
          border-radius: 4px;
        }
        .enhanced-messages-container::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, rgba(156, 163, 175, 0.3), rgba(156, 163, 175, 0.6));
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .enhanced-messages-container::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, rgba(156, 163, 175, 0.5), rgba(156, 163, 175, 0.8));
        }
        .enhanced-messages-container {
          scrollbar-width: thin;
          scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
        }
        
        /* Performance optimizations during scrolling */
        .enhanced-messages-container.is-scrolling * {
          pointer-events: none;
        }
        
        .enhanced-messages-container.is-scrolling img {
          transform: translateZ(0);
          backface-visibility: hidden;
        }
        
        /* Smooth animations */
        .enhanced-messages-container .group {
          will-change: transform, opacity;
        }
        
        /* Line clamp utility */
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        /* Message content styling improvements */
        .enhanced-messages-container .group div[dangerouslySetInnerHTML] {
          word-spacing: normal !important;
          letter-spacing: normal !important;
          line-height: 1.6 !important;
          white-space: pre-wrap !important;
        }
        
        .enhanced-messages-container .group div[dangerouslySetInnerHTML] br {
          line-height: 1.6;
        }
        
        /* Ensure proper text rendering */
        .enhanced-messages-container .group {
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        
        /* Fix spacing in message bubbles */
        .enhanced-messages-container .group > div > div {
          word-break: break-word;
          overflow-wrap: break-word;
          hyphens: auto;
        }
        
        /* Preserve spacing in assistant messages */
        .enhanced-messages-container .group [role="assistant"] div[dangerouslySetInnerHTML] {
          white-space: pre-wrap !important;
          word-spacing: normal !important;
        }
        
        /* Debug styles for message content */
        .debug-message-content {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif !important;
          white-space: pre-wrap !important;
          word-spacing: normal !important;
          letter-spacing: normal !important;
        }
        
        .debug-message-content * {
          white-space: inherit !important;
          word-spacing: inherit !important;
          letter-spacing: inherit !important;
        }
        
        /* History tab scroll fixes */
        [data-radix-scroll-area-viewport] {
          height: 100% !important;
        }
        
        /* Ensure proper height for tab content */
        [data-state="active"][data-orientation="horizontal"] {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
      `}</style>
      <div
        className={cn(
          "fixed bottom-4 right-4 z-50 w-80 h-[500px] flex flex-col",
          isDarkMode ? "dark" : "",
          className
        )}
        style={customStyles}
      >
        <Card className="flex flex-col shadow-xl border-0 bg-background h-[500px] overflow-hidden">
          {/* Header */}
          <div
            className="flex items-center justify-between p-4 border-b rounded-t-lg flex-shrink-0"
            style={{
              background: primaryColor,
              color: textColor,
            }}
          >
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <span className="font-medium">{settings.chatbotName}</span>
              {/* Realtime connection indicator */}
              {conversationId && (
                <div
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors duration-200",
                    realtimeConnected ? "bg-green-400" : "bg-red-400"
                  )}
                  title={
                    realtimeConnected
                      ? "Connected to live support"
                      : realtimeError || "Connecting to live support..."
                  }
                />
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* New Conversation Button */}
              {messages.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={startNewConversation}
                  className="text-current hover:bg-white/20 h-6 w-6 p-0"
                  title="Start new conversation"
                >
                  +
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(true)}
                className="text-current hover:bg-white/20 h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <TabsList
              className="grid w-full grid-cols-3 rounded-none border-b"
              style={{ backgroundColor: `${primaryColor}08` }}
            >
              <TabsTrigger
                value="chat"
                className="flex items-center gap-1 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                style={
                  activeTab === "chat" ? { color: settings.primaryColor } : {}
                }
              >
                <MessageCircle className="w-4 h-4" />
                Chat
              </TabsTrigger>
              {enableFAQ && (
                <TabsTrigger
                  value="faq"
                  className="flex items-center gap-1 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  style={
                    activeTab === "faq" ? { color: settings.primaryColor } : {}
                  }
                >
                  <HelpCircle className="w-4 h-4" />
                  FAQ
                </TabsTrigger>
              )}
              {enableHistory && (
                <TabsTrigger
                  value="history"
                  className="flex items-center gap-1 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  style={
                    activeTab === "history"
                      ? { color: settings.primaryColor }
                      : {}
                  }
                >
                  <History className="w-4 h-4" />
                  History
                </TabsTrigger>
              )}
            </TabsList>

            {/* Chat Tab */}
            <TabsContent
              value="chat"
              className="flex flex-col flex-1 overflow-hidden m-0"
            >
              {/* Messages */}
              <div
                ref={messagesContainerRef}
                className={cn(
                  "flex-1 overflow-y-auto bg-gradient-to-b from-background to-background/95 enhanced-messages-container",
                  scrollPerformance.isScrolling && "is-scrolling"
                )}
                style={{
                  minHeight: 0,
                  ...(shouldUseVirtualScrollForMessages
                    ? messagesVirtualScroll.scrollElementProps.style
                    : {}),
                }}
                data-scroll-container
                {...(shouldUseVirtualScrollForMessages
                  ? {
                      onScroll:
                        messagesVirtualScroll.scrollElementProps.onScroll,
                    }
                  : {})}
              >
                {shouldUseVirtualScrollForMessages ? (
                  // Virtual scrolled messages
                  <div
                    {...messagesVirtualScroll.containerProps}
                    className="relative"
                  >
                    {/* Human Agent Status Indicator for Virtual Scroll */}
                    {conversationStatus ===
                      ConversationStatus.AWAITING_HUMAN_RESPONSE && (
                      <div className="absolute left-0 right-0 top-0 px-4 z-10">
                        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium text-green-700 dark:text-green-400">
                              Connected to human support agent
                            </span>
                          </div>
                          <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                            A support agent will respond to your message shortly
                          </p>
                        </div>
                      </div>
                    )}

                    {messagesVirtualScroll.virtualItems.map(
                      ({ index, item: message, offsetTop }) => (
                        <div
                          key={message.id}
                          className="absolute left-0 right-0 px-4"
                          style={{
                            top: offsetTop,
                            height: estimatedMessageHeight,
                          }}
                        >
                          <EnhancedMessageDisplay
                            message={message}
                            primaryColor={primaryColor}
                            textColor={textColor}
                            isLast={
                              index === messages.length - 1 && !isStreaming
                            }
                            showTimestamp={true}
                            showStatus={true}
                            showActions={true}
                            conversationStatus={conversationStatus}
                            onCopy={(content) => {
                              navigator.clipboard.writeText(content);
                            }}
                            onFeedback={(messageId, feedback) => {
                              console.log(
                                `Feedback for ${messageId}: ${feedback}`
                              );
                            }}
                          />
                        </div>
                      )
                    )}

                    {/* Streaming Message in virtual scroll */}
                    {isStreaming &&
                      streamingMessageId &&
                      conversationStatus !==
                        ConversationStatus.AWAITING_HUMAN_RESPONSE && (
                        <div
                          className="absolute left-0 right-0 px-4"
                          style={{
                            top: messages.length * estimatedMessageHeight,
                            height: estimatedMessageHeight,
                          }}
                        >
                          <EnhancedMessageDisplay
                            key={streamingMessageId}
                            message={{
                              id: streamingMessageId,
                              content: currentStreamingMessage,
                              role: "assistant",
                              createdAt: new Date(),
                              isStreaming: true,
                            }}
                            primaryColor={primaryColor}
                            textColor={textColor}
                            isLast={true}
                            showTimestamp={false}
                            showStatus={false}
                            showActions={false}
                          />
                        </div>
                      )}
                  </div>
                ) : (
                  // Regular messages rendering
                  <div className="p-4 space-y-2">
                    {/* Human Agent Status Indicator */}
                    {conversationStatus ===
                      ConversationStatus.AWAITING_HUMAN_RESPONSE && (
                      <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-sm font-medium text-green-700 dark:text-green-400">
                            Connected to human support agent
                          </span>
                        </div>
                        <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                          A support agent will respond to your message shortly
                        </p>
                      </div>
                    )}

                    {messages.map((message, index) => (
                      <EnhancedMessageDisplay
                        key={message.id}
                        message={message}
                        primaryColor={primaryColor}
                        textColor={textColor}
                        isLast={index === messages.length - 1 && !isStreaming}
                        showTimestamp={true}
                        showStatus={true}
                        showActions={true}
                        conversationStatus={conversationStatus}
                        onCopy={(content) => {
                          navigator.clipboard.writeText(content);
                        }}
                        onFeedback={(messageId, feedback) => {
                          console.log(`Feedback for ${messageId}: ${feedback}`);
                        }}
                      />
                    ))}

                    {/* Streaming Message */}
                    {isStreaming &&
                      streamingMessageId &&
                      conversationStatus !==
                        ConversationStatus.AWAITING_HUMAN_RESPONSE && (
                        <EnhancedMessageDisplay
                          key={streamingMessageId}
                          message={{
                            id: streamingMessageId,
                            content: currentStreamingMessage,
                            role: "assistant",
                            createdAt: new Date(),
                            isStreaming: true,
                          }}
                          primaryColor={primaryColor}
                          textColor={textColor}
                          isLast={true}
                          showTimestamp={false}
                          showStatus={false}
                          showActions={false}
                        />
                      )}

                    {/* Loading indicator for non-streaming */}
                    {isLoading && !streamingConfig.enabled && (
                      <EnhancedMessageDisplay
                        message={{
                          id: "loading",
                          content: "",
                          role: "assistant",
                          createdAt: new Date(),
                          isStreaming: true,
                        }}
                        primaryColor={primaryColor}
                        textColor={textColor}
                        showTimestamp={false}
                        showStatus={false}
                        showActions={false}
                      />
                    )}

                    {error && (
                      <Alert className="border-destructive/50 text-destructive bg-red-50/50 dark:bg-red-900/10 backdrop-blur-sm">
                        <AlertCircle className="h-4 w-4" />
                        <div className="text-sm font-medium">{error}</div>
                      </Alert>
                    )}

                    {realtimeError && (
                      <Alert className="border-orange-500/50 text-orange-700 bg-orange-50/50 dark:bg-orange-900/10 backdrop-blur-sm">
                        <AlertCircle className="h-4 w-4" />
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">
                            Connection issue: {realtimeError}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleConnectionRecovery}
                            className="ml-2 h-6 px-2 text-xs"
                          >
                            Retry
                          </Button>
                        </div>
                      </Alert>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Enhanced Features UI */}
              {enableEnhancedFeatures && (
                <div className="px-4 py-2 border-t bg-muted/30">
                  {/* Proactive Questions */}
                  {intelligenceConfig.showProactiveQuestions &&
                    proactiveQuestions.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-medium text-muted-foreground mb-2">
                          Suggested questions:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {proactiveQuestions.map((question, index) => (
                            <Button
                              key={index}
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 px-2"
                              onClick={() =>
                                handleProactiveQuestionClick(question)
                              }
                            >
                              {question}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Suggested Topics */}
                  {intelligenceConfig.showSuggestedTopics &&
                    suggestedTopics.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-medium text-muted-foreground mb-2">
                          Related topics:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {suggestedTopics.map((topic, index) => (
                            <Button
                              key={index}
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7 px-2 bg-primary/10 hover:bg-primary/20"
                              onClick={() => handleSuggestedTopicClick(topic)}
                            >
                              {topic.replace(/_/g, " ")}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Conversation Actions */}
                  {intelligenceConfig.showConversationActions &&
                    conversationActions.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-medium text-muted-foreground mb-2">
                          Quick actions:
                        </div>
                        <div className="space-y-1">
                          {conversationActions.map((action, index) => (
                            <Button
                              key={index}
                              variant="outline"
                              size="sm"
                              className="w-full text-xs h-8 justify-start"
                              onClick={() =>
                                handleConversationActionClick(action)
                              }
                            >
                              <span className="truncate">{action.content}</span>
                              <span className="ml-auto text-xs text-muted-foreground">
                                {Math.round(action.confidence * 100)}%
                              </span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Intelligence Metrics (Debug/Admin) */}
                  {intelligenceConfig.showIntelligenceMetrics &&
                    intelligenceMetadata && (
                      <div className="mb-3 p-2 bg-muted/50 rounded text-xs">
                        <div className="font-medium mb-1">
                          Intelligence Metrics:
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <div>
                            Context:{" "}
                            {Math.round(
                              intelligenceMetadata.context_understanding * 100
                            )}
                            %
                          </div>
                          <div>
                            Proactive:{" "}
                            {Math.round(
                              intelligenceMetadata.proactive_score * 100
                            )}
                            %
                          </div>
                          <div>
                            Helpful:{" "}
                            {Math.round(
                              intelligenceMetadata.helpfulness_score * 100
                            )}
                            %
                          </div>
                          <div>
                            Escalation Risk:{" "}
                            {Math.round(
                              intelligenceMetadata.escalation_risk * 100
                            )}
                            %
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Escalation Button */}
                  {escalationConfig.enabled &&
                    escalationConfig.showEscalationButton && (
                      <div className="mb-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs h-8"
                          onClick={() => handleEscalationButtonClick()}
                          disabled={isEscalating}
                        >
                          {conversationStatus ===
                          ConversationStatus.AWAITING_HUMAN_RESPONSE
                            ? "🔄 Return to AI"
                            : conversationStatus === ConversationStatus.RESOLVED
                            ? "✅ Conversation Resolved"
                            : "🙋‍♂️ Talk to a human agent"}
                        </Button>
                      </div>
                    )}
                </div>
              )}

              {/* Image Preview Area */}
              {/* {enableImageUpload && imagePreview && (
                <div className="px-4 pb-2">
                  <div className="relative">
                    <Image
                      src={imagePreview}
                      alt="Upload preview"
                      width={300}
                      height={80}
                      className="max-w-full h-20 object-cover rounded border"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={removeImage}
                      className="absolute -top-2 -right-2 h-6 w-6 p-0 bg-background border rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )} */}

              {/* Input */}
              <div className="p-4 border-t bg-background flex-shrink-0">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      conversationStatus ===
                      ConversationStatus.AWAITING_HUMAN_RESPONSE
                        ? "Human agent will respond shortly..."
                        : "Type your message..."
                    }
                    disabled={isLoading || isStreaming}
                    className="flex-1"
                  />

                  {/* Image Upload Button */}
                  {/* {enableImageUpload && (
                    <div {...getRootProps()}>
                      <input {...getInputProps()} />
                      <Button
                        variant="outline"
                        size="sm"
                        className="px-3"
                        disabled={isLoading || isStreaming}
                        title="Upload image"
                      >
                        <Upload className="w-4 h-4" />
                      </Button>
                    </div>
                  )} */}

                  {isStreaming ? (
                    <Button
                      onClick={cancelStreaming}
                      size="sm"
                      variant="outline"
                      className="px-3"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={() => sendMessage()}
                      disabled={
                        (!inputValue.trim() && !uploadedImage) ||
                        isLoading ||
                        conversationStatus ===
                          ConversationStatus.AWAITING_HUMAN_RESPONSE
                      }
                      size="sm"
                      className="px-3"
                      style={{
                        background: primaryColor,
                        color: textColor,
                      }}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* FAQ Tab */}
            {enableFAQ && (
              <TabsContent
                value="faq"
                className="flex flex-col flex-1 overflow-hidden m-0"
              >
                <div className="flex-1 overflow-hidden p-4">
                  <AccordionFAQ
                    faqs={faqs}
                    chatbotId={chatbotId}
                    searchable={true}
                    categorized={true}
                    allowMultipleOpen={true}
                    onFAQSelect={handleFAQClick}
                    onStartChat={() => setActiveTab("chat")}
                    primaryColor={primaryColor}
                    maxHeight="350px"
                    showPopularity={true}
                    enableChatIntegration={true}
                  />
                </div>
              </TabsContent>
            )}

            {/* History Tab */}
            {enableHistory && (
              <TabsContent
                value="history"
                className="flex flex-col flex-1 overflow-hidden m-0 h-full"
              >
                <ConversationHistory
                  conversations={conversationHistory}
                  isLoading={isLoadingHistory}
                  searchQuery={historySearch}
                  onSearchChange={setHistorySearch}
                  onConversationSelect={loadConversation}
                  primaryColor={primaryColor}
                  className="flex-1 min-h-0"
                />
              </TabsContent>
            )}
          </Tabs>
        </Card>

        {/* Escalation Dialog */}
        {showEscalationDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <Card className="w-80 p-4 m-4">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">Request Human Assistance</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Let us know how we can better help you.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Reason for escalation:
                  </label>
                  <textarea
                    value={escalationReason}
                    onChange={(e) => setEscalationReason(e.target.value)}
                    placeholder="Please describe what you need help with..."
                    className="w-full mt-1 p-2 border rounded text-sm resize-none"
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleEscalation(escalationReason)}
                    disabled={isEscalating || !escalationReason.trim()}
                    className="flex-1"
                    style={{
                      background: primaryColor,
                      color: textColor,
                    }}
                  >
                    {isEscalating ? "Connecting..." : "Request Help"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowEscalationDialog(false);
                      setEscalationReason("");
                    }}
                    disabled={isEscalating}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Lead Collection Dialog */}
        {showLeadCollection && leadCollectionConfig.enabled && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <Card className="w-80 p-4 m-4">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">Stay Connected</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Let us know how to reach you for follow-up.
                  </p>
                </div>

                <div className="space-y-3">
                  {leadCollectionConfig.collectEmail && (
                    <div>
                      <label className="text-sm font-medium">Email:</label>
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={leadCollectionData.email || ""}
                        onChange={(e) =>
                          setLeadCollectionData((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                        className="mt-1"
                      />
                    </div>
                  )}

                  {leadCollectionConfig.collectPhone && (
                    <div>
                      <label className="text-sm font-medium">Phone:</label>
                      <Input
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={leadCollectionData.phone || ""}
                        onChange={(e) =>
                          setLeadCollectionData((prev) => ({
                            ...prev,
                            phone: e.target.value,
                          }))
                        }
                        className="mt-1"
                      />
                    </div>
                  )}

                  {leadCollectionConfig.collectCompany && (
                    <div>
                      <label className="text-sm font-medium">Company:</label>
                      <Input
                        placeholder="Your company name"
                        value={leadCollectionData.company || ""}
                        onChange={(e) =>
                          setLeadCollectionData((prev) => ({
                            ...prev,
                            company: e.target.value,
                          }))
                        }
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleLeadDataSubmit(leadCollectionData)}
                    disabled={
                      !leadCollectionData.email &&
                      leadCollectionConfig.collectEmail
                    }
                    className="flex-1"
                    style={{
                      background: primaryColor,
                      color: textColor,
                    }}
                  >
                    Submit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowLeadCollection(false)}
                  >
                    Skip
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
