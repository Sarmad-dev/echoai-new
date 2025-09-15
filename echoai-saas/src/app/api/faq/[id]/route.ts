import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/supabase-server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { question, answer, category, displayOrder } = await request.json();

    if (!question || !answer) {
      return NextResponse.json(
        { error: 'Missing required fields: question, answer' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify FAQ exists
    const { data: existingFaq, error: faqError } = await supabase
      .from('FAQ')
      .select('id, chatbotId')
      .eq('id', id)
      .single();

    if (faqError || !existingFaq) {
      return NextResponse.json(
        { error: 'FAQ not found' },
        { status: 404 }
      );
    }

    // Update FAQ
    const { data: updatedFaq, error: updateError } = await supabase
      .from('FAQ')
      .update({
        question,
        answer,
        category: category || null,
        displayOrder: displayOrder || 0,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating FAQ:', updateError);
      return NextResponse.json(
        { error: 'Failed to update FAQ' },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedFaq);

  } catch (error) {
    console.error('Error in FAQ PUT:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = await createClient();

    // Verify FAQ exists
    const { data: existingFaq, error: faqError } = await supabase
      .from('FAQ')
      .select('id')
      .eq('id', id)
      .single();

    if (faqError || !existingFaq) {
      return NextResponse.json(
        { error: 'FAQ not found' },
        { status: 404 }
      );
    }

    // Delete FAQ
    const { error: deleteError } = await supabase
      .from('FAQ')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting FAQ:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete FAQ' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in FAQ DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}