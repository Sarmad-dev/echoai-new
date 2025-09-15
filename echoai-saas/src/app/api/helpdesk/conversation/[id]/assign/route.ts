import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withRoleProtection } from '@/lib/middleware/role-protection'
import { createClient } from '@/lib/supabase/supabase-server'

// Request validation schema
const assignConversationSchema = z.object({
  assignedTo: z.string().nullable().optional()
})

interface AssignConversationRequest {
  assignedTo?: string | null
}

interface AssignConversationResponse {
  success: boolean
  conversation: {
    id: string
    assignedTo?: string | null
    updatedAt: string
  }
}

async function handleAssignConversation(
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
    const validatedData = assignConversationSchema.parse(body) as AssignConversationRequest

    // Verify conversation exists
    const { data: existingConversation, error: fetchError } = await supabaseAdmin
      .from('Conversation')
      .select('id, assignedTo, status')
      .eq('id', conversationId)
      .single()

    if (fetchError || !existingConversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // If assignedTo is not provided, assign to current user
    const assignedTo = validatedData.assignedTo !== undefined 
      ? validatedData.assignedTo 
      : userId

    // Update conversation assignment
    const { data: updatedConversation, error: updateError } = await supabaseAdmin
      .from('Conversation')
      .update({
        assignedTo: assignedTo,
        updatedAt: new Date().toISOString()
      } as any)
      .eq('id', conversationId)
      .select('id, assignedTo, updatedAt')
      .single()

    if (updateError || !updatedConversation) {
      console.error('Error updating conversation assignment:', updateError)
      return NextResponse.json(
        { error: 'Failed to assign conversation' },
        { status: 500 }
      )
    }

    // The assignment change will be automatically broadcast via Supabase Realtime
    // to all connected help desk clients

    const response: AssignConversationResponse = {
      success: true,
      conversation: {
        id: (updatedConversation as any).id,
        assignedTo: (updatedConversation as any).assignedTo,
        updatedAt: (updatedConversation as any).updatedAt
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Assign conversation API error:', error)

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
export const PATCH = withRoleProtection(handleAssignConversation, ['staff', 'admin'])

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