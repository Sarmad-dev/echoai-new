/**
 * Configuration validator for OAuth integrations
 * Ensures all required environment variables are set
 */

import { getAllProviders, validateProviderConfig } from './providers'

export interface ConfigValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  providers: {
    [key: string]: {
      configured: boolean
      missing: string[]
    }
  }
}

/**
 * Validate all integration configurations
 */
export function validateIntegrationConfig(): ConfigValidationResult {
  const result: ConfigValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    providers: {}
  }

  // Check encryption key
  if (!process.env.INTEGRATION_ENCRYPTION_KEY) {
    result.errors.push('INTEGRATION_ENCRYPTION_KEY is required for secure token storage')
    result.valid = false
  } else if (process.env.INTEGRATION_ENCRYPTION_KEY === 'default-key-change-in-production') {
    result.warnings.push('INTEGRATION_ENCRYPTION_KEY is using default value - change in production')
  }

  // Check base URL
  if (!process.env.NEXT_PUBLIC_BASE_URL) {
    result.errors.push('NEXT_PUBLIC_BASE_URL is required for OAuth callbacks')
    result.valid = false
  }

  // Validate each provider
  const providers = getAllProviders()
  for (const provider of providers) {
    const validation = validateProviderConfig(provider.id)
    result.providers[provider.id] = {
      configured: validation.valid,
      missing: validation.missing
    }

    if (!validation.valid) {
      result.warnings.push(`${provider.name} integration not configured: missing ${validation.missing.join(', ')}`)
    }
  }

  return result
}

/**
 * Get configuration status for a specific provider
 */
export function getProviderConfigStatus(providerId: string): {
  configured: boolean
  missing: string[]
  instructions: string[]
} {
  const validation = validateProviderConfig(providerId)
  const instructions: string[] = []

  switch (providerId) {
    case 'hubspot':
      instructions.push(
        '1. Go to HubSpot Developer Portal (developers.hubspot.com)',
        '2. Create a new app or select existing app',
        '3. Copy Client ID and Client Secret',
        '4. Add redirect URI: ' + (process.env.NEXT_PUBLIC_BASE_URL || '[BASE_URL]') + '/api/integrations/oauth/callback/hubspot',
        '5. Set environment variables: HUBSPOT_CLIENT_ID, HUBSPOT_CLIENT_SECRET'
      )
      break

    case 'slack':
      instructions.push(
        '1. Go to Slack API Portal (api.slack.com)',
        '2. Create a new app or select existing app',
        '3. Go to OAuth & Permissions section',
        '4. Add redirect URI: ' + (process.env.NEXT_PUBLIC_BASE_URL || '[BASE_URL]') + '/api/integrations/oauth/callback/slack',
        '5. Copy Client ID and Client Secret',
        '6. Set environment variables: SLACK_CLIENT_ID, SLACK_CLIENT_SECRET'
      )
      break

    case 'google':
      instructions.push(
        '1. Go to Google Cloud Console (console.cloud.google.com)',
        '2. Create a new project or select existing project',
        '3. Enable Google Sheets API',
        '4. Go to Credentials section and create OAuth 2.0 Client ID',
        '5. Add redirect URI: ' + (process.env.NEXT_PUBLIC_BASE_URL || '[BASE_URL]') + '/api/integrations/oauth/callback/google',
        '6. Copy Client ID and Client Secret',
        '7. Set environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET'
      )
      break

    case 'salesforce':
      instructions.push(
        '1. Go to Salesforce Setup (setup.salesforce.com)',
        '2. Navigate to App Manager and create a new Connected App',
        '3. Enable OAuth Settings',
        '4. Add callback URL: ' + (process.env.NEXT_PUBLIC_BASE_URL || '[BASE_URL]') + '/api/integrations/oauth/callback/salesforce',
        '5. Select required OAuth scopes',
        '6. Copy Consumer Key and Consumer Secret',
        '7. Set environment variables: SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET'
      )
      break

    default:
      instructions.push('Configuration instructions not available for this provider')
  }

  return {
    configured: validation.valid,
    missing: validation.missing,
    instructions
  }
}

/**
 * Log configuration status to console
 */
export function logConfigurationStatus(): void {
  const validation = validateIntegrationConfig()
  
  console.log('🔧 Integration Configuration Status:')
  
  if (validation.valid) {
    console.log('✅ Core configuration is valid')
  } else {
    console.log('❌ Configuration errors found:')
    validation.errors.forEach(error => console.log(`   - ${error}`))
  }

  if (validation.warnings.length > 0) {
    console.log('⚠️  Configuration warnings:')
    validation.warnings.forEach(warning => console.log(`   - ${warning}`))
  }

  console.log('\n📋 Provider Status:')
  Object.entries(validation.providers).forEach(([providerId, status]) => {
    const icon = status.configured ? '✅' : '❌'
    const providerName = getAllProviders().find(p => p.id === providerId)?.name || providerId
    console.log(`   ${icon} ${providerName}: ${status.configured ? 'Configured' : `Missing ${status.missing.join(', ')}`}`)
  })

  console.log('\n💡 To configure missing providers, check the setup instructions in the dashboard.')
}