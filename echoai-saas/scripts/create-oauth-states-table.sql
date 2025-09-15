-- Create OAuth states table for CSRF protection
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS "oauth_states" (
    state TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for cleanup queries
CREATE INDEX IF NOT EXISTS "oauth_states_expires_at_idx" ON "oauth_states" ("expires_at");

-- Disable RLS for service access
ALTER TABLE "oauth_states" DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON "oauth_states" TO authenticated, service_role;

-- Create function to clean up expired states
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
    DELETE FROM "oauth_states" WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up expired states (optional)
-- This would need to be set up separately in Supabase or via cron