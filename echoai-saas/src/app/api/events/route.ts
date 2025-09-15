/**
 * Event Reception API Route
 * 
 * Receives events from FastAPI service and processes them through the workflow pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { EventProcessingPipeline } from '@/lib/event-processing-pipeline';
import { headers } from 'next/headers';

// Initialize the event processing pipeline
const eventPipeline = new EventProcessingPipeline();

// POST /api/events - Receive events from FastAPI
export async function POST(request: NextRequest) {
  try {
    // Validate authentication
    const authResult = await validateEventAuthentication(request);
    if (!authResult.valid) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error
        },
        { status: 401 }
      );
    }

    // Parse event data
    const eventData = await request.json();
    
    // Validate event structure
    const validationResult = validateEventStructure(eventData);
    if (!validationResult.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validationResult.error
        },
        { status: 400 }
      );
    }

    // Process the event through the pipeline
    await eventPipeline.receiveEvent(eventData);
    
    return NextResponse.json({
      success: true,
      message: 'Event processed successfully',
      eventId: eventData.data?.conversation_id || 'unknown'
    });
    
  } catch (error) {
    console.error('Error processing event:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process event'
      },
      { status: 500 }
    );
  }
}

// GET /api/events/health - Health check for event service
export async function GET() {
  try {
    const status = await eventPipeline.getHealthStatus();
    
    return NextResponse.json({
      success: true,
      status: 'healthy',
      pipeline: status
    });
    
  } catch (error) {
    console.error('Error checking event service health:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Event service health check failed'
      },
      { status: 500 }
    );
  }
}

/**
 * Validates authentication for incoming events
 */
async function validateEventAuthentication(request: NextRequest): Promise<{
  valid: boolean;
  error?: string;
}> {
  try {
    const headersList = await headers();
    
    // Check for API key in headers
    const apiKey = headersList.get('x-api-key') || request.headers.get('x-api-key');
    const expectedApiKey = process.env.FASTAPI_EVENT_API_KEY;
    
    if (!expectedApiKey) {
      console.warn('FASTAPI_EVENT_API_KEY not configured - allowing all requests in development');
      return { valid: true };
    }
    
    if (!apiKey) {
      return {
        valid: false,
        error: 'Missing API key in x-api-key header'
      };
    }
    
    if (apiKey !== expectedApiKey) {
      return {
        valid: false,
        error: 'Invalid API key'
      };
    }
    
    return { valid: true };
    
  } catch (error) {
    console.error('Error validating event authentication:', error);
    return {
      valid: false,
      error: 'Authentication validation failed'
    };
  }
}

/**
 * Validates the structure of incoming event data
 */
function validateEventStructure(eventData: unknown): {
  valid: boolean;
  error?: string;
} {
  try {
    // Type guard to ensure eventData is an object
    if (!eventData || typeof eventData !== 'object') {
      return {
        valid: false,
        error: 'Event data must be an object'
      };
    }

    const data = eventData as Record<string, unknown>;

    // Check required fields
    if (!data.name) {
      return {
        valid: false,
        error: 'Missing required field: name'
      };
    }
    
    if (!data.data || typeof data.data !== 'object') {
      return {
        valid: false,
        error: 'Missing required field: data'
      };
    }

    const eventDataObj = data.data as Record<string, unknown>;
    
    if (!eventDataObj.user_id) {
      return {
        valid: false,
        error: 'Missing required field: data.user_id'
      };
    }
    
    // Validate event name format
    const validEventNames = [
      'conversation.started',
      'message.created',
      'sentiment.trigger',
      'intent.detected',
      'image.uploaded'
    ];
    
    if (!validEventNames.includes(data.name as string)) {
      return {
        valid: false,
        error: `Invalid event name: ${data.name}. Must be one of: ${validEventNames.join(', ')}`
      };
    }
    
    return { valid: true };
    
  } catch {
    return {
      valid: false,
      error: 'Invalid event data structure'
    };
  }
}