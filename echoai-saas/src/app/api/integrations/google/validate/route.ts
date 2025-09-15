import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { GoogleSheetsApiClient } from '@/lib/integrations/google-sheets-client';
import { GoogleSheetsConnectionValidator } from '@/lib/integrations/google-sheets-connection-validator';
import { OAuth2Manager } from '@/lib/integrations/oauth2-manager';
import { rateLimit } from '@/lib/utils/rate-limiter';

/**
 * POST /api/integrations/google/validate
 * 
 * Validates Google Sheets connection and retrieves account information
 * Includes caching, rate limiting, and comprehensive error handling
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting - 10 requests per minute per user
    const rateLimitResult = await rateLimit(request, {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10,
      keyGenerator: async (req) => {
        const session = await getServerSession();
        return `google-validate:${session?.user?.id || 'anonymous'}`;
      }
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
          errorCode: 'RATE_LIMITED',
          retryAfter: rateLimitResult.retryAfter
        },
        { 
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
          }
        }
      );
    }

    // Authentication check
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Authentication required',
          errorCode: 'AUTH_REQUIRED',
          requiresAuth: true
        },
        { status: 401 }
      );
    }

    // Parse request body for any additional options
    let options = {};
    try {
      const body = await request.json();
      options = body || {};
    } catch {
      // Empty body is fine, use defaults
    }

    // Initialize services
    const oauth2Manager = new OAuth2Manager();
    
    // Get integration to initialize client
    const integration = await oauth2Manager.getIntegration(session.user.id, 'google');
    if (!integration) {
      return NextResponse.json({
        success: false,
        error: 'No Google integration found',
        errorCode: 'AUTH_REQUIRED',
        requiresAuth: true,
        suggestedAction: 'Please connect your Google account first.'
      });
    }

    const googleSheetsClient = new GoogleSheetsApiClient(integration);
    const validator = new GoogleSheetsConnectionValidator(googleSheetsClient, oauth2Manager);

    // Check for cached results first (15 minutes cache)
    const maxCacheAge = (options as any)?.maxCacheAge || 15 * 60 * 1000;
    const validationResult = await validator.validateConnectionWithCache(
      session.user.id,
      maxCacheAge
    );

    // Return validation result
    return NextResponse.json(validationResult, {
      status: validationResult.success ? 200 : 400,
      headers: {
        'Cache-Control': 'private, max-age=900', // Cache for 15 minutes
      }
    });

  } catch (error) {
    console.error('Google Sheets validation error:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Google API rate limit exceeded',
            errorCode: 'RATE_LIMITED',
            isRetryable: true,
            retryDelay: 60000
          },
          { 
            status: 429,
            headers: {
              'Retry-After': '60'
            }
          }
        );
      }

      if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
        return NextResponse.json({
          success: false,
          error: 'Network connection failed',
          errorCode: 'NETWORK_ERROR',
          isRetryable: true,
          retryDelay: 5000
        }, { status: 503 });
      }
    }

    // Generic error response
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error during validation',
        errorCode: 'CONNECTION_FAILED',
        isRetryable: true
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/integrations/google/validate
 * 
 * Get cached validation status without performing new validation
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Authentication required',
          errorCode: 'AUTH_REQUIRED',
          requiresAuth: true
        },
        { status: 401 }
      );
    }

    // Initialize services
    const oauth2Manager = new OAuth2Manager();
    
    // Get integration
    const integration = await oauth2Manager.getIntegration(session.user.id, 'google');
    if (!integration) {
      return NextResponse.json({
        success: false,
        error: 'No Google integration found',
        errorCode: 'AUTH_REQUIRED',
        requiresAuth: true
      });
    }

    // Return cached status from integration health
    const lastCheck = integration.lastHealthCheck ? new Date(integration.lastHealthCheck) : null;
    const healthStatus = integration.healthStatus || 'UNKNOWN';

    return NextResponse.json({
      success: healthStatus === 'HEALTHY',
      cached: true,
      healthStatus: healthStatus.toLowerCase(),
      lastValidated: lastCheck?.toISOString(),
      requiresAuth: healthStatus === 'ERROR' && integration.config?.connectionDetails === undefined
    });

  } catch (error) {
    console.error('Error getting Google Sheets validation status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        errorCode: 'CONNECTION_FAILED'
      },
      { status: 500 }
    );
  }
}