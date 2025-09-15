/**
 * Conversation Triage API Endpoints - Individual Rule
 * 
 * Provides REST API for managing individual triage rules.
 * 
 * Requirements: 6.3, 6.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/supabase-server';
import { conversationTriageEngine } from '@/lib/automation/conversation-triage';

/**
 * PATCH /api/helpdesk/triage/[id]
 * Update triage rule
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    
    // Get current user and verify role
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user role
    const { data: userData, error: userError } = await supabase
      .from('User')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData || !['staff', 'admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const ruleId = id;
    const updates = await request.json();

    const updatedRule = await conversationTriageEngine.updateTriageRule(ruleId, updates);

    if (!updatedRule) {
      return NextResponse.json(
        { error: 'Triage rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      rule: updatedRule 
    });
  } catch (error) {
    console.error('Error in PATCH /api/helpdesk/triage:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/helpdesk/triage/[id]
 * Delete triage rule
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    
    // Get current user and verify role
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user role
    const { data: userData, error: userError } = await supabase
      .from('User')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData || !['staff', 'admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const ruleId = id;

    const success = await conversationTriageEngine.deleteTriageRule(ruleId);

    if (!success) {
      return NextResponse.json(
        { error: 'Triage rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/helpdesk/triage:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}