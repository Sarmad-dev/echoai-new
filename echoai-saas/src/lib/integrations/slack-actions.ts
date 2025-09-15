/**
 * Slack Integration Action Handlers
 *
 * Provides comprehensive Slack messaging actions for automation workflows:
 * - SendSlackMessage: Send messages to channels or users with rich formatting
 * - SendSlackNotification: Send structured notifications with attachments
 * - SendSlackAlert: Send urgent alerts with escalation options
 * - UpdateSlackMessage: Update existing messages
 * - SendSlackThread: Send threaded replies
 */

import {
  ActionHandler,
  ActionConfig,
  ValidationResult,
  ActionConfigSchema,
  ActionResult,
} from "../workflow/actions";
import { WorkflowContext } from "../workflow-execution-engine";
import {
  SlackApiClient,
  SlackRateLimitError,
  SlackAttachment,
} from "./slack-client";
import { OAuth2Manager } from "./oauth2-manager";
import { getProvider } from "./providers";
import * as crypto from "crypto";

export interface SlackActionConfig extends ActionConfig {
  // Message content
  message?: string;
  text?: string;

  // Channel/User targeting
  channel?: string;
  user?: string;
  userEmail?: string;

  // Message formatting
  username?: string;
  iconEmoji?: string;
  iconUrl?: string;

  // Threading
  threadTs?: string;
  replyBroadcast?: boolean;

  // Rich content
  attachments?: SlackAttachment[];
  includeContext?: boolean;
  includeTriggerData?: boolean;

  // Notification settings
  notificationType?: "info" | "warning" | "error" | "success";
  urgency?: "low" | "medium" | "high" | "critical";

  // Integration settings
  integrationId?: string;
  retryOnRateLimit?: boolean;
  maxRetries?: number;

  // Message update settings
  messageTs?: string;
  updateExisting?: boolean;
}

/**
 * Base class for Slack actions with common functionality
 */
abstract class BaseSlackAction implements ActionHandler {
  abstract type: string;

  protected oauth2Manager = new OAuth2Manager();

  /**
   * Decrypt token using the same logic as API endpoints
   */
  private decryptToken(encryptedText: string): string {
    const encryptionKey =
      process.env.INTEGRATION_ENCRYPTION_KEY ||
      "default-key-change-in-production";
    const algorithm = "aes-256-cbc";
    const key = crypto.scryptSync(encryptionKey, "salt", 32);
    const parts = encryptedText.split(":");

    if (parts.length === 2) {
      // New format: iv:encrypted
      const [ivHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, "hex");
      const decipher = crypto.createDecipheriv(algorithm, key, iv);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } else if (parts.length === 3) {
      // Old GCM format: iv:authTag:encrypted - handle gracefully
      const [, , encrypted] = parts;
      // Use a default IV for legacy data - this is a fallback for old encrypted data
      const defaultIv = Buffer.alloc(16, 0);
      const decipher = crypto.createDecipheriv(algorithm, key, defaultIv);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } else {
      throw new Error("Invalid encrypted data format");
    }
  }

  /**
   * Get integration using server-side Supabase client (for workflow execution)
   */
  private async getIntegrationServerSide(
    integrationId: string,
    userId: string
  ) {
    // Dynamically import server-side client to avoid client-side issues
    const { createClient } = await import("../supabase/supabase");
    const supabase = await createClient();

    const { data: integration, error } = await supabase
      .from("Integration")
      .select("*")
      .eq("id", integrationId)
      .eq("userId", userId)
      .eq("provider", "slack")
      .eq("isActive", true)
      .single();

    if (error || !integration) {
      return null;
    }

    // Decrypt tokens before returning
    return {
      ...integration,
      accessToken: this.decryptToken(integration.accessToken),
      refreshToken: integration.refreshToken
        ? this.decryptToken(integration.refreshToken)
        : undefined,
      tokenExpiry: integration.tokenExpiry
        ? new Date(integration.tokenExpiry)
        : undefined,
      createdAt: new Date(integration.createdAt),
      updatedAt: new Date(integration.updatedAt),
    };
  }

