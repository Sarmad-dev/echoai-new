# Design Document

## Overview

This design addresses the inconsistency in Slack action node configuration by standardizing connection checking and data loading across all Slack action types. Currently, only the "Send Slack Message" action properly validates connections and loads channels/users, while "Send Slack Notification" and "Send Slack Thread Reply" actions lack this functionality.

The solution involves creating shared utilities for connection validation and data loading, then updating the configuration forms for the inconsistent action types to use these shared utilities. This ensures a consistent user experience and maintainable codebase.

## Architecture

### Current State Analysis

**Working Implementation (Send Slack Message):**
- `SlackMessageConfigForm` component checks connection status via `/api/integrations/slack/status`
- Loads channels via `/api/integrations/slack/channels`
- Loads users via `/api/integrations/slack/users`
- Displays connection errors with remediation links
- Shows loading states during data fetching

**Missing Implementation (Send Slack Notification & Send Slack Thread Reply):**
- No connection status checking
- No channel/user data loading
- Generic configuration forms without Slack-specific UI
- No integration validation

### Target Architecture

```mermaid
graph TB
    subgraph "Configuration Forms"
        SMF[SlackMessageConfigForm]
        SNF[SlackNotificationConfigForm]
        STF[SlackThreadReplyConfigForm]
    end
    
    subgraph "Shared Utilities"
        SCH[useSlackConnection Hook]
        SCD[useSlackChannels Hook]
        SUD[useSlackUsers Hook]
        SCU[SlackConnectionUtils]
    end
    
    subgraph "API Endpoints"
        SSE[/api/integrations/slack/status]
        SCE[/api/integrations/slack/channels]
        SUE[/api/integrations/slack/users]
    end
    
    subgraph "UI Components"
        CCS[ConnectionStatusCard]
        CSD[ChannelSelectDropdown]
        USD[UserSelectDropdown]
        LSC[LoadingStateComponent]
    end
    
    SMF --> SCH
    SNF --> SCH
    STF --> SCH
    
    SCH --> SSE
    SCD --> SCE
    SUD --> SUE
    
    SMF --> CCS
    SNF --> CCS
    STF --> CCS
    
    SMF --> CSD
    SNF --> CSD
    STF --> CSD
    
    SMF --> USD
    SNF --> USD
    STF --> USD
```

## Components and Interfaces

### 1. Shared React Hooks

#### useSlackConnection Hook
```typescript
interface SlackConnectionState {
  status: 'checking' | 'connected' | 'disconnected' | 'error';
  connectionData?: {
    teamId: string;
    teamName: string;
    userId: string;
    userName: string;
  };
  error?: string;
  errorType?: 'auth_failed' | 'permission_denied' | 'rate_limited' | 'service_unavailable' | 'network_error' | 'unknown';
  retryAfter?: number;
  checkConnection: () => Promise<void>;
}

function useSlackConnection(): SlackConnectionState
```

#### useSlackChannels Hook
```typescript
interface SlackChannelsState {
  channels: SlackChannelOption[];
  loading: boolean;
  error?: string;
  loadChannels: () => Promise<void>;
}

interface SlackChannelOption {
  id: string;
  name: string;
  type: 'channel' | 'private_channel';
  isPrivate: boolean;
  isMember: boolean;
  memberCount?: number;
}

function useSlackChannels(connectionStatus: string): SlackChannelsState
```

#### useSlackUsers Hook
```typescript
interface SlackUsersState {
  users: SlackUserOption[];
  loading: boolean;
  error?: string;
  loadUsers: () => Promise<void>;
}

interface SlackUserOption {
  id: string;
  name: string;
  realName: string;
  email?: string;
  displayName: string;
}

function useSlackUsers(connectionStatus: string): SlackUsersState
```

### 2. Shared UI Components

#### SlackConnectionStatusCard
```typescript
interface SlackConnectionStatusCardProps {
  connectionState: SlackConnectionState;
  onRetry?: () => void;
}

function SlackConnectionStatusCard({ connectionState, onRetry }: SlackConnectionStatusCardProps): JSX.Element
```

