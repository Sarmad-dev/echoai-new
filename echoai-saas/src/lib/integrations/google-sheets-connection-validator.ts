/**
 * Google Sheets Connection Validation Service
 * 
 * Provides comprehensive connection validation for Google Sheets integrations
 * including user information retrieval, drive quota validation, and
 * sheets access permission testing.
 */

import { GoogleSheetsApiClient } from './google-sheets-client';
import { OAuth2Manager, Integration } from './oauth2-manager';
import { IntegrationErrorHandler } from './integration-error-handler';
import { IntegrationErrorCode } from './hubspot-connection-validator';

export interface GoogleAccountInfo {
  email: string;
  name: string;
  driveQuota: {
    limit: string;
    usage: string;
    usageInDrive: string;
  };
  permissions: {
    canCreateFiles: boolean;
    canEditFiles: boolean;
    canShareFiles: boolean;
  };
}

export interface GoogleSheetsValidationResult {
  success: boolean;
  accountInfo?: GoogleAccountInfo;
  error?: string;
  errorCode?: IntegrationErrorCode;
  requiresAuth?: boolean;
  suggestedAction?: string;
  lastValidated?: Date;
  isRetryable?: boolean;
}

export interface GoogleUserInfo {
  email: string;
  name: string;
  id: string;
  picture?: string;
  verified_email?: boolean;
}

export interface GoogleDriveInfo {
  quota: {
    limit: string;
    usage: string;
    usageInDrive: string;
  };
}

export interface GoogleSheetsPermissions {
  canCreate: boolean;
  canEdit: boolean;
  canShare: boolean;
}

export class GoogleSheetsConnectionValidator {
  constructor(
    private googleSheetsClient: GoogleSheetsApiClient,
    private oauth2Manager: OAuth2Manager
  ) {}

  /**
   * Validate Google Sheets connection and retrieve account information
   */
  async validateConnection(userId: string): Promise<GoogleSheetsValidationResult> {
    try {
      // 1. Check if integration exists and tokens are valid
      const integration = await this.getGoogleIntegration(userId);
      if (!integration) {
        return {
          success: false,
          error: 'No Google integration found',
          requiresAuth: true,
          errorCode: IntegrationErrorCode.AUTH_REQUIRED,
          suggestedAction: 'Please connect your Google account first.'
        };
      }

      // 2. Test API connection with user info call
      const userInfo = await this.googleSheetsClient.getUserInfo(integration.accessToken);
      
      // 3. Test Drive access and get quota information
      const driveInfo = await this.googleSheetsClient.getDriveInfo(integration.accessToken);
      
      // 4. Test Sheets API access
      const sheetsAccess = await this.googleSheetsClient.testSheetsAccess(integration.accessToken);
      
      const validationResult: GoogleSheetsValidationResult = {
        success: true,
        accountInfo: {
          email: userInfo.email,
          name: userInfo.name,
          driveQuota: driveInfo.quota,
          permissions: {
            canCreateFiles: sheetsAccess.canCreate,
            canEditFiles: sheetsAccess.canEdit,
            canShareFiles: sheetsAccess.canShare
          }
        },
        lastValidated: new Date()
      };

      // Update integration health status
      try {
        await this.oauth2Manager.updateHealthStatus(
          integration.id,
          'HEALTHY',
          undefined,
          Date.now() - performance.now()
        );
      } catch (healthUpdateError) {
        console.error('Failed to update health status:', healthUpdateError);
        // Don't fail validation if health status update fails
      }

      return validationResult;
    } catch (error) {
      return this.handleValidationError(error, userId);
    }
  }

  /**
   * Get Google integration for a user
   */
  private async getGoogleIntegration(userId: string): Promise<Integration | null> {
    return await this.oauth2Manager.getIntegration(userId, 'google');
  }

