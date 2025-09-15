import { NextRequest, NextResponse } from "next/server";
import { databaseService } from "@/lib/supabase/database-service";
import { ExecutionStatus } from "@/types/database";
import { subDays, startOfDay, endOfDay } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const workflowId = searchParams.get("workflowId");
    const chatbotId = searchParams.get("chatbotId");
    const timeRange = searchParams.get("timeRange") || "30d";

    // Calculate date range
    const days = timeRange === "7d" ? 7 : timeRange === "90d" ? 90 : 30;
    const startDate = startOfDay(subDays(new Date(), days));
    const endDate = endOfDay(new Date());

    const client = databaseService.getClient();

    // Build query for workflow executions
    let executionsQuery = client
      .from("WorkflowExecution")
      .select(`
        id,
        workflowId,
        chatbotId,
        triggerId,
        status,
        startedAt
      `)
      .gte("startedAt", startDate.toISOString())
      .lte("startedAt", endDate.toISOString());

    if (workflowId) {
      executionsQuery = executionsQuery.eq("workflowId", workflowId);
    }

    if (chatbotId) {
      executionsQuery = executionsQuery.eq("chatbotId", chatbotId);
    }

    const executionsResult = await databaseService.executeQuery(
      async () => await executionsQuery,
      "getTriggerStats"
    );

    const executions = executionsResult as Array<{
      id: string;
      workflowId: string;
      chatbotId: string;
      triggerId: string;
      status: ExecutionStatus;
      startedAt: string;
    }>;

    // Group executions by trigger ID
    const triggerGroups = executions.reduce((acc, execution) => {
      const triggerId = execution.triggerId;
      if (!acc[triggerId]) {
        acc[triggerId] = {
          triggerId,
          executions: [],
        };
      }
      acc[triggerId].executions.push(execution);
      return acc;
    }, {} as Record<string, { triggerId: string; executions: typeof executions }>);

    // Calculate statistics for each trigger
    const triggerStats = Object.values(triggerGroups).map(group => {
      const totalExecutions = group.executions.length;
      const successfulExecutions = group.executions.filter(e => e.status === ExecutionStatus.COMPLETED).length;
      const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

      return {
        triggerId: group.triggerId,
        count: totalExecutions,
        successRate,
      };
    });

    // Sort by count (most frequent first)
    triggerStats.sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      data: triggerStats,
    });
  } catch (error) {
    console.error("Error fetching trigger statistics:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch trigger statistics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}