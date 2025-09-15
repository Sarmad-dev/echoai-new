import { OAuth2Manager } from './oauth2-manager'
import { getProvider } from './providers'
import { createClient } from '@/lib/supabase/supabase'

export interface TokenRefreshResult {
  success: boolean
  integrationId: string
  provider: string
  error?: string
  refreshed?: boolean
}

export interface HealthCheckResult {
  integrationId: string
  provider: string
  healthy: boolean
  lastChecked: Date
  error?: string
  tokenExpiry?: Date
  needsRefresh: boolean
}

export class TokenManager {
  private oauth2Manager: OAuth2Manager
  private supabase = createClient()

  constructor() {
    this.oauth2Manager = new OAuth2Manager()
  }

  /**
   * Check and refresh tokens for all active integrations
   */
  async refreshExpiredTokens(): Promise<TokenRefreshResult[]> {
    const results: TokenRefreshResult[] = []

    try {
      // Get all active integrations that might need token refresh
      const { data: integrations, error } = await this.supabase
        .from('Integration')
        .select('*')
        .eq('isActive', true)
        .not('refreshToken', 'is', null)

      if (error) {
        console.error('Error fetching integrations for token refresh:', error)
        return results
      }

      for (const integration of integrations) {
        const result = await this.refreshIntegrationToken(integration.id, integration.provider)
        results.push(result)
      }
    } catch (error) {
      console.error('Error in bulk token refresh:', error)
    }

    return results
  }

  /**
   * Refresh token for a specific integration
   */
  async refreshIntegrationToken(integrationId: string, providerId: string): Promise<TokenRefreshResult> {
    try {
      const provider = getProvider(providerId)
      if (!provider) {
        return {
          success: false,
          integrationId,
          provider: providerId,
          error: 'Provider configuration not found'
        }
      }

      const integration = await this.oauth2Manager.getIntegrationById(integrationId)
      if (!integration) {
        return {
          success: false,
          integrationId,
          provider: providerId,
          error: 'Integration not found'
        }
      }

      // Check if token needs refresh (expires within 5 minutes)
      const needsRefresh = integration.tokenExpiry && 
        integration.tokenExpiry.getTime() - Date.now() < 5 * 60 * 1000

      if (!needsRefresh) {
        return {
          success: true,
          integrationId,
          provider: providerId,
          refreshed: false
        }
      }

      const refreshedIntegration = await this.oauth2Manager.refreshAccessToken(integrationId, provider)
      
      if (refreshedIntegration) {
        return {
          success: true,
          integrationId,
          provider: providerId,
          refreshed: true
        }
      } else {
        return {
          success: false,
          integrationId,
          provider: providerId,
          error: 'Token refresh failed'
        }
      }
    } catch (error) {
      console.error(`Error refreshing token for integration ${integrationId}:`, error)
      return {
        success: false,
        integrationId,
        provider: providerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Perform health checks on all active integrations
   */
  async performHealthChecks(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = []

    try {
      const { data: integrations, error } = await this.supabase
        .from('Integration')
        .select('*')
        .eq('isActive', true)

      if (error) {
        console.error('Error fetching integrations for health check:', error)
        return results
      }

      for (const integration of integrations) {
        const result = await this.checkIntegrationHealth(integration.id, integration.provider)
        results.push(result)
      }
    } catch (error) {
      console.error('Error in bulk health check:', error)
    }

    return results
  }

  /**
   * Check health of a specific integration
   */
  async checkIntegrationHealth(integrationId: string, providerId: string): Promise<HealthCheckResult> {
    const now = new Date()
    
    try {
      const integration = await this.oauth2Manager.getIntegrationById(integrationId)
      if (!integration) {
        return {
          integrationId,
          provider: providerId,
          healthy: false,
          lastChecked: now,
          error: 'Integration not found',
          needsRefresh: false
        }
      }

      // Check if token is expired or expires soon (within 5 minutes)
      const needsRefresh = integration.tokenExpiry && 
        integration.tokenExpiry.getTime() - Date.now() < 5 * 60 * 1000

      // Test the connection
      const testResult = await this.oauth2Manager.testConnection(integrationId)

      return {
        integrationId,
        provider: providerId,
        healthy: testResult.success,
        lastChecked: now,
        error: testResult.error,
        tokenExpiry: integration.tokenExpiry,
        needsRefresh: needsRefresh || false
      }
    } catch (error) {
      console.error(`Error checking health for integration ${integrationId}:`, error)
      return {
        integrationId,
        provider: providerId,
        healthy: false,
        lastChecked: now,
        error: error instanceof Error ? error.message : 'Unknown error',
        needsRefresh: false
      }
    }
  }

  /**
   * Get integrations that need attention (expired, failing, etc.)
   */
  async getIntegrationsNeedingAttention(): Promise<{
    expired: HealthCheckResult[]
    failing: HealthCheckResult[]
    needingRefresh: HealthCheckResult[]
  }> {
    const healthChecks = await this.performHealthChecks()
    
    const expired = healthChecks.filter(check => 
      check.tokenExpiry && check.tokenExpiry < new Date()
    )
    
    const failing = healthChecks.filter(check => 
      !check.healthy && !expired.includes(check)
    )
    
    const needingRefresh = healthChecks.filter(check => 
      check.needsRefresh && !expired.includes(check)
    )

    return { expired, failing, needingRefresh }
  }

  /**
   * Schedule automatic token refresh (to be called by a cron job or background task)
   */
  async scheduleTokenRefresh(): Promise<void> {
    console.log('Starting scheduled token refresh...')
    
    const results = await this.refreshExpiredTokens()
    const refreshed = results.filter(r => r.success && r.refreshed)
    const failed = results.filter(r => !r.success)

    console.log(`Token refresh completed: ${refreshed.length} refreshed, ${failed.length} failed`)

    if (failed.length > 0) {
      console.error('Failed token refreshes:', failed)
      // Here you could send alerts to administrators
    }
  }

  /**
   * Monitor integration health and send alerts if needed
   */
  async monitorIntegrationHealth(): Promise<void> {
    console.log('Starting integration health monitoring...')
    
    const attention = await this.getIntegrationsNeedingAttention()
    
    if (attention.expired.length > 0) {
      console.warn(`${attention.expired.length} integrations have expired tokens`)
      // Send alert to administrators
    }
    
    if (attention.failing.length > 0) {
      console.warn(`${attention.failing.length} integrations are failing health checks`)
      // Send alert to administrators
    }
    
    if (attention.needingRefresh.length > 0) {
      console.info(`${attention.needingRefresh.length} integrations need token refresh`)
      // Attempt to refresh these tokens
      for (const check of attention.needingRefresh) {
        await this.refreshIntegrationToken(check.integrationId, check.provider)
      }
    }
  }
}