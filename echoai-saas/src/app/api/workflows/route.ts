/**
 * Workflow Management API Routes
 * 
 * Handles CRUD operations for automation workflows
 */

import { NextRequest, NextResponse } from 'next/server';
import { workflowService } from '@/lib/workflow-service';
import type { CreateWorkflowRequest, WorkflowListOptions } from '@/lib/workflow-service';

// GET /api/workflows - List workflows
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const options: WorkflowListOptions = {
      userId: searchParams.get('userId') || undefined,
      chatbotId: searchParams.get('chatbotId') || undefined,
      isActive: searchParams.get('isActive') ? searchParams.get('isActive') === 'true' : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
    };
    
    console.log('GET /api/workflows called with options:', options);
    
    const workflows = await workflowService.listWorkflows(options);
    
    console.log(`GET /api/workflows returning ${workflows.length} workflows`);
    
    return NextResponse.json({
      success: true,
      data: workflows,
      count: workflows.length
    });
    
  } catch (error) {
    console.error('Error listing workflows:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list workflows'
      },
      { status: 500 }
    );
  }
}

// POST /api/workflows - Create new workflow
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.flowDefinition || !body.userId || !body.chatbotId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: name, flowDefinition, userId, chatbotId'
        },
        { status: 400 }
      );
    }
    

    
    const createRequest: CreateWorkflowRequest = {
      name: body.name,
      description: body.description,
      flowDefinition: body.flowDefinition,
      userId: body.userId,
      chatbotId: body.chatbotId,
      isActive: body.isActive ?? true
    };
    
    const result = await workflowService.createWorkflow(createRequest);
    
    return NextResponse.json({
      success: true,
      data: {
        workflow: result.workflow,
        validation: result.validation
      }
    });
    
  } catch (error) {
    console.error('Error creating workflow:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create workflow'
      },
      { status: 500 }
    );
  }
}