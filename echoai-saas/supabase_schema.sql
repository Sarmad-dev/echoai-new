-- Complete Supabase schema based on Prisma schema
-- Run this in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Create UserPlan enum
CREATE TYPE "UserPlan" AS ENUM ('FREE', 'PRO');

-- Create User table
CREATE TABLE IF NOT EXISTS "User" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    "apiKey" UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    plan "UserPlan" DEFAULT 'FREE',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Chatbot table
CREATE TABLE IF NOT EXISTS "Chatbot" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT DEFAULT 'EchoAI Assistant' NOT NULL,
    "welcomeMessage" TEXT DEFAULT 'Hello! How can I help you today?' NOT NULL,
    "primaryColor" TEXT DEFAULT '#3B82F6' NOT NULL,
    "isActive" BOOLEAN DEFAULT true NOT NULL,
    "apiKey" UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Document table
CREATE TABLE IF NOT EXISTS "Document" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    content TEXT NOT NULL,
    metadata JSONB,
    embedding vector(1536), -- 1536 dimensions for text-embedding-3-small
    "chatbotId" TEXT NOT NULL REFERENCES "Chatbot"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Conversation table
CREATE TABLE IF NOT EXISTS "Conversation" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "chatbotId" TEXT REFERENCES "Chatbot"(id) ON DELETE SET NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Message table
CREATE TABLE IF NOT EXISTS "Message" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "conversationId" TEXT NOT NULL REFERENCES "Conversation"(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes (matching Prisma schema)
-- User table indexes (unique constraints already create indexes)

-- Chatbot table indexes
CREATE INDEX IF NOT EXISTS "Chatbot_userId_idx" ON "Chatbot" ("userId");
CREATE INDEX IF NOT EXISTS "Chatbot_apiKey_idx" ON "Chatbot" ("apiKey");

-- Document table indexes
CREATE INDEX IF NOT EXISTS "Document_chatbotId_idx" ON "Document" ("chatbotId");

-- Conversation table indexes
CREATE INDEX IF NOT EXISTS "Conversation_userId_idx" ON "Conversation" ("userId");
CREATE INDEX IF NOT EXISTS "Conversation_chatbotId_idx" ON "Conversation" ("chatbotId");

-- Vector similarity search index for Document table
CREATE INDEX IF NOT EXISTS "Document_embedding_cosine_idx" 
ON "Document" USING hnsw (embedding vector_cosine_ops);

-- Disable RLS for service access (since you're using secret key)
ALTER TABLE "User" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Chatbot" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Conversation" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" DISABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated and service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Create a function to update the updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updatedAt columns
CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON "User"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chatbot_updated_at BEFORE UPDATE ON "Chatbot"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_updated_at BEFORE UPDATE ON "Conversation"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert a test user for development (optional)
INSERT INTO "User" (id, email, "apiKey") 
VALUES (
    'abf1b291-bd47-4320-84c0-672777f49f18'::uuid,
    'test@example.com',
    'abf1b291-bd47-4320-84c0-672777f49f18'::uuid
) ON CONFLICT (email) DO NOTHING;