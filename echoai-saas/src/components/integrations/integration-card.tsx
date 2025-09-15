'use client'

import { useState } from 'react'
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle, 
  Circle,
  Loader2,
  Settings,
  Unlink,
  TestTube
} from 'lucide-react'

interface IntegrationStatus {
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

interface IntegrationCardProps {
  integration: IntegrationStatus
  onConnect: (providerId: string) => Promise<void>
  onDisconnect: (integrationId: string) => Promise<void>
  onTestConnection: (integrationId: string) => Promise<void>
  isLoading?: boolean
}

// Health status indicator component
function HealthIndicator({ 
  status, 
  lastCheck, 
  size = 'sm' 
}: { 
  status: 'healthy' | 'warning' | 'error' | 'unknown'
  lastCheck?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4', 
    lg: 'h-5 w-5'
  }

  const statusConfig = {
    healthy: {
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-500',
      label: 'Healthy'
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500',
      label: 'Warning'
    },
    error: {
      icon: AlertCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500',
      label: 'Error'
    },
    unknown: {
      icon: Circle,
      color: 'text-gray-400',
      bgColor: 'bg-gray-400',
      label: 'Unknown'
    }
  }

  const config = statusConfig[status]
  const Icon = config.icon

  const formatLastCheck = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
      <Icon className={`${sizeClasses[size]} ${config.color}`} />
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">
          Health: {config.label}
        </span>
        {lastCheck && (
          <span className="text-xs text-muted-foreground">
            Last checked {formatLastCheck(lastCheck)}
          </span>
        )}
      </div>
    </div>
  )
}

// Provider icon component
function ProviderIcon({ providerId }: { providerId: string }) {
  const iconClasses = "h-10 w-10 rounded-lg flex items-center justify-center text-white font-semibold"
  
  switch (providerId.toLowerCase()) {
    case 'slack':
      return (
        <div className={`${iconClasses} bg-[#4A154B]`}>
          <span className="text-lg">S</span>
        </div>
      )
    case 'hubspot':
      return (
        <div className={`${iconClasses} bg-[#FF7A59]`}>
          <span className="text-lg">H</span>
        </div>
      )
    default:
      return (
        <div className={`${iconClasses} bg-gray-500`}>
          <Settings className="h-5 w-5" />
        </div>
      )
  }
}

export function IntegrationCard({ 
  integration, 
  onConnect, 
  onDisconnect, 
  onTestConnection,
  isLoading = false 
}: IntegrationCardProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const handleConnect = async () => {
    setActionLoading('connect')
    try {
      await onConnect(integration.id)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDisconnect = async () => {
    if (!integration.integration?.id) return
    
    setActionLoading('disconnect')
    try {
      await onDisconnect(integration.integration.id)
    } finally {
      setActionLoading(null)
    }
  }

  const handleTestConnection = async () => {
    if (!integration.integration?.id) return
    
    setActionLoading('test')
    try {
      await onTestConnection(integration.integration.id)
    } finally {
      setActionLoading(null)
    }
  }

  const getCardVariant = () => {
    if (!integration.configured) return 'default'
    if (integration.connected && integration.healthStatus === 'healthy') return 'success'
    if (integration.connected && integration.healthStatus === 'error') return 'error'
    if (integration.connected && integration.healthStatus === 'warning') return 'warning'
    return 'default'
  }

  const cardVariantClasses = {
    default: '',
    success: 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10',
    error: 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10',
    warning: 'border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10'
  }

  console.log("Integration Status: ", integration.healthStatus)

  return (
    <Card className={`transition-all hover:shadow-md ${cardVariantClasses[getCardVariant()]}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <ProviderIcon providerId={integration.id} />
            <div>
              <CardTitle className="text-lg">{integration.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                {integration.connected ? (
                  <Badge variant="default" className="text-xs">
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    Not Connected
                  </Badge>
                )}
                {integration.connected && (
                  <Badge 
                    variant={
                      integration.healthStatus === 'healthy' ? 'default' :
                      integration.healthStatus === 'warning' ? 'secondary' : 
                      integration.healthStatus === 'error' ? 'destructive' : 'outline'
                    }
                    className="text-xs"
                  >
                    {integration.healthStatus === 'healthy' && '🟢'}
                    {integration.healthStatus === 'warning' && '🟡'}
                    {integration.healthStatus === 'error' && '🔴'}
                    {integration.healthStatus === 'unknown' && '⚪'}
                    {' '}
                    {integration.healthStatus.charAt(0).toUpperCase() + integration.healthStatus.slice(1)}
                  </Badge>
                )}
                {!integration.configured && (
                  <Badge variant="destructive" className="text-xs">
                    Not Configured
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <CardDescription className="text-sm">
          {integration.description}
        </CardDescription>

        {/* Connection Details */}
        {integration.connected && integration.integration?.connectionDetails && (
          <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
            <h4 className="text-sm font-medium">Connection Details</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              {integration.integration.connectionDetails.workspaceName && (
                <div>Workspace: {integration.integration.connectionDetails.workspaceName}</div>
              )}
              {integration.integration.connectionDetails.portalName && (
                <div>Portal: {integration.integration.connectionDetails.portalName}</div>
              )}
              {integration.integration.connectionDetails.connectedUser && (
                <div>User: {integration.integration.connectionDetails.connectedUser}</div>
              )}
              <div>Connected: {new Date(integration.integration.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
        )}

        {/* Health Status */}
        {integration.connected && (
          <div className="space-y-2">
            <HealthIndicator 
              status={integration.healthStatus}
              lastCheck={integration.integration?.lastHealthCheck}
            />
          </div>
        )}

        {/* Missing Configuration Warning */}
        {!integration.configured && integration.missingConfig && integration.missingConfig.length > 0 && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Configuration Required
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  Missing: {integration.missingConfig.join(', ')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {!integration.connected ? (
            <Button 
              onClick={handleConnect}
              disabled={!integration.configured || actionLoading === 'connect' || isLoading}
              className="flex-1"
            >
              {actionLoading === 'connect' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect'
              )}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={actionLoading === 'test' || isLoading}
                className="flex-1"
              >
                {actionLoading === 'test' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <TestTube className="h-4 w-4 mr-2" />
                    Test
                  </>
                )}
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={actionLoading !== null || isLoading}
                    size="icon"
                  >
                    <Unlink className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect {integration.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the connection to your {integration.name} account. 
                      Any automations using this integration will stop working until you reconnect.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDisconnect}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {actionLoading === 'disconnect' ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Disconnecting...
                        </>
                      ) : (
                        'Disconnect'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}