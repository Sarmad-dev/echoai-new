import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/supabase-server';

interface SlackIntegrationResponse {
  id: string;
  teamId: string;
  teamName: string;
  userId: string;
  userName: string;
  botId?: string;
  isActive: boolean;
  healthStatus: 'HEALTHY' | 'WARNING' | 'ERROR' | 'UNKNOWN';
  lastHealthCheck?: string;
  createdAt: string;
}

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use the user ID from the session for database queries
    const userId = session.user.id;

    const supabase = await createClient();

    // Get all Slack integrations for the user
    const { data: integrations, error } = await supabase
      .from('Integration')
      .select('*')
      .eq('userId', userId)
      .eq('provider', 'slack')
      .order('createdAt', { ascending: false });

    if (error) {
      console.error('Error fetching Slack integrations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch Slack integrations' },
        { status: 500 }
      );
    }

    // Transform integrations to include workspace information from config
    const slackIntegrations: SlackIntegrationResponse[] = integrations.map(integration => {
      const config = integration.config as any || {};
      
      // Handle date fields properly - they might be Date objects or ISO strings
      const formatDate = (dateValue: any): string | undefined => {
        if (!dateValue) return undefined;
        if (dateValue instanceof Date) return dateValue.toISOString();
        if (typeof dateValue === 'string') return dateValue;
        return undefined;
      };
      
      return {
        id: integration.id,
        teamId: config.teamId || 'unknown',
        teamName: config.teamName || 'Unknown Workspace',
        userId: config.userId || 'unknown',
        userName: config.userName || 'Unknown User',
        botId: config.botId,
        isActive: integration.isActive,
        healthStatus: integration.healthStatus,
        lastHealthCheck: formatDate(integration.lastHealthCheck),
        createdAt: formatDate(integration.createdAt) || new Date().toISOString()
      };
    });

    return NextResponse.json({
      integrations: slackIntegrations,
      count: slackIntegrations.length
    });
  } catch (error) {
    console.error('Error in Slack integrations endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}