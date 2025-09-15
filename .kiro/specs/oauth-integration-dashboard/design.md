# Design Document: OAuth Integration Dashboard

## Overview

This design builds upon the existing OAuth infrastructure in the EchoAI SaaS platform to create a user-friendly dashboard interface for managing Slack and HubSpot integrations. The system leverages the existing `OAuth2Manager`, provider configurations, and API endpoints while adding a comprehensive frontend interface and enhanced user experience features.

The design focuses on creating an intuitive `/dashboard/integrations` route that provides:
- Visual integration status indicators
- One-click OAuth connection flows
- Real-time connection health monitoring
- Secure token management with automatic refresh
- Comprehensive error handling and user feedback

## Architecture

### System Architecture Overview

```mermaid
graph TB
    subgraph "Frontend Layer"
        A[Integrations Dashboard Page] --> B[Integration Card Components]
        A --> C[OAuth Flow Handler]
        A --> D[Status Monitor]
        B --> E[Connect Button]
        B --> F[Disconnect Button]
        B --> G[Health Indicator]
    end
    
    subgraph "API Layer (Existing)"
        H[/api/integrations] --> I[OAuth2Manager]
        J[/api/integrations/oauth/authorize] --> I
        K[/api/integrations/oauth/callback/[provider]] --> I
        I --> L[Provider Configurations]
    end
    
    subgraph "Database Layer (Enhanced)"
        M[Integration Table] --> N[Encrypted Tokens]
        M --> O[Connection Status]
        M --> P[Health Check Results]
        Q[oauth_states Table] --> R[CSRF Protection]
    end
    
    subgraph "External Services"
        S[Slack OAuth API]
        T[HubSpot OAuth API]
        U[Slack API Health Check]
        V[HubSpot API Health Check]
    end
    
    A --> H
    C --> J
    J --> S
    J --> T
    K --> S
    K --> T
    I --> M
    D --> U
    D --> V
```

### Enhanced Database Schema

The existing schema will be extended with additional tables for OAuth state management and health monitoring:

```sql
-- OAuth state management for CSRF protection (already referenced in OAuth2Manager)
CREATE TABLE IF NOT EXISTS "oauth_states" (
    state TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    provider_id TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Integration table (already exists, but documenting expected structure)
CREATE TABLE IF NOT EXISTS "Integration" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'hubspot', 'slack', 'google', 'salesforce'
    "accessToken" TEXT NOT NULL, -- Encrypted
    "refreshToken" TEXT, -- Encrypted
    "tokenExpiry" TIMESTAMP WITH TIME ZONE,
    config JSONB DEFAULT '{}', -- Provider-specific configuration
    "isActive" BOOLEAN DEFAULT true,
    "lastHealthCheck" TIMESTAMP WITH TIME ZONE,
    "healthStatus" TEXT DEFAULT 'unknown' CHECK ("healthStatus" IN ('healthy', 'warning', 'error', 'unknown')),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Integration health check logs
CREATE TABLE IF NOT EXISTS "IntegrationHealthLog" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "integrationId" TEXT NOT NULL REFERENCES "Integration"(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('healthy', 'warning', 'error')),
    "errorMessage" TEXT,
    "responseTime" INTEGER, -- milliseconds
    "checkedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "oauth_states_expires_at_idx" ON "oauth_states" ("expires_at");
CREATE INDEX IF NOT EXISTS "Integration_userId_provider_idx" ON "Integration" ("userId", "provider");
CREATE INDEX IF NOT EXISTS "Integration_healthStatus_idx" ON "Integration" ("healthStatus");
CREATE INDEX IF NOT EXISTS "IntegrationHealthLog_integrationId_idx" ON "IntegrationHealthLog" ("integrationId");
```

## Components and Interfaces

### 1. Integrations Dashboard Page

**Location**: `echoai-saas/src/app/dashboard/integrations/page.tsx`

**Key Features**:
- Grid layout of integration cards
- Real-time status updates
- Success/error message handling from OAuth callbacks
- Loading states during API calls

**Component Structure**:
```typescript
interface IntegrationsPageProps {}

interface IntegrationStatus {
  id: string
  name: string
  description: string
  configured: boolean
  connected: boolean
  healthStatus: 'healthy' | 'warning' | 'error' | 'unknown'
  integration?: {
    id: string
    isActive: boolean
    createdAt: string
    lastHealthCheck?: string
    config: Record<string, any>
  }
  missingConfig?: string[]
}

const IntegrationsPage: React.FC<IntegrationsPageProps> = () => {
  // Component implementation
}
```

### 2. Integration Card Component

**Location**: `echoai-saas/src/components/integrations/IntegrationCard.tsx`

**Key Features**:
- Visual status indicators with color coding
- Connect/Disconnect buttons with loading states
- Provider-specific icons and branding
- Connection details display
- Health status with last check timestamp

