import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsApiClient } from '@/lib/integrations/google-sheets-client';
import { OAuth2Manager } from '@/lib/integrations/oauth2-manager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const integrationId = searchParams.get('integrationId');
    const spreadsheetId = searchParams.get('spreadsheetId');

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
    const spreadsheet = await client.getSpreadsheet(spreadsheetId);

    if (!spreadsheet) {
      return NextResponse.json(
        { error: 'Spreadsheet not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      sheets: spreadsheet.sheets,
      spreadsheetInfo: {
        id: spreadsheet.spreadsheetId,
        title: spreadsheet.properties.title,
        url: spreadsheet.spreadsheetUrl,
      },
    });
  } catch (error) {
    console.error('Error fetching Google Sheets sheets:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch sheets',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}