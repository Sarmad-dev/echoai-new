import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/supabase-server';
import * as crypto from 'crypto';

interface SlackStatusResponse {
  connected: boolean;
  teamId?: string;
  teamName?: string;
  userId?: string;
  userName?: string;
  botId?: string;
  scopes?: string[];
  lastChecked?: string;
  error?: string;
  errorType?: 'auth_failed' | 'permission_denied' | 'rate_limited' | 'service_unavailable' | 'network_error' | 'unknown';
  retryAfter?: number;
}

// Error type mapping for user-friendly messages
const ERROR_MESSAGES = {
  auth_failed: 'Slack authentication has expired. Please reconnect your Slack account.',
  permission_denied: 'The Slack bot doesn\'t have permission to access this resource. Please check bot permissions.',
  rate_limited: 'Slack API rate limit reached. Please try again in a few minutes.',
  service_unavailable: 'Slack service is temporarily unavailable. Please try again later.',
  network_error: 'Network connection error. Please check your internet connection and try again.',
  unknown: 'An unexpected error occurred. Please try again or contact support if the issue persists.'
};

function categorizeSlackError(error: string): NonNullable<SlackStatusResponse['errorType']> {
  if (error.includes('invalid_auth') || error.includes('token_revoked') || error.includes('account_inactive')) {
    return 'auth_failed';
  }
  if (error.includes('missing_scope') || error.includes('not_allowed') || error.includes('restricted_action')) {
    return 'permission_denied';
  }
  if (error.includes('rate_limited')) {
    return 'rate_limited';
  }
  if (error.includes('service_unavailable') || error.includes('HTTP 5')) {
    return 'service_unavailable';
  }
  if (error.includes('Network') || error.includes('fetch')) {
    return 'network_error';
  }
  return 'unknown';
}

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

async function testSlackConnectionWithRetry(integration: any, maxRetries = 3): Promise<SlackStatusResponse> {
  const { SlackApiClient, SlackRateLimitError } = await import('@/lib/integrations/slack-client');
  
  let lastError: Error | null = null;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      const client = new SlackApiClient(integration);
      const testResult = await client.testConnection();

      if (testResult.success) {
        // Try to get additional bot information
        let botId: string | undefined;
        try {
          const botInfo = await client.getBotInfo();
          botId = botInfo.bot?.id;
        } catch (botError) {
          // Bot info is optional, don't fail if we can't get it
          console.warn('Could not retrieve bot info:', botError);
        }

        return {
          connected: true,
          teamId: testResult.teamId,
          teamName: testResult.teamName,
          userId: testResult.userId,
          userName: testResult.userName,
          botId,
          lastChecked: new Date().toISOString()
        };
      } else {
        const errorType = categorizeSlackError(testResult.error || '');
        return {
          connected: false,
          error: ERROR_MESSAGES[errorType],
          errorType,
          lastChecked: new Date().toISOString()
        };
      }
    } catch (error) {
      lastError = error as Error;
      
      // Handle rate limiting with exponential backoff
      if (error instanceof SlackRateLimitError) {
        if (retryCount < maxRetries - 1) {
          const delay = Math.min(error.retryAfter * 1000, 60000); // Max 60 seconds
          await new Promise(resolve => setTimeout(resolve, delay));
          retryCount++;
          continue;
        } else {
          return {
            connected: false,
            error: ERROR_MESSAGES.rate_limited,
            errorType: 'rate_limited',
            retryAfter: error.retryAfter,
            lastChecked: new Date().toISOString()
          };
        }
      }

      // For other errors, implement exponential backoff
      if (retryCount < maxRetries - 1) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
        retryCount++;
        continue;
      }
    }
  }

  // All retries exhausted
  const errorType = categorizeSlackError(lastError?.message || '');
  return {
    connected: false,
    error: ERROR_MESSAGES[errorType],
    errorType,
    lastChecked: new Date().toISOString()
  };
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
      // Check specific integration
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
      // Check if user has any active Slack integration (backward compatibility)
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
      return NextResponse.json({ 
        connected: false,
        error: 'Slack integration not found. Please connect your Slack account first.',
        lastChecked: new Date().toISOString()
      });
    }

    // Decrypt the integration tokens before testing
    const decryptedIntegration = {
      ...integration,
      accessToken: decryptToken(integration.accessToken),
      refreshToken: integration.refreshToken ? decryptToken(integration.refreshToken) : undefined
    }

    // Test the connection with retry logic
    const statusResult = await testSlackConnectionWithRetry(decryptedIntegration);

    // Update the integration health status in the database
    try {
      await supabase
        .from('Integration')
        .update({
          lastHealthCheck: new Date().toISOString(),
          healthStatus: statusResult.connected ? 'HEALTHY' : 'ERROR'
        })
        .eq('id', integration.id);
    } catch (updateError) {
      console.warn('Failed to update integration health status:', updateError);
      // Don't fail the request if we can't update the database
    }

    return NextResponse.json(statusResult);
  } catch (error) {
    console.error('Error checking Slack status:', error);
    return NextResponse.json(
      { 
        connected: false,
        error: 'Internal server error occurred while checking Slack status',
        errorType: 'unknown' as const,
        lastChecked: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}