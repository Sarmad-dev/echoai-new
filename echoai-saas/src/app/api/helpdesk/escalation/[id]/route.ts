/**
 * Escalation Trigger Configuration API Endpoints - Individual Configuration
 * 
 * Provides REST API for managing individual escalation trigger configurations.
 * 
 * Requirements: 6.1, 6.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/supabase-server';
import { escalationTriggerSystem } from '@/lib/automation/escalation-triggers';

/**
 * PATCH /api/helpdesk/escalation/[id]
 * Update escalation trigger configuration
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

    const configId = id;
    const updates = await request.json();

    const configManager = escalationTriggerSystem['configManager'];
    const updatedConfig = await configManager.updateConfiguration(configId, updates);

    if (!updatedConfig) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      configuration: updatedConfig 
    });
  } catch (error) {
    console.error('Error in PATCH /api/helpdesk/escalation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/helpdesk/escalation/[id]
 * Delete escalation trigger configuration
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

    const configId = id;

    const configManager = escalationTriggerSystem['configManager'];
    const success = await configManager.deleteConfiguration(configId);

    if (!success) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/helpdesk/escalation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}