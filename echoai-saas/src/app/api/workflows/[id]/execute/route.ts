/**
 * Workflow Execution API Route
 * 
 * Handles execution of workflows based on trigger events
 */

import { NextRequest, NextResponse } from 'next/server';
import { workflowService } from '@/lib/workflow-service';
import type { TriggerEvent } from '@/lib/workflow-execution-engine';

// POST /api/workflows/[id]/execute - Execute workflow
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workflowId } = await params;
    const body = await request.json();
    
    // Validate required fields
    if (!body.triggerType || !body.userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: triggerType, userId'
        },
        { status: 400 }
      );
    }
    
    const triggerEvent: TriggerEvent = {
      type: body.triggerType,
      data: body.triggerData || {},
      conversationId: body.conversationId,
      messageId: body.messageId,
      userId: body.userId
    };
    
    const result = await workflowService.executeWorkflow(workflowId, triggerEvent);
    
    return NextResponse.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Error executing workflow:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute workflow'
      },
      { status: 500 }
    );
  }
}

// GET /api/workflows/[id]/execute - Get execution status
export async function GET(
  _request: NextRequest,
  { params: _params }: { params: Promise<{ id: string }> }
) {
  try {
    const activeExecutions = workflowService.getActiveExecutions();
    
    return NextResponse.json({
      success: true,
      data: {
        activeExecutions,
        count: activeExecutions.length
      }
    });
    
  } catch (error) {
    console.error('Error getting execution status:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get execution status'
      },
      { status: 500 }
    );
  }
}