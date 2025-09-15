import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Check if user has a HubSpot integration
    const { data: integration, error } = await supabase
      .from('Integration')
      .select('*')
      .eq('userId', session.user.id)
      .eq('provider', 'hubspot')
      .eq('isActive', true)
      .single();

    if (error || !integration) {
      return NextResponse.json({ 
        connected: false,
        message: 'HubSpot integration not found'
      });
    }

    // Test the connection
    try {
      const { HubSpotApiClient } = await import('@/lib/integrations/hubspot-client');
      const client = new HubSpotApiClient(integration);
      const testResult = await client.testConnection();

      if (testResult.success) {
        return NextResponse.json({
          connected: true,
          portalId: testResult.portalId,
          accountId: testResult.accountId,
        });
      } else {
        return NextResponse.json({
          connected: false,
          error: testResult.error,
        });
      }
    } catch (error) {
      return NextResponse.json({
        connected: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      });
    }
  } catch (error) {
    console.error('Error checking HubSpot status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}