  /**
   * Handle validation errors with specific error codes and suggestions
   */
  private async handleValidationError(error: any, userId?: string): Promise<GoogleSheetsValidationResult> {
    console.error('Google Sheets validation error:', error);

    // Update integration health status if we have a user ID
    if (userId) {
      try {
        const integration = await this.getGoogleIntegration(userId);
        if (integration) {
          await this.oauth2Manager.updateHealthStatus(
            integration.id,
            'ERROR',
            error.message,
            undefined
          );
        }
      } catch (healthUpdateError) {
        console.error('Failed to update health status:', healthUpdateError);
      }
    }

    // Determine error code based on error type
    let errorCode: IntegrationErrorCode;
    
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      errorCode = IntegrationErrorCode.AUTH_EXPIRED;
    } else if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
      errorCode = IntegrationErrorCode.INSUFFICIENT_PERMISSIONS;
    } else if (error.message?.includes('429') || error.name === 'GoogleSheetsRateLimitError') {
      errorCode = IntegrationErrorCode.RATE_LIMITED;
    } else if (error.message?.includes('503') || error.message?.includes('Service Unavailable')) {
      errorCode = IntegrationErrorCode.SERVICE_UNAVAILABLE;
    } else if (error.message?.includes('ENOTFOUND') || error.message?.includes('network')) {
      errorCode = IntegrationErrorCode.NETWORK_ERROR;
    } else if (error.message?.includes('timeout')) {
      errorCode = IntegrationErrorCode.TIMEOUT;
    } else {
      errorCode = IntegrationErrorCode.CONNECTION_FAILED;
    }

    // Use error handler to create standardized response
    const errorResponse = IntegrationErrorHandler.createErrorResponse('google', errorCode, error);
    
    return {
      success: false,
      error: errorResponse.error,
      errorCode: errorResponse.errorCode,
      requiresAuth: errorResponse.requiresAuth,
      suggestedAction: errorResponse.suggestedAction,
      isRetryable: errorResponse.isRetryable
    };
  }

  /**
   * Validate connection with cached results
   */
  async validateConnectionWithCache(
    userId: string,
    maxCacheAge: number = 15 * 60 * 1000 // 15 minutes default
  ): Promise<GoogleSheetsValidationResult> {
    try {
      const integration = await this.getGoogleIntegration(userId);
      if (!integration) {
        return this.validateConnection(userId);
      }

      // Check if we have recent validation results
      const lastCheck = integration.lastHealthCheck ? new Date(integration.lastHealthCheck) : null;
      const now = new Date();
      
      if (lastCheck && (now.getTime() - lastCheck.getTime()) < maxCacheAge) {
        // Return cached result if recent and healthy and we have cached account info
        if (integration.healthStatus === 'HEALTHY') {
          const cachedAccountInfo = this.extractAccountInfoFromConfig(integration);
          if (cachedAccountInfo) {
            return {
              success: true,
              accountInfo: cachedAccountInfo,
              lastValidated: lastCheck
            };
          }
        }
      }

      // Perform fresh validation
      return this.validateConnection(userId);
    } catch (error) {
      return this.handleValidationError(error, userId);
    }
  }

  /**
   * Extract account info from integration config (for cached results)
   */
  private extractAccountInfoFromConfig(integration: Integration): GoogleAccountInfo | undefined {
    const connectionDetails = integration.config?.connectionDetails;
    if (!connectionDetails) {
      return undefined;
    }

    return {
      email: connectionDetails.email || '',
      name: connectionDetails.name || 'Unknown User',
      driveQuota: {
        limit: connectionDetails.driveQuota?.limit || 'unlimited',
        usage: connectionDetails.driveQuota?.usage || '0',
        usageInDrive: connectionDetails.driveQuota?.usageInDrive || '0'
      },
      permissions: {
        canCreateFiles: connectionDetails.permissions?.canCreateFiles ?? true,
        canEditFiles: connectionDetails.permissions?.canEditFiles ?? true,
        canShareFiles: connectionDetails.permissions?.canShareFiles ?? true
      }
    };
  }

  /**
   * Test basic connectivity without full validation
   */
  async testBasicConnectivity(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const integration = await this.getGoogleIntegration(userId);
      if (!integration) {
        return { success: false, error: 'No Google integration found' };
      }

      // Simple connectivity test
      const testResult = await this.googleSheetsClient.testConnection();
      return testResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }
}