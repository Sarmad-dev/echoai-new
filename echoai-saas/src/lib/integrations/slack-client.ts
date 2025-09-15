/**
 * Slack API Client
 * 
 * Provides a comprehensive interface for interacting with Slack's Web API
 * Handles message sending, channel management, and user interactions with proper
 * error handling and rate limiting support.
 */

import { Integration } from './oauth2-manager';

export interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_mpim: boolean;
  is_private: boolean;
  is_archived: boolean;
  is_general: boolean;
  is_shared: boolean;
  is_ext_shared: boolean;
  is_org_shared: boolean;
  pending_shared: string[];
  is_pending_ext_shared: boolean;
  is_member: boolean;
  topic: {
    value: string;
    creator: string;
    last_set: number;
  };
  purpose: {
    value: string;
    creator: string;
    last_set: number;
  };
  num_members?: number;
}

export interface SlackUser {
  id: string;
  team_id: string;
  name: string;
  deleted: boolean;
  color: string;
  real_name: string;
  tz: string;
  tz_label: string;
  tz_offset: number;
  profile: {
    title: string;
    phone: string;
    skype: string;
    real_name: string;
    real_name_normalized: string;
    display_name: string;
    display_name_normalized: string;
    fields: Record<string, any>;
    status_text: string;
    status_emoji: string;
    status_expiration: number;
    avatar_hash: string;
    email?: string;
    image_24: string;
    image_32: string;
    image_48: string;
    image_72: string;
    image_192: string;
    image_512: string;
  };
  is_admin: boolean;
  is_owner: boolean;
  is_primary_owner: boolean;
  is_restricted: boolean;
  is_ultra_restricted: boolean;
  is_bot: boolean;
  is_app_user: boolean;
  updated: number;
}

export interface SlackMessage {
  channel: string;
  text?: string;
  blocks?: any[];
  attachments?: SlackAttachment[];
  thread_ts?: string;
  reply_broadcast?: boolean;
  username?: string;
  icon_emoji?: string;
  icon_url?: string;
  link_names?: boolean;
  parse?: 'full' | 'none';
  unfurl_links?: boolean;
  unfurl_media?: boolean;
  as_user?: boolean;
}

export interface SlackAttachment {
  fallback?: string;
  color?: string;
  pretext?: string;
  author_name?: string;
  author_link?: string;
  author_icon?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: SlackAttachmentField[];
  image_url?: string;
  thumb_url?: string;
  footer?: string;
  footer_icon?: string;
  ts?: number;
  actions?: any[];
  callback_id?: string;
  mrkdwn_in?: string[];
}

export interface SlackAttachmentField {
  title: string;
  value: string;
  short?: boolean;
}

export interface SlackMessageResponse {
  ok: boolean;
  channel: string;
  ts: string;
  message: {
    type: string;
    subtype?: string;
    text: string;
    ts: string;
    username?: string;
    bot_id?: string;
    attachments?: SlackAttachment[];
    blocks?: any[];
  };
  error?: string;
  warning?: string;
}

export interface SlackApiError {
  ok: false;
  error: string;
  warning?: string;
  response_metadata?: {
    messages?: string[];
    warnings?: string[];
  };
}

export class SlackRateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number
  ) {
    super(message);
    this.name = 'SlackRateLimitError';
  }
}

export class SlackApiClient {
  private baseUrl = 'https://slack.com/api';
  private accessToken: string;
  private retryAttempts = 3;
  private retryDelay = 1000; // Base delay in ms

  constructor(integration: Integration) {
    if (integration.provider !== 'slack') {
      throw new Error('Integration must be for Slack provider');
    }
    this.accessToken = integration.accessToken;
  }

  /**
   * Make authenticated request to Slack API with retry logic
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    let lastError: Error;

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json() as T & SlackApiError;

        // Ensure data is defined
        if (!data) {
          throw new Error('Empty response from Slack API');
        }

        // Handle Slack API errors
        if (typeof data === 'object' && 'ok' in data && !data.ok) {
          // Handle rate limiting
          if (data.error === 'rate_limited') {
            const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
            throw new SlackRateLimitError(
              'Slack API rate limit exceeded',
              retryAfter
            );
          }

          throw new Error(`Slack API error: ${data.error}`);
        }

        return data;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on rate limit errors - let caller handle
        if (error instanceof SlackRateLimitError) {
          throw error;
        }

        // Don't retry on client errors (4xx)
        if (error instanceof Error && error.message.includes('HTTP 4')) {
          throw error;
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.retryAttempts - 1) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  // ===== MESSAGE METHODS =====

  /**
   * Send a message to a channel or user
   */
  async sendMessage(message: SlackMessage): Promise<SlackMessageResponse> {
    // Validate required fields
    if (!message.channel) {
      throw new Error('Channel is required');
    }

    if (!message.text && !message.blocks && !message.attachments) {
      throw new Error('Message must have text, blocks, or attachments');
    }

    const response = await this.makeRequest<SlackMessageResponse>('chat.postMessage', {
      method: 'POST',
      body: JSON.stringify(message),
    });

    return response;
  }

