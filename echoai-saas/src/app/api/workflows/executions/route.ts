import { NextRequest, NextResponse } from "next/server";
import { WorkflowExecutionEngine } from "@/lib/workflow-execution-engine";
import { databaseService } from "@/lib/supabase/database-service";
import { ExecutionStatus } from "@/types/database";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const workflowId = searchParams.get("workflowId");
    const chatbotId = searchParams.get("chatbotId");
    const status = searchParams.get("status") as ExecutionStatus | null;
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = (page - 1) * limit;

    // Get execution engine instance
    const executionEngine = new WorkflowExecutionEngine();

    // Get execution history with filters
    const result = await executionEngine.getExecutionHistory(
      workflowId || undefined,
      chatbotId || undefined,
      limit,
      offset
    );

    // Apply additional filters
    let filteredExecutions = result.executions;

    if (status) {
      filteredExecutions = filteredExecutions.filter(
        (exec) => exec.status === status
      );
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filteredExecutions = filteredExecutions.filter(
        (exec) =>
          exec.id.toLowerCase().includes(searchLower) ||
          exec.triggerId.toLowerCase().includes(searchLower)
      );
    }

    // Enhance executions with workflow and chatbot names
    const enhancedExecutions = await Promise.all(
      filteredExecutions.map(async (execution) => {
        try {
          // Get workflow name
          const client = databaseService.getClient();
          const workflowResult = await databaseService.executeOptionalQuery(
            async () => {
              return await client
                .from("AutomationWorkflow")
                .select("name")
                .eq("id", execution.workflowId)
                .single();
            },
            "getWorkflowName"
          );

          // Get chatbot name
          const chatbotResult = await databaseService.executeOptionalQuery(
            async () => {
              return await client
                .from("Chatbot")
                .select("name")
                .eq("id", execution.chatbotId)
                .single();
            },
            "getChatbotName"
          );

          // Calculate duration if completed
          let duration: number | undefined;
          if (execution.completedAt) {
            duration =
              execution.completedAt.getTime() - execution.startedAt.getTime();
          }

          return {
            ...execution,
            workflowName: (workflowResult as any)?.name || "Unknown Workflow",
            chatbotName: (chatbotResult as any)?.name || "Unknown Chatbot",
            duration,
          };
        } catch (error) {
          console.error(`Error enhancing execution ${execution.id}:`, error);
          return {
            ...execution,
            workflowName: "Unknown Workflow",
            chatbotName: "Unknown Chatbot",
            duration: undefined,
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        executions: enhancedExecutions,
        total: result.total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching execution history:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch execution history",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const executionId = searchParams.get("executionId");

    if (!executionId) {
      return NextResponse.json(
        {
          success: false,
          error: "Execution ID is required",
        },
        { status: 400 }
      );
    }

    // Stop the execution if it's running
    const executionEngine = new WorkflowExecutionEngine();
    const stopped = await executionEngine.stopExecution(executionId);

    if (!stopped) {
      return NextResponse.json(
        {
          success: false,
          error: "Execution not found or already completed",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Execution stopped successfully",
    });
  } catch (error) {
    console.error("Error stopping execution:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to stop execution",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
