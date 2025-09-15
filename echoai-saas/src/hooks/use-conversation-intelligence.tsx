"use client";

import { useState, useEffect, useCallback } from "react";

export interface ConversationIntelligenceData {
  leadPotential: number;
  topicsCovered: string[];
  escalationRisk: number;
  proactiveScore: number;
  helpfulnessScore: number;
  knowledgeGapsFound: string[];
  userGoalsIdentified: string[];
  contextUnderstanding: number;
  conversationFlowScore: number;
  userSatisfactionPrediction: number;
}

export interface ConversationIntelligenceResponse {
  intelligenceData: ConversationIntelligenceData;
  contextUnderstanding: number;
  proactiveScore: number;
  helpfulnessScore: number;
}

interface UseConversationIntelligenceReturn {
  intelligence: ConversationIntelligenceResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useConversationIntelligence(
  conversationId: string | null
): UseConversationIntelligenceReturn {
  const [intelligence, setIntelligence] = useState<ConversationIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIntelligence = useCallback(async () => {
    if (!conversationId) {
      setIntelligence(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/helpdesk/conversations/${conversationId}/intelligence`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          // No intelligence data found - this is normal for new conversations
          setIntelligence(null);
          return;
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data: ConversationIntelligenceResponse = await response.json();
      setIntelligence(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch conversation intelligence";
      setError(errorMessage);
      console.error("Error fetching conversation intelligence:", err);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const refetch = useCallback(() => {
    return fetchIntelligence();
  }, [fetchIntelligence]);

  // Auto-fetch when conversationId changes
  useEffect(() => {
    fetchIntelligence();
  }, [fetchIntelligence]);

  return {
    intelligence,
    loading,
    error,
    refetch,
  };
}