import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Manager } from '@/lib/integrations/oauth2-manager';
import { createClient } from '@/lib/supabase/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const { integrationId, config } = await request.json();

    if (!integrationId || !config) {
      return NextResponse.json(
        { error: 'Integration ID and config are required' },
        { status: 400 }
      );
    }

    const oauth2Manager = new OAuth2Manager();
    const integration = await oauth2Manager.getIntegrationById(integrationId);

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    // Update integration config in database
    const supabase = await createClient();
    const { error } = await supabase
      .from('Integration')
      .update({
        config: {
          ...integration.config,
          ...config,
          updatedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      })
      .eq('id', integrationId);

    if (error) {
      console.error('Error updating integration config:', error);
      return NextResponse.json(
        { error: 'Failed to update integration configuration' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving integration config:', error);
    return NextResponse.json(
      { error: 'Failed to save integration configuration' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const integrationId = searchParams.get('integrationId');

    if (!integrationId) {
      return NextResponse.json(
        { error: 'Integration ID is required' },
        { status: 400 }
      );
    }

    const oauth2Manager = new OAuth2Manager();
    const integration = await oauth2Manager.getIntegrationById(integrationId);

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      config: integration.config || {},
    });
  } catch (error) {
    console.error('Error fetching integration config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch integration configuration' },
      { status: 500 }
    );
  }
}