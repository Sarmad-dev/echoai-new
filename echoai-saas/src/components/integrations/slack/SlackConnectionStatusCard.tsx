import React from "react";
import { SlackConnectionState } from "@/types/slack";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { SlackIntegrationSelector } from "./SlackIntegrationSelector";

interface SlackConnectionStatusCardProps {
  connectionState: SlackConnectionState;
  onRetry?: () => void;
  showIntegrationSelector?: boolean;
  className?: string;
}

const getStatusIcon = (status: SlackConnectionState["status"]) => {
  switch (status) {
    case "connected":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "disconnected":
      return <XCircle className="h-5 w-5 text-red-500" />;
    case "error":
      return <AlertTriangle className="h-5 w-5 text-red-500" />;
    case "rate_limited":
      return <Clock className="h-5 w-5 text-yellow-500" />;
    case "checking":
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    default:
      return <RefreshCw className="h-5 w-5 text-gray-400" />;
  }
};

const getStatusBadge = (status: SlackConnectionState["status"]) => {
  const variants = {
    connected: { variant: "default" as const, text: "Connected" },
    disconnected: { variant: "destructive" as const, text: "Disconnected" },
    error: { variant: "destructive" as const, text: "Error" },
    rate_limited: { variant: "secondary" as const, text: "Rate Limited" },
    checking: { variant: "outline" as const, text: "Checking..." },
  };

  const config = variants[status] || {
    variant: "outline" as const,
    text: "Unknown",
  };

  return <Badge variant={config.variant}>{config.text}</Badge>;
};

export function SlackConnectionStatusCard({
  connectionState,
  onRetry,
  showIntegrationSelector = true,
  className,
}: SlackConnectionStatusCardProps) {
  const {
    status,
    selectedIntegrationId,
    availableIntegrations,
    connectionData,
    error,
    errorType,
    retryAfter,
    recoveryInstructions,
    isRetryable,
    checkConnection,
    selectIntegration,
  } = connectionState;

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      checkConnection(selectedIntegrationId);
    }
  };

  const handleIntegrationSelect = async (integrationId: string) => {
    await selectIntegration(integrationId);
  };

  const handleRefreshIntegrations = () => {
    checkConnection();
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon(status)}
            <span>Slack Connection</span>
          </div>
          {getStatusBadge(status)}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Integration Selector */}
        {showIntegrationSelector && (
          <SlackIntegrationSelector
            integrations={availableIntegrations}
            selectedIntegrationId={selectedIntegrationId}
            onIntegrationSelect={handleIntegrationSelect}
            onRefresh={handleRefreshIntegrations}
            loading={status === "checking"}
            error={errorType === "integration_not_found" ? undefined : error}
          />
        )}

        {/* Connection Status Details */}
        {status === "connected" && connectionData && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-800">
                Successfully Connected
              </span>
            </div>
            <div className="text-sm text-green-700 space-y-1">
              <div>
                <strong>Workspace:</strong> {connectionData.teamName}
              </div>
              <div>
                <strong>Connected as:</strong> {connectionData.userName}
              </div>
              {connectionData.botId && (
                <div>
                  <strong>Bot ID:</strong> {connectionData.botId}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Display */}
        {(status === "error" ||
          status === "disconnected" ||
          status === "rate_limited") &&
          error && (
            <Alert
              variant={status === "rate_limited" ? "default" : "destructive"}
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p>{error}</p>

                  {retryAfter && (
                    <p className="text-sm">
                      Please wait {retryAfter} seconds before retrying.
                    </p>
                  )}

                  {recoveryInstructions && recoveryInstructions.length > 0 && (
                    <div>
                      <p className="font-medium text-sm mb-1">
                        To fix this issue:
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-sm">
                        {recoveryInstructions.map((instruction, index) => (
                          <li key={index}>{instruction}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {(isRetryable || status === "disconnected") && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={status === "checking" || Boolean(retryAfter && retryAfter > 0)}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${
                  status === "checking" ? "animate-spin" : ""
                }`}
              />
              {status === "checking" ? "Checking..." : "Retry Connection"}
            </Button>
          )}

          {errorType === "auth_failed" && (
            <Button
              variant="default"
              size="sm"
              onClick={() => window.open("/dashboard/integrations", "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Reconnect Slack
            </Button>
          )}

          {errorType === "integration_not_found" && (
            <Button
              variant="default"
              size="sm"
              onClick={() => window.open("/dashboard/integrations", "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Setup Slack Integration
            </Button>
          )}
        </div>

        {/* Loading State */}
        {status === "checking" && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span className="ml-2 text-sm text-muted-foreground">
              Checking Slack connection...
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
