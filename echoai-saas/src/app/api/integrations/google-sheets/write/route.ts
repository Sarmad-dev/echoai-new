import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsApiClient } from '@/lib/integrations/google-sheets-client';
import { OAuth2Manager } from '@/lib/integrations/oauth2-manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      integrationId, 
      spreadsheetId, 
      range, 
      values, 
      writeMode = 'append',
      valueInputOption = 'USER_ENTERED'
    } = body;

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

    if (!values || !Array.isArray(values)) {
      return NextResponse.json(
        { error: 'Values array is required' },
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
    
    let result;
    
    switch (writeMode) {
      case 'append':
        if (!range) {
          return NextResponse.json(
            { error: 'Range is required for append mode' },
            { status: 400 }
          );
        }
        result = await client.appendToSheet(spreadsheetId, range, values, valueInputOption);
        break;
        
      case 'update':
      case 'overwrite':
        if (!range) {
          return NextResponse.json(
            { error: 'Range is required for update/overwrite mode' },
            { status: 400 }
          );
        }
        result = await client.writeRange(spreadsheetId, range, values, valueInputOption);
        break;
        
      default:
        return NextResponse.json(
          { error: `Invalid write mode: ${writeMode}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      writeMode,
      rowsWritten: values.length,
      range: 'tableRange' in result ? result.tableRange : range,
      updatedCells: 'updates' in result ? result.updates.updatedCells : result.updatedCells,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    });
  } catch (error) {
    console.error('Error writing to Google Sheets:', error);
    return NextResponse.json(
      { 
        error: 'Failed to write to Google Sheets',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}