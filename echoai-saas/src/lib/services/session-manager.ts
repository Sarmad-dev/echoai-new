import { createClient } from "@/lib/supabase/supabase-server";

export interface SessionValidationResult {
  isValid: boolean;
  session?: {
    id: string;
    externalUserId: string;
    chatbotId: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    memoryBuffer?: Record<string, unknown> | null;
    externalUser: {
      id: string;
      email: string;
      firstName?: string;
      lastName?: string;
    };
    chatbot: {
      id: string;
      name: string;
      isActive: boolean;
    };
  };
  error?: string;
  errorCode?:
    | "NOT_FOUND"
    | "EXPIRED"
    | "INACTIVE"
    | "UNAUTHORIZED"
    | "SERVER_ERROR";
}

export interface SessionCleanupResult {
  sessionsFound: number;
  sessionsDeactivated: number;
  sessions: Array<{
    id: string;
    userEmail?: string;
    chatbotName?: string;
    lastActivity: string;
  }>;
}

export class SessionManager {
  private async getSupabase() {
    return await createClient();
  }

  /**
   * Validate a session and check if it's active and not expired
   */
  async validateSession(
    sessionId: string,
    options?: {
      externalUserEmail?: string;
      chatbotId?: string;
      maxAgeHours?: number;
    }
  ): Promise<SessionValidationResult> {
    try {
      const maxAgeHours = options?.maxAgeHours || 24;

      const supabase = await this.getSupabase();
      const { data: session, error } = await supabase
        .from("ConversationSession")
        .select(
          `
          *,
          externalUser:ExternalUser(*),
          chatbot:Chatbot(id, name, isActive)
        `
        )
        .eq("id", sessionId)
        .eq("isActive", true)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return {
            isValid: false,
            error: "Session not found or inactive",
            errorCode: "NOT_FOUND",
          };
        }
        return {
          isValid: false,
          error: "Failed to validate session",
          errorCode: "SERVER_ERROR",
        };
      }

      // Check user authorization if provided
      const userEmail = Array.isArray(session.externalUser) 
        ? session.externalUser[0]?.email 
        : session.externalUser?.email;
      
      if (
        options?.externalUserEmail &&
        userEmail !== options.externalUserEmail
      ) {
        return {
          isValid: false,
          error: "Session does not belong to the specified user",
          errorCode: "UNAUTHORIZED",
        };
      }

      // Check chatbot authorization if provided
      if (options?.chatbotId && session.chatbotId !== options.chatbotId) {
        return {
          isValid: false,
          error: "Session does not belong to the specified chatbot",
          errorCode: "UNAUTHORIZED",
        };
      }

      // Check if session is expired
      const sessionAge =
        new Date().getTime() - new Date(session.updatedAt).getTime();
      const isExpired = sessionAge > maxAgeHours * 60 * 60 * 1000;

      if (isExpired) {
        // Auto-deactivate expired session
        await this.deactivateSession(sessionId);
        return {
          isValid: false,
          error: "Session has expired",
          errorCode: "EXPIRED",
        };
      }

