import { NextRequest, NextResponse } from "next/server";
import { databaseService } from "@/lib/supabase/database-service";
import { AnalyticsMetrics } from "@/types/database";
import { subDays, startOfDay, endOfDay } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const chatbotId = searchParams.get("chatbotId");
    const userId = searchParams.get("userId");
    const timeRange = searchParams.get("timeRange") || "30d";
    const conversationType = searchParams.get("conversationType"); // 'active', 'resolved', 'all'
    
    // Calculate date range
    const days = timeRange === "7d" ? 7 : timeRange === "90d" ? 90 : 30;
    const startDate = startOfDay(subDays(new Date(), days));
    const endDate = endOfDay(new Date());

    const client = databaseService.getClient();

    // Build queries with filters
    let sessionQuery = client
      .from("ConversationSession")
      .select("*")
      .gte("createdAt", startDate.toISOString())
      .lte("createdAt", endDate.toISOString());

    const messageQuery = client
      .from("Message")
      .select("*")
      .gte("createdAt", startDate.toISOString())
      .lte("createdAt", endDate.toISOString());

    let workflowQuery = client
      .from("WorkflowExecution")
      .select("*")
      .gte("startedAt", startDate.toISOString())
      .lte("startedAt", endDate.toISOString());

    // Apply chatbot filter
    if (chatbotId) {
      sessionQuery = sessionQuery.eq("chatbotId", chatbotId);
      workflowQuery = workflowQuery.eq("chatbotId", chatbotId);
    }

    // Apply conversation type filter
    if (conversationType === "active") {
      sessionQuery = sessionQuery.eq("isActive", true);
    } else if (conversationType === "resolved") {
      sessionQuery = sessionQuery.eq("isActive", false);
    }

    // Execute queries
    const [sessionsResult, messagesResult, workflowsResult] = await Promise.all([
      databaseService.executeQuery(async () => await sessionQuery, "getAnalyticsSessions"),
      databaseService.executeQuery(async () => await messageQuery, "getAnalyticsMessages"),
      databaseService.executeQuery(async () => await workflowQuery, "getAnalyticsWorkflows")
    ]);

    const sessions = sessionsResult as any[];
    const messages = messagesResult as any[];
    const workflows = workflowsResult as any[];

    // Filter messages by session if chatbot filter is applied
    const filteredMessages = chatbotId 
      ? messages.filter(msg => sessions.some(session => session.id === msg.sessionId))
      : messages;

    // Calculate metrics
    const metrics = await calculateAnalyticsMetrics(sessions, filteredMessages, workflows);

    return NextResponse.json({
      success: true,
      data: metrics,
      filters: {
        chatbotId,
        userId,
        timeRange,
        conversationType,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      }
    });
  } catch (error) {
    console.error("Error fetching analytics metrics:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch analytics metrics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function calculateAnalyticsMetrics(
  sessions: any[],
  messages: any[],
  workflows: any[]
): Promise<AnalyticsMetrics> {
  // Total Conversations
  const totalConversations = sessions.length;

  // Average Sentiment
  const messagesWithSentiment = messages.filter(m => 
    m.sentimentScore !== null && m.sentimentScore !== undefined
  );
  const averageSentiment = messagesWithSentiment.length > 0
    ? messagesWithSentiment.reduce((sum, m) => sum + (m.sentimentScore || 0), 0) / messagesWithSentiment.length
    : 0;

  // Resolution Rate (percentage of conversations that are no longer active)
  const resolvedSessions = sessions.filter(s => !s.isActive).length;
  const resolutionRate = totalConversations > 0 ? (resolvedSessions / totalConversations) * 100 : 0;

  // Automation Triggers (total workflow executions)
  const automationTriggers = workflows.length;

  // Active Users (unique external users in active sessions)
  const activeUsers = new Set(
    sessions.filter(s => s.isActive).map(s => s.externalUserId)
  ).size;

  // Top Intents from message metadata
  const intentCounts: Record<string, number> = {};
  messages.forEach(message => {
    if (message.metadata && message.metadata.intent) {
      const intent = message.metadata.intent;
      intentCounts[intent] = (intentCounts[intent] || 0) + 1;
    }
  });

  const topIntents = Object.entries(intentCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([intent, count]) => ({ intent, count }));

  return {
    totalConversations,
    averageSentiment: Math.round(averageSentiment * 100) / 100,
    resolutionRate: Math.round(resolutionRate * 100) / 100,
    automationTriggers,
    activeUsers,
    topIntents
  };
}