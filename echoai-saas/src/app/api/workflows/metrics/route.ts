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

    // Build base query for workflow executions
    let executionsQuery = client
      .from("WorkflowExecution")
      .select(
        `
        id,
        workflowId,
        chatbotId,
        status,
        startedAt,
        completedAt,
        workflow:AutomationWorkflow(name),
        chatbot:Chatbot(name)
      `
      )
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
      "getExecutionMetrics"
    );

    const executions = executionsResult as Array<{
      id: string;
      workflowId: string;
      chatbotId: string;
      status: ExecutionStatus;
      startedAt: string;
      completedAt?: string;
      workflow: { name: string };
      chatbot: { name: string };
    }>;

    // Group executions by workflow
    const workflowGroups = executions.reduce((acc, execution) => {
      const key = execution.workflowId;
      if (!acc[key]) {
        acc[key] = {
          workflowId: execution.workflowId,
          workflowName: execution.workflow.name,
          executions: [],
        };
      }
      acc[key].executions.push(execution);
      return acc;
    }, {} as Record<string, { workflowId: string; workflowName: string; executions: typeof executions }>);

    // Calculate metrics for each workflow
    const workflowMetrics = Object.values(workflowGroups).map((group) => {
      const totalExecutions = group.executions.length;
      const successfulExecutions = group.executions.filter(
        (e) => e.status === ExecutionStatus.COMPLETED
      ).length;
      const failedExecutions = group.executions.filter(
        (e) => e.status === ExecutionStatus.FAILED
      ).length;

      // Calculate average execution time for completed executions
      const completedExecutions = group.executions.filter((e) => e.completedAt);
      const totalExecutionTime = completedExecutions.reduce(
        (sum, execution) => {
          const startTime = new Date(execution.startedAt).getTime();
          const endTime = new Date(execution.completedAt!).getTime();
          return sum + (endTime - startTime);
        },
        0
      );

      const averageExecutionTime =
        completedExecutions.length > 0
          ? totalExecutionTime / completedExecutions.length
          : 0;

      const successRate =
        totalExecutions > 0
          ? (successfulExecutions / totalExecutions) * 100
          : 0;

      // Calculate time-based metrics
      const now = new Date();
      const todayStart = startOfDay(now);
      const weekStart = subDays(todayStart, 7);
      const monthStart = subDays(todayStart, 30);

      const executionsToday = group.executions.filter(
        (e) => new Date(e.startedAt) >= todayStart
      ).length;

      const executionsThisWeek = group.executions.filter(
        (e) => new Date(e.startedAt) >= weekStart
      ).length;

      const executionsThisMonth = group.executions.filter(
        (e) => new Date(e.startedAt) >= monthStart
      ).length;

      // Find last execution
      const lastExecution = group.executions.sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      )[0];

      return {
        workflowId: group.workflowId,
        workflowName: group.workflowName,
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        averageExecutionTime,
        successRate,
        lastExecuted: lastExecution
          ? new Date(lastExecution.startedAt)
          : undefined,
        executionsToday,
        executionsThisWeek,
        executionsThisMonth,
      };
    });

    return NextResponse.json({
      success: true,
      data: workflowMetrics,
    });
  } catch (error) {
    console.error("Error fetching workflow metrics:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch workflow metrics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
