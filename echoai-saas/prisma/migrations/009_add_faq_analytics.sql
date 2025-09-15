-- Add analytics fields to FAQ table
ALTER TABLE "FAQ" ADD COLUMN "popularity" INTEGER DEFAULT 0;
ALTER TABLE "FAQ" ADD COLUMN "tags" TEXT[];
ALTER TABLE "FAQ" ADD COLUMN "lastUpdated" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Create index for popularity sorting
CREATE INDEX "FAQ_popularity_idx" ON "FAQ"("popularity" DESC);

-- Create FAQ analytics tracking table
CREATE TABLE "FAQAnalytics" (
    "id" TEXT NOT NULL,
    "faqId" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "action" TEXT NOT NULL, -- 'view', 'click', 'search'
    "userAgent" TEXT,
    "sessionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FAQAnalytics_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "FAQAnalytics" ADD CONSTRAINT "FAQAnalytics_faqId_fkey" FOREIGN KEY ("faqId") REFERENCES "FAQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FAQAnalytics" ADD CONSTRAINT "FAQAnalytics_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for analytics queries
CREATE INDEX "FAQAnalytics_faqId_idx" ON "FAQAnalytics"("faqId");
CREATE INDEX "FAQAnalytics_chatbotId_idx" ON "FAQAnalytics"("chatbotId");
CREATE INDEX "FAQAnalytics_action_idx" ON "FAQAnalytics"("action");
CREATE INDEX "FAQAnalytics_createdAt_idx" ON "FAQAnalytics"("createdAt" DESC);