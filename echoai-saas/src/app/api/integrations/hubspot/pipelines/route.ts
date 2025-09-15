import { NextRequest, NextResponse } from 'next/server';
import { HubSpotApiClient } from '@/lib/integrations/hubspot-client';
import { OAuth2Manager } from '@/lib/integrations/oauth2-manager';

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

    if (integration.provider !== 'hubspot') {
      return NextResponse.json(
        { error: 'Integration is not for HubSpot' },
        { status: 400 }
      );
    }

    const client = new HubSpotApiClient(integration);

    // Fetch deal pipelines
    const pipelines = await client.getDealPipelines();

    return NextResponse.json({
      pipelines,
    });
  } catch (error) {
    console.error('Error fetching HubSpot pipelines:', error);
    return NextResponse.json(
      { error: 'Failed to fetch HubSpot pipelines' },
      { status: 500 }
    );
  }
}