import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messageId, conversationId, deliveredAt, clientInfo } = body;

    if (!messageId || !conversationId) {
      return NextResponse.json(
        { error: 'Missing required fields: messageId, conversationId' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Update message with delivery confirmation
    const { error: updateError } = await supabase
      .from('Message')
      .update({
        metadata: {
          deliveredAt,
          clientInfo,
          deliveryConfirmed: true,
        },
      })
      .eq('id', messageId)
      .eq('conversationId', conversationId);

    if (updateError) {
      console.error('❌ Failed to update message delivery status:', updateError);
      return NextResponse.json(
        { error: 'Failed to confirm delivery' },
        { status: 500 }
      );
    }

    console.log('✅ Message delivery confirmed:', { messageId, conversationId });

    return NextResponse.json({
      success: true,
      messageId,
      confirmedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error in delivery confirmation endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}