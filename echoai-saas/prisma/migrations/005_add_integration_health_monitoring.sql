-- Migration: Add integration health monitoring
-- This migration adds health status tracking to the Integration table
-- and creates the IntegrationHealthLog table for health check history

-- Create the IntegrationHealthStatus enum
CREATE TYPE "IntegrationHealthStatus" AS ENUM ('HEALTHY', 'WARNING', 'ERROR', 'UNKNOWN');

-- Add health monitoring columns to Integration table
ALTER TABLE "Integration" 
ADD COLUMN "lastHealthCheck" TIMESTAMP(3),
ADD COLUMN "healthStatus" "IntegrationHealthStatus" NOT NULL DEFAULT 'UNKNOWN';

-- Create IntegrationHealthLog table
CREATE TABLE "IntegrationHealthLog" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "status" "IntegrationHealthStatus" NOT NULL,
    "errorMessage" TEXT,
    "responseTime" INTEGER,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationHealthLog_pkey" PRIMARY KEY ("id")
);

-- Create indexes for performance
CREATE INDEX "Integration_healthStatus_idx" ON "Integration"("healthStatus");
CREATE INDEX "IntegrationHealthLog_integrationId_idx" ON "IntegrationHealthLog"("integrationId");
CREATE INDEX "IntegrationHealthLog_checkedAt_idx" ON "IntegrationHealthLog"("checkedAt");
CREATE INDEX "IntegrationHealthLog_status_idx" ON "IntegrationHealthLog"("status");

-- Add foreign key constraint
ALTER TABLE "IntegrationHealthLog" ADD CONSTRAINT "IntegrationHealthLog_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;