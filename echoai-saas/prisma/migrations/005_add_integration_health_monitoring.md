# Migration 005: Add Integration Health Monitoring

## Overview
This migration enhances the database schema to support integration health monitoring capabilities for the OAuth Integration Dashboard feature.

## Changes Made

### 1. Enhanced Integration Table
Added the following columns to the `Integration` table:
- `lastHealthCheck`: Timestamp of the last health check performed
- `healthStatus`: Current health status using the new enum (HEALTHY, WARNING, ERROR, UNKNOWN)

### 2. New IntegrationHealthStatus Enum
Created enum with the following values:
- `HEALTHY`: Integration is working properly
- `WARNING`: Integration has minor issues but is functional
- `ERROR`: Integration has critical issues and may not be functional
- `UNKNOWN`: Health status has not been determined yet (default)

### 3. New IntegrationHealthLog Table
Created table to track health check history with:
- `id`: Primary key
- `integrationId`: Foreign key to Integration table
- `status`: Health status at time of check
- `errorMessage`: Optional error message if check failed
- `responseTime`: API response time in milliseconds
- `checkedAt`: Timestamp when check was performed

### 4. Database Indexes
Added performance indexes for:
- `Integration.healthStatus` - for filtering by health status
- `IntegrationHealthLog.integrationId` - for querying logs by integration
- `IntegrationHealthLog.checkedAt` - for time-based queries
- `IntegrationHealthLog.status` - for filtering by status

## Requirements Addressed
- **Requirement 4.1**: OAuth Security and Token Management - Enhanced token tracking with health status
- **Requirement 7.1**: Integration Status Monitoring - Added health status tracking
- **Requirement 7.2**: Integration Status Monitoring - Added health check history logging

## Usage
After running this migration:
1. All existing integrations will have `healthStatus` set to `UNKNOWN`
2. The `lastHealthCheck` field will be `NULL` until first health check is performed
3. Health check logs can be created to track integration status over time

## Rollback
To rollback this migration:
1. Drop the `IntegrationHealthLog` table
2. Remove the added columns from `Integration` table
3. Drop the `IntegrationHealthStatus` enum