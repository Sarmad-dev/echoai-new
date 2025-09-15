import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withRoleProtection } from '@/lib/middleware/role-protection'
import { ConversationStatus } from '@/types/database'
import { createClient } from '@/lib/supabase/supabase-server'

// Request validation schema
const updateStatusSchema = z.object({
  status: z.enum(['AI_HANDLING', 'AWAITING_HUMAN_RESPONSE', 'RESOLVED']),
  assignedTo: z.string().optional().nullable()
})

interface UpdateStatusRequest {
  status: ConversationStatus
  assignedTo?: string | null
}

interface UpdateStatusResponse {
  success: boolean
  conversation: {
    id: string
    status: ConversationStatus
    assignedTo?: string | null
    updatedAt: string
  }
}

async function handleUpdateStatus(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
    const supabaseAdmin = await createClient()
  try {
    // Get user ID from headers (set by middleware)
    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const conversationId = params.id
    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = updateStatusSchema.parse(body) as UpdateStatusRequest

    // Verify conversation exists
    const { data: existingConversation, error: fetchError } = await supabaseAdmin
      .from('Conversation')
      .select('id, status, assignedTo')
      .eq('id', conversationId)
      .single()

    if (fetchError || !existingConversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: any = {
      status: validatedData.status,
      updatedAt: new Date().toISOString()
    }

    // Handle assignment logic based on status
    if (validatedData.status === ConversationStatus.AWAITING_HUMAN_RESPONSE) {
      // If taking over conversation, assign to current user if not explicitly specified
      updateData.assignedTo = validatedData.assignedTo !== undefined 
        ? validatedData.assignedTo 
        : userId
    } else if (validatedData.status === ConversationStatus.AI_HANDLING) {
      // If returning to AI, clear assignment
      updateData.assignedTo = null
    } else if (validatedData.status === ConversationStatus.RESOLVED) {
      // For resolved status, keep current assignment or use provided value
      if (validatedData.assignedTo !== undefined) {
        updateData.assignedTo = validatedData.assignedTo
      }
    }

    // Update conversation status and assignment
    const { data: updatedConversation, error: updateError } = await supabaseAdmin
      .from('Conversation')
      .update(updateData as any)
      .eq('id', conversationId)
      .select('id, status, assignedTo, updatedAt')
      .single()

    if (updateError || !updatedConversation) {
      console.error('Error updating conversation status:', updateError)
      return NextResponse.json(
        { error: 'Failed to update conversation status' },
        { status: 500 }
      )
    }

    // The status change will be automatically broadcast via Supabase Realtime
    // to all connected help desk clients

    const response: UpdateStatusResponse = {
      success: true,
      conversation: {
        id: (updatedConversation as any).id,
        status: (updatedConversation as any).status as ConversationStatus,
        assignedTo: (updatedConversation as any).assignedTo,
        updatedAt: (updatedConversation as any).updatedAt
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Update conversation status API error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Apply role protection middleware (staff/admin only)
export const PATCH = withRoleProtection(handleUpdateStatus, ['staff', 'admin'])

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  })
}