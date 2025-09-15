'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

export interface IntegrationStatus {
  id: string
  name: string
  description: string
  configured: boolean
  connected: boolean
  healthStatus: 'healthy' | 'warning' | 'error' | 'unknown'
  integration?: {
    id: string
    isActive: boolean
    createdAt: string
    lastHealthCheck?: string
    config: Record<string, unknown>
    connectionDetails?: {
      workspaceName?: string
      portalName?: string
      accountId?: string
      connectedUser?: string
    }
  }
  missingConfig?: string[]
}

interface UseIntegrationsOptions {
  userId?: string
  onSuccess?: (message: string) => void
  onError?: (error: string) => void
}

interface UseIntegrationsReturn {
  integrations: IntegrationStatus[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  initiateOAuth: (providerId: string) => Promise<void>
  disconnectIntegration: (integrationId: string) => Promise<void>
  testConnection: (integrationId: string) => Promise<void>
  isConnecting: boolean
  isDisconnecting: boolean
  isTesting: boolean
}

export function useIntegrations(options: UseIntegrationsOptions = {}): UseIntegrationsReturn {
  const { userId, onSuccess, onError } = options
  
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  const fetchIntegrations = useCallback(async () => {
    if (!userId) {
      setError('User ID is required')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('🔄 Fetching integrations for userId:', userId)
      const response = await fetch(`/api/integrations?userId=${encodeURIComponent(userId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      console.log('📡 Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('❌ API Error:', errorData)
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('✅ API Response data:', data)
      setIntegrations(data.providers || [])
      console.log('🎯 Set integrations:', data.providers?.length || 0, 'providers')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load integrations'
      console.error('💥 Fetch integrations error:', err)
      setError(errorMessage)
      onError?.(errorMessage)
    } finally {
      setIsLoading(false)
      console.log('🏁 Finished loading integrations')
    }
  }, [userId]) // Remove onError from dependencies

  const initiateOAuth = useCallback(async (providerId: string) => {
    if (!userId) {
      const errorMessage = 'User authentication required'
      setError(errorMessage)
      onError?.(errorMessage)
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      const response = await fetch('/api/integrations/oauth/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          provider: providerId, 
          userId 
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const { authUrl } = await response.json()
      
      if (!authUrl) {
        throw new Error('No authorization URL received')
      }

      // Redirect to OAuth provider
      window.location.href = authUrl
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initiate OAuth flow'
      setError(errorMessage)
      onError?.(errorMessage)
      toast.error('Connection failed', {
        description: errorMessage
      })
    } finally {
      setIsConnecting(false)
    }
  }, [userId]) // Remove onError from dependencies

  const disconnectIntegration = useCallback(async (integrationId: string) => {
    if (!userId) {
      const errorMessage = 'User authentication required'
      setError(errorMessage)
      onError?.(errorMessage)
      return
    }

    setIsDisconnecting(true)
    setError(null)

    try {
      const response = await fetch(`/api/integrations?integrationId=${encodeURIComponent(integrationId)}&userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      // Update local state optimistically
      setIntegrations(prev => 
        prev.map(integration => 
          integration.integration?.id === integrationId 
            ? { ...integration, connected: false, integration: undefined, healthStatus: 'unknown' as const }
            : integration
        )
      )

      const successMessage = 'Integration disconnected successfully'
      onSuccess?.(successMessage)
      toast.success(successMessage)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect integration'
      setError(errorMessage)
      onError?.(errorMessage)
      toast.error('Disconnect failed', {
        description: errorMessage
      })
    } finally {
      setIsDisconnecting(false)
    }
  }, [userId]) // Remove onSuccess and onError from dependencies

  const testConnection = useCallback(async (integrationId: string) => {
    setIsTesting(true)
    setError(null)

    try {
      const response = await fetch(`/api/integrations/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          integrationId
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const { status, healthStatus } = await response.json()

      // Update health status optimistically
      setIntegrations(prev =>
        prev.map(integration =>
          integration.integration?.id === integrationId
            ? { 
                ...integration, 
                healthStatus: healthStatus || 'healthy',
                integration: integration.integration ? {
                  ...integration.integration,
                  lastHealthCheck: new Date().toISOString()
                } : integration.integration
              }
            : integration
        )
      )

      const successMessage = status === 'healthy' ? 'Connection test successful' : 'Connection test completed with warnings'
      onSuccess?.(successMessage)
      toast.success(successMessage)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection test failed'
      setError(errorMessage)
      onError?.(errorMessage)
      
      // Update health status to error
      setIntegrations(prev =>
        prev.map(integration =>
          integration.integration?.id === integrationId
            ? { 
                ...integration, 
                healthStatus: 'error' as const,
                integration: integration.integration ? {
                  ...integration.integration,
                  lastHealthCheck: new Date().toISOString()
                } : integration.integration
              }
            : integration
        )
      )

      toast.error('Connection test failed', {
        description: errorMessage
      })
    } finally {
      setIsTesting(false)
    }
  }, []) // Remove userId dependency since we get it from session

  const refetch = useCallback(async () => {
    await fetchIntegrations()
  }, [fetchIntegrations])

  useEffect(() => {
    fetchIntegrations()
  }, [fetchIntegrations])

  return {
    integrations,
    isLoading,
    error,
    refetch,
    initiateOAuth,
    disconnectIntegration,
    testConnection,
    isConnecting,
    isDisconnecting,
    isTesting,
  }
}