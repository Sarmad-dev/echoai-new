-- Add API key to chatbots
ALTER TABLE "Chatbot" ADD COLUMN "apiKey" UUID NOT NULL DEFAULT gen_random_uuid();

-- Make apiKey unique
ALTER TABLE "Chatbot" ADD CONSTRAINT "Chatbot_apiKey_key" UNIQUE ("apiKey");

-- Add index for apiKey lookups
CREATE INDEX "Chatbot_apiKey_idx" ON "Chatbot"("apiKey");