  /**
   * Get Slack client for the configured integration
   */
  protected async getSlackClient(
    config: SlackActionConfig,
    context: WorkflowContext
  ): Promise<SlackApiClient> {
    if (!config.integrationId) {
      throw new Error("Slack integration ID is required");
    }

    let integration;

    // Use server-side approach if we have userId in context (workflow execution)
    if (context.userId) {
      integration = await this.getIntegrationServerSide(
        config.integrationId,
        context.userId
      );
    } else {
      // Fallback to OAuth2Manager for other cases
      integration = await this.oauth2Manager.getIntegrationById(
        config.integrationId
      );
    }

    if (!integration) {
      throw new Error("Slack integration not found");
    }

    if (!integration.isActive) {
      throw new Error("Slack integration is not active");
    }

    // Check if token needs refresh
    if (integration.tokenExpiry && integration.tokenExpiry < new Date()) {
      const provider = getProvider("slack");
      if (!provider) {
        throw new Error("Slack provider configuration not found");
      }

      const refreshedIntegration = await this.oauth2Manager.refreshAccessToken(
        config.integrationId,
        provider
      );

      if (!refreshedIntegration) {
        throw new Error("Failed to refresh Slack access token");
      }

      return new SlackApiClient(refreshedIntegration);
    }

    return new SlackApiClient(integration);
  }

  /**
   * Handle rate limiting with retry logic
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: SlackActionConfig
  ): Promise<T> {
    const maxRetries = config.maxRetries || 3;
    const retryOnRateLimit = config.retryOnRateLimit !== false;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (error instanceof SlackRateLimitError && retryOnRateLimit) {
          if (attempt < maxRetries - 1) {
            // Wait for the retry-after period plus a small buffer
            const waitTime = (error.retryAfter + 1) * 1000;
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            continue;
          }
        }
        throw error;
      }
    }

    throw new Error("Max retries exceeded");
  }

  /**
   * Process template variables in message content
   */
  protected processTemplate(
    template: string,
    context: WorkflowContext
  ): string {
    let processed = template;

    // Replace context variables
    Object.entries(context.triggerData).forEach(([key, value]) => {
      processed = processed.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, "g"),
        String(value)
      );
    });

    // Replace common variables
    processed = processed.replace(
      /\{\{timestamp\}\}/g,
      new Date().toISOString()
    );
    processed = processed.replace(/\{\{executionId\}\}/g, context.executionId);
    processed = processed.replace(/\{\{triggerType\}\}/g, context.triggerId);
    processed = processed.replace(
      /\{\{date\}\}/g,
      new Date().toLocaleDateString()
    );
    processed = processed.replace(
      /\{\{time\}\}/g,
      new Date().toLocaleTimeString()
    );

    return processed;
  }

  /**
   * Resolve channel or user ID
   */
  protected async resolveTarget(
    client: SlackApiClient,
    config: SlackActionConfig
  ): Promise<string> {
    // If channel is specified, use it
    if (config.channel) {
      return SlackApiClient.formatChannelName(config.channel);
    }

    // If user is specified, use it
    if (config.user) {
      return config.user.startsWith("@") ? config.user.slice(1) : config.user;
    }

    // If userEmail is specified, look up the user
    if (config.userEmail) {
      const user = await client.getUserByEmail(config.userEmail);
      if (user) {
        return user.id;
      }
      throw new Error(
        `User with email ${config.userEmail} not found in Slack workspace`
      );
    }

    throw new Error("Channel, user, or userEmail must be specified");
  }

  /**
   * Create context attachment if requested
   */
  protected createContextAttachment(
    config: SlackActionConfig,
    context: WorkflowContext
  ): SlackAttachment | null {
    if (!config.includeContext && !config.includeTriggerData) {
      return null;
    }

    if (config.includeTriggerData) {
      return SlackApiClient.createTriggerAttachment(
        context.triggerId,
        context.triggerData
      );
    }

    return {
      fallback: "Workflow Context",
      color: "good",
      title: "Workflow Context",
      fields: [
        {
          title: "Execution ID",
          value: context.executionId,
          short: true,
        },
        {
          title: "Trigger Type",
          value: context.triggerId,
          short: true,
        },
        {
          title: "Timestamp",
          value: new Date().toISOString(),
          short: true,
        },
      ],
      footer: "EchoAI Automation",
      ts: Math.floor(Date.now() / 1000),
    };
  }

  abstract execute(
    config: SlackActionConfig,
    context: WorkflowContext
  ): Promise<ActionResult>;
  abstract validateConfig(config: SlackActionConfig): ValidationResult;
  abstract getConfigSchema(): ActionConfigSchema;
}

