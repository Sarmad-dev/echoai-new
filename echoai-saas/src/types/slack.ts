// Shared types for Slack integration components and hooks

export interface SlackIntegration {
  id: string;
  teamId: string;
  teamName: string;
  userId: string;
  userName: string;
  botId?: string;
  isActive: boolean;
  healthStatus: 'HEALTHY' | 'WARNING' | 'ERROR' | 'UNKNOWN';
  lastHealthCheck?: string;
  createdAt: string;
}

export interface SlackConnectionState {
  status: 'checking' | 'connected' | 'disconnected' | 'error' | 'rate_limited';
  selectedIntegrationId?: string;
  availableIntegrations: SlackIntegration[];
  connectionData?: {
    teamId: string;
    teamName: string;
    userId: string;
    userName: string;
    botId?: string;
  };
  error?: string;
  errorType?: 'auth_failed' | 'permission_denied' | 'rate_limited' | 'service_unavailable' | 'network_error' | 'integration_not_found' | 'workspace_mismatch' | 'unknown';
  retryAfter?: number;
  recoveryInstructions?: string[];
  isRetryable?: boolean;
  checkConnection: (integrationId?: string) => Promise<void>;
  selectIntegration: (integrationId: string) => Promise<void>;
}

export interface SlackChannelOption {
  id: string;
  name: string;
  type: 'channel' | 'private_channel';
  isPrivate: boolean;
  isMember: boolean;
  memberCount?: number;
}

export interface SlackChannelsState {
  channels: SlackChannelOption[];
  loading: boolean;
  error?: string;
  errorType?: string;
  isRetryable?: boolean;
  recoveryInstructions?: string[];
  loadChannels: (integrationId?: string) => Promise<void>;
}

export interface SlackUserOption {
  id: string;
  name: string;
  realName: string;
  email?: string;
  displayName: string;
}

export interface SlackUsersState {
  users: SlackUserOption[];
  loading: boolean;
  error?: string;
  errorType?: string;
  isRetryable?: boolean;
  recoveryInstructions?: string[];
  loadUsers: (integrationId?: string) => Promise<void>;
}

// API Response types
export interface SlackConnectionResponse {
  connected: boolean;
  teamId?: string;
  teamName?: string;
  userId?: string;
  userName?: string;
  botId?: string;
  lastChecked: string;
  error?: string;
  errorType?: 'auth_failed' | 'permission_denied' | 'rate_limited' | 'service_unavailable' | 'network_error' | 'integration_not_found' | 'workspace_mismatch' | 'unknown';
  retryAfter?: number;
}

export interface SlackChannelsResponse {
  channels: SlackChannelOption[];
}

export interface SlackUsersResponse {
  users: SlackUserOption[];
}

// Error handling types
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: ['network_error', 'service_unavailable', 'rate_limited']
};