      return {
        isValid: true,
        session,
      };
    } catch (error) {
      console.error("Error validating session:", error);
      return {
        isValid: false,
        error: "Internal server error",
        errorCode: "SERVER_ERROR",
      };
    }
  }

  /**
   * Create or retrieve an active session for a user and chatbot
   */
  async getOrCreateSession(
    externalUserEmail: string,
    chatbotId: string,
    userInfo?: { firstName?: string; lastName?: string }
  ): Promise<{
    sessionId: string;
    externalUserId: string;
    isNewUser: boolean;
  } | null> {
    try {
      // Find or create external user
      const supabase = await this.getSupabase();
      const { data: existingUser, error: userError } = await supabase
        .from("ExternalUser")
        .select("*")
        .eq("email", externalUserEmail)
        .single();

      let externalUser = existingUser;
      let isNewUser = false;

      if (userError && userError.code === "PGRST116") {
        // Create new user
        const { data: newUser, error: createError } = await supabase
          .from("ExternalUser")
          .insert({
            email: externalUserEmail,
            firstName: userInfo?.firstName || null,
            lastName: userInfo?.lastName || null,
          })
          .select()
          .single();

        if (createError) {
          console.error("Error creating external user:", createError);
          return null;
        }

        externalUser = newUser;
        isNewUser = true;
      } else if (userError) {
        console.error("Error finding external user:", userError);
        return null;
      }

      // Check for existing active session
      const { data: existingSession } = await supabase
        .from("ConversationSession")
        .select("*")
        .eq("externalUserId", externalUser.id)
        .eq("chatbotId", chatbotId)
        .eq("isActive", true)
        .order("createdAt", { ascending: false })
        .limit(1)
        .single();

      let session = existingSession;

      // Create new session if none exists or existing is old
      if (
        !existingSession ||
        new Date().getTime() - new Date(existingSession.updatedAt).getTime() >
          24 * 60 * 60 * 1000
      ) {
        // Deactivate old session if it exists
        if (existingSession) {
          await this.deactivateSession(existingSession.id);
        }

        // Create new session
        const { data: newSession, error: createSessionError } = await supabase
          .from("ConversationSession")
          .insert({
            externalUserId: externalUser.id,
            chatbotId,
            memoryBuffer: null,
            isActive: true,
          })
          .select()
          .single();

        if (createSessionError) {
          console.error("Error creating session:", createSessionError);
          return null;
        }

        session = newSession;
      }

      return {
        sessionId: session.id,
        externalUserId: externalUser.id,
        isNewUser,
      };
    } catch (error) {
      console.error("Error in getOrCreateSession:", error);
      return null;
    }
  }

  /**
   * Update session memory buffer
   */
  async updateSessionMemory(
    sessionId: string,
    memoryBuffer: Record<string, unknown> | null
  ): Promise<boolean> {
    try {
      const supabase = await this.getSupabase();
      const { error } = await supabase
        .from("ConversationSession")
        .update({
          memoryBuffer,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (error) {
        console.error("Error updating session memory:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error in updateSessionMemory:", error);
      return false;
    }
  }

  /**
   * Deactivate a session
   */
  async deactivateSession(sessionId: string): Promise<boolean> {
    try {
      const supabase = await this.getSupabase();
      const { error } = await supabase
        .from("ConversationSession")
        .update({
          isActive: false,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (error) {
        console.error("Error deactivating session:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error in deactivateSession:", error);
      return false;
    }
  }

  /**
   * Clean up inactive sessions older than specified hours
   */
  async cleanupInactiveSessions(
    maxAgeHours: number = 24,
    dryRun: boolean = false
  ): Promise<SessionCleanupResult> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);

      // Find inactive sessions
      const supabase = await this.getSupabase();
      const { data: inactiveSessions, error: findError } = await supabase
        .from("ConversationSession")
        .select(
          `
          id,
          updatedAt,
          externalUser:ExternalUser(email),
          chatbot:Chatbot(name)
        `
        )
        .eq("isActive", true)
        .lt("updatedAt", cutoffTime.toISOString());

      if (findError) {
        console.error("Error finding inactive sessions:", findError);
        throw new Error("Failed to find inactive sessions");
      }

      const sessions = (inactiveSessions || []).map((session: {
        id: string;
        updatedAt: string;
        externalUser: { email?: string } | { email?: string }[];
        chatbot: { name?: string } | { name?: string }[];
      }) => ({
        id: session.id,
        userEmail: Array.isArray(session.externalUser) 
          ? session.externalUser[0]?.email 
          : session.externalUser?.email,
        chatbotName: Array.isArray(session.chatbot) 
          ? session.chatbot[0]?.name 
          : session.chatbot?.name,
        lastActivity: session.updatedAt,
      }));

      let sessionsDeactivated = 0;

      if (!dryRun && inactiveSessions && inactiveSessions.length > 0) {
        const sessionIds = inactiveSessions.map((s: { id: string }) => s.id);

        const { error: deactivateError } = await supabase
          .from("ConversationSession")
          .update({
            isActive: false,
            updatedAt: new Date().toISOString(),
          })
          .in("id", sessionIds);

        if (deactivateError) {
          console.error("Error deactivating sessions:", deactivateError);
          throw new Error("Failed to deactivate sessions");
        }

        sessionsDeactivated = sessionIds.length;
      }

      return {
        sessionsFound: sessions.length,
        sessionsDeactivated,
        sessions,
      };
    } catch (error) {
      console.error("Error in cleanupInactiveSessions:", error);
      throw error;
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStatistics(maxAgeHours: number = 24) {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);

      const supabase = await this.getSupabase();

      const [
        { count: activeSessions },
        { count: inactiveSessions },
        { count: expiredSessions },
      ] = await Promise.all([
        // Active sessions
        supabase
          .from("ConversationSession")
          .select("id", { count: "exact", head: true })
          .eq("isActive", true)
          .gte("updatedAt", cutoffTime.toISOString()),

        // Inactive sessions
        supabase
          .from("ConversationSession")
          .select("id", { count: "exact", head: true })
          .eq("isActive", false),

        // Expired sessions (active but old)
        supabase
          .from("ConversationSession")
          .select("id", { count: "exact", head: true })
          .eq("isActive", true)
          .lt("updatedAt", cutoffTime.toISOString()),
      ]);

      return {
        activeSessions: activeSessions || 0,
        inactiveSessions: inactiveSessions || 0,
        expiredSessions: expiredSessions || 0,
        totalSessions: (activeSessions || 0) + (inactiveSessions || 0),
      };
    } catch (error) {
      console.error("Error getting session statistics:", error);
      throw error;
    }
  }
}
