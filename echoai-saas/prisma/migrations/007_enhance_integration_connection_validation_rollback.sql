-- Rollback Migration: Remove connection validation enhancements
-- This script reverses the changes made in 007_enhance_integration_connection_validation.sql

-- Drop the IntegrationCache table
DROP TABLE IF EXISTS "IntegrationCache";

-- Remove the connection validation columns from Integration table
ALTER TABLE "Integration" DROP COLUMN IF EXISTS "lastConnectionValidation";
ALTER TABLE "Integration" DROP COLUMN IF EXISTS "connectionStatus";
ALTER TABLE "Integration" DROP COLUMN IF EXISTS "accountInfo";
ALTER TABLE "Integration" DROP COLUMN IF EXISTS "validationError";

-- Drop the connection status index
DROP INDEX IF EXISTS "idx_integration_connection_status";