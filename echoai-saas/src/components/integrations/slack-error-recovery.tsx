import React from 'react';
import { AlertTriangle, RefreshCw, ExternalLink, Info, Clock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SlackErrorRecoveryProps {
  error: string;
  errorType?: string;
  isRetryable?: boolean;
  retryAfter?: number;
  recoveryInstructions?: string[];
  onRetry?: () => void;
  onNavigateToSettings?: () => void;
  className?: string;
}

/**
 * Comprehensive error recovery component for Slack integration errors
 */
export function SlackErrorRecovery({
  error,
  errorType = 'unknown',
  isRetryable = false,
  retryAfter,
  recoveryInstructions = [],
  onRetry,
  onNavigateToSettings,
  className
}: SlackErrorRecoveryProps) {
  const getErrorIcon = () => {
    switch (errorType) {
      case 'rate_limited':
        return <Clock className="h-4 w-4" />;
      case 'auth_failed':
      case 'permission_denied':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getErrorVariant = () => {
    switch (errorType) {
      case 'rate_limited':
        return 'default' as const;
      case 'auth_failed':
      case 'permission_denied':
        return 'destructive' as const;
      case 'service_unavailable':
      case 'network_error':
        return 'default' as const;
      default:
        return 'destructive' as const;
    }
  };

  const getErrorTitle = () => {
    switch (errorType) {
      case 'auth_failed':
        return 'Authentication Required';
      case 'permission_denied':
        return 'Permission Denied';
      case 'rate_limited':
        return 'Rate Limited';
      case 'service_unavailable':
        return 'Service Unavailable';
      case 'network_error':
        return 'Connection Error';
      case 'integration_not_found':
        return 'Integration Not Found';
      case 'workspace_mismatch':
        return 'Workspace Mismatch';
      default:
        return 'Error';
    }
  };

  const formatRetryTime = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds} seconds`;
    } else if (seconds < 3600) {
      return `${Math.ceil(seconds / 60)} minutes`;
    } else {
      return `${Math.ceil(seconds / 3600)} hours`;
    }
  };

  const shouldShowRetryButton = () => {
    return isRetryable && onRetry && (!retryAfter || retryAfter <= 0);
  };

  const shouldShowSettingsButton = () => {
    return ['auth_failed', 'integration_not_found', 'permission_denied'].includes(errorType) && onNavigateToSettings;
  };

  return (
    <div className={className}>
      <Alert variant={getErrorVariant()}>
        {getErrorIcon()}
        <AlertTitle>{getErrorTitle()}</AlertTitle>
        <AlertDescription className="mt-2">
          {error}
        </AlertDescription>
      </Alert>

      {retryAfter && retryAfter > 0 && (
        <Alert className="mt-4">
          <Clock className="h-4 w-4" />
          <AlertTitle>Please Wait</AlertTitle>
          <AlertDescription>
            You can retry this operation in {formatRetryTime(retryAfter)}.
          </AlertDescription>
        </Alert>
      )}

      {recoveryInstructions.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              How to Fix This
            </CardTitle>
            <CardDescription>
              Follow these steps to resolve the issue:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2">
              {recoveryInstructions.map((instruction, index) => (
                <li key={index} className="text-sm">
                  {instruction}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 mt-4">
        {shouldShowRetryButton() && (
          <Button
            onClick={onRetry}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        )}

        {shouldShowSettingsButton() && (
          <Button
            onClick={onNavigateToSettings}
            variant="default"
            size="sm"
            className="flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Go to Settings
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Simplified error display for inline use
 */
export function SlackErrorInline({
  error,
  errorType: _errorType,
  isRetryable,
  onRetry,
  className
}: Pick<SlackErrorRecoveryProps, 'error' | 'errorType' | 'isRetryable' | 'onRetry' | 'className'>) {
  return (
    <div className={`flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-md ${className}`}>
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <span className="text-sm text-red-700">{error}</span>
      </div>
      {isRetryable && onRetry && (
        <Button
          onClick={onRetry}
          variant="ghost"
          size="sm"
          className="text-red-700 hover:text-red-800"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

/**
 * Rate limit specific component with countdown
 */
export function SlackRateLimitDisplay({
  retryAfter,
  onRetryAvailable,
  className
}: {
  retryAfter: number;
  onRetryAvailable?: () => void;
  className?: string;
}) {
  const [timeLeft, setTimeLeft] = React.useState(retryAfter);

  React.useEffect(() => {
    if (timeLeft <= 0) {
      onRetryAvailable?.();
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, onRetryAvailable]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md ${className}`}>
      <Clock className="h-4 w-4 text-yellow-600" />
      <span className="text-sm text-yellow-700">
        Rate limited. Retry available in {formatTime(timeLeft)}
      </span>
    </div>
  );
}