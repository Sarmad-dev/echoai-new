-- Migration: Add oauth_states table for CSRF protection
-- This table stores OAuth state parameters to prevent CSRF attacks during OAuth flows

-- Create the oauth_states table
CREATE TABLE IF NOT EXISTS "OAuthState" (
    "state" TEXT PRIMARY KEY,
    "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "providerId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "OAuthState_expiresAt_idx" ON "OAuthState" ("expiresAt");
CREATE INDEX IF NOT EXISTS "OAuthState_userId_idx" ON "OAuthState" ("userId");

-- Add a cleanup function to remove expired states
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
    DELETE FROM "OAuthState" WHERE "expiresAt" < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up expired states (optional, can be done via cron or application logic)
-- This is commented out as it requires pg_cron extension
-- SELECT cron.schedule('cleanup-oauth-states', '*/5 * * * *', 'SELECT cleanup_expired_oauth_states();');