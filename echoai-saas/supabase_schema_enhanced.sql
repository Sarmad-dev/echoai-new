-- Enhanced Supabase schema for Advanced Automation Platform
-- Run this in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Create enums (UserPlan already exists, only add new ones)
DO $$ BEGIN
    CREATE TYPE "UserPlan" AS ENUM ('FREE', 'PRO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- User table (already exists - no changes needed)
-- Chatbot table (already exists - no changes needed)  
-- Document table (already exists - no changes needed)
-- Conversation table (already exists - no changes needed)

-- Add new columns to existing Message table
ALTER TABLE "Message" 
ADD COLUMN IF NOT EXISTS "sessionId" TEXT REFERENCES "ConversationSession"(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "sentimentScore" DECIMAL(3,2), -- -1.00 to 1.00
ADD COLUMN IF NOT EXISTS metadata JSONB,
ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

-- Create ExternalUser table for chat widget users
CREATE TABLE IF NOT EXISTS "ExternalUser" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email TEXT UNIQUE NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ConversationSession table for persistent memory
CREATE TABLE IF NOT EXISTS "ConversationSession" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "externalUserId" TEXT NOT NULL REFERENCES "ExternalUser"(id) ON DELETE CASCADE,
    "chatbotId" TEXT NOT NULL REFERENCES "Chatbot"(id) ON DELETE CASCADE,
    "memoryBuffer" JSONB, -- LangChain memory state
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create AutomationWorkflow table for visual workflows
CREATE TABLE IF NOT EXISTS "AutomationWorkflow" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    "flowDefinition" JSONB NOT NULL, -- React Flow graph
    "stateMachine" JSONB NOT NULL, -- XState machine definition
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create WorkflowExecution table for execution tracking
CREATE TABLE IF NOT EXISTS "WorkflowExecution" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "workflowId" TEXT NOT NULL REFERENCES "AutomationWorkflow"(id) ON DELETE CASCADE,
    "triggerId" TEXT NOT NULL,
    "triggerData" JSONB,
    status "ExecutionStatus" NOT NULL,
    "executionLog" JSONB,
    "startedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "completedAt" TIMESTAMP WITH TIME ZONE
);

-- Create Integration table for third-party connections
CREATE TABLE IF NOT EXISTS "Integration" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'hubspot', 'slack', 'google_sheets', 'salesforce'
    "accessToken" TEXT NOT NULL, -- Encrypted
    "refreshToken" TEXT, -- Encrypted
    "tokenExpiry" TIMESTAMP WITH TIME ZONE,
    config JSONB, -- Provider-specific configuration
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create FAQ table for chatbot FAQs
CREATE TABLE IF NOT EXISTS "FAQ" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "chatbotId" TEXT NOT NULL REFERENCES "Chatbot"(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT,
    "displayOrder" INTEGER DEFAULT 0,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ImageAnalysis table for vision analysis results
CREATE TABLE IF NOT EXISTS "ImageAnalysis" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "messageId" TEXT NOT NULL REFERENCES "Message"(id) ON DELETE CASCADE,
    "imageUrl" TEXT NOT NULL,
    prompt TEXT NOT NULL,
    "analysisResult" JSONB NOT NULL,
    "processingTime" INTEGER, -- milliseconds
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for optimal performance

-- Existing table indexes (already exist - no changes needed for User, Chatbot, Document, Conversation)

-- ExternalUser indexes
CREATE INDEX IF NOT EXISTS "ExternalUser_email_idx" ON "ExternalUser" ("email");

-- ConversationSession indexes
CREATE INDEX IF NOT EXISTS "ConversationSession_externalUserId_idx" ON "ConversationSession" ("externalUserId");
CREATE INDEX IF NOT EXISTS "ConversationSession_chatbotId_idx" ON "ConversationSession" ("chatbotId");
CREATE INDEX IF NOT EXISTS "ConversationSession_isActive_idx" ON "ConversationSession" ("isActive");

-- New Message indexes for added columns
CREATE INDEX IF NOT EXISTS "Message_sessionId_idx" ON "Message" ("sessionId");
CREATE INDEX IF NOT EXISTS "Message_sentimentScore_idx" ON "Message" ("sentimentScore");

-- AutomationWorkflow indexes
CREATE INDEX IF NOT EXISTS "AutomationWorkflow_userId_idx" ON "AutomationWorkflow" ("userId");
CREATE INDEX IF NOT EXISTS "AutomationWorkflow_isActive_idx" ON "AutomationWorkflow" ("isActive");

-- WorkflowExecution indexes
CREATE INDEX IF NOT EXISTS "WorkflowExecution_workflowId_idx" ON "WorkflowExecution" ("workflowId");
CREATE INDEX IF NOT EXISTS "WorkflowExecution_status_idx" ON "WorkflowExecution" ("status");
CREATE INDEX IF NOT EXISTS "WorkflowExecution_startedAt_idx" ON "WorkflowExecution" ("startedAt");

-- Integration indexes
CREATE INDEX IF NOT EXISTS "Integration_userId_idx" ON "Integration" ("userId");
CREATE INDEX IF NOT EXISTS "Integration_provider_idx" ON "Integration" ("provider");
CREATE INDEX IF NOT EXISTS "Integration_isActive_idx" ON "Integration" ("isActive");

-- FAQ indexes
CREATE INDEX IF NOT EXISTS "FAQ_chatbotId_idx" ON "FAQ" ("chatbotId");
CREATE INDEX IF NOT EXISTS "FAQ_isActive_idx" ON "FAQ" ("isActive");
CREATE INDEX IF NOT EXISTS "FAQ_displayOrder_idx" ON "FAQ" ("displayOrder");

-- ImageAnalysis indexes
CREATE INDEX IF NOT EXISTS "ImageAnalysis_messageId_idx" ON "ImageAnalysis" ("messageId");

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS "Message_conversation_created_idx" ON "Message" ("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "WorkflowExecution_workflow_status_idx" ON "WorkflowExecution" ("workflowId", "status");
CREATE INDEX IF NOT EXISTS "ConversationSession_chatbot_active_idx" ON "ConversationSession" ("chatbotId", "isActive");

-- Disable RLS for service access (since you're using secret key)
-- Existing tables RLS already disabled, only disable for new tables
ALTER TABLE "ExternalUser" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ConversationSession" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "AutomationWorkflow" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkflowExecution" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Integration" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "FAQ" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ImageAnalysis" DISABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated and service_role (for new tables only)
GRANT ALL ON "ExternalUser" TO authenticated, service_role;
GRANT ALL ON "ConversationSession" TO authenticated, service_role;
GRANT ALL ON "AutomationWorkflow" TO authenticated, service_role;
GRANT ALL ON "WorkflowExecution" TO authenticated, service_role;
GRANT ALL ON "Integration" TO authenticated, service_role;
GRANT ALL ON "FAQ" TO authenticated, service_role;
GRANT ALL ON "ImageAnalysis" TO authenticated, service_role;

-- The update_updated_at_column function already exists from the base schema

-- Create triggers for updatedAt columns (only for new tables, existing triggers already exist)
CREATE TRIGGER update_external_user_updated_at BEFORE UPDATE ON "ExternalUser"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_session_updated_at BEFORE UPDATE ON "ConversationSession"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_workflow_updated_at BEFORE UPDATE ON "AutomationWorkflow"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integration_updated_at BEFORE UPDATE ON "Integration"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Test user already exists from the base schema