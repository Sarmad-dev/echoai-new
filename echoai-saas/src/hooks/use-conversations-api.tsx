"use client";

import { useState, useEffect, useCallback } from "react";
import { ConversationWithMetadata } from "@/components/helpdesk/conversation-table";
import { ConversationStatus } from "@/types/database";

interface ConversationsApiFilters {
  status?: ConversationStatus;
  assignedTo?: string;
  customerEmail?: string;
  source?: string;
  search?: string;
}

interface ConversationsApiParams extends ConversationsApiFilters {
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "updatedAt" | "customerEmail" | "status";
  sortOrder?: "asc" | "desc";
}

interface ConversationsApiResponse {
  conversations: ConversationWithMetadata[];
  totalCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

interface UseConversationsApiOptions {
  initialParams?: ConversationsApiParams;
  autoFetch?: boolean;
}

interface UseConversationsApiReturn {
  conversations: ConversationWithMetadata[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  hasMore: boolean;
  currentPage: number;
  fetchConversations: (params?: ConversationsApiParams) => Promise<void>;
  refetch: () => Promise<void>;
  setFilters: (filters: ConversationsApiFilters) => void;
  nextPage: () => Promise<void>;
  prevPage: () => Promise<void>;
}

export function useConversationsApi({
  initialParams = {
    page: 1,
    limit: 20,
    sortBy: "updatedAt",
    sortOrder: "desc",
  },
  autoFetch = true,
}: UseConversationsApiOptions = {}): UseConversationsApiReturn {
  const [conversations, setConversations] = useState<
    ConversationWithMetadata[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [currentParams, setCurrentParams] =
    useState<ConversationsApiParams>(initialParams);

  const fetchConversations = useCallback(
    async (params?: ConversationsApiParams) => {
      const finalParams = params || currentParams;
      setLoading(true);
      setError(null);

      try {
        // Build query string
        const queryParams = new URLSearchParams();

        Object.entries(finalParams).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            queryParams.append(key, value.toString());
          }
        });

        const response = await fetch(
          `/api/helpdesk/conversations?${queryParams.toString()}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const data: ConversationsApiResponse = await response.json();

        // Transform API response to match ConversationWithMetadata interface
        const transformedConversations: ConversationWithMetadata[] =
          data.conversations.map((conv) => ({
            id: conv.id,
            customerEmail: conv.customerEmail,
            source: conv.source,
            status: conv.status,
            assignedTo: conv.assignedTo,
            sentimentScore: conv.sentimentScore,
            duration: conv.duration,
            lastMessage:
              conv.lastMessage &&
              typeof conv.lastMessage === "object" &&
              "content" in conv.lastMessage
                ? (conv.lastMessage as any).content
                : typeof conv.lastMessage === "string"
                ? conv.lastMessage
                : "No messages",
            lastMessageTimestamp:
              conv.lastMessage &&
              typeof conv.lastMessage === "object" &&
              "createdAt" in conv.lastMessage
                ? new Date((conv.lastMessage as any).createdAt)
                : new Date(conv.createdAt),
            messageCount: conv.messageCount,
            createdAt: new Date(conv.createdAt),
            updatedAt: new Date(conv.updatedAt),
          }));

        setConversations(transformedConversations);
        setTotalCount(data.totalCount);
        setHasMore(data.hasMore);
        setCurrentParams(finalParams);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch conversations";
        setError(errorMessage);
        console.error("Error fetching conversations:", err);
      } finally {
        setLoading(false);
      }
    },
    [currentParams]
  );

  const refetch = useCallback(() => {
    return fetchConversations(currentParams);
  }, [fetchConversations, currentParams]);

  const setFilters = useCallback(
    (filters: ConversationsApiFilters) => {
      const newParams = {
        ...currentParams,
        ...filters,
        page: 1, // Reset to first page when filters change
      };
      fetchConversations(newParams);
    },
    [currentParams, fetchConversations]
  );

  const nextPage = useCallback(async () => {
    if (hasMore) {
      const newParams = {
        ...currentParams,
        page: (currentParams.page || 1) + 1,
      };
      await fetchConversations(newParams);
    }
  }, [hasMore, currentParams, fetchConversations]);

  const prevPage = useCallback(async () => {
    const currentPage = currentParams.page || 1;
    if (currentPage > 1) {
      const newParams = {
        ...currentParams,
        page: currentPage - 1,
      };
      await fetchConversations(newParams);
    }
  }, [currentParams, fetchConversations]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch) {
      fetchConversations();
    }
  }, [autoFetch]); // Only run on mount

  return {
    conversations,
    loading,
    error,
    totalCount,
    hasMore,
    currentPage: currentParams.page || 1,
    fetchConversations,
    refetch,
    setFilters,
    nextPage,
    prevPage,
  };
}
