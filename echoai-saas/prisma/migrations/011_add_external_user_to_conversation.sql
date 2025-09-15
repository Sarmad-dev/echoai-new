-- Migration: Add externalUserId to Conversation table
-- Date: 2025-09-08
-- Description: Adds externalUserId column to support widget conversations with external users

BEGIN;

-- Add externalUserId column to Conversation table
ALTER TABLE "Conversation" 
ADD COLUMN IF NOT EXISTS "externalUserId" TEXT;

-- Add foreign key constraint
ALTER TABLE "Conversation" 
ADD CONSTRAINT "Conversation_externalUserId_fkey" 
FOREIGN KEY ("externalUserId") REFERENCES "ExternalUser"(id) ON DELETE SET NULL;

-- Create index on externalUserId for better query performance
CREATE INDEX IF NOT EXISTS "Conversation_externalUserId_idx" ON "Conversation" ("externalUserId");

-- Add comment to document the column purpose
COMMENT ON COLUMN "Conversation"."externalUserId" IS 'Reference to external user for widget conversations';

COMMIT;

-- Verification query (for manual testing)
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'Conversation' AND column_name = 'externalUserId';