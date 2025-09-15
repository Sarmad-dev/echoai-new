# Migration 007: Enhance Integration Connection Validation

## Overview
This migration enhances the database schema to support connection validation tracking for integrations, specifically for HubSpot and Google Sheets integration features.

## Changes Made

### Integration Table Enhancements
Added the following columns to the `Integration` table:

- **`lastConnectionValidation`** (TIMESTAMP): Tracks when the connection was last validated
- **`connectionStatus`** (TEXT): Current connection status with possible values:
  - `connected`: Integration is working properly
  - `disconnected`: Integration requires authentication
  - `error`: Integration has validation errors
  - `validating`: Validation is currently in progress
  - `unknown`: Status has not been determined (default)
- **`accountInfo`** (JSONB): Cached account information from the provider (encrypted/sanitized)
- **`validationError`** (TEXT): Error message from the last failed validation attempt

### New IntegrationCache Table
Created a new table for caching provider-specific data:

- **`id`** (TEXT): Primary key
- **`integrationId`** (TEXT): Foreign key to Integration table
- **`cacheKey`** (TEXT): Identifier for the type of cached data
- **`cacheData`** (JSONB): The actual cached data from provider APIs
- **`expiresAt`** (TIMESTAMP): Expiration time for automatic cleanup
- **`createdAt`** (TIMESTAMP): Creation timestamp

### Indexes Added
- **`idx_integration_connection_status`**: Composite index on `(userId, provider, connectionStatus)` for efficient connection status queries
- **`idx_integration_cache_expiry`**: Index on `expiresAt` for efficient cache cleanup operations

## Requirements Addressed
- **Requirement 5.1**: Secure token storage and data privacy compliance
- **Requirement 5.5**: Data retention and privacy regulation compliance

## Usage Examples

### Querying Connection Status
```sql
-- Get all connected integrations for a user
SELECT * FROM "Integration" 
WHERE "userId" = $1 AND "connectionStatus" = 'connected';

-- Get integrations that need validation
SELECT * FROM "Integration" 
WHERE "connectionStatus" IN ('unknown', 'error') 
AND ("lastConnectionValidation" IS NULL OR "lastConnectionValidation" < NOW() - INTERVAL '1 hour');
```

### Cache Management
```sql
-- Store account information in cache
INSERT INTO "IntegrationCache" ("integrationId", "cacheKey", "cacheData", "expiresAt")
VALUES ($1, 'account_info', $2, NOW() + INTERVAL '1 hour');

-- Retrieve cached data
SELECT "cacheData" FROM "IntegrationCache"
WHERE "integrationId" = $1 AND "cacheKey" = $2 AND "expiresAt" > NOW();

-- Clean up expired cache entries
DELETE FROM "IntegrationCache" WHERE "expiresAt" < NOW();
```

## Migration Instructions

### Apply Migration
```bash
# Run the migration script
psql -d your_database -f 007_enhance_integration_connection_validation.sql
```

### Rollback (if needed)
```bash
# Rollback the migration
psql -d your_database -f 007_enhance_integration_connection_validation_rollback.sql
```

## Post-Migration Steps
1. Update application code to use new connection validation columns
2. Implement cache cleanup job for expired entries
3. Update integration services to populate connection status
4. Test connection validation flows with new schema

## Security Considerations
- Account information stored in `accountInfo` should be sanitized and not contain sensitive tokens
- Cache data should not include raw authentication tokens
- Regular cleanup of expired cache entries is recommended
- Consider encryption for sensitive cached data

## Performance Impact
- New indexes will improve query performance for connection status checks
- Cache table reduces API calls to external providers
- Minimal impact on existing queries due to backward compatibility