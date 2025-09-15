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

    // Check if user has a Google Sheets integration
    const { data: integration, error } = await supabase
      .from('Integration')
      .select('*')
      .eq('userId', session.user.id)
      .eq('provider', 'google')
      .eq('isActive', true)
      .single();

    if (error || !integration) {
      return NextResponse.json({ 
        connected: false,
        message: 'Google Sheets integration not found'
      });
    }

    // Test the connection by trying to access Google Drive API
    try {
      const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: {
          'Authorization': `Bearer ${integration.accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({
          connected: true,
          userEmail: data.user?.emailAddress,
        });
      } else {
        return NextResponse.json({
          connected: false,
          error: 'Failed to authenticate with Google',
        });
      }
    } catch (error) {
      return NextResponse.json({
        connected: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      });
    }
  } catch (error) {
    console.error('Error checking Google Sheets status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}