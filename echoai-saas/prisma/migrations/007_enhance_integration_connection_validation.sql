-- Migration: Enhance database schema for connection validation tracking
-- This migration adds connection validation columns to the Integration table
-- and creates the IntegrationCache table for provider-specific data caching

-- Add connection validation columns to Integration table
ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "lastConnectionValidation" TIMESTAMP;
ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "connectionStatus" TEXT DEFAULT 'unknown';
ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "accountInfo" JSONB;
ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "validationError" TEXT;

-- Create index for efficient connection status queries
CREATE INDEX IF NOT EXISTS "idx_integration_connection_status" 
ON "Integration"("userId", "provider", "connectionStatus");

-- Create table for caching provider-specific data
CREATE TABLE IF NOT EXISTS "IntegrationCache" (
  "id" TEXT PRIMARY KEY,
  "integrationId" TEXT NOT NULL REFERENCES "Integration"("id") ON DELETE CASCADE,
  "cacheKey" TEXT NOT NULL,
  "cacheData" JSONB NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  CONSTRAINT "IntegrationCache_integrationId_cacheKey_key" UNIQUE("integrationId", "cacheKey")
);

-- Create index for efficient cache expiry queries
CREATE INDEX IF NOT EXISTS "idx_integration_cache_expiry" 
ON "IntegrationCache"("expiresAt");

-- Add comments for documentation
COMMENT ON COLUMN "Integration"."lastConnectionValidation" IS 'Timestamp of the last connection validation attempt';
COMMENT ON COLUMN "Integration"."connectionStatus" IS 'Current connection status: connected, disconnected, error, validating, unknown';
COMMENT ON COLUMN "Integration"."accountInfo" IS 'Cached account information retrieved from the provider';
COMMENT ON COLUMN "Integration"."validationError" IS 'Error message from the last failed validation attempt';

COMMENT ON TABLE "IntegrationCache" IS 'Cache table for storing provider-specific data with expiration';
COMMENT ON COLUMN "IntegrationCache"."cacheKey" IS 'Unique key identifying the type of cached data';
COMMENT ON COLUMN "IntegrationCache"."cacheData" IS 'JSON data cached from the provider API';
COMMENT ON COLUMN "IntegrationCache"."expiresAt" IS 'Expiration timestamp for automatic cache cleanup';