import { NextRequest, NextResponse } from "next/server";
import { analyticsService } from "@/lib/analytics/analytics-service";
import { subDays, startOfDay, endOfDay } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const chatbotId = searchParams.get("chatbotId");
    const userId = searchParams.get("userId");
    const workflowId = searchParams.get("workflowId");
    const timeRange = searchParams.get("timeRange") || "30d";
    
    // Calculate date range
    const days = timeRange === "7d" ? 7 : timeRange === "90d" ? 90 : 30;
    const startDate = startOfDay(subDays(new Date(), days));
    const endDate = endOfDay(new Date());

    // Get workflow analytics
    const workflowAnalytics = await analyticsService.getWorkflowAnalytics({
      chatbotId: chatbotId || undefined,
      userId: userId || undefined,
      workflowId: workflowId || undefined,
      dateRange: { start: startDate, end: endDate }
    });

    // Calculate performance insights
    const performanceInsights = calculatePerformanceInsights(workflowAnalytics);

    return NextResponse.json({
      success: true,
      data: {
        workflows: workflowAnalytics,
        insights: performanceInsights
      },
      filters: {
        chatbotId,
        userId,
        workflowId,
        timeRange,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      }
    });
  } catch (error) {
    console.error("Error fetching workflow performance analytics:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch workflow performance analytics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function calculatePerformanceInsights(workflowAnalytics: any[]) {
  if (workflowAnalytics.length === 0) {
    return {
      totalWorkflows: 0,
      averageSuccessRate: 0,
      averageExecutionTime: 0,
      mostActiveWorkflow: null,
      bestPerformingWorkflow: null,
      slowestWorkflow: null,
      recommendations: []
    };
  }

  const totalWorkflows = workflowAnalytics.length;
  const totalExecutions = workflowAnalytics.reduce((sum, w) => sum + w.executionCount, 0);
  
  // Calculate average success rate weighted by execution count
  const weightedSuccessRate = workflowAnalytics.reduce((sum, w) => {
    return sum + (w.successRate * w.executionCount);
  }, 0);
  const averageSuccessRate = totalExecutions > 0 ? weightedSuccessRate / totalExecutions : 0;

  // Calculate average execution time weighted by execution count
  const weightedExecutionTime = workflowAnalytics.reduce((sum, w) => {
    return sum + (w.averageExecutionTime * w.executionCount);
  }, 0);
  const averageExecutionTime = totalExecutions > 0 ? weightedExecutionTime / totalExecutions : 0;

  // Find most active workflow
  const mostActiveWorkflow = workflowAnalytics.reduce((max, w) => 
    w.executionCount > max.executionCount ? w : max
  );

  // Find best performing workflow (highest success rate with meaningful execution count)
  const meaningfulWorkflows = workflowAnalytics.filter(w => w.executionCount >= 5);
  const bestPerformingWorkflow = meaningfulWorkflows.length > 0
    ? meaningfulWorkflows.reduce((max, w) => w.successRate > max.successRate ? w : max)
    : null;

  // Find slowest workflow (highest execution time with meaningful execution count)
  const slowestWorkflow = meaningfulWorkflows.length > 0
    ? meaningfulWorkflows.reduce((max, w) => w.averageExecutionTime > max.averageExecutionTime ? w : max)
    : null;

  // Generate recommendations
  const recommendations = [];
  
  if (averageSuccessRate < 80) {
    recommendations.push("Overall workflow success rate is below 80%. Consider reviewing failed executions and optimizing workflow logic.");
  }

  if (averageExecutionTime > 30000) { // 30 seconds
    recommendations.push("Average execution time is high. Consider optimizing slow workflows or breaking them into smaller steps.");
  }

  const lowPerformanceWorkflows = workflowAnalytics.filter(w => w.successRate < 70 && w.executionCount >= 3);
  if (lowPerformanceWorkflows.length > 0) {
    recommendations.push(`${lowPerformanceWorkflows.length} workflow(s) have success rates below 70%. Review error logs and improve reliability.`);
  }

  const inactiveWorkflows = workflowAnalytics.filter(w => w.executionCount === 0);
  if (inactiveWorkflows.length > 0) {
    recommendations.push(`${inactiveWorkflows.length} workflow(s) have not been executed. Consider reviewing trigger conditions or removing unused workflows.`);
  }

  return {
    totalWorkflows,
    totalExecutions,
    averageSuccessRate: Math.round(averageSuccessRate * 100) / 100,
    averageExecutionTime: Math.round(averageExecutionTime),
    mostActiveWorkflow,
    bestPerformingWorkflow,
    slowestWorkflow,
    recommendations
  };
}