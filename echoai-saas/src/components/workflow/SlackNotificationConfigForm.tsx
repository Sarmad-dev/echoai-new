/**
 * Slack Notification Configuration Form
 *
 * Provides a specialized configuration form for Slack notification actions
 * with connection checking, channel/user selection, and notification-specific options.
 */

"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SlackConnectionStatusCard,
  SlackChannelSelector,
  SlackUserSelector,
} from "@/components/integrations/slack";
import { useSlackConnection } from "@/hooks/useSlackConnection";
import { useSlackChannels } from "@/hooks/useSlackChannels";
import { useSlackUsers } from "@/hooks/useSlackUsers";
import type { ActionConfig } from "@/lib/workflow/actions";
import type { SlackActionConfig } from "@/lib/integrations/slack-actions";

interface SlackNotificationConfigFormProps {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
}

export function SlackNotificationConfigForm({
  config,
  onChange,
}: SlackNotificationConfigFormProps) {
  // Cast config to SlackActionConfig for type safety
  const slackConfig = config as SlackActionConfig;

  // Use shared hooks for connection and data management
  const connectionState = useSlackConnection();
  const channelsState = useSlackChannels(connectionState.status, connectionState.selectedIntegrationId);
  const usersState = useSlackUsers(connectionState.status, connectionState.selectedIntegrationId);

  // Helper function to update configuration
  const updateConfig = (updates: Partial<SlackActionConfig>) => {
    const updatedConfig = { ...slackConfig, ...updates };
    
    // Always include the selected integration ID in the config
    if (connectionState.selectedIntegrationId) {
      updatedConfig.integrationId = connectionState.selectedIntegrationId;
    }
    
    onChange(updatedConfig);
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <SlackConnectionStatusCard
        connectionState={connectionState}
        onRetry={connectionState.checkConnection}
      />

      {/* Only show configuration options if connected */}
      {connectionState.status === "connected" && (
        <>
          {/* Notification Type and Urgency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="notificationType">Notification Type</Label>
              <Select
                value={slackConfig.notificationType || "info"}
                onValueChange={(value) =>
                  updateConfig({
                    notificationType: value as
                      | "info"
                      | "warning"
                      | "error"
                      | "success",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select notification type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">ℹ️ Info</SelectItem>
                  <SelectItem value="success">✅ Success</SelectItem>
                  <SelectItem value="warning">⚠️ Warning</SelectItem>
                  <SelectItem value="error">❌ Error</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                Determines the visual styling and icon for the notification
              </p>
            </div>

            <div>
              <Label htmlFor="urgency">Urgency Level</Label>
              <Select
                value={slackConfig.urgency || "medium"}
                onValueChange={(value) =>
                  updateConfig({
                    urgency: value as "low" | "medium" | "high" | "critical",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select urgency level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">🔵 Low</SelectItem>
                  <SelectItem value="medium">🟡 Medium</SelectItem>
                  <SelectItem value="high">🟠 High</SelectItem>
                  <SelectItem value="critical">🔴 Critical</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                Affects notification priority and formatting
              </p>
            </div>
          </div>

          {/* Message Template */}
          <div>
            <Label htmlFor="message">Notification Message</Label>
            <Textarea
              id="message"
              value={slackConfig.message || ""}
              onChange={(e) => updateConfig({ message: e.target.value })}
              placeholder="Enter your notification message. Use {{variable}} for dynamic content."
              rows={4}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Available variables:{" "}
              {`{{userEmail}}, {{userName}}, {{userPhone}}, {{conversationId}}, {{message}}, {{timestamp}}, {{sentimentScore}}, {{company}}`}
            </p>
          </div>

          {/* Channel Selection */}
          <div>
            <Label htmlFor="channel">Target Channel or User</Label>
            <SlackChannelSelector
              channels={channelsState.channels}
              loading={channelsState.loading}
              value={slackConfig.channel || ""}
              onChange={(channelId) => updateConfig({ channel: channelId })}
              placeholder="Select a channel or search by name"
              error={channelsState.error}
            />
            <p className="text-sm text-muted-foreground mt-1">
              You can also use variables like {`{{userEmail}}`} to send
              notifications dynamically
            </p>
          </div>

          {/* User Selection (Alternative to Channel) */}
          <div>
            <Label htmlFor="user">Or Send Direct Message to User</Label>
            <SlackUserSelector
              users={usersState.users}
              loading={usersState.loading}
              value={slackConfig.user || ""}
              onChange={(userId) => updateConfig({ user: userId, channel: "" })}
              placeholder="Select a user for direct message"
              error={usersState.error}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Selecting a user will override the channel selection above
            </p>
          </div>

          {/* Bot Appearance */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="username">Bot Username</Label>
              <Input
                id="username"
                value={slackConfig.username || "EchoAI Notifications"}
                onChange={(e) => updateConfig({ username: e.target.value })}
                placeholder="EchoAI Notifications"
              />
            </div>

            <div>
              <Label htmlFor="iconEmoji">Icon Emoji</Label>
              <Input
                id="iconEmoji"
                value={slackConfig.iconEmoji || ":bell:"}
                onChange={(e) => updateConfig({ iconEmoji: e.target.value })}
                placeholder=":bell:"
              />
            </div>
          </div>

          {/* Advanced Options */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="includeContext"
                checked={slackConfig.includeContext || false}
                onCheckedChange={(checked) =>
                  updateConfig({ includeContext: checked })
                }
              />
              <Label htmlFor="includeContext">
                Include conversation context in notification
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="includeTriggerData"
                checked={slackConfig.includeTriggerData || false}
                onCheckedChange={(checked) =>
                  updateConfig({ includeTriggerData: checked })
                }
              />
              <Label htmlFor="includeTriggerData">
                Include trigger data and workflow information
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="retryOnRateLimit"
                checked={slackConfig.retryOnRateLimit !== false}
                onCheckedChange={(checked) =>
                  updateConfig({ retryOnRateLimit: checked })
                }
              />
              <Label htmlFor="retryOnRateLimit">
                Automatically retry if rate limited
              </Label>
            </div>
          </div>

          {/* Retry Configuration */}
          <div>
            <Label htmlFor="maxRetries">Maximum Retry Attempts</Label>
            <Input
              id="maxRetries"
              type="number"
              min="0"
              max="10"
              value={slackConfig.maxRetries || 3}
              onChange={(e) =>
                updateConfig({ maxRetries: parseInt(e.target.value) || 3 })
              }
            />
            <p className="text-sm text-muted-foreground mt-1">
              Number of times to retry sending the notification if it fails
              (0-10)
            </p>
          </div>
        </>
      )}
    </div>
  );
}
