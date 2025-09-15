/**
 * Escalation Trigger API Endpoints
 * 
 * Provides REST API for managing escalation triggers and processing escalation events.
 * 
 * Requirements: 6.1, 6.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/supabase-server';
import { escalationTriggerSystem } from '@/lib/automation/escalation-triggers';
import { conversationStatusUpdater } from '@/lib/automation/conversation-status-updater';
import { ConversationStatus } from '@/types/database';

/**
 * GET /api/helpdesk/escalation
 * Get escalation configurations and analytics
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

    if (type === 'analytics') {
      // Get escalation analytics
      const analytics = await escalationTriggerSystem.getEscalationAnalytics();
      return NextResponse.json({ analytics });
    } else {
      // Get escalation configurations
      const configManager = escalationTriggerSystem['configManager'];
      const configurations = await configManager.getActiveConfigurations();
      return NextResponse.json({ configurations });
    }
  } catch (error) {
    console.error('Error in GET /api/helpdesk/escalation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/helpdesk/escalation
 * Create new escalation trigger configuration or process escalation event
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

    if (action === 'process_message') {
      // Process a message for escalation triggers
      const { conversationId, messageId, messageContent, sentimentScore } = data;

      if (!conversationId || !messageId || !messageContent) {
        return NextResponse.json(
          { error: 'Missing required fields: conversationId, messageId, messageContent' },
          { status: 400 }
        );
      }

      const results = await escalationTriggerSystem.processMessage(
        conversationId,
        messageId,
        messageContent,
        sentimentScore
      );

      return NextResponse.json({ 
        success: true, 
        escalationResults: results,
        escalated: results.some(r => r.success)
      });
    } else if (action === 'create_config') {
      // Create new escalation configuration
      const configManager = escalationTriggerSystem['configManager'];
      const newConfig = await configManager.createConfiguration(data);
      
      return NextResponse.json({ 
        success: true, 
        configuration: newConfig 
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "process_message" or "create_config"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error in POST /api/helpdesk/escalation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}