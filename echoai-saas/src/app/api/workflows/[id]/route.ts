/**
 * Individual Workflow API Routes
 *
 * Handles operations on specific workflows by ID
 */

import { NextRequest, NextResponse } from "next/server";
import { workflowService } from "@/lib/workflow-service";
import type { UpdateWorkflowRequest } from "@/lib/workflow-service";

// GET /api/workflows/[id] - Get workflow by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workflowId } = await params;

    const workflow = await workflowService.getWorkflow(workflowId);

    if (!workflow) {
      return NextResponse.json(
        {
          success: false,
          error: "Workflow not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    console.error("Error getting workflow:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get workflow",
      },
      { status: 500 }
    );
  }
}

// PUT /api/workflows/[id] - Update workflow
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workflowId } = await params;
    const body = await request.json();

    const updateRequest: UpdateWorkflowRequest = {
      name: body.name,
      description: body.description,
      flowDefinition: body.flowDefinition,
      isActive: body.isActive,
    };

    const result = await workflowService.updateWorkflow(
      workflowId,
      updateRequest
    );

    return NextResponse.json({
      success: true,
      data: {
        workflow: result.workflow,
        validation: result.validation,
      },
    });
  } catch (error) {
    console.error("Error updating workflow:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update workflow",
      },
      { status: 500 }
    );
  }
}

// PATCH /api/workflows/[id] - Partially update workflow
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workflowId } = await params;
    const body = await request.json();

    // Only include fields that are actually provided in the request
    const updateRequest: UpdateWorkflowRequest = {};
    
    if (body.name !== undefined) {
      updateRequest.name = body.name;
    }
    
    if (body.description !== undefined) {
      updateRequest.description = body.description;
    }
    
    if (body.flowDefinition !== undefined) {
      updateRequest.flowDefinition = body.flowDefinition;
    }
    
    if (body.isActive !== undefined) {
      updateRequest.isActive = body.isActive;
    }

    // Ensure at least one field is being updated
    if (Object.keys(updateRequest).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "At least one field must be provided for update",
        },
        { status: 400 }
      );
    }

    const result = await workflowService.updateWorkflow(
      workflowId,
      updateRequest
    );

    return NextResponse.json({
      success: true,
      data: {
        workflow: result.workflow,
        validation: result.validation,
      },
    });
  } catch (error) {
    console.error("Error updating workflow:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update workflow",
      },
      { status: 500 }
    );
  }
}

// DELETE /api/workflows/[id] - Delete workflow
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workflowId } = await params;

    const deleted = await workflowService.deleteWorkflow(workflowId);

    if (!deleted) {
      return NextResponse.json(
        {
          success: false,
          error: "Workflow not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Workflow deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting workflow:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete workflow",
      },
      { status: 500 }
    );
  }
}
