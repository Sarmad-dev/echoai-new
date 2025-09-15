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

    // Get user's Google integration
    const { data: integration, error } = await supabase
      .from('Integration')
      .select('*')
      .eq('userId', session.user.id)
      .eq('provider', 'google')
      .eq('isActive', true)
      .single();

    if (error || !integration) {
      return NextResponse.json({ error: 'Google Sheets integration not found' }, { status: 404 });
    }

    try {
      // Get spreadsheets from Google Drive
      const driveResponse = await fetch(
        'https://www.googleapis.com/drive/v3/files?q=mimeType="application/vnd.google-apps.spreadsheet"&fields=files(id,name)',
        {
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`,
          },
        }
      );

      if (!driveResponse.ok) {
        throw new Error('Failed to fetch spreadsheets from Google Drive');
      }

      const driveData = await driveResponse.json();
      const spreadsheets = [];

      // Get sheet details for each spreadsheet
      for (const file of driveData.files.slice(0, 10)) { // Limit to 10 spreadsheets
        try {
          const sheetsResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${file.id}?fields=sheets(properties(sheetId,title))`,
            {
              headers: {
                'Authorization': `Bearer ${integration.accessToken}`,
              },
            }
          );

          if (sheetsResponse.ok) {
            const sheetsData = await sheetsResponse.json();
            spreadsheets.push({
              id: file.id,
              name: file.name,
              sheets: sheetsData.sheets?.map((sheet: any) => ({
                id: sheet.properties.sheetId.toString(),
                title: sheet.properties.title,
              })) || [],
            });
          }
        } catch (error) {
          console.error(`Error fetching sheets for ${file.name}:`, error);
          // Continue with other spreadsheets
        }
      }

      return NextResponse.json({
        spreadsheets,
      });
    } catch (error) {
      console.error('Error fetching Google Sheets:', error);
      return NextResponse.json(
        { error: 'Failed to fetch spreadsheets' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in Google Sheets API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}