#### SlackChannelSelector
```typescript
interface SlackChannelSelectorProps {
  channels: SlackChannelOption[];
  loading: boolean;
  value?: string;
  onChange: (channelId: string) => void;
  placeholder?: string;
  error?: string;
}

function SlackChannelSelector({ channels, loading, value, onChange, placeholder, error }: SlackChannelSelectorProps): JSX.Element
```

#### SlackUserSelector
```typescript
interface SlackUserSelectorProps {
  users: SlackUserOption[];
  loading: boolean;
  value?: string;
  onChange: (userId: string) => void;
  placeholder?: string;
  error?: string;
}

function SlackUserSelector({ users, loading, value, onChange, placeholder, error }: SlackUserSelectorProps): JSX.Element
```

### 3. Updated Configuration Forms

#### SlackNotificationConfigForm
- Extends existing form with connection checking
- Uses shared hooks and components
- Maintains notification-specific configuration options
- Adds channel/user selection with proper validation

#### SlackThreadReplyConfigForm
- Extends existing form with connection checking
- Uses shared hooks and components
- Maintains thread-specific configuration options (threadTs, replyBroadcast)
- Adds channel/user selection with proper validation

### 4. Utility Functions

#### SlackConnectionUtils
```typescript
class SlackConnectionUtils {
  static async checkConnection(): Promise<SlackConnectionState>;
  static async loadChannels(): Promise<SlackChannelOption[]>;
  static async loadUsers(): Promise<SlackUserOption[]>;
  static formatChannelForDisplay(channel: SlackChannelOption): string;
  static formatUserForDisplay(user: SlackUserOption): string;
  static getConnectionErrorMessage(errorType: string): string;
  static shouldRetryConnection(errorType: string): boolean;
}
```

## Data Models

### SlackActionConfig Extensions

```typescript
// Enhanced base interface for all Slack actions
interface BaseSlackActionConfig extends ActionConfig {
  integrationId: string;
  channel?: string;
  user?: string;
  userEmail?: string;
  message: string;
  username?: string;
  iconEmoji?: string;
  retryOnRateLimit?: boolean;
  maxRetries?: number;
}

// Notification-specific configuration
interface SlackNotificationConfig extends BaseSlackActionConfig {
  notificationType: 'info' | 'warning' | 'error' | 'success';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  includeContext?: boolean;
  includeTriggerData?: boolean;
}

// Thread reply-specific configuration
interface SlackThreadReplyConfig extends BaseSlackActionConfig {
  threadTs: string;
  replyBroadcast?: boolean;
}
```

### API Response Models

```typescript
// Standardized connection status response
interface SlackConnectionResponse {
  connected: boolean;
  teamId?: string;
  teamName?: string;
  userId?: string;
  userName?: string;
  botId?: string;
  lastChecked: string;
  error?: string;
  errorType?: 'auth_failed' | 'permission_denied' | 'rate_limited' | 'service_unavailable' | 'network_error' | 'unknown';
  retryAfter?: number;
}

// Standardized channels response
interface SlackChannelsResponse {
  channels: Array<{
    id: string;
    name: string;
    type: 'channel' | 'private_channel';
    isPrivate: boolean;
    isMember: boolean;
    memberCount?: number;
  }>;
}

// Standardized users response
interface SlackUsersResponse {
  users: Array<{
    id: string;
    name: string;
    realName: string;
    email?: string;
    displayName: string;
  }>;
}
```

## Error Handling

### Connection Error Types
1. **auth_failed**: Token expired or revoked
2. **permission_denied**: Insufficient bot permissions
3. **rate_limited**: API rate limit exceeded
4. **service_unavailable**: Slack service issues
5. **network_error**: Network connectivity problems
6. **unknown**: Unexpected errors

### Error Recovery Strategies
1. **Automatic Retry**: For transient errors (network, rate limits)
2. **User Action Required**: For auth failures (redirect to reconnect)
3. **Graceful Degradation**: Show cached data when possible
4. **Clear Messaging**: User-friendly error descriptions with next steps

### Retry Logic
```typescript
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: ['network_error', 'service_unavailable', 'rate_limited']
};
```

## Testing Strategy

### Unit Tests
1. **Hook Testing**: Test connection, channels, and users hooks with various states
2. **Component Testing**: Test UI components with different props and states
3. **Utility Testing**: Test connection utilities with mocked API responses
4. **Error Handling**: Test error scenarios and recovery mechanisms

