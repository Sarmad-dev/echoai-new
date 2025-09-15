-- Add instructions column to Chatbot table
ALTER TABLE "Chatbot" ADD COLUMN "instructions" TEXT;

-- Add comment for clarity
COMMENT ON COLUMN "Chatbot"."instructions" IS 'Simple training instructions for the chatbot behavior';