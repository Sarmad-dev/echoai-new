-- Migration: Add Enhanced Chatbot Intelligence Features
-- This migration adds support for training instructions, conversation intelligence,
-- enhanced lead qualification, and escalation management

-- Create enum types for enhanced features
CREATE TYPE "InstructionType" AS ENUM ('BEHAVIOR', 'KNOWLEDGE', 'TONE', 'ESCALATION');
CREATE TYPE "CollectionStrategy" AS ENUM ('DIRECT', 'CONVERSATIONAL', 'PROGRESSIVE');
CREATE TYPE "LeadPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'QUALIFIED', 'CONTACTED', 'CONVERTED', 'LOST');
CREATE TYPE "EscalationType" AS ENUM ('TECHNICAL', 'FRUSTRATION', 'COMPLEXITY', 'COMPLAINT', 'REQUEST');
CREATE TYPE "EscalationStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED');
CREATE TYPE "UrgencyLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- Create TrainingInstruction table
CREATE TABLE "TrainingInstruction" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "type" "InstructionType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingInstruction_pkey" PRIMARY KEY ("id")
);

-- Create ConversationIntelligence table
CREATE TABLE "ConversationIntelligence" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "intelligenceData" JSONB NOT NULL,
    "contextUnderstanding" DECIMAL(3,2),
    "proactiveScore" DECIMAL(3,2),
    "helpfulnessScore" DECIMAL(3,2),
    "topicTransitions" JSONB,
    "userProfile" JSONB,
    "conversationSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationIntelligence_pkey" PRIMARY KEY ("id")
);

-- Create EnhancedLead table
CREATE TABLE "EnhancedLead" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "contactInfo" JSONB,
    "qualificationData" JSONB,
    "conversationMetrics" JSONB,
    "collectionStrategy" "CollectionStrategy" NOT NULL DEFAULT 'CONVERSATIONAL',
    "leadScore" DECIMAL(3,2),
    "priority" "LeadPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "qualificationQuestions" JSONB,
    "followUpActions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnhancedLead_pkey" PRIMARY KEY ("id")
);

-- Create EscalationRequest table
CREATE TABLE "EscalationRequest" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "escalationType" "EscalationType" NOT NULL,
    "triggerReason" TEXT,
    "escalationData" JSONB,
    "status" "EscalationStatus" NOT NULL DEFAULT 'PENDING',
    "assignedAgentId" TEXT,
    "urgencyLevel" "UrgencyLevel" NOT NULL DEFAULT 'MEDIUM',
    "customerSentiment" TEXT,
    "conversationContext" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscalationRequest_pkey" PRIMARY KEY ("id")
);

-- Create unique constraints
CREATE UNIQUE INDEX "ConversationIntelligence_conversationId_key" ON "ConversationIntelligence"("conversationId");
CREATE UNIQUE INDEX "EnhancedLead_conversationId_key" ON "EnhancedLead"("conversationId");
CREATE UNIQUE INDEX "EscalationRequest_conversationId_key" ON "EscalationRequest"("conversationId");

-- Create performance indexes for TrainingInstruction
CREATE INDEX "TrainingInstruction_chatbotId_idx" ON "TrainingInstruction"("chatbotId");
CREATE INDEX "TrainingInstruction_type_idx" ON "TrainingInstruction"("type");
CREATE INDEX "TrainingInstruction_isActive_idx" ON "TrainingInstruction"("isActive");
CREATE INDEX "TrainingInstruction_priority_idx" ON "TrainingInstruction"("priority");

-- Create performance indexes for ConversationIntelligence
CREATE INDEX "ConversationIntelligence_chatbotId_idx" ON "ConversationIntelligence"("chatbotId");
CREATE INDEX "ConversationIntelligence_userId_idx" ON "ConversationIntelligence"("userId");
CREATE INDEX "ConversationIntelligence_createdAt_idx" ON "ConversationIntelligence"("createdAt");

-- Create performance indexes for EnhancedLead
CREATE INDEX "EnhancedLead_chatbotId_idx" ON "EnhancedLead"("chatbotId");
CREATE INDEX "EnhancedLead_status_idx" ON "EnhancedLead"("status");
CREATE INDEX "EnhancedLead_priority_idx" ON "EnhancedLead"("priority");
CREATE INDEX "EnhancedLead_leadScore_idx" ON "EnhancedLead"("leadScore");
CREATE INDEX "EnhancedLead_createdAt_idx" ON "EnhancedLead"("createdAt");

-- Create performance indexes for EscalationRequest
CREATE INDEX "EscalationRequest_chatbotId_idx" ON "EscalationRequest"("chatbotId");
CREATE INDEX "EscalationRequest_status_idx" ON "EscalationRequest"("status");
CREATE INDEX "EscalationRequest_escalationType_idx" ON "EscalationRequest"("escalationType");
CREATE INDEX "EscalationRequest_urgencyLevel_idx" ON "EscalationRequest"("urgencyLevel");
CREATE INDEX "EscalationRequest_createdAt_idx" ON "EscalationRequest"("createdAt");

-- Add foreign key constraints
ALTER TABLE "TrainingInstruction" ADD CONSTRAINT "TrainingInstruction_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationIntelligence" ADD CONSTRAINT "ConversationIntelligence_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationIntelligence" ADD CONSTRAINT "ConversationIntelligence_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EnhancedLead" ADD CONSTRAINT "EnhancedLead_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EnhancedLead" ADD CONSTRAINT "EnhancedLead_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EscalationRequest" ADD CONSTRAINT "EscalationRequest_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EscalationRequest" ADD CONSTRAINT "EscalationRequest_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;