  /**
   * Send a simple text message to a channel
   */
  async sendTextMessage(
    channel: string,
    text: string,
    options: Partial<SlackMessage> = {}
  ): Promise<SlackMessageResponse> {
    return this.sendMessage({
      channel,
      text,
      ...options,
    });
  }

  /**
   * Send a message with attachments
   */
  async sendMessageWithAttachments(
    channel: string,
    text: string,
    attachments: SlackAttachment[],
    options: Partial<SlackMessage> = {}
  ): Promise<SlackMessageResponse> {
    return this.sendMessage({
      channel,
      text,
      attachments,
      ...options,
    });
  }

  /**
   * Send a threaded reply
   */
  async sendThreadReply(
    channel: string,
    threadTs: string,
    text: string,
    options: Partial<SlackMessage> = {}
  ): Promise<SlackMessageResponse> {
    return this.sendMessage({
      channel,
      text,
      thread_ts: threadTs,
      ...options,
    });
  }

  /**
   * Update an existing message
   */
  async updateMessage(
    channel: string,
    ts: string,
    text?: string,
    attachments?: SlackAttachment[],
    blocks?: any[]
  ): Promise<SlackMessageResponse> {
    const payload: any = {
      channel,
      ts,
    };

    if (text) payload.text = text;
    if (attachments) payload.attachments = attachments;
    if (blocks) payload.blocks = blocks;

    return this.makeRequest<SlackMessageResponse>('chat.update', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Delete a message
   */
  async deleteMessage(channel: string, ts: string): Promise<{ ok: boolean; channel: string; ts: string }> {
    return this.makeRequest('chat.delete', {
      method: 'POST',
      body: JSON.stringify({
        channel,
        ts,
      }),
    });
  }

  // ===== CHANNEL METHODS =====

  /**
   * Get list of channels
   */
  async getChannels(excludeArchived: boolean = true): Promise<SlackChannel[]> {
    const response = await this.makeRequest<{
      ok: boolean;
      channels: SlackChannel[];
    }>(`conversations.list?exclude_archived=${excludeArchived}&types=public_channel,private_channel`);

    return response.channels;
  }

  /**
   * Get channel information
   */
  async getChannelInfo(channel: string): Promise<SlackChannel> {
    const response = await this.makeRequest<{
      ok: boolean;
      channel: SlackChannel;
    }>(`conversations.info?channel=${encodeURIComponent(channel)}`);

    return response.channel;
  }

  /**
   * Join a channel
   */
  async joinChannel(channel: string): Promise<{ ok: boolean; channel: SlackChannel }> {
    return this.makeRequest('conversations.join', {
      method: 'POST',
      body: JSON.stringify({
        channel,
      }),
    });
  }

  /**
   * Get channel members
   */
  async getChannelMembers(channel: string): Promise<string[]> {
    const response = await this.makeRequest<{
      ok: boolean;
      members: string[];
    }>(`conversations.members?channel=${encodeURIComponent(channel)}`);

    return response.members;
  }

  // ===== USER METHODS =====

  /**
   * Get list of users
   */
  async getUsers(): Promise<SlackUser[]> {
    const response = await this.makeRequest<{
      ok: boolean;
      members: SlackUser[];
    }>('users.list');

    return response.members;
  }

  /**
   * Get user information
   */
  async getUserInfo(user: string): Promise<SlackUser> {
    const response = await this.makeRequest<{
      ok: boolean;
      user: SlackUser;
    }>(`users.info?user=${encodeURIComponent(user)}`);

    return response.user;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<SlackUser | null> {
    try {
      const response = await this.makeRequest<{
        ok: boolean;
        user: SlackUser;
      }>(`users.lookupByEmail?email=${encodeURIComponent(email)}`);

      return response.user;
    } catch (error) {
      if (error instanceof Error && error.message.includes('users_not_found')) {
        return null;
      }
      throw error;
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Test API connection and permissions
   */
  async testConnection(): Promise<{
    success: boolean;
    teamId?: string;
    teamName?: string;
    userId?: string;
    userName?: string;
    scopes?: string[];
    error?: string;
  }> {
    try {
      const response = await this.makeRequest<{
        ok: boolean;
        url: string;
        team: string;
        user: string;
        team_id: string;
        user_id: string;
        bot_id?: string;
      }>('auth.test');

      return {
        success: true,
        teamId: response.team_id,
        teamName: response.team,
        userId: response.user_id,
        userName: response.user,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get bot information
   */
  async getBotInfo(): Promise<{
    ok: boolean;
    bot: {
      id: string;
      deleted: boolean;
      name: string;
      updated: number;
      app_id: string;
      user_id: string;
      icons: Record<string, string>;
    };
  }> {
    return this.makeRequest('bots.info');
  }

  /**
   * Format channel name for API calls
   */
  static formatChannelName(channel: string): string {
    // If it's already a channel ID (starts with C, G, D), return as-is
    if (/^[CGD][A-Z0-9]+$/.test(channel)) {
      return channel;
    }

    // If it starts with # or @, remove the prefix
    if (channel.startsWith('#') || channel.startsWith('@')) {
      return channel.slice(1);
    }

    return channel;
  }

  /**
   * Create rich message attachments for different trigger types
   */
  static createTriggerAttachment(
    triggerType: string,
    triggerData: Record<string, any>
  ): SlackAttachment {
    const baseAttachment: SlackAttachment = {
      fallback: `Automation triggered: ${triggerType}`,
      color: 'good',
      fields: [],
      footer: 'EchoAI Automation',
      ts: Math.floor(Date.now() / 1000),
    };

    switch (triggerType) {
      case 'new_conversation':
        return {
          ...baseAttachment,
          title: '🆕 New Conversation Started',
          color: 'good',
          fields: [
            {
              title: 'User Email',
              value: triggerData.userEmail || 'Anonymous',
              short: true,
            },
            {
              title: 'Conversation ID',
              value: triggerData.conversationId || 'N/A',
              short: true,
            },
            {
              title: 'First Message',
              value: triggerData.message || 'No message',
              short: false,
            },
          ],
        };

      case 'negative_sentiment':
        return {
          ...baseAttachment,
          title: '😟 Negative Sentiment Detected',
          color: 'danger',
          fields: [
            {
              title: 'Sentiment Score',
              value: triggerData.sentimentScore?.toString() || 'N/A',
              short: true,
            },
            {
              title: 'User Email',
              value: triggerData.userEmail || 'Anonymous',
              short: true,
            },
            {
              title: 'Message',
              value: triggerData.message || 'No message',
              short: false,
            },
          ],
        };

      case 'intent_detected':
        return {
          ...baseAttachment,
          title: '🎯 Intent Detected',
          color: 'warning',
          fields: [
            {
              title: 'Intent',
              value: triggerData.intent || 'Unknown',
              short: true,
            },
            {
              title: 'Confidence',
              value: triggerData.confidence?.toString() || 'N/A',
              short: true,
            },
            {
              title: 'User Email',
              value: triggerData.userEmail || 'Anonymous',
              short: true,
            },
            {
              title: 'Message',
              value: triggerData.message || 'No message',
              short: false,
            },
          ],
        };

      case 'image_uploaded':
        return {
          ...baseAttachment,
          title: '📷 Image Uploaded',
          color: 'good',
          fields: [
            {
              title: 'User Email',
              value: triggerData.userEmail || 'Anonymous',
              short: true,
            },
            {
              title: 'Image Type',
              value: triggerData.imageType || 'Unknown',
              short: true,
            },
            {
              title: 'Analysis Result',
              value: triggerData.analysisResult || 'Processing...',
              short: false,
            },
          ],
          image_url: triggerData.imageUrl,
        };

      case 'high_value_lead':
        return {
          ...baseAttachment,
          title: '💎 High-Value Lead Qualified',
          color: 'good',
          fields: [
            {
              title: 'Lead Score',
              value: triggerData.leadScore?.toString() || 'N/A',
              short: true,
            },
            {
              title: 'User Email',
              value: triggerData.userEmail || 'Anonymous',
              short: true,
            },
            {
              title: 'Company',
              value: triggerData.company || 'Unknown',
              short: true,
            },
            {
              title: 'Qualification Reason',
              value: triggerData.qualificationReason || 'Automated detection',
              short: false,
            },
          ],
        };

      default:
        return {
          ...baseAttachment,
          title: `🤖 ${triggerType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
          fields: [
            {
              title: 'Trigger Data',
              value: JSON.stringify(triggerData, null, 2),
              short: false,
            },
          ],
        };
    }
  }
}