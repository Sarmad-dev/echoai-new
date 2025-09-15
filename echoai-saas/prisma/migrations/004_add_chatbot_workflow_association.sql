-- Add chatbot association to AutomationWorkflow and WorkflowExecution tables
-- This migration adds chatbotId fields and foreign key relationships for proper workflow scoping

-- Add chatbotId column to AutomationWorkflow table
ALTER TABLE "AutomationWorkflow" ADD COLUMN "chatbotId" TEXT NOT NULL DEFAULT '';

-- Add chatbotId column to WorkflowExecution table  
ALTER TABLE "WorkflowExecution" ADD COLUMN "chatbotId" TEXT NOT NULL DEFAULT '';

-- Create indexes for performance optimization
CREATE INDEX "AutomationWorkflow_chatbotId_idx" ON "AutomationWorkflow"("chatbotId");
CREATE INDEX "AutomationWorkflow_userId_chatbotId_idx" ON "AutomationWorkflow"("userId", "chatbotId");
CREATE INDEX "WorkflowExecution_chatbotId_idx" ON "WorkflowExecution"("chatbotId");

-- Add foreign key constraints
ALTER TABLE "AutomationWorkflow" ADD CONSTRAINT "AutomationWorkflow_chatbotId_fkey" 
    FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_chatbotId_fkey" 
    FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Remove the default empty string constraint after adding the foreign key
-- Note: In production, you would need to populate existing records with valid chatbotId values
-- before removing the default and making the constraint NOT NULL without default
ALTER TABLE "AutomationWorkflow" ALTER COLUMN "chatbotId" DROP DEFAULT;
ALTER TABLE "WorkflowExecution" ALTER COLUMN "chatbotId" DROP DEFAULT;