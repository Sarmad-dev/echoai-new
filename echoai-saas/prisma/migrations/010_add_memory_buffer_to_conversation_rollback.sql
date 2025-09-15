-- Rollback Migration: Remove memoryBuffer column from Conversation table
-- Date: 2025-09-08
-- Description: Rollback script to remove memory buffer functionality from conversations

BEGIN;

-- Drop the index first
DROP INDEX IF EXISTS "Conversation_memoryBuffer_idx";

-- Remove the memoryBuffer column from Conversation table
ALTER TABLE "Conversation" 
DROP COLUMN IF EXISTS "memoryBuffer";

COMMIT;

-- Verification query (for manual testing)
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'Conversation' AND column_name = 'memoryBuffer';
-- Should return no rows after rollback