**Props Interface**:
```typescript
interface IntegrationCardProps {
  integration: IntegrationStatus
  onConnect: (providerId: string) => Promise<void>
  onDisconnect: (integrationId: string) => Promise<void>
  onTestConnection: (integrationId: string) => Promise<void>
  isLoading?: boolean
}

interface HealthIndicatorProps {
  status: 'healthy' | 'warning' | 'error' | 'unknown'
  lastCheck?: string
  size?: 'sm' | 'md' | 'lg'
}
```

### 3. OAuth Flow Manager Hook

**Location**: `echoai-saas/src/hooks/useOAuthFlow.ts`

**Key Features**:
- Centralized OAuth flow management
- Automatic error handling
- Loading state management
- Success/error callbacks

```typescript
interface UseOAuthFlowOptions {
  onSuccess?: (provider: string) => void
  onError?: (error: string) => void
}

interface UseOAuthFlowReturn {
  initiateOAuth: (providerId: string) => Promise<void>
  disconnectIntegration: (integrationId: string) => Promise<void>
  testConnection: (integrationId: string) => Promise<boolean>
  isLoading: boolean
  error: string | null
}

const useOAuthFlow = (options?: UseOAuthFlowOptions): UseOAuthFlowReturn => {
  // Hook implementation
}
```

### 4. Integration Status Hook

**Location**: `echoai-saas/src/hooks/useIntegrationStatus.ts`

**Key Features**:
- Real-time integration status fetching
- Automatic health check scheduling
- Optimistic updates for better UX

```typescript
interface UseIntegrationStatusReturn {
  integrations: IntegrationStatus[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  updateIntegrationStatus: (integrationId: string, status: Partial<IntegrationStatus>) => void
}

const useIntegrationStatus = (): UseIntegrationStatusReturn => {
  // Hook implementation with SWR or React Query
}
```

### 5. Enhanced OAuth2Manager Methods

**Location**: `echoai-saas/src/lib/integrations/oauth2-manager.ts` (existing file)

**New Methods to Add**:
```typescript
export class OAuth2Manager {
  // ... existing methods

  /**
   * Update integration health status
   */
  async updateHealthStatus(
    integrationId: string, 
    status: 'healthy' | 'warning' | 'error',
    errorMessage?: string,
    responseTime?: number
  ): Promise<void> {
    // Implementation
  }

  /**
   * Get integration with health status
   */
  async getIntegrationWithHealth(integrationId: string): Promise<Integration & { healthStatus: string; lastHealthCheck?: Date } | null> {
    // Implementation
  }

  /**
   * Batch health check for user integrations
   */
  async performBatchHealthCheck(userId: string): Promise<{ integrationId: string; status: string; error?: string }[]> {
    // Implementation
  }

  /**
   * Get provider-specific connection details
   */
  async getProviderConnectionDetails(integrationId: string): Promise<Record<string, any> | null> {
    // Implementation to get workspace name, account info, etc.
  }
}
```

## Data Models

### Enhanced Integration Data Structures

```typescript
// Enhanced integration status for frontend
interface IntegrationStatus {
  id: string
  name: string
  description: string
  configured: boolean // Whether env vars are set
  connected: boolean // Whether user has connected
  healthStatus: 'healthy' | 'warning' | 'error' | 'unknown'
  integration?: {
    id: string
    isActive: boolean
    createdAt: string
    lastHealthCheck?: string
    config: Record<string, any>
    connectionDetails?: {
      // Provider-specific details
      workspaceName?: string // Slack
      portalName?: string // HubSpot
      accountId?: string
      connectedUser?: string
    }
  }
  missingConfig?: string[]
}

// OAuth flow state management
interface OAuthFlowState {
  providerId: string
  userId: string
  state: string
  createdAt: Date
  expiresAt: Date
}

// Health check result
interface HealthCheckResult {
  integrationId: string
  status: 'healthy' | 'warning' | 'error'
  errorMessage?: string
  responseTime: number
  checkedAt: Date
  details?: Record<string, any>
}

// Provider-specific connection details
interface SlackConnectionDetails {
  teamId: string
  teamName: string
  userId: string
  userName: string
  botUserId?: string
}

interface HubSpotConnectionDetails {
  portalId: string
  portalName?: string
  userId: string
  userEmail: string
  scopes: string[]
}
```

### API Response Formats

```typescript
// GET /api/integrations response
interface IntegrationsResponse {
  providers: IntegrationStatus[]
  integrations: Integration[]
}

// POST /api/integrations/oauth/authorize response
interface AuthorizeResponse {
  authUrl: string
}

// OAuth callback success response (via redirect)
interface CallbackSuccessParams {
  success: string
  provider: string
}

// OAuth callback error response (via redirect)
interface CallbackErrorParams {
  error: string
}
```

## Error Handling

### Comprehensive Error Management Strategy

1. **OAuth Flow Errors**:
   - User cancellation handling
   - Invalid state parameter detection
   - Token exchange failures
   - Network connectivity issues

2. **Integration Management Errors**:
   - Token expiration handling
   - Refresh token failures
   - API rate limiting
   - Service unavailability

3. **UI Error States**:
   - Loading state management
   - Error message display
   - Retry mechanisms
   - Graceful degradation

