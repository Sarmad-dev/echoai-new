'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Settings,
  Building2,
  Users,
  Mail,
  Crown,
  Activity,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeIntegration, HubSpotAccountInfo } from '@/hooks/useNodeIntegration';
import { toast } from 'sonner';

export interface HubSpotNodeProps {
  nodeId: string;
  onConnectionChange?: (status: 'validating' | 'connected' | 'disconnected' | 'error') => void;
  onAccountInfoUpdate?: (info: HubSpotAccountInfo) => void;
  onConfigureClick?: () => void;
  className?: string;
  showAccountDetails?: boolean;
  showActions?: boolean;
  compact?: boolean;
}

export interface HubSpotNodeState {
  connectionStatus: 'validating' | 'connected' | 'disconnected' | 'error';
  accountInfo?: HubSpotAccountInfo;
  availableObjects: string[];
  error?: string;
  isConfiguring: boolean;
}

const ConnectionStatusIndicator: React.FC<{
  status: 'validating' | 'connected' | 'disconnected' | 'error';
  isValidating?: boolean;
}> = ({ status, isValidating }) => {
  if (isValidating) {
    return (
      <div className="flex items-center gap-2 text-blue-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm font-medium">Validating...</span>
      </div>
    );
  }

  switch (status) {
    case 'connected':
      return (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Connected</span>
        </div>
      );
    case 'disconnected':
      return (
        <div className="flex items-center gap-2 text-orange-600">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm font-medium">Not Connected</span>
        </div>
      );
    case 'error':
      return (
        <div className="flex items-center gap-2 text-red-600">
          <XCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Connection Error</span>
        </div>
      );
    default:
      return (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">Checking...</span>
        </div>
      );
  }
};

