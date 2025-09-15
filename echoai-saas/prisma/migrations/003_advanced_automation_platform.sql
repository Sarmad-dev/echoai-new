-- Advanced Automation Platform Schema Enhancement
-- This migration adds new tables and columns for conversation sessions, external users,
-- automation workflows, integrations, and analytics

-- Create ExecutionStatus enum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- Create ExternalUser table for chat widget users
CREATE TABLE "ExternalUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalUser_pkey" PRIMARY KEY ("id")
);

-- Create ConversationSession table for persistent memory
CREATE TABLE "ConversationSession" (
    "id" TEXT NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "memoryBuffer" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationSession_pkey" PRIMARY KEY ("id")
);

-- Create AutomationWorkflow table for visual workflows
CREATE TABLE "AutomationWorkflow" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "flowDefinition" JSONB NOT NULL,
    "stateMachine" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationWorkflow_pkey" PRIMARY KEY ("id")
);

-- Create WorkflowExecution table for execution tracking
CREATE TABLE "WorkflowExecution" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "triggerId" TEXT NOT NULL,
    "triggerData" JSONB,
    "status" "ExecutionStatus" NOT NULL,
    "executionLog" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowExecution_pkey" PRIMARY KEY ("id")
);

-- Create Integration table for third-party connections
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "config" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- Create FAQ table for chatbot FAQs
CREATE TABLE "FAQ" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FAQ_pkey" PRIMARY KEY ("id")
);

-- Create ImageAnalysis table for vision analysis results
CREATE TABLE "ImageAnalysis" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "analysisResult" JSONB NOT NULL,
    "processingTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageAnalysis_pkey" PRIMARY KEY ("id")
);

-- Add new columns to existing Message table
ALTER TABLE "Message" ADD COLUMN "sessionId" TEXT;
ALTER TABLE "Message" ADD COLUMN "sentimentScore" DECIMAL(3,2);
ALTER TABLE "Message" ADD COLUMN "metadata" JSONB;
ALTER TABLE "Message" ADD COLUMN "imageUrl" TEXT;

-- Create unique constraints
CREATE UNIQUE INDEX "ExternalUser_email_key" ON "ExternalUser"("email");

-- Create indexes for optimal performance

-- ExternalUser indexes
CREATE INDEX "ExternalUser_email_idx" ON "ExternalUser"("email");

-- ConversationSession indexes
CREATE INDEX "ConversationSession_externalUserId_idx" ON "ConversationSession"("externalUserId");
CREATE INDEX "ConversationSession_chatbotId_idx" ON "ConversationSession"("chatbotId");
CREATE INDEX "ConversationSession_isActive_idx" ON "ConversationSession"("isActive");

-- Message indexes for new columns
CREATE INDEX "Message_sessionId_idx" ON "Message"("sessionId");
CREATE INDEX "Message_sentimentScore_idx" ON "Message"("sentimentScore");

-- AutomationWorkflow indexes
CREATE INDEX "AutomationWorkflow_userId_idx" ON "AutomationWorkflow"("userId");
CREATE INDEX "AutomationWorkflow_isActive_idx" ON "AutomationWorkflow"("isActive");

-- WorkflowExecution indexes
CREATE INDEX "WorkflowExecution_workflowId_idx" ON "WorkflowExecution"("workflowId");
CREATE INDEX "WorkflowExecution_status_idx" ON "WorkflowExecution"("status");
CREATE INDEX "WorkflowExecution_startedAt_idx" ON "WorkflowExecution"("startedAt");

-- Integration indexes
CREATE INDEX "Integration_userId_idx" ON "Integration"("userId");
CREATE INDEX "Integration_provider_idx" ON "Integration"("provider");
CREATE INDEX "Integration_isActive_idx" ON "Integration"("isActive");

-- FAQ indexes
CREATE INDEX "FAQ_chatbotId_idx" ON "FAQ"("chatbotId");
CREATE INDEX "FAQ_isActive_idx" ON "FAQ"("isActive");
CREATE INDEX "FAQ_displayOrder_idx" ON "FAQ"("displayOrder");

-- ImageAnalysis indexes
CREATE INDEX "ImageAnalysis_messageId_idx" ON "ImageAnalysis"("messageId");

-- Add foreign key constraints

-- ConversationSession foreign keys
ALTER TABLE "ConversationSession" ADD CONSTRAINT "ConversationSession_externalUserId_fkey" FOREIGN KEY ("externalUserId") REFERENCES "ExternalUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationSession" ADD CONSTRAINT "ConversationSession_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Message foreign key for session
ALTER TABLE "Message" ADD CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConversationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AutomationWorkflow foreign keys
ALTER TABLE "AutomationWorkflow" ADD CONSTRAINT "AutomationWorkflow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- WorkflowExecution foreign keys
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "AutomationWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Integration foreign keys
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FAQ foreign keys
ALTER TABLE "FAQ" ADD CONSTRAINT "FAQ_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ImageAnalysis foreign keys
ALTER TABLE "ImageAnalysis" ADD CONSTRAINT "ImageAnalysis_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create triggers for updatedAt columns on new tables
CREATE TRIGGER update_external_user_updated_at BEFORE UPDATE ON "ExternalUser"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_session_updated_at BEFORE UPDATE ON "ConversationSession"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_workflow_updated_at BEFORE UPDATE ON "AutomationWorkflow"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integration_updated_at BEFORE UPDATE ON "Integration"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions to authenticated and service_role for new tables
GRANT ALL ON "ExternalUser" TO authenticated, service_role;
GRANT ALL ON "ConversationSession" TO authenticated, service_role;
GRANT ALL ON "AutomationWorkflow" TO authenticated, service_role;
GRANT ALL ON "WorkflowExecution" TO authenticated, service_role;
GRANT ALL ON "Integration" TO authenticated, service_role;
GRANT ALL ON "FAQ" TO authenticated, service_role;
GRANT ALL ON "ImageAnalysis" TO authenticated, service_role;

-- Disable RLS for service access (consistent with existing tables)
ALTER TABLE "ExternalUser" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ConversationSession" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "AutomationWorkflow" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkflowExecution" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Integration" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "FAQ" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ImageAnalysis" DISABLE ROW LEVEL SECURITY;