-- Migration: Help Desk Schema Updates
-- Description: Add role-based access control, conversation status management, and help desk functionality

-- Create UserRole enum
CREATE TYPE "UserRole" AS ENUM ('user', 'staff', 'admin');

-- Create ConversationStatus enum
CREATE TYPE "ConversationStatus" AS ENUM ('AI_HANDLING', 'AWAITING_HUMAN_RESPONSE', 'RESOLVED');

-- Add role field to User table with default value 'user'
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'admin';

-- Add help desk fields to Conversation table
ALTER TABLE "Conversation" ADD COLUMN "status" "ConversationStatus" NOT NULL DEFAULT 'AI_HANDLING';
ALTER TABLE "Conversation" ADD COLUMN "customerEmail" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "source" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "assignedTo" TEXT;

-- Create indexes for optimal help desk query performance
CREATE INDEX "Conversation_status_idx" ON "Conversation"("status");
CREATE INDEX "Conversation_assignedTo_idx" ON "Conversation"("assignedTo");
CREATE INDEX "Conversation_status_assignedTo_idx" ON "Conversation"("status", "assignedTo");
CREATE INDEX "Conversation_customerEmail_idx" ON "Conversation"("customerEmail");

-- Add indexes to Message table for help desk queries
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");
CREATE INDEX "Message_role_idx" ON "Message"("role");
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- Update existing conversations to have default status
UPDATE "Conversation" SET "status" = 'AI_HANDLING' WHERE "status" IS NULL;

-- Update existing users to have default role
UPDATE "User" SET "role" = 'user' WHERE "role" IS NULL;