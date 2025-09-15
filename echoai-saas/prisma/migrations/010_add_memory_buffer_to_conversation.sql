-- Migration: Add memoryBuffer column to Conversation table
-- Date: 2025-09-08
-- Description: Adds memory buffer functionality directly to conversations for better memory management

BEGIN;

-- Add memoryBuffer column to Conversation table
ALTER TABLE "Conversation" 
ADD COLUMN IF NOT EXISTS "memoryBuffer" JSONB;

-- Add comment to document the column purpose
COMMENT ON COLUMN "Conversation"."memoryBuffer" IS 'LangChain memory state for conversation context and history';

-- Create index on memoryBuffer for better query performance when filtering by memory content
CREATE INDEX IF NOT EXISTS "Conversation_memoryBuffer_idx" ON "Conversation" USING GIN ("memoryBuffer");

-- Update the schema version or add any additional constraints if needed
-- (No additional constraints needed for this migration)

COMMIT;

-- Verification query (for manual testing)
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'Conversation' AND column_name = 'memoryBuffer';