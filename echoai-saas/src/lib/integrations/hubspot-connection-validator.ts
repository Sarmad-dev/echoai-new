/**
 * HubSpot Connection Validation Service
 * 
 * Provides comprehensive connection validation for HubSpot integrations
 * including account information retrieval, permission validation, and
 * available objects discovery.
 */

import { HubSpotApiClient } from './hubspot-client';
import { OAuth2Manager, Integration } from './oauth2-manager';
import { IntegrationErrorHandler } from './integration-error-handler';

export interface HubSpotAccountInfo {
  portalId: string;
  portalName: string;
  userEmail: string;
  subscriptionTier: string;
  availableObjects: string[];
  permissions: string[];
  apiLimits: {
    dailyLimit: number;
    currentUsage: number;
  };
}

export interface HubSpotObject {
  name: string;
  label: string;
  properties: HubSpotProperty[];
}

export interface HubSpotProperty {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  options?: Array<{ label: string; value: string }>;
}

export interface HubSpotValidationResult {
  success: boolean;
  accountInfo?: HubSpotAccountInfo;
  availableObjects?: HubSpotObject[];
  error?: string;
  errorCode?: IntegrationErrorCode;
  requiresAuth?: boolean;
  suggestedAction?: string;
  lastValidated?: Date;
}

export enum IntegrationErrorCode {
  // Authentication errors
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  
  // Permission errors
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  SCOPE_MISSING = 'SCOPE_MISSING',
  
  // API errors
  RATE_LIMITED = 'RATE_LIMITED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  API_ERROR = 'API_ERROR',
  
  // Configuration errors
  INVALID_CONFIG = 'INVALID_CONFIG',
  MISSING_CONFIG = 'MISSING_CONFIG',
  
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  
  // Connection errors
  CONNECTION_FAILED = 'CONNECTION_FAILED'
}

export class HubSpotConnectionValidator {
  constructor(
    private hubspotClient: HubSpotApiClient,
    private oauth2Manager: OAuth2Manager
  ) {}

  /**
   * Validate HubSpot connection and retrieve account information
   */
  async validateConnection(userId: string): Promise<HubSpotValidationResult> {
    try {
      // 1. Check if integration exists and tokens are valid
      const integration = await this.getHubSpotIntegration(userId);
      if (!integration) {
        return {
          success: false,
          error: 'No HubSpot integration found',
          requiresAuth: true,
          errorCode: IntegrationErrorCode.AUTH_REQUIRED,
          suggestedAction: 'Please connect your HubSpot account first.'
        };
      }

      // 2. Test API connection with account info call
      const accountInfo = await this.hubspotClient.getAccountInfo(integration.accessToken);
      
      // 3. Validate permissions and capabilities
      const permissions = await this.hubspotClient.getPermissions(integration.accessToken);
      
      // 4. Get available objects and properties
      const availableObjects = await this.hubspotClient.getAvailableObjects(integration.accessToken);
      
      // 5. Get API usage information
      const rateLimitStatus = await this.hubspotClient.getRateLimitStatus();
      
      const validationResult: HubSpotValidationResult = {
        success: true,
        accountInfo: {
          portalId: accountInfo.portalId,
          portalName: accountInfo.portalName || `Portal ${accountInfo.portalId}`,
          userEmail: accountInfo.userEmail,
          subscriptionTier: accountInfo.subscriptionTier,
          availableObjects: availableObjects.map(obj => obj.name),
          permissions: permissions,
          apiLimits: {
            dailyLimit: rateLimitStatus.dailyLimit || 40000,
            currentUsage: rateLimitStatus.dailyUsage || 0
          }
        },
        availableObjects,
        lastValidated: new Date()
      };

      // Update integration health status
      await this.oauth2Manager.updateHealthStatus(
        integration.id,
        'HEALTHY',
        undefined,
        Date.now() - performance.now()
      );

      return validationResult;
    } catch (error) {
      return this.handleValidationError(error, userId);
    }
  }

  /**
   * Get HubSpot integration for a user
   */
  private async getHubSpotIntegration(userId: string): Promise<Integration | null> {
    return await this.oauth2Manager.getIntegration(userId, 'hubspot');
  }

  /**
   * Handle validation errors with specific error codes and suggestions
   */
  private async handleValidationError(error: any, userId?: string): Promise<HubSpotValidationResult> {
    console.error('HubSpot validation error:', error);

    // Update integration health status if we have a user ID
    if (userId) {
      try {
        const integration = await this.getHubSpotIntegration(userId);
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
    } else if (error.message?.includes('429') || error.name === 'HubSpotRateLimitError') {
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
    return IntegrationErrorHandler.createErrorResponse('hubspot', errorCode, error);
  }

  /**
   * Validate connection with cached results
   */
  async validateConnectionWithCache(
    userId: string,
    maxCacheAge: number = 15 * 60 * 1000 // 15 minutes default
  ): Promise<HubSpotValidationResult> {
    try {
      const integration = await this.getHubSpotIntegration(userId);
      if (!integration) {
        return this.validateConnection(userId);
      }

      // Check if we have recent validation results
      const lastCheck = integration.lastHealthCheck ? new Date(integration.lastHealthCheck) : null;
      const now = new Date();
      
      if (lastCheck && (now.getTime() - lastCheck.getTime()) < maxCacheAge) {
        // Return cached result if recent and healthy
        if (integration.healthStatus === 'HEALTHY') {
          return {
            success: true,
            accountInfo: this.extractAccountInfoFromConfig(integration),
            lastValidated: lastCheck
          };
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
  private extractAccountInfoFromConfig(integration: Integration): HubSpotAccountInfo | undefined {
    const connectionDetails = integration.config?.connectionDetails;
    if (!connectionDetails) {
      return undefined;
    }

    return {
      portalId: connectionDetails.portalId || '',
      portalName: connectionDetails.portalName || 'Unknown Portal',
      userEmail: connectionDetails.userEmail || '',
      subscriptionTier: connectionDetails.accountType || 'Unknown',
      availableObjects: [], // Would need to be cached separately
      permissions: connectionDetails.scopes || [],
      apiLimits: {
        dailyLimit: 40000, // Default HubSpot limit
        currentUsage: 0
      }
    };
  }

  /**
   * Test basic connectivity without full validation
   */
  async testBasicConnectivity(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const integration = await this.getHubSpotIntegration(userId);
      if (!integration) {
        return { success: false, error: 'No HubSpot integration found' };
      }

      // Simple connectivity test
      const testResult = await this.hubspotClient.testConnection();
      return testResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }
}