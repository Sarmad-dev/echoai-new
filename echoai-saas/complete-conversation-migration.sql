-- Complete Migration: Fix Conversation Management
-- Date: 2025-09-08
-- Description: Complete migration to fix conversation ID storage and add external user support

BEGIN;

-- Step 1: Add memoryBuffer to Conversation table (if not already added)
ALTER TABLE "Conversation" 
ADD COLUMN IF NOT EXISTS "memoryBuffer" JSONB;

-- Step 2: Add externalUserId to Conversation table
ALTER TABLE "Conversation" 
ADD COLUMN IF NOT EXISTS "externalUserId" TEXT;

-- Step 3: Add foreign key constraint for externalUserId
ALTER TABLE "Conversation" 
ADD CONSTRAINT IF NOT EXISTS "Conversation_externalUserId_fkey" 
FOREIGN KEY ("externalUserId") REFERENCES "ExternalUser"(id) ON DELETE SET NULL;

-- Step 4: Create indexes for better performance
CREATE INDEX IF NOT EXISTS "Conversation_memoryBuffer_idx" ON "Conversation" USING GIN ("memoryBuffer");
CREATE INDEX IF NOT EXISTS "Conversation_externalUserId_idx" ON "Conversation" ("externalUserId");

-- Step 5: Add comments to document the columns
COMMENT ON COLUMN "Conversation"."memoryBuffer" IS 'LangChain memory state for conversation context and history';
COMMENT ON COLUMN "Conversation"."externalUserId" IS 'Reference to external user for widget conversations';

-- Step 6: Update any existing conversations that might need external user association
-- This is a data migration step - you may need to customize this based on your data
-- UPDATE "Conversation" SET "externalUserId" = (
--   SELECT eu.id FROM "ExternalUser" eu 
--   WHERE eu.email = 'some_condition'
-- ) WHERE "chatbotId" IS NOT NULL AND "externalUserId" IS NULL;

COMMIT;

-- Verification queries
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'Conversation' 
  AND column_name IN ('memoryBuffer', 'externalUserId')
ORDER BY column_name;

-- Check indexes
SELECT 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE tablename = 'Conversation' 
  AND indexname LIKE '%memoryBuffer%' OR indexname LIKE '%externalUserId%';