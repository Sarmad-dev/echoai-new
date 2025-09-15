import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/database'
import { headers } from 'next/headers'

// Get a specific chatbot
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const headersList = await headers()
    const userId = headersList.get('x-user-id')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 })
    }

    // Get chatbot
    const { data: chatbot, error: chatbotError } = await supabaseAdmin
      .from('Chatbot')
      .select('*')
      .eq('id', id)
      .eq('userId', userId)
      .single()

    if (chatbotError || !chatbot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
    }

    // Get document count
    const { count: documentCount } = await supabaseAdmin
      .from('Document')
      .select('*', { count: 'exact', head: true })
      .eq('chatbotId', id)

    // Get conversation count
    const { count: conversationCount } = await supabaseAdmin
      .from('Conversation')
      .select('*', { count: 'exact', head: true })
      .eq('chatbotId', id)

    const chatbotWithCounts = {
      ...(chatbot as any),
      _count: {
        documents: documentCount || 0,
        conversations: conversationCount || 0
      }
    }

    return NextResponse.json(chatbotWithCounts)
  } catch (error) {
    console.error('Error fetching chatbot:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Update a chatbot
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const headersList = await headers()
    const userId = headersList.get('x-user-id')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 })
    }

    const body = await request.json()
    const { name, welcomeMessage, primaryColor, isActive } = body

    // Build update object
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (welcomeMessage !== undefined) updateData.welcomeMessage = welcomeMessage
    if (primaryColor !== undefined) updateData.primaryColor = primaryColor
    if (isActive !== undefined) updateData.isActive = isActive

    // Update chatbot
    const { data: updatedChatbot, error: updateError } = await (supabaseAdmin as any)
      .from('Chatbot')
      .update(updateData)
      .eq('id', id)
      .eq('userId', userId)
      .select('*')
      .single()

    if (updateError || !updatedChatbot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
    }

    // Get document count
    const { count: documentCount } = await supabaseAdmin
      .from('Document')
      .select('*', { count: 'exact', head: true })
      .eq('chatbotId', id)

    // Get conversation count
    const { count: conversationCount } = await supabaseAdmin
      .from('Conversation')
      .select('*', { count: 'exact', head: true })
      .eq('chatbotId', id)

    const chatbotWithCounts = {
      ...(updatedChatbot as any),
      _count: {
        documents: documentCount || 0,
        conversations: conversationCount || 0
      }
    }

    return NextResponse.json(chatbotWithCounts)
  } catch (error) {
    console.error('Error updating chatbot:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Delete a chatbot
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const headersList = await headers()
    const userId = headersList.get('x-user-id')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 })
    }

    // First, delete all related documents
    await supabaseAdmin
      .from('Document')
      .delete()
      .eq('chatbotId', id)

    // Then delete all related conversations and messages
    const { data: conversations } = await supabaseAdmin
      .from('Conversation')
      .select('id')
      .eq('chatbotId', id)

    if (conversations && conversations.length > 0) {
      const conversationIds = conversations.map((conv: any) => conv.id)
      
      // Delete messages first
      await supabaseAdmin
        .from('Message')
        .delete()
        .in('conversationId', conversationIds)

      // Then delete conversations
      await supabaseAdmin
        .from('Conversation')
        .delete()
        .eq('chatbotId', id)
    }

    // Finally, delete the chatbot
    const { error: deleteError } = await supabaseAdmin
      .from('Chatbot')
      .delete()
      .eq('id', id)
      .eq('userId', userId)

    if (deleteError) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting chatbot:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}