### Integration Tests
1. **API Endpoint Testing**: Test Slack API endpoints with real/mocked responses
2. **Form Integration**: Test complete configuration flow for each action type
3. **Connection Flow**: Test connection checking and data loading sequences
4. **Error Scenarios**: Test various error conditions and user flows

### E2E Tests
1. **Configuration Workflow**: Test complete action configuration from start to finish
2. **Connection Management**: Test connecting/disconnecting Slack integrations
3. **Multi-Integration**: Test behavior with multiple Slack workspaces
4. **Error Recovery**: Test user recovery from various error states

### Test Data Management
```typescript
// Mock data factories for consistent testing
class SlackTestDataFactory {
  static createMockConnection(overrides?: Partial<SlackConnectionResponse>): SlackConnectionResponse;
  static createMockChannels(count?: number): SlackChannelOption[];
  static createMockUsers(count?: number): SlackUserOption[];
  static createMockError(type: string): SlackConnectionResponse;
}
```

## Performance Considerations

### Caching Strategy
1. **Connection Status**: Cache for 5 minutes
2. **Channels List**: Cache for 15 minutes
3. **Users List**: Cache for 30 minutes
4. **Error States**: No caching for immediate retry capability

### Loading Optimization
1. **Parallel Loading**: Load channels and users simultaneously
2. **Progressive Enhancement**: Show form while data loads
3. **Skeleton States**: Show loading placeholders
4. **Debounced Retries**: Prevent rapid retry attempts

### Memory Management
1. **Cleanup Hooks**: Proper cleanup of API calls and timers
2. **Memoization**: Memoize expensive computations
3. **Lazy Loading**: Load data only when needed
4. **Component Unmounting**: Cancel pending requests on unmount

## Security Considerations

### Token Handling
1. **Server-Side Decryption**: Keep token decryption on server
2. **Minimal Exposure**: Don't expose tokens to client-side
3. **Secure Storage**: Use encrypted storage for cached data
4. **Token Refresh**: Handle token refresh transparently

### API Security
1. **Authentication**: Verify user session for all API calls
2. **Authorization**: Ensure user owns the integration
3. **Rate Limiting**: Implement client-side rate limiting
4. **Input Validation**: Validate all user inputs

### Error Information
1. **Sanitized Errors**: Don't expose sensitive error details
2. **Logging**: Log detailed errors server-side only
3. **User Messages**: Provide helpful but non-revealing messages
4. **Debug Information**: Include debug info only in development

## Migration Strategy

### Phase 1: Create Shared Infrastructure
1. Implement shared hooks (useSlackConnection, useSlackChannels, useSlackUsers)
2. Create shared UI components (SlackConnectionStatusCard, selectors)
3. Implement utility functions (SlackConnectionUtils)
4. Add comprehensive tests for shared components

### Phase 2: Update Slack Notification Configuration
1. Create SlackNotificationConfigForm component
2. Integrate connection checking and data loading
3. Update ActionConfigForm routing to use new component
4. Test notification action configuration flow

### Phase 3: Update Slack Thread Reply Configuration
1. Create SlackThreadReplyConfigForm component
2. Integrate connection checking and data loading
3. Update ActionConfigForm routing to use new component
4. Test thread reply action configuration flow

### Phase 4: Refactor Existing Implementation
1. Update SlackMessageConfigForm to use shared utilities
2. Remove duplicate code and logic
3. Ensure consistent behavior across all forms
4. Update tests to use shared test utilities

### Phase 5: Documentation and Training
1. Update component documentation
2. Create developer guidelines for Slack integrations
3. Update user documentation for action configuration
4. Provide migration guide for any breaking changes

## Backwards Compatibility

### Configuration Compatibility
- Existing action configurations will continue to work
- New fields are optional with sensible defaults
- Graceful handling of missing integration IDs
- Fallback to generic forms if Slack-specific components fail

### API Compatibility
- Existing API endpoints remain unchanged
- New functionality is additive only
- Proper error handling for missing endpoints
- Version detection for feature availability

### Component Compatibility
- Existing components continue to work during migration
- Progressive enhancement approach
- Feature detection for new capabilities
- Graceful degradation for unsupported features