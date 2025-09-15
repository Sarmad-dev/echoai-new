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

    // Get user's HubSpot integration
    const { data: integration, error } = await supabase
      .from('Integration')
      .select('*')
      .eq('userId', session.user.id)
      .eq('provider', 'hubspot')
      .eq('isActive', true)
      .single();

    if (error || !integration) {
      return NextResponse.json({ error: 'HubSpot integration not found' }, { status: 404 });
    }

    try {
      const { HubSpotApiClient } = await import('@/lib/integrations/hubspot-client');
      const client = new HubSpotApiClient(integration);
      
      // Get contact properties
      const properties = await client.getContactProperties();
      
      // Filter and format properties for the UI
      const formattedProperties = properties
        .filter(prop => !prop.name.startsWith('hs_') || ['hs_lead_status'].includes(prop.name))
        .map(prop => ({
          name: prop.name,
          label: prop.label,
          type: prop.type,
          fieldType: prop.fieldType,
          description: prop.description,
          options: prop.options,
        }));

      return NextResponse.json({
        properties: formattedProperties,
      });
    } catch (error) {
      console.error('Error fetching HubSpot contact properties:', error);
      return NextResponse.json(
        { error: 'Failed to fetch contact properties' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in HubSpot contact properties API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}