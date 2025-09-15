/**
 * Workflow Validation API Route
 * 
 * Validates workflow definitions without saving them
 */

import { NextRequest, NextResponse } from 'next/server';
import { workflowService } from '@/lib/workflow-service';

// POST /api/workflows/validate - Validate workflow definition
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.flowDefinition) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: flowDefinition'
        },
        { status: 400 }
      );
    }
    
    const validation = workflowService.validateWorkflow(body.flowDefinition);
    
    return NextResponse.json({
      success: true,
      data: validation
    });
    
  } catch (error) {
    console.error('Error validating workflow:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate workflow'
      },
      { status: 500 }
    );
  }
}