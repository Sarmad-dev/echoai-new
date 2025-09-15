/**
 * Slack Thread Reply Configuration Form
 *
 * Provides a specialized configuration form for Slack thread reply actions
 * with connection checking, channel/user selection, and thread-specific options.
 */

"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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

interface SlackThreadReplyConfigFormProps {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
}

export function SlackThreadReplyConfigForm({
  config,
  onChange,
}: SlackThreadReplyConfigFormProps) {
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
          {/* Thread Configuration */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="threadTs">Thread Timestamp</Label>
              <Input
                id="threadTs"
                value={slackConfig.threadTs || ""}
                onChange={(e) => updateConfig({ threadTs: e.target.value })}
                placeholder="Enter the timestamp of the parent message (e.g., 1234567890.123456)"
              />
              <p className="text-sm text-muted-foreground mt-1">
                The timestamp of the message you want to reply to. You can get this from the message permalink or use variables like {`{{messageTs}}`}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="replyBroadcast"
                checked={slackConfig.replyBroadcast || false}
                onCheckedChange={(checked) =>
                  updateConfig({ replyBroadcast: checked })
                }
              />
              <Label htmlFor="replyBroadcast">
                Broadcast reply to channel
              </Label>
              <p className="text-sm text-muted-foreground">
                When enabled, the reply will also be posted to the main channel
              </p>
            </div>
          </div>

          {/* Message Template */}
          <div>
            <Label htmlFor="message">Reply Message</Label>
            <Textarea
              id="message"
              value={slackConfig.message || ""}
              onChange={(e) => updateConfig({ message: e.target.value })}
              placeholder="Enter your thread reply message. Use {{variable}} for dynamic content."
              rows={4}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Available variables:{" "}
              {`{{userEmail}}, {{userName}}, {{userPhone}}, {{conversationId}}, {{message}}, {{timestamp}}, {{sentimentScore}}, {{company}}`}
            </p>
          </div>

          {/* Channel Selection */}
          <div>
            <Label htmlFor="channel">Target Channel</Label>
            <SlackChannelSelector
              channels={channelsState.channels}
              loading={channelsState.loading}
              value={slackConfig.channel || ""}
              onChange={(channelId) => updateConfig({ channel: channelId })}
              placeholder="Select the channel where the thread exists"
              error={channelsState.error}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Select the channel where the original message thread is located
            </p>
          </div>

          {/* User Selection (Alternative to Channel) */}
          <div>
            <Label htmlFor="user">Or Reply in Direct Message Thread</Label>
            <SlackUserSelector
              users={usersState.users}
              loading={usersState.loading}
              value={slackConfig.user || ""}
              onChange={(userId) => updateConfig({ user: userId, channel: "" })}
              placeholder="Select a user for direct message thread reply"
              error={usersState.error}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Selecting a user will override the channel selection above for DM thread replies
            </p>
          </div>

          {/* Bot Appearance */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="username">Bot Username</Label>
              <Input
                id="username"
                value={slackConfig.username || "EchoAI Bot"}
                onChange={(e) => updateConfig({ username: e.target.value })}
                placeholder="EchoAI Bot"
              />
            </div>

            <div>
              <Label htmlFor="iconEmoji">Icon Emoji</Label>
              <Input
                id="iconEmoji"
                value={slackConfig.iconEmoji || ":robot_face:"}
                onChange={(e) => updateConfig({ iconEmoji: e.target.value })}
                placeholder=":robot_face:"
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
                Include conversation context in reply
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
              Number of times to retry sending the thread reply if it fails
              (0-10)
            </p>
          </div>

          {/* Thread Reply Help */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">
              💡 Thread Reply Tips
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>
                • Thread timestamps can be found in message permalinks or captured from previous workflow steps
              </li>
              <li>
                • Use broadcast sparingly to avoid channel noise - only for important updates
              </li>
              <li>
                • Thread replies maintain conversation context and keep channels organized
              </li>
              <li>
                • Variables like {`{{messageTs}}`} can be used if captured from trigger data
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}