```typescript
// Error handling utilities
class IntegrationErrorHandler {
  static handleOAuthError(error: OAuthError): UserFriendlyError {
    switch (error.type) {
      case 'user_cancelled':
        return {
          title: 'Authorization Cancelled',
          message: 'You cancelled the authorization process. You can try connecting again.',
          action: 'retry'
        }
      case 'invalid_state':
        return {
          title: 'Security Error',
          message: 'Invalid authorization state. Please try connecting again.',
          action: 'retry'
        }
      case 'token_exchange_failed':
        return {
          title: 'Connection Failed',
          message: 'Failed to complete the connection. Please try again.',
          action: 'retry'
        }
      default:
        return {
          title: 'Connection Error',
          message: 'An unexpected error occurred. Please try again or contact support.',
          action: 'retry'
        }
    }
  }

  static handleHealthCheckError(error: HealthCheckError): HealthStatus {
    if (error.code === 'token_expired') {
      return {
        status: 'warning',
        message: 'Connection expired. Please reconnect.',
        action: 'reconnect'
      }
    }
    
    if (error.code === 'rate_limited') {
      return {
        status: 'warning',
        message: 'API rate limit reached. Connection will retry automatically.',
        action: 'wait'
      }
    }

    return {
      status: 'error',
      message: 'Connection test failed. Check your integration settings.',
      action: 'troubleshoot'
    }
  }
}
```

## Testing Strategy

### Multi-Layer Testing Approach

1. **Unit Tests**:
   - OAuth2Manager methods
   - Integration card components
   - Error handling utilities
   - Hook functionality

2. **Integration Tests**:
   - Complete OAuth flows (mocked)
   - API endpoint testing
   - Database operations
   - Health check mechanisms

3. **End-to-End Tests**:
   - Full user journey from dashboard to connected integration
   - Error scenario handling
   - Real-time status updates

4. **Security Tests**:
   - CSRF protection validation
   - Token encryption/decryption
   - State parameter validation
   - Access control verification

```typescript
// Example test structure
describe('OAuth Integration Dashboard', () => {
  describe('Integration Cards', () => {
    it('should display correct status for connected integrations')
    it('should show connect button for unconfigured integrations')
    it('should handle loading states during OAuth flow')
    it('should display health status with appropriate indicators')
  })

  describe('OAuth Flow', () => {
    it('should generate secure authorization URLs')
    it('should handle successful OAuth callbacks')
    it('should handle OAuth errors gracefully')
    it('should validate state parameters for CSRF protection')
  })

  describe('Health Monitoring', () => {
    it('should perform periodic health checks')
    it('should update status indicators in real-time')
    it('should handle API failures gracefully')
    it('should trigger reconnection for expired tokens')
  })
})
```

## Security Considerations

### Enhanced Security Measures

1. **OAuth Security**:
   - CSRF protection with state parameters
   - Secure token storage with encryption
   - Automatic token refresh handling
   - Scope validation and minimal permissions

2. **Data Protection**:
   - Token encryption at rest
   - Secure token transmission
   - User-scoped data isolation
   - Audit logging for integration changes

3. **API Security**:
   - Rate limiting for OAuth endpoints
   - Input validation and sanitization
   - Proper error message handling (no sensitive data exposure)
   - Session validation for dashboard access

```typescript
// Security utilities
class IntegrationSecurity {
  static generateSecureState(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  static validateStateParameter(state: string, storedState: string): boolean {
    return crypto.timingSafeEqual(
      Buffer.from(state, 'hex'),
      Buffer.from(storedState, 'hex')
    )
  }

  static sanitizeIntegrationData(integration: Integration): PublicIntegration {
    return {
      id: integration.id,
      provider: integration.provider,
      isActive: integration.isActive,
      createdAt: integration.createdAt,
      healthStatus: integration.healthStatus,
      // Exclude sensitive tokens
    }
  }
}
```

## User Experience Design

### Interface Design Principles

1. **Visual Hierarchy**:
   - Clear status indicators with color coding
   - Prominent connect/disconnect buttons
   - Organized card layout with consistent spacing

2. **Feedback Systems**:
   - Real-time status updates
   - Loading states during operations
   - Success/error notifications
   - Progress indicators for OAuth flows

3. **Accessibility**:
   - Keyboard navigation support
   - Screen reader compatibility
   - High contrast mode support
   - Focus management during OAuth flows

### Component Styling Guidelines

```typescript
// Tailwind CSS classes for consistent styling
const integrationCardStyles = {
  base: "bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-shadow",
  connected: "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20",
  error: "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20",
  warning: "border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20"
}

const statusIndicatorStyles = {
  healthy: "bg-green-500 text-white",
  warning: "bg-yellow-500 text-white",
  error: "bg-red-500 text-white",
  unknown: "bg-gray-400 text-white"
}
```

This design provides a comprehensive foundation for implementing the OAuth integration dashboard while leveraging the existing infrastructure and maintaining security, usability, and scalability standards.