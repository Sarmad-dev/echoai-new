"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/supabase";

interface TypingUser {
  userId: string;
  userType: "agent" | "customer";
  timestamp: string;
}

interface UseTypingIndicatorReturn {
  typingUsers: TypingUser[];
  isTyping: boolean;
  startTyping: () => void;
  stopTyping: () => void;
  isCustomerTyping: boolean;
  isAgentTyping: boolean;
}

export function useTypingIndicator(
  conversationId: string,
  userType: "agent" | "customer" = "agent"
): UseTypingIndicatorReturn {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const supabase = createClient();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);

  // Send typing indicator to API
  const sendTypingIndicator = useCallback(
    async (typing: boolean) => {
      try {
        await fetch("/api/helpdesk/typing", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversationId,
            isTyping: typing,
            userType,
          }),
        });
      } catch (error) {
        console.error("Failed to send typing indicator:", error);
      }
    },
    [conversationId, userType]
  );

  const startTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      sendTypingIndicator(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Auto-stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingIndicator(false);
    }, 3000);
  }, [isTyping, sendTypingIndicator]);

  const stopTyping = useCallback(() => {
    if (isTyping) {
      setIsTyping(false);
      sendTypingIndicator(false);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [isTyping, sendTypingIndicator]);

  // Set up realtime subscription for typing indicators
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase.channel(`typing-${conversationId}`);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "typing_start" }, (payload) => {
        const { userId, userType: senderType, timestamp } = payload.payload;

        setTypingUsers((prev) => {
          // Remove existing entry for this user and add new one
          const filtered = prev.filter((user) => user.userId !== userId);
          return [...filtered, { userId, userType: senderType, timestamp }];
        });
      })
      .on("broadcast", { event: "typing_stop" }, (payload) => {
        const { userId } = payload.payload;

        setTypingUsers((prev) => prev.filter((user) => user.userId !== userId));
      })
      .subscribe();

    // Cleanup function
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversationId, supabase]);

  // Clean up old typing indicators (older than 10 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      setTypingUsers((prev) =>
        prev.filter((user) => {
          const userTime = new Date(user.timestamp).getTime();
          return now - userTime < 10000; // 10 seconds
        })
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const isCustomerTyping = typingUsers.some(
    (user) => user.userType === "customer"
  );
  const isAgentTyping = typingUsers.some((user) => user.userType === "agent");

  return {
    typingUsers,
    isTyping,
    startTyping,
    stopTyping,
    isCustomerTyping,
    isAgentTyping,
  };
}
