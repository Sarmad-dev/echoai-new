-- CreateEnum
CREATE TYPE "UserPlan" AS ENUM ('FREE', 'PRO');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "plan" "UserPlan" NOT NULL DEFAULT 'FREE';

-- CreateTable
CREATE TABLE "Chatbot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'EchoAI Assistant',
    "welcomeMessage" TEXT NOT NULL DEFAULT 'Hello! How can I help you today?',
    "primaryColor" TEXT NOT NULL DEFAULT '#3B82F6',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chatbot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Chatbot_userId_idx" ON "Chatbot"("userId");

-- AddForeignKey
ALTER TABLE "Chatbot" ADD CONSTRAINT "Chatbot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing UserSettings to Chatbot
INSERT INTO "Chatbot" ("id", "name", "welcomeMessage", "primaryColor", "userId", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text,
    COALESCE("chatbotName", 'EchoAI Assistant'),
    COALESCE("welcomeMessage", 'Hello! How can I help you today?'),
    COALESCE("primaryColor", '#3B82F6'),
    "userId",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "UserSettings";

-- Add chatbotId to Document table
ALTER TABLE "Document" ADD COLUMN "chatbotId" TEXT;

-- Migrate existing documents to the first chatbot of each user
UPDATE "Document" 
SET "chatbotId" = (
    SELECT "id" 
    FROM "Chatbot" 
    WHERE "Chatbot"."userId" = "Document"."userId" 
    LIMIT 1
);

-- Make chatbotId required and add foreign key
ALTER TABLE "Document" ALTER COLUMN "chatbotId" SET NOT NULL;
ALTER TABLE "Document" ADD CONSTRAINT "Document_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Remove old userId column and index from Document
ALTER TABLE "Document" DROP CONSTRAINT "Document_userId_fkey";
DROP INDEX "Document_userId_idx";
ALTER TABLE "Document" DROP COLUMN "userId";

-- Create new index on chatbotId
CREATE INDEX "Document_chatbotId_idx" ON "Document"("chatbotId");

-- Add chatbotId to Conversation table
ALTER TABLE "Conversation" ADD COLUMN "chatbotId" TEXT;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create indexes
CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");
CREATE INDEX "Conversation_chatbotId_idx" ON "Conversation"("chatbotId");

-- Drop UserSettings table
DROP TABLE "UserSettings";