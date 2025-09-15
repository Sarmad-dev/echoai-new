import { useState, useCallback, useEffect } from 'react';

export interface SessionData {
  sessionId: string;
  messages: any[];
  timestamp: number;
  userEmail: string;
  chatbotId: string;
}

export interface UseSessionManagementProps {
  userEmail?: string;
  chatbotId?: string;
  onError?: (error: string) => void;
}

export function useSessionManagement({
  userEmail,
  chatbotId,
  onError,
}: UseSessionManagementProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSessionInitialized, setIsSessionInitialized] = useState(false);

  // Generate storage key for this user/chatbot combination
  const getSessionStorageKey = useCallback(() => {
    return `chat-session-${chatbotId}-${userEmail}`;
  }, [chatbotId, userEmail]);

  // Load session from localStorage
  const loadStoredSession = useCallback((): SessionData | null => {
    if (!userEmail || !chatbotId) return null;

    try {
      const stored = localStorage.getItem(getSessionStorageKey());
      if (stored) {
        const sessionData = JSON.parse(stored);
        // Check if session is not too old (24 hours)
        const sessionAge = Date.now() - sessionData.timestamp;
        if (sessionAge < 24 * 60 * 60 * 1000) {
          return sessionData;
        } else {
          // Remove expired session
          localStorage.removeItem(getSessionStorageKey());
        }
      }
    } catch (error) {
      console.error('Failed to load stored session:', error);
      localStorage.removeItem(getSessionStorageKey());
    }
    return null;
  }, [userEmail, chatbotId, getSessionStorageKey]);

  // Save session to localStorage
  const saveSessionToStorage = useCallback(
    (sessionId: string, messages: any[]) => {
      if (!userEmail || !chatbotId) return;

      try {
        const sessionData: SessionData = {
          sessionId,
          messages,
          timestamp: Date.now(),
          userEmail,
          chatbotId,
        };
        localStorage.setItem(getSessionStorageKey(), JSON.stringify(sessionData));
      } catch (error) {
        console.error('Failed to save session to storage:', error);
      }
    },
    [userEmail, chatbotId, getSessionStorageKey]
  );

  // Clear session from localStorage
  const clearStoredSession = useCallback(() => {
    if (!userEmail || !chatbotId) return;
    
    try {
      localStorage.removeItem(getSessionStorageKey());
    } catch (error) {
      console.error('Failed to clear stored session:', error);
    }
  }, [userEmail, chatbotId, getSessionStorageKey]);

  // Validate existing session with server
  const validateSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      try {
        const params = new URLSearchParams({
          sessionId,
        });

        if (userEmail) params.append('externalUserEmail', userEmail);
        if (chatbotId) params.append('chatbotId', chatbotId);

        const response = await fetch(`/api/chat/session?${params.toString()}`);

        if (response.ok) {
          return true;
        } else if (response.status === 410) {
          // Session expired
          console.log('Session expired, will create new one');
          return false;
        } else if (response.status === 404) {
          // Session not found
          console.log('Session not found, will create new one');
          return false;
        } else {
          console.error('Session validation failed:', response.status);
          return false;
        }
      } catch (error) {
        console.error('Failed to validate session:', error);
        return false;
      }
    },
    [userEmail, chatbotId]
  );

  // Create new session
  const createSession = useCallback(async (): Promise<string | null> => {
    if (!userEmail || !chatbotId) return null;

    try {
      const response = await fetch('/api/chat/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          externalUserEmail: userEmail,
          chatbotId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.sessionId;
      } else {
        throw new Error(`Failed to create session: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to create session:', error);
      onError?.('Failed to create session');
      return null;
    }
  }, [userEmail, chatbotId, onError]);

  // Initialize or resume session
  const initializeSession = useCallback(async (): Promise<{
    sessionId: string | null;
    messages: any[];
    isResumed: boolean;
  }> => {
    if (!userEmail || !chatbotId) {
      return { sessionId: null, messages: [], isResumed: false };
    }

    try {
      // First, try to load session from localStorage
      const storedSession = loadStoredSession();

      if (storedSession && storedSession.sessionId) {
        // Validate stored session with server
        const isValid = await validateSession(storedSession.sessionId);

        if (isValid) {
          // Resume existing session
          setSessionId(storedSession.sessionId);
          setIsSessionInitialized(true);
          console.log('Resumed existing session:', storedSession.sessionId);
          return {
            sessionId: storedSession.sessionId,
            messages: storedSession.messages || [],
            isResumed: true,
          };
        } else {
          // Clear invalid session from storage
          clearStoredSession();
        }
      }

      // Create new session
      const newSessionId = await createSession();
      if (newSessionId) {
        setSessionId(newSessionId);
        setIsSessionInitialized(true);
        console.log('Created new session:', newSessionId);
        return {
          sessionId: newSessionId,
          messages: [],
          isResumed: false,
        };
      }

      return { sessionId: null, messages: [], isResumed: false };
    } catch (error) {
      console.error('Failed to initialize session:', error);
      onError?.('Failed to initialize session');
      return { sessionId: null, messages: [], isResumed: false };
    }
  }, [
    userEmail,
    chatbotId,
    loadStoredSession,
    validateSession,
    clearStoredSession,
    createSession,
    onError,
  ]);

  // Reset session (start new conversation)
  const resetSession = useCallback(() => {
    clearStoredSession();
    setSessionId(null);
    setIsSessionInitialized(false);
  }, [clearStoredSession]);

  // Load conversation from history
  const loadConversation = useCallback(
    async (historySessionId: string): Promise<{
      success: boolean;
      messages: any[];
    }> => {
      try {
        // First validate that the session is still active
        const isValid = await validateSession(historySessionId);

        if (!isValid) {
          onError?.('This conversation is no longer available');
          return { success: false, messages: [] };
        }

        const response = await fetch(`/api/chat/session/${historySessionId}`);

        if (response.ok) {
          const sessionData = await response.json();

          // Set as current session
          setSessionId(historySessionId);
          setIsSessionInitialized(true);

          const messages = sessionData.messages || [];

          // Save resumed session to localStorage
          saveSessionToStorage(historySessionId, messages);

          console.log('Loaded conversation:', historySessionId);
          return { success: true, messages };
        } else {
          throw new Error(`Failed to load conversation: ${response.status}`);
        }
      } catch (error) {
        console.error('Failed to load conversation:', error);
        onError?.('Failed to load conversation');
        return { success: false, messages: [] };
      }
    },
    [validateSession, saveSessionToStorage, onError]
  );

  return {
    sessionId,
    isSessionInitialized,
    initializeSession,
    resetSession,
    loadConversation,
    saveSessionToStorage,
    validateSession,
    loadStoredSession,
    clearStoredSession,
  };
}