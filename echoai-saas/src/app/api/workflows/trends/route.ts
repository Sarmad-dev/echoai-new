import { NextRequest, NextResponse } from "next/server";
import { databaseService } from "@/lib/supabase/database-service";
import { ExecutionStatus } from "@/types/database";
import { subDays, startOfDay, endOfDay, format, eachDayOfInterval } from "date-fns";

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
        status,
        startedAt,
        completedAt
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
      "getExecutionTrends"
    );

    const executions = executionsResult as Array<{
      id: string;
      workflowId: string;
      chatbotId: string;
      status: ExecutionStatus;
      startedAt: string;
      completedAt?: string;
    }>;

    // Generate all dates in the range
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

    // Group executions by date
    const dailyData = dateRange.map(date => {
      const dateStr = format(date, "yyyy-MM-dd");
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);

      // Filter executions for this day
      const dayExecutions = executions.filter(execution => {
        const executionDate = new Date(execution.startedAt);
        return executionDate >= dayStart && executionDate <= dayEnd;
      });

      const totalExecutions = dayExecutions.length;
      const successful = dayExecutions.filter(e => e.status === ExecutionStatus.COMPLETED).length;
      const failed = dayExecutions.filter(e => e.status === ExecutionStatus.FAILED).length;

      // Calculate average execution time for completed executions on this day
      const completedExecutions = dayExecutions.filter(e => e.completedAt);
      const totalExecutionTime = completedExecutions.reduce((sum, execution) => {
        const startTime = new Date(execution.startedAt).getTime();
        const endTime = new Date(execution.completedAt!).getTime();
        return sum + (endTime - startTime);
      }, 0);

      const averageTime = completedExecutions.length > 0 
        ? totalExecutionTime / completedExecutions.length 
        : 0;

      return {
        date: dateStr,
        executions: totalExecutions,
        successful,
        failed,
        averageTime,
      };
    });

    return NextResponse.json({
      success: true,
      data: dailyData,
    });
  } catch (error) {
    console.error("Error fetching execution trends:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch execution trends",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}