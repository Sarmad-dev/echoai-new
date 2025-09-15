-- Migration: Add memoryBuffer column to Conversation table
-- This adds memory buffer functionality directly to conversations instead of using separate sessions

-- Add memoryBuffer column to Conversation table
ALTER TABLE "Conversation" 
ADD COLUMN IF NOT EXISTS "memoryBuffer" JSONB;

-- Add comment to document the column purpose
COMMENT ON COLUMN "Conversation"."memoryBuffer" IS 'LangChain memory state for conversation context and history';

-- Create index on memoryBuffer for better query performance when filtering by memory content
CREATE INDEX IF NOT EXISTS "Conversation_memoryBuffer_idx" ON "Conversation" USING GIN ("memoryBuffer");

-- Update existing conversations to have null memory buffer (they will be initialized on first use)
-- No need to update existing records as NULL is the default and expected initial state

-- Verify the migration
DO $$
BEGIN
    -- Check if column was added successfully
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Conversation' 
        AND column_name = 'memoryBuffer'
        AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'Migration successful: memoryBuffer column added to Conversation table';
    ELSE
        RAISE EXCEPTION 'Migration failed: memoryBuffer column not found in Conversation table';
    END IF;
END $$;