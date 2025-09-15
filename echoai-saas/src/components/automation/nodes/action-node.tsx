"use client";

import React, { memo, useState, useEffect, useCallback } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import {
  Play,
  Settings,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ActionNodeData {
  label: string;
  nodeType?: string;
  config: Record<string, unknown>;
}

interface IntegrationStatus {
  connected: boolean;
  loading: boolean;
  error?: string;
}

export const ActionNode = memo(
  ({ data, selected }: NodeProps<ActionNodeData>) => {
    const [integrationStatus, setIntegrationStatus] =
      useState<IntegrationStatus>({
        connected: false,
        loading: false,
      });

    useEffect(() => {
      checkIntegrationStatus();
    }, [data.nodeType]);

    const checkIntegrationStatus = useCallback(async () => {
      if (!requiresIntegration(data.nodeType)) {
        return;
      }

      setIntegrationStatus({ connected: false, loading: true });

      try {
        const provider = getProviderFromNodeType(data.nodeType);
        if (!provider) return;

        const response = await fetch(`/api/integrations/${provider}/status`);
        const result = await response.json();

        setIntegrationStatus({
          connected: result.connected,
          loading: false,
          error: result.error,
        });
      } catch (error) {
        setIntegrationStatus({
          connected: false,
          loading: false,
          error: "Failed to check integration status",
        });
      }
    }, []);

    const requiresIntegration = (nodeType?: string): boolean => {
      return [
        "send_slack_message",
        "create_hubspot_contact",
        "log_to_google_sheets",
      ].includes(nodeType || "");
    };

    const getProviderFromNodeType = (nodeType?: string): string | null => {
      switch (nodeType) {
        case "send_slack_message":
          return "slack";
        case "create_hubspot_contact":
          return "hubspot";
        case "log_to_google_sheets":
          return "google-sheets";
        default:
          return null;
      }
    };

    const getNodeIcon = (nodeType?: string) => {
      switch (nodeType) {
        case "send_slack_message":
          return (
            <div className="w-3 h-3 bg-[#4A154B] rounded text-white text-xs flex items-center justify-center font-bold">
              S
            </div>
          );
        case "create_hubspot_contact":
          return (
            <div className="w-3 h-3 bg-[#FF7A59] rounded text-white text-xs flex items-center justify-center font-bold">
              H
            </div>
          );
        case "log_to_google_sheets":
          return (
            <div className="w-3 h-3 bg-[#34A853] rounded text-white text-xs flex items-center justify-center font-bold">
              G
            </div>
          );
        default:
          return <Play className="w-3 h-3" />;
      }
    };

    const getStatusIndicator = () => {
      if (!requiresIntegration(data.nodeType)) {
        return null;
      }

      if (integrationStatus.loading) {
        return <Loader2 className="w-3 h-3 animate-spin text-gray-500" />;
      }

      if (integrationStatus.connected) {
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      }

      return <AlertCircle className="w-3 h-3 text-red-500" />;
    };

    const getNodeColor = () => {
      if (!requiresIntegration(data.nodeType)) {
        return selected ? "border-primary" : "border-border";
      }

      if (integrationStatus.loading) {
        return "border-gray-300";
      }

      if (integrationStatus.connected) {
        return selected ? "border-primary" : "border-green-200";
      }

      return selected ? "border-primary" : "border-red-200";
    };

    const getBackgroundColor = () => {
      if (!requiresIntegration(data.nodeType)) {
        return "bg-card";
      }

      if (integrationStatus.connected) {
        return "bg-green-50/50";
      }

      if (integrationStatus.error) {
        return "bg-red-50/50";
      }

      return "bg-card";
    };

    return (
      <div
        className={`
      px-4 py-3 shadow-lg rounded-lg border-2 min-w-[200px] transition-colors
      ${getBackgroundColor()} ${getNodeColor()}
    `}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1 bg-blue-500 text-white rounded">
            {getNodeIcon(data.nodeType)}
          </div>
          <div className="font-medium text-sm">Action</div>
          <div className="ml-auto flex items-center gap-1">
            {getStatusIndicator()}
            <button className="p-1 hover:bg-accent rounded">
              <Settings className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="text-sm font-medium mb-1">{data.label}</div>

        <div className="flex items-center gap-2 flex-wrap">
          {Object.keys(data.config).length > 0 && (
            <Badge variant="secondary" className="text-xs">
              Configured
            </Badge>
          )}

          {requiresIntegration(data.nodeType) && (
            <Badge
              variant={integrationStatus.connected ? "default" : "destructive"}
              className="text-xs"
            >
              {integrationStatus.loading
                ? "Checking..."
                : integrationStatus.connected
                ? "Connected"
                : "Not Connected"}
            </Badge>
          )}
        </div>

        {integrationStatus.error && (
          <div className="text-xs text-red-600 mt-1">
            {integrationStatus.error}
          </div>
        )}

        {/* Input handle */}
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 bg-blue-500 border-2 border-white"
        />

        {/* Output handle */}
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 bg-blue-500 border-2 border-white"
        />
      </div>
    );
  }
);

ActionNode.displayName = "ActionNode";
