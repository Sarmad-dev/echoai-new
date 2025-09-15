/**
 * Conversation Triage API Endpoints
 * 
 * Provides REST API for managing conversation triage rules, priority queue,
 * and automated escalation processing.
 * 
 * Requirements: 6.3, 6.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/supabase-server';
import { conversationTriageEngine } from '@/lib/automation/conversation-triage';

/**
 * GET /api/helpdesk/triage
 * Get triage rules, priority queue, or analytics
 */
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');

    if (type === 'rules') {
      // Get triage rules
      const rules = await conversationTriageEngine.getActiveTriageRules();
      return NextResponse.json({ rules });
    } else if (type === 'queue') {
      // Get priority queue
      const priority = searchParams.get('priority') as any;
      const assignedTo = searchParams.get('assignedTo') || undefined;
      const limit = parseInt(searchParams.get('limit') || '50');
      const offset = parseInt(searchParams.get('offset') || '0');

      const queue = await conversationTriageEngine.getPriorityQueue({
        priority,
        assignedTo,
        limit,
        offset
      });

      return NextResponse.json({ queue });
    } else if (type === 'analytics') {
      // Get triage analytics
      const timeframe = searchParams.get('timeframe') as 'day' | 'week' | 'month' || 'week';
      const analytics = await conversationTriageEngine.getTriageAnalytics(timeframe);
      return NextResponse.json({ analytics });
    } else {
      return NextResponse.json(
        { error: 'Invalid type. Use "rules", "queue", or "analytics"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error in GET /api/helpdesk/triage:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/helpdesk/triage
 * Create triage rule or evaluate conversation for triage
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'evaluate_conversation') {
      // Evaluate conversation for triage
      const { conversationId, messageContent, sentimentScore, metadata } = data;

      if (!conversationId) {
        return NextResponse.json(
          { error: 'Missing required field: conversationId' },
          { status: 400 }
        );
      }

      const results = await conversationTriageEngine.evaluateConversation(
        conversationId,
        messageContent,
        sentimentScore,
        metadata
      );

      return NextResponse.json({ 
        success: true, 
        triageResults: results,
        triaged: results.some(r => r.success)
      });
    } else if (action === 'create_rule') {
      // Create new triage rule
      const newRule = await conversationTriageEngine.createTriageRule(data);
      
      return NextResponse.json({ 
        success: true, 
        rule: newRule 
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "evaluate_conversation" or "create_rule"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error in POST /api/helpdesk/triage:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}