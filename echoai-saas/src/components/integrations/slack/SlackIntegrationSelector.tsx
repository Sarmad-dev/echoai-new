import React from 'react';
import { SlackIntegration } from '@/types/slack';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, HelpCircle, ExternalLink } from 'lucide-react';

interface SlackIntegrationSelectorProps {
  integrations: SlackIntegration[];
  selectedIntegrationId?: string;
  onIntegrationSelect: (integrationId: string) => void;
  onRefresh?: () => void;
  loading?: boolean;
  error?: string;
  className?: string;
}

const getHealthStatusIcon = (status: SlackIntegration['healthStatus']) => {
  switch (status) {
    case 'HEALTHY':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'WARNING':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'ERROR':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <HelpCircle className="h-4 w-4 text-gray-400" />;
  }
};

const getHealthStatusBadge = (status: SlackIntegration['healthStatus']) => {
  const variants = {
    HEALTHY: 'default',
    WARNING: 'secondary',
    ERROR: 'destructive',
    UNKNOWN: 'outline'
  } as const;

  return (
    <Badge variant={variants[status]} className="ml-2 text-xs">
      {status.toLowerCase()}
    </Badge>
  );
};

export function SlackIntegrationSelector({
  integrations,
  selectedIntegrationId,
  onIntegrationSelect,
  onRefresh,
  loading = false,
  error,
  className
}: SlackIntegrationSelectorProps) {
  // Show setup instructions if no integrations
  if (integrations.length === 0 && !loading) {
    return (
      <div className={className}>
        <Alert>
          <ExternalLink className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p>No Slack integrations found. To get started:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Go to Settings → Integrations</li>
                <li>Click "Connect" next to Slack</li>
                <li>Authorize EchoAI in your Slack workspace</li>
                <li>Return here to configure your action</li>
              </ol>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.open('/dashboard/integrations', '_blank')}
                className="mt-2"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Integrations
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Show single integration info if only one
  if (integrations.length === 1) {
    const integration = integrations[0];
    return (
      <div className={className}>
        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
          <div className="flex items-center space-x-3">
            {getHealthStatusIcon(integration.healthStatus)}
            <div>
              <div className="font-medium">{integration.teamName}</div>
              <div className="text-sm text-muted-foreground">
                Connected as {integration.userName}
              </div>
            </div>
            {getHealthStatusBadge(integration.healthStatus)}
          </div>
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
        
        {integration.healthStatus === 'ERROR' && (
          <Alert variant="destructive" className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This Slack integration has connection issues. Please check your integration settings or try reconnecting.
            </AlertDescription>
          </Alert>
        )}
        
        {!integration.isActive && (
          <Alert variant="destructive" className="mt-2">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              This Slack integration is inactive. Please reactivate it in your integration settings.
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  // Show selector for multiple integrations
  return (
    <div className={className}>
      <div className="space-y-2">
        <label className="text-sm font-medium">Slack Workspace</label>
        <div className="flex items-center space-x-2">
          <Select
            value={selectedIntegrationId}
            onValueChange={onIntegrationSelect}
            disabled={loading}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select a Slack workspace..." />
            </SelectTrigger>
            <SelectContent>
              {integrations.map((integration) => (
                <SelectItem key={integration.id} value={integration.id}>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-2">
                      {getHealthStatusIcon(integration.healthStatus)}
                      <div>
                        <div className="font-medium">{integration.teamName}</div>
                        <div className="text-xs text-muted-foreground">
                          {integration.userName}
                        </div>
                      </div>
                    </div>
                    {getHealthStatusBadge(integration.healthStatus)}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {selectedIntegrationId && (
        <div className="mt-2">
          {(() => {
            const selectedIntegration = integrations.find(i => i.id === selectedIntegrationId);
            if (!selectedIntegration) return null;

            if (selectedIntegration.healthStatus === 'ERROR') {
              return (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    The selected Slack workspace has connection issues. Please check your integration settings or try reconnecting.
                  </AlertDescription>
                </Alert>
              );
            }

            if (!selectedIntegration.isActive) {
              return (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    The selected Slack workspace is inactive. Please reactivate it in your integration settings.
                  </AlertDescription>
                </Alert>
              );
            }

            if (selectedIntegration.healthStatus === 'WARNING') {
              return (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    The selected Slack workspace has some issues but should still work. Monitor for any problems.
                  </AlertDescription>
                </Alert>
              );
            }

            return null;
          })()}
        </div>
      )}
    </div>
  );
}