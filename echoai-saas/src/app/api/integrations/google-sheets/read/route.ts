import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsApiClient } from '@/lib/integrations/google-sheets-client';
import { OAuth2Manager } from '@/lib/integrations/oauth2-manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { integrationId, spreadsheetId, range, includeHeaders = false } = body;

    if (!integrationId) {
      return NextResponse.json(
        { error: 'Integration ID is required' },
        { status: 400 }
      );
    }

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Spreadsheet ID is required' },
        { status: 400 }
      );
    }

    if (!range) {
      return NextResponse.json(
        { error: 'Range is required' },
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

    if (integration.provider !== 'google') {
      return NextResponse.json(
        { error: 'Invalid integration provider' },
        { status: 400 }
      );
    }

    const client = new GoogleSheetsApiClient(integration);
    
    let data;
    if (includeHeaders) {
      data = await client.readWithHeaders(spreadsheetId, range);
    } else {
      const result = await client.readRange(spreadsheetId, range);
      data = result?.values || [];
    }

    return NextResponse.json({
      success: true,
      data,
      range,
      rowCount: Array.isArray(data) ? data.length : 0,
      hasHeaders: includeHeaders,
    });
  } catch (error) {
    console.error('Error reading from Google Sheets:', error);
    return NextResponse.json(
      { 
        error: 'Failed to read from Google Sheets',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}