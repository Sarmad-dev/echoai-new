import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/supabase-server';
import * as crypto from 'crypto';

// Token decryption function (copied from OAuth2Manager)
function decryptToken(encryptedText: string): string {
  const encryptionKey = process.env.INTEGRATION_ENCRYPTION_KEY || 'default-key-change-in-production'
  const algorithm = 'aes-256-cbc'
  const key = crypto.scryptSync(encryptionKey, 'salt', 32)
  const parts = encryptedText.split(':')

  if (parts.length === 2) {
    // New format: iv:encrypted
    const [ivHex, encrypted] = parts
    const iv = Buffer.from(ivHex, 'hex')
    const decipher = crypto.createDecipheriv(algorithm, key, iv)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } else if (parts.length === 3) {
    // Old GCM format: iv:authTag:encrypted - handle gracefully
    const [, , encrypted] = parts
    const decipher = crypto.createDecipher(algorithm, key)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } else {
    throw new Error('Invalid encrypted data format')
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const integrationId = searchParams.get('integrationId');

    const supabase = await createClient();

    let integration;
    let error;

    if (integrationId) {
      // Get specific integration
      const result = await supabase
        .from('Integration')
        .select('*')
        .eq('id', integrationId)
        .eq('userId', session.user.id)
        .eq('provider', 'slack')
        .single();
      
      integration = result.data;
      error = result.error;
    } else {
      // Get user's active Slack integration (backward compatibility)
      const result = await supabase
        .from('Integration')
        .select('*')
        .eq('userId', session.user.id)
        .eq('provider', 'slack')
        .eq('isActive', true)
        .single();
      
      integration = result.data;
      error = result.error;
    }

    if (error || !integration) {
      return NextResponse.json({ error: 'Slack integration not found' }, { status: 404 });
    }

    try {
      // Decrypt the integration tokens before using
      const decryptedIntegration = {
        ...integration,
        accessToken: decryptToken(integration.accessToken),
        refreshToken: integration.refreshToken ? decryptToken(integration.refreshToken) : undefined
      }

      const { SlackApiClient } = await import('@/lib/integrations/slack-client');
      const client = new SlackApiClient(decryptedIntegration);
      
      // Get users
      const users = await client.getUsers();
      
      // Format users for the UI (exclude bots and deleted users)
      const formattedUsers = users
        .filter(user => !user.deleted && !user.is_bot)
        .map(user => ({
          id: user.id,
          name: user.name,
          realName: user.real_name,
          email: user.profile.email,
          displayName: user.profile.display_name || user.real_name,
        }));

      return NextResponse.json({
        users: formattedUsers,
      });
    } catch (error) {
      console.error('Error fetching Slack users:', error);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in Slack users API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}