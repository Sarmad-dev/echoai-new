-- Rollback Migration: Remove Enhanced Chatbot Intelligence Features
-- This script removes all the enhanced chatbot intelligence tables and types

-- Drop foreign key constraints first
ALTER TABLE "TrainingInstruction" DROP CONSTRAINT IF EXISTS "TrainingInstruction_chatbotId_fkey";
ALTER TABLE "ConversationIntelligence" DROP CONSTRAINT IF EXISTS "ConversationIntelligence_conversationId_fkey";
ALTER TABLE "ConversationIntelligence" DROP CONSTRAINT IF EXISTS "ConversationIntelligence_chatbotId_fkey";
ALTER TABLE "EnhancedLead" DROP CONSTRAINT IF EXISTS "EnhancedLead_conversationId_fkey";
ALTER TABLE "EnhancedLead" DROP CONSTRAINT IF EXISTS "EnhancedLead_chatbotId_fkey";
ALTER TABLE "EscalationRequest" DROP CONSTRAINT IF EXISTS "EscalationRequest_conversationId_fkey";
ALTER TABLE "EscalationRequest" DROP CONSTRAINT IF EXISTS "EscalationRequest_chatbotId_fkey";

-- Drop tables
DROP TABLE IF EXISTS "EscalationRequest";
DROP TABLE IF EXISTS "EnhancedLead";
DROP TABLE IF EXISTS "ConversationIntelligence";
DROP TABLE IF EXISTS "TrainingInstruction";

-- Drop enum types
DROP TYPE IF EXISTS "UrgencyLevel";
DROP TYPE IF EXISTS "EscalationStatus";
DROP TYPE IF EXISTS "EscalationType";
DROP TYPE IF EXISTS "LeadStatus";
DROP TYPE IF EXISTS "LeadPriority";
DROP TYPE IF EXISTS "CollectionStrategy";
DROP TYPE IF EXISTS "InstructionType";