/**
 * Send Slack Message Action
 * Sends messages to Slack channels or users with rich formatting options
 */
export class SendSlackMessageAction extends BaseSlackAction {
  type = "send_slack_message";

  async execute(
    config: SlackActionConfig,
    context: WorkflowContext
  ): Promise<ActionResult> {
    try {
      console.log('SendSlackMessageAction.execute called with config:', JSON.stringify(config, null, 2));
      
      // If no integration ID is provided, simulate the action for testing
      if (!config.integrationId) {
        console.log('No Slack integration ID provided, simulating message send');
        
        const message = this.processTemplate(
          config.message || config.text || "",
          context
        );

        if (!message.trim()) {
          return {
            success: false,
            error: "Message content is required",
          };
        }

        const channel = config.channel || '#general';
        
        // Simulate successful message send
        console.log(`[SIMULATED] Slack message sent to ${channel}: ${message}`);
        
        return {
          success: true,
          data: {
            messageId: `simulated_${Date.now()}`,
            channel: channel,
            timestamp: Date.now().toString(),
            text: message,
            simulated: true,
          },
        };
      }

      const client = await this.getSlackClient(config, context);

      const message = this.processTemplate(
        config.message || config.text || "",
        context
      );

      if (!message.trim()) {
        return {
          success: false,
          error: "Message content is required",
        };
      }

      const target = await this.resolveTarget(client, config);

      if (!target) {
        return {
          success: false,
          error: "Failed to resolve target channel or user",
        };
      }

      // Prepare attachments
      const attachments: SlackAttachment[] = [];

      // Add custom attachments
      if (config.attachments) {
        attachments.push(...config.attachments);
      }

      // Add context attachment if requested
      const contextAttachment = this.createContextAttachment(config, context);
      if (contextAttachment) {
        attachments.push(contextAttachment);
      }

      const result = await this.executeWithRetry(async () => {
        return await client.sendMessage({
          channel: target,
          text: message,
          attachments: attachments.length > 0 ? attachments : undefined,
          username: config.username,
          icon_emoji: config.iconEmoji,
          icon_url: config.iconUrl,
          thread_ts: config.threadTs,
          reply_broadcast: config.replyBroadcast,
        });
      }, config);

      return {
        success: true,
        data: {
          messageId: result.ts,
          channel: result.channel,
          timestamp: result.ts,
          text: message,
          slackUrl: `slack://channel?team=${result.channel}&id=${result.channel}`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to send Slack message",
      };
    }
  }

  validateConfig(config: SlackActionConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.integrationId) {
      warnings.push("Slack integration ID not provided - will simulate message sending");
    }

    if (!config.message && !config.text) {
      errors.push("Message content is required");
    }

    if (!config.channel && !config.user && !config.userEmail) {
      warnings.push("No target specified, will use #general as default");
    }

    if (config.channel && config.user) {
      warnings.push("Both channel and user specified, channel will be used");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getConfigSchema(): ActionConfigSchema {
    return {
      type: this.type,
      title: "Send Slack Message",
      description: "Send a message to a Slack channel or user",
      properties: {
        integrationId: {
          type: "string",
          title: "Slack Integration",
          description: "Select the Slack integration to use",
        },
        message: {
          type: "string",
          title: "Message",
          description:
            "The message to send (supports template variables like {{userEmail}}, {{timestamp}})",
        },
        channel: {
          type: "string",
          title: "Channel",
          description:
            "Slack channel name (e.g., #general, general, or channel ID)",
        },
        user: {
          type: "string",
          title: "User",
          description: "Slack username or user ID to send direct message",
        },
        userEmail: {
          type: "string",
          title: "User Email",
          description: "Email address to look up Slack user",
        },
        username: {
          type: "string",
          title: "Bot Username",
          description: "Custom username for the bot message",
          default: "EchoAI Bot",
        },
        iconEmoji: {
          type: "string",
          title: "Icon Emoji",
          description: "Emoji to use as bot icon (e.g., :robot_face:)",
          default: ":robot_face:",
        },
        includeContext: {
          type: "boolean",
          title: "Include Context",
          description: "Include workflow execution context as attachment",
          default: false,
        },
        includeTriggerData: {
          type: "boolean",
          title: "Include Trigger Data",
          description: "Include trigger-specific data as rich attachment",
          default: true,
        },
        retryOnRateLimit: {
          type: "boolean",
          title: "Retry on Rate Limit",
          description: "Automatically retry when rate limited",
          default: true,
        },
        maxRetries: {
          type: "number",
          title: "Max Retries",
          description: "Maximum number of retry attempts",
          default: 3,
          minimum: 1,
          maximum: 10,
        },
      },
      required: ["integrationId", "message"],
    };
  }
}

/**
 * Send Slack Notification Action
 * Sends structured notifications with predefined formatting for different types
 */
export class SendSlackNotificationAction extends BaseSlackAction {
  type = "send_slack_notification";

  async execute(
    config: SlackActionConfig,
    context: WorkflowContext
  ): Promise<ActionResult> {
    try {
      const client = await this.getSlackClient(config, context);

      const message = this.processTemplate(
        config.message || config.text || "",
        context
      );

      const target = await this.resolveTarget(client, config);
      const notificationType = config.notificationType || "info";
      const urgency = config.urgency || "medium";

      // Create notification attachment
      const notificationAttachment = this.createNotificationAttachment(
        notificationType,
        urgency,
        message,
        context
      );

      const attachments = [notificationAttachment];

      // Add context attachment if requested
      const contextAttachment = this.createContextAttachment(config, context);
      if (contextAttachment) {
        attachments.push(contextAttachment);
      }

      const result = await this.executeWithRetry(async () => {
        return await client.sendMessage({
          channel: target,
          text: this.getNotificationText(notificationType, urgency),
          attachments,
          username: config.username || "EchoAI Notifications",
          icon_emoji:
            config.iconEmoji || this.getNotificationIcon(notificationType),
          thread_ts: config.threadTs,
        });
      }, config);

      return {
        success: true,
        data: {
          messageId: result.ts,
          channel: result.channel,
          timestamp: result.ts,
          notificationType,
          urgency,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to send Slack notification",
      };
    }
  }

  private createNotificationAttachment(
    type: string,
    urgency: string,
    message: string,
    context: WorkflowContext
  ): SlackAttachment {
    const colors = {
      info: "good",
      success: "good",
      warning: "warning",
      error: "danger",
    };

    const urgencyEmojis = {
      low: "🔵",
      medium: "🟡",
      high: "🟠",
      critical: "🔴",
    };

    return {
      fallback: `${type.toUpperCase()}: ${message}`,
      color: colors[type as keyof typeof colors] || "good",
      title: `${
        urgencyEmojis[urgency as keyof typeof urgencyEmojis]
      } ${type.toUpperCase()} Notification`,
      text: message,
      fields: [
        {
          title: "Urgency",
          value: urgency.toUpperCase(),
          short: true,
        },
        {
          title: "Source",
          value: context.triggerId
            .replace(/_/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase()),
          short: true,
        },
        {
          title: "Time",
          value: new Date().toLocaleString(),
          short: true,
        },
      ],
      footer: "EchoAI Automation",
      ts: Math.floor(Date.now() / 1000),
    };
  }

  private getNotificationText(type: string, urgency: string): string {
    const urgencyPrefix = urgency === "critical" ? "🚨 URGENT: " : "";
    return `${urgencyPrefix}${type.toUpperCase()} notification from EchoAI`;
  }

  private getNotificationIcon(type: string): string {
    const icons = {
      info: ":information_source:",
      success: ":white_check_mark:",
      warning: ":warning:",
      error: ":x:",
    };
    return icons[type as keyof typeof icons] || ":bell:";
  }

  validateConfig(config: SlackActionConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.integrationId) {
      errors.push("Slack integration ID is required");
    }

    if (!config.message && !config.text) {
      errors.push("Message content is required");
    }

    if (!config.channel && !config.user && !config.userEmail) {
      errors.push("Channel, user, or userEmail must be specified");
    }

    if (
      config.notificationType &&
      !["info", "warning", "error", "success"].includes(config.notificationType)
    ) {
      errors.push("Notification type must be info, warning, error, or success");
    }

    if (
      config.urgency &&
      !["low", "medium", "high", "critical"].includes(config.urgency)
    ) {
      errors.push("Urgency must be low, medium, high, or critical");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getConfigSchema(): ActionConfigSchema {
    return {
      type: this.type,
      title: "Send Slack Notification",
      description:
        "Send a structured notification to Slack with predefined formatting",
      properties: {
        integrationId: {
          type: "string",
          title: "Slack Integration",
          description: "Select the Slack integration to use",
        },
        message: {
          type: "string",
          title: "Notification Message",
          description: "The notification content (supports template variables)",
        },
        channel: {
          type: "string",
          title: "Channel",
          description: "Slack channel name or ID",
        },
        user: {
          type: "string",
          title: "User",
          description: "Slack username or user ID",
        },
        userEmail: {
          type: "string",
          title: "User Email",
          description: "Email address to look up Slack user",
        },
        notificationType: {
          type: "string",
          title: "Notification Type",
          enum: ["info", "success", "warning", "error"],
          default: "info",
        },
        urgency: {
          type: "string",
          title: "Urgency Level",
          enum: ["low", "medium", "high", "critical"],
          default: "medium",
        },
        includeContext: {
          type: "boolean",
          title: "Include Context",
          default: false,
        },
        includeTriggerData: {
          type: "boolean",
          title: "Include Trigger Data",
          default: true,
        },
        retryOnRateLimit: {
          type: "boolean",
          title: "Retry on Rate Limit",
          default: true,
        },
        maxRetries: {
          type: "number",
          title: "Max Retries",
          default: 3,
          minimum: 1,
          maximum: 10,
        },
      },
      required: ["integrationId", "message"],
    };
  }
}

/**
 * Send Slack Thread Reply Action
 * Sends replies to existing message threads
 */
export class SendSlackThreadReplyAction extends BaseSlackAction {
  type = "send_slack_thread_reply";

  async execute(
    config: SlackActionConfig,
    context: WorkflowContext
  ): Promise<ActionResult> {
    try {
      const client = await this.getSlackClient(config, context);

      const message = this.processTemplate(
        config.message || config.text || "",
        context
      );

      if (!config.threadTs) {
        return {
          success: false,
          error: "Thread timestamp is required for thread replies",
        };
      }

      const target = await this.resolveTarget(client, config);

      const result = await this.executeWithRetry(async () => {
        return await client.sendThreadReply(target, config.threadTs!, message, {
          username: config.username,
          icon_emoji: config.iconEmoji,
          reply_broadcast: config.replyBroadcast,
        });
      }, config);

      return {
        success: true,
        data: {
          messageId: result.ts,
          channel: result.channel,
          timestamp: result.ts,
          threadTs: config.threadTs,
          text: message,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to send Slack thread reply",
      };
    }
  }

  validateConfig(config: SlackActionConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.integrationId) {
      errors.push("Slack integration ID is required");
    }

    if (!config.message && !config.text) {
      errors.push("Message content is required");
    }

    if (!config.threadTs) {
      errors.push("Thread timestamp is required");
    }

    if (!config.channel && !config.user && !config.userEmail) {
      errors.push("Channel, user, or userEmail must be specified");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getConfigSchema(): ActionConfigSchema {
    return {
      type: this.type,
      title: "Send Slack Thread Reply",
      description: "Send a reply to an existing Slack message thread",
      properties: {
        integrationId: {
          type: "string",
          title: "Slack Integration",
          description: "Select the Slack integration to use",
        },
        message: {
          type: "string",
          title: "Reply Message",
          description: "The reply content (supports template variables)",
        },
        channel: {
          type: "string",
          title: "Channel",
          description: "Slack channel name or ID",
        },
        threadTs: {
          type: "string",
          title: "Thread Timestamp",
          description: "Timestamp of the parent message to reply to",
        },
        replyBroadcast: {
          type: "boolean",
          title: "Broadcast Reply",
          description: "Whether to broadcast the reply to the channel",
          default: false,
        },
        username: {
          type: "string",
          title: "Bot Username",
          default: "EchoAI Bot",
        },
        iconEmoji: {
          type: "string",
          title: "Icon Emoji",
          default: ":robot_face:",
        },
        retryOnRateLimit: {
          type: "boolean",
          title: "Retry on Rate Limit",
          default: true,
        },
        maxRetries: {
          type: "number",
          title: "Max Retries",
          default: 3,
          minimum: 1,
          maximum: 10,
        },
      },
      required: ["integrationId", "message", "threadTs"],
    };
  }
}
