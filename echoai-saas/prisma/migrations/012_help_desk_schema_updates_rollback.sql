-- Rollback Migration: Help Desk Schema Updates
-- Description: Remove help desk functionality and revert schema changes

-- Drop indexes from Message table
DROP INDEX IF EXISTS "Message_createdAt_idx";
DROP INDEX IF EXISTS "Message_role_idx";
DROP INDEX IF EXISTS "Message_conversationId_idx";

-- Drop indexes from Conversation table
DROP INDEX IF EXISTS "Conversation_customerEmail_idx";
DROP INDEX IF EXISTS "Conversation_status_assignedTo_idx";
DROP INDEX IF EXISTS "Conversation_assignedTo_idx";
DROP INDEX IF EXISTS "Conversation_status_idx";

-- Remove help desk fields from Conversation table
ALTER TABLE "Conversation" DROP COLUMN IF EXISTS "assignedTo";
ALTER TABLE "Conversation" DROP COLUMN IF EXISTS "source";
ALTER TABLE "Conversation" DROP COLUMN IF EXISTS "customerEmail";
ALTER TABLE "Conversation" DROP COLUMN IF EXISTS "status";

-- Remove role field from User table
ALTER TABLE "User" DROP COLUMN IF EXISTS "role";

-- Drop enums
DROP TYPE IF EXISTS "ConversationStatus";
DROP TYPE IF EXISTS "UserRole";