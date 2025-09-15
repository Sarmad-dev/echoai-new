# Implementation Plan

- [x] 1. Enhance database schema for integration health monitoring

  - Add health status columns to Integration table
  - Create IntegrationHealthLog table for tracking health check history
  - Add database migration script to update existing schema
  - _Requirements: 4.1, 7.1, 7.2_

- [x] 2. Create integration dashboard page route

  - Create `/dashboard/integrations/page.tsx` with grid layout for integration cards
  - Implement URL parameter handling for OAuth callback success/error messages
  - Add loading states and error boundary for the page
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 3. Build IntegrationCard component

  - Create reusable IntegrationCard component with status indicators
  - Implement connect/disconnect button states with loading indicators
  - Add health status display with color-coded indicators
  - Include provider-specific icons and branding
  - _Requirements: 1.4, 1.5, 5.1, 7.3_

- [x] 4. Create oauth_states table for CSRF protection

  - Add oauth_states table to database schema for secure state management
  - Create database migration to add the table
  - Update OAuth2Manager to use database-backed state storage
  - _Requirements: 4.1, 4.6_

- [x] 5. Fix OAuth2Manager encryption implementation

  - Replace deprecated crypto.createCipher with crypto.createCipherGCM
  - Fix encryption/decryption methods to use proper GCM mode
  - Ensure proper IV handling and authentication tag validation
  - _Requirements: 4.1, 4.2, 4.4_

- [x] 6. Create OAuth API endpoints

  - Implement `/api/integrations` route for fetching integration status
  - Create `/api/integrations/oauth/authorize` for OAuth initiation
  - Build `/api/integrations/oauth/callback/[provider]` for OAuth callbacks
  - Add `/api/integrations/test` for connection testing
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 6.1, 6.2_

- [x] 7. Create provider configurations

  - Define OAuth provider configurations for Slack, HubSpot, Google, Salesforce
  - Implement provider validation and configuration checking
  - Add environment variable validation for OAuth credentials
  - _Requirements: 2.1, 3.1, 4.1_

- [x] 8. Create useIntegrations hook

  - Build hook for managing integration state and API calls
  - Implement OAuth flow initiation and connection testing
  - Add integration disconnection functionality
  - Handle loading states and error management
  - _Requirements: 1.6, 5.2, 6.1, 6.2_

- [x] 9. Connect dashboard to real API endpoints

  - Replace mock data in integrations page with useIntegrations hook
  - Implement proper user authentication context integration
  - Add error handling for API failures and network issues

  - _Requirements: 1.6, 5.2, 6.1, 6.2_

- [x] 10. Enhance OAuth2Manager with health monitoring methods

  - Add updateHealthStatus method for tracking integration health
  - Implement getIntegrationWithHealth method for detailed status
  - Create performBatchHealthCheck for multiple integrations
  - Add getProviderConnectionDetails for workspace/account info
  - _Requirements: 4.2, 4.3, 7.6, 7.7_

- [x] 11. Fix health status enum mapping between database and API

  - Update OAuth2Manager to use proper enum values (HEALTHY vs healthy)
  - Ensure consistent health status mapping between Prisma schema and API responses
  - Update API endpoints to return correct enum values
  - _Requirements: 7.1, 7.2_

- [x] 12. Implement provider-specific connection details retrieval

  - Add Slack workspace name and user info retrieval in OAuth callback
  - Implement HubSpot portal name and account details fetching
  - Store connection details in integration config for display
  - _Requirements: 2.8, 3.8, 7.7_

- [x] 13. Enable health status display in IntegrationCard component

  - Uncomment and fix the health status indicator in IntegrationCard
  - Add proper health status styling and icons
  - Display last health check timestamp
  - _Requirements: 7.1, 7.3, 7.5_

- [ ] 14. Add health check scheduling and monitoring

  - Create background job for periodic health checks

  - Implement health status update API endpoints
  - Add integration status history tracking with logs
  - _Requirements: 7.1, 7.2, 7.4, 7.5_

- [ ] 15. Add comprehensive error handling utilities

  - Build IntegrationErrorHandler class for centralized error handling
  - Implement IntegrationSecurity utilities for safe data handling
  - Add helper functions for status formatting and display
  - _Requirements: 4.4, 4.5, 6.5, 6.6_

- [ ] 16. Write comprehensive tests for OAuth integration dashboard

  - Create unit tests for IntegrationCard component
  - Write integration tests for OAuth flow hooks
  - Add end-to-end tests for complete OAuth journey
  - Test error scenarios and edge cases
  - _Requirements: 2.7, 3.7, 4.6, 6.7_

- [x] 15. Integrate dashboard with existing navigation
  - Add integrations link to dashboard navigation menu
  - Update dashboard layout to include integrations route
  - Ensure proper authentication and authorization for the route
  - _Requirements: 1.1, 4.7_
