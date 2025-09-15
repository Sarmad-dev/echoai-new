import { NextRequest, NextResponse } from "next/server";
import { databaseService } from "@/lib/supabase/database-service";
import { subDays, startOfDay, endOfDay, format, eachDayOfInterval } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const chatbotId = searchParams.get("chatbotId");
    const userId = searchParams.get("userId");
    const timeRange = searchParams.get("timeRange") || "30d";
    const metric = searchParams.get("metric") || "conversations"; // conversations, sentiment, automation, resolution
    const granularity = searchParams.get("granularity") || "daily"; // hourly, daily, weekly
    
    // Calculate date range
    const days = timeRange === "7d" ? 7 : timeRange === "90d" ? 90 : 30;
    const startDate = startOfDay(subDays(new Date(), days));
    const endDate = endOfDay(new Date());

    const client = databaseService.getClient();

    let historicalData: any[] = [];

    switch (metric) {
      case "conversations":
        historicalData = await getConversationTrends(client, startDate, endDate, chatbotId, granularity);
        break;
      case "sentiment":
        historicalData = await getSentimentTrends(client, startDate, endDate, chatbotId, granularity);
        break;
      case "automation":
        historicalData = await getAutomationTrends(client, startDate, endDate, chatbotId, granularity);
        break;
      case "resolution":
        historicalData = await getResolutionTrends(client, startDate, endDate, chatbotId, granularity);
        break;
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }

    return NextResponse.json({
      success: true,
      data: historicalData,
      metadata: {
        metric,
        granularity,
        timeRange,
        chatbotId,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      }
    });
  } catch (error) {
    console.error("Error fetching historical analytics:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch historical analytics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function getConversationTrends(
  client: any,
  startDate: Date,
  endDate: Date,
  chatbotId: string | null,
  granularity: string
) {
  let sessionQuery = client
    .from("ConversationSession")
    .select("*")
    .gte("createdAt", startDate.toISOString())
    .lte("createdAt", endDate.toISOString());

  if (chatbotId) {
    sessionQuery = sessionQuery.eq("chatbotId", chatbotId);
  }

  const sessionsResult = await databaseService.executeQuery(
    async () => await sessionQuery,
    "getConversationTrends"
  );

  const sessions = sessionsResult as any[];

  return generateTimeSeriesData(sessions, startDate, endDate, granularity, (data) => ({
    total: data.length,
    active: data.filter((s: any) => s.isActive).length,
    resolved: data.filter((s: any) => !s.isActive).length
  }));
}

async function getSentimentTrends(
  client: any,
  startDate: Date,
  endDate: Date,
  chatbotId: string | null,
  granularity: string
) {
  let messageQuery = client
    .from("Message")
    .select("*, ConversationSession!inner(chatbotId)")
    .gte("createdAt", startDate.toISOString())
    .lte("createdAt", endDate.toISOString())
    .not("sentimentScore", "is", null);

  if (chatbotId) {
    messageQuery = messageQuery.eq("ConversationSession.chatbotId", chatbotId);
  }

  const messagesResult = await databaseService.executeQuery(
    async () => await messageQuery,
    "getSentimentTrends"
  );

  const messages = messagesResult as any[];

  return generateTimeSeriesData(messages, startDate, endDate, granularity, (data) => {
    if (data.length === 0) {
      return { average: 0, positive: 0, neutral: 0, negative: 0 };
    }

    const avgSentiment = data.reduce((sum: number, m: any) => sum + (m.sentimentScore || 0), 0) / data.length;
    const positive = data.filter((m: any) => (m.sentimentScore || 0) > 0.2).length;
    const negative = data.filter((m: any) => (m.sentimentScore || 0) < -0.2).length;
    const neutral = data.length - positive - negative;

    return {
      average: Math.round(avgSentiment * 100) / 100,
      positive: Math.round((positive / data.length) * 100),
      neutral: Math.round((neutral / data.length) * 100),
      negative: Math.round((negative / data.length) * 100)
    };
  });
}

async function getAutomationTrends(
  client: any,
  startDate: Date,
  endDate: Date,
  chatbotId: string | null,
  granularity: string
) {
  let workflowQuery = client
    .from("WorkflowExecution")
    .select("*")
    .gte("startedAt", startDate.toISOString())
    .lte("startedAt", endDate.toISOString());

  if (chatbotId) {
    workflowQuery = workflowQuery.eq("chatbotId", chatbotId);
  }

  const workflowsResult = await databaseService.executeQuery(
    async () => await workflowQuery,
    "getAutomationTrends"
  );

  const workflows = workflowsResult as any[];

  return generateTimeSeriesData(workflows, startDate, endDate, granularity, (data) => {
    const total = data.length;
    const successful = data.filter((w: any) => w.status === "COMPLETED").length;
    const failed = data.filter((w: any) => w.status === "FAILED").length;
    const pending = data.filter((w: any) => w.status === "PENDING" || w.status === "RUNNING").length;

    // Calculate average execution time for completed workflows
    const completedWorkflows = data.filter((w: any) => w.status === "COMPLETED" && w.completedAt);
    const avgExecutionTime = completedWorkflows.length > 0
      ? completedWorkflows.reduce((sum: number, w: any) => {
          const start = new Date(w.startedAt).getTime();
          const end = new Date(w.completedAt).getTime();
          return sum + (end - start);
        }, 0) / completedWorkflows.length
      : 0;

    return {
      total,
      successful,
      failed,
      pending,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      averageExecutionTime: Math.round(avgExecutionTime)
    };
  });
}

async function getResolutionTrends(
  client: any,
  startDate: Date,
  endDate: Date,
  chatbotId: string | null,
  granularity: string
) {
  // Get sessions that were resolved (became inactive) within the date range
  let sessionQuery = client
    .from("ConversationSession")
    .select("*")
    .gte("updatedAt", startDate.toISOString())
    .lte("updatedAt", endDate.toISOString())
    .eq("isActive", false);

  if (chatbotId) {
    sessionQuery = sessionQuery.eq("chatbotId", chatbotId);
  }

  const sessionsResult = await databaseService.executeQuery(
    async () => await sessionQuery,
    "getResolutionTrends"
  );

  const sessions = sessionsResult as any[];

  return generateTimeSeriesData(sessions, startDate, endDate, granularity, (data) => {
    const resolved = data.length;
    
    // Calculate average resolution time (time from creation to last update)
    const avgResolutionTime = data.length > 0
      ? data.reduce((sum: number, s: any) => {
          const start = new Date(s.createdAt).getTime();
          const end = new Date(s.updatedAt).getTime();
          return sum + (end - start);
        }, 0) / data.length
      : 0;

    return {
      resolved,
      averageResolutionTime: Math.round(avgResolutionTime / (1000 * 60)) // Convert to minutes
    };
  }, "updatedAt"); // Use updatedAt for resolution trends
}

function generateTimeSeriesData(
  data: any[],
  startDate: Date,
  endDate: Date,
  granularity: string,
  aggregator: (data: any[]) => any,
  dateField: string = "createdAt"
) {
  const intervals = generateTimeIntervals(startDate, endDate, granularity);
  
  return intervals.map(interval => {
    const intervalData = data.filter(item => {
      const itemDate = new Date(item[dateField]);
      return itemDate >= interval.start && itemDate < interval.end;
    });

    return {
      timestamp: interval.start.toISOString(),
      label: formatIntervalLabel(interval.start, granularity),
      ...aggregator(intervalData)
    };
  });
}

function generateTimeIntervals(startDate: Date, endDate: Date, granularity: string) {
  const intervals = [];
  
  if (granularity === "hourly") {
    let current = new Date(startDate);
    while (current < endDate) {
      const next = new Date(current);
      next.setHours(current.getHours() + 1);
      intervals.push({ start: new Date(current), end: next });
      current = next;
    }
  } else if (granularity === "daily") {
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
    dateRange.forEach(date => {
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      intervals.push({ start: dayStart, end: dayEnd });
    });
  } else if (granularity === "weekly") {
    let current = new Date(startDate);
    while (current < endDate) {
      const next = new Date(current);
      next.setDate(current.getDate() + 7);
      intervals.push({ start: new Date(current), end: next });
      current = next;
    }
  }
  
  return intervals;
}

function formatIntervalLabel(date: Date, granularity: string): string {
  if (granularity === "hourly") {
    return format(date, "MMM dd, HH:mm");
  } else if (granularity === "daily") {
    return format(date, "MMM dd");
  } else if (granularity === "weekly") {
    return format(date, "MMM dd");
  }
  return format(date, "MMM dd");
}