const AccountInfoDisplay: React.FC<{
  accountInfo: HubSpotAccountInfo;
  compact?: boolean;
}> = ({ accountInfo, compact }) => {
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{accountInfo.portalName}</span>
        </div>
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{accountInfo.userEmail}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Portal</span>
          </div>
          <div className="pl-6">
            <p className="font-medium">{accountInfo.portalName}</p>
            <p className="text-sm text-muted-foreground">ID: {accountInfo.portalId}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Account</span>
          </div>
          <div className="pl-6">
            <p className="font-medium">{accountInfo.userEmail}</p>
            <div className="flex items-center gap-2 mt-1">
              <Crown className="h-3 w-3 text-yellow-500" />
              <span className="text-sm text-muted-foreground">{accountInfo.subscriptionTier}</span>
            </div>
          </div>
        </div>
      </div>

      {accountInfo.availableObjects.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Available Objects</span>
          </div>
          <div className="pl-6">
            <div className="flex flex-wrap gap-1">
              {accountInfo.availableObjects.slice(0, 6).map((object) => (
                <Badge key={object} variant="secondary" className="text-xs">
                  {object}
                </Badge>
              ))}
              {accountInfo.availableObjects.length > 6 && (
                <Badge variant="outline" className="text-xs">
                  +{accountInfo.availableObjects.length - 6} more
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}

      {accountInfo.apiLimits && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">API Usage</span>
          </div>
          <div className="pl-6">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      (accountInfo.apiLimits.currentUsage / accountInfo.apiLimits.dailyLimit) * 100,
                      100
                    )}%`
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {accountInfo.apiLimits.currentUsage.toLocaleString()} / {accountInfo.apiLimits.dailyLimit.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ErrorDisplay: React.FC<{
  error: string;
  errorCode?: string | null;
  suggestedAction?: string | null;
  onRetry?: () => void;
  onAuth?: () => void;
  requiresAuth?: boolean;
  isRetrying?: boolean;
}> = ({ error, errorCode, suggestedAction, onRetry, onAuth, requiresAuth, isRetrying }) => {
  return (
    <Alert className="border-red-200">
      <AlertTriangle className="h-4 w-4 text-red-600" />
      <AlertDescription>
        <div className="space-y-2">
          <div>
            <strong>Connection Error</strong>
            {errorCode && (
              <Badge variant="outline" className="ml-2 text-xs">
                {errorCode}
              </Badge>
            )}
          </div>
          <p className="text-sm">{error}</p>
          {suggestedAction && (
            <p className="text-sm text-muted-foreground italic">{suggestedAction}</p>
          )}
          <div className="flex gap-2 mt-3">
            {requiresAuth && onAuth && (
              <Button size="sm" onClick={onAuth} className="h-8">
                <ExternalLink className="h-3 w-3 mr-1" />
                Connect HubSpot
              </Button>
            )}
            {onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                disabled={isRetrying}
                className="h-8"
              >
                {isRetrying ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                Retry
              </Button>
            )}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export const HubSpotNode: React.FC<HubSpotNodeProps> = ({
  nodeId,
  onConnectionChange,
  onAccountInfoUpdate,
  onConfigureClick,
  className,
  showAccountDetails = true,
  showActions = true,
  compact = false
}) => {
  const [isConfiguring, setIsConfiguring] = useState(false);

  const {
    connectionStatus,
    accountInfo,
    error,
    errorCode,
    isLoading,
    isValidating,
    isAuthenticating,
    suggestedAction,
    lastValidated,
    validateConnection,
    initiateAuth,
    clearError,
    retryValidation
  } = useNodeIntegration('hubspot', nodeId, {
    autoValidate: true,
    onConnectionChange,
    onAccountInfoUpdate: (info) => {
      if (onAccountInfoUpdate && 'portalId' in info) {
        onAccountInfoUpdate(info as HubSpotAccountInfo);
      }
    },
    onError: (errorMessage) => {
      console.error('HubSpot node error:', errorMessage);
    }
  });

  const handleConfigureClick = () => {
    if (onConfigureClick) {
      setIsConfiguring(true);
      onConfigureClick();
      // Reset configuring state after a delay
      setTimeout(() => setIsConfiguring(false), 1000);
    }
  };

  const handleAuthClick = async () => {
    try {
      await initiateAuth();
    } catch (error) {
      console.error('Auth initiation failed:', error);
      toast.error('Failed to start authentication process');
    }
  };

  const handleRetryClick = async () => {
    clearError();
    await retryValidation();
  };

  const requiresAuth = connectionStatus === 'disconnected' || 
    (connectionStatus === 'error' && errorCode === 'AUTH_REQUIRED');

  if (compact) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <img
                  src="https://www.hubspot.com/hubfs/HubSpot_Logos/HubSpot-Inversed-Favicon.png"
                  alt="HubSpot"
                  className="w-5 h-5"
                />
                <span className="font-medium">HubSpot</span>
              </div>
              <ConnectionStatusIndicator status={connectionStatus} isValidating={isValidating} />
            </div>
            
            {showActions && (
              <div className="flex items-center gap-2">
                {requiresAuth ? (
                  <Button
                    size="sm"
                    onClick={handleAuthClick}
                    disabled={isAuthenticating}
                    className="h-7"
                  >
                    {isAuthenticating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      'Connect'
                    )}
                  </Button>
                ) : connectionStatus === 'connected' && onConfigureClick ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleConfigureClick}
                    disabled={isConfiguring}
                    className="h-7"
                  >
                    <Settings className="h-3 w-3" />
                  </Button>
                ) : null}
              </div>
            )}
          </div>

          {connectionStatus === 'connected' && accountInfo && showAccountDetails && (
            <div className="mt-3 pt-3 border-t">
              <AccountInfoDisplay accountInfo={accountInfo as HubSpotAccountInfo} compact />
            </div>
          )}

          {error && (
            <div className="mt-3">
              <Alert className="border-red-200">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-sm">
                  {error}
                  {requiresAuth && (
                    <Button
                      size="sm"
                      onClick={handleAuthClick}
                      disabled={isAuthenticating}
                      className="ml-2 h-6"
                    >
                      Connect
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full max-w-2xl', className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="https://www.hubspot.com/hubfs/HubSpot_Logos/HubSpot-Inversed-Favicon.png"
              alt="HubSpot"
              className="w-6 h-6"
            />
            <span>HubSpot Integration</span>
          </div>
          <ConnectionStatusIndicator status={connectionStatus} isValidating={isValidating} />
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading && !isValidating && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading HubSpot connection...</span>
          </div>
        )}

        {error && (
          <ErrorDisplay
            error={error}
            errorCode={errorCode}
            suggestedAction={suggestedAction}
            onRetry={handleRetryClick}
            onAuth={handleAuthClick}
            requiresAuth={requiresAuth}
            isRetrying={isValidating}
          />
        )}

        {connectionStatus === 'connected' && accountInfo && showAccountDetails && (
          <>
            <Separator />
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-600" />
                Account Information
              </h4>
              <AccountInfoDisplay accountInfo={accountInfo as HubSpotAccountInfo} />
            </div>
          </>
        )}

        {showActions && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {lastValidated && (
                  <span>Last checked: {lastValidated.toLocaleTimeString()}</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={validateConnection}
                  disabled={isValidating}
                >
                  {isValidating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh
                </Button>

                {requiresAuth ? (
                  <Button
                    onClick={handleAuthClick}
                    disabled={isAuthenticating}
                  >
                    {isAuthenticating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Connect HubSpot
                      </>
                    )}
                  </Button>
                ) : connectionStatus === 'connected' && onConfigureClick ? (
                  <Button
                    onClick={handleConfigureClick}
                    disabled={isConfiguring}
                  >
                    {isConfiguring ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Settings className="h-4 w-4 mr-2" />
                    )}
                    Configure
                  </Button>
                ) : null}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default HubSpotNode;