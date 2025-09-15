import { OAuthProvider } from "./oauth2-manager";

/**
 * OAuth provider configurations
 * Environment variables should be set for each provider
 */

export const OAUTH_PROVIDERS: Record<string, OAuthProvider> = {
  hubspot: {
    id: "hubspot",
    name: "HubSpot",
    description: "Connect to HubSpot CRM for contact and deal management",
    authUrl: "https://app.hubspot.com/oauth/authorize",
    tokenUrl: "https://api.hubapi.com/oauth/v1/token",
    scopes: [
      "crm.objects.contacts.read",
      "crm.objects.contacts.write",
      "crm.objects.deals.read",
      "crm.objects.deals.write",
      "crm.objects.companies.read",
      "crm.objects.companies.write",
    ],
    clientId: process.env.HUBSPOT_CLIENT_ID || "",
    clientSecret: process.env.HUBSPOT_CLIENT_SECRET || "",
    redirectUri:
      process.env.NEXT_PUBLIC_BASE_URL +
      "/api/integrations/oauth/callback/hubspot",
  },

  slack: {
    id: "slack",
    name: "Slack",
    description: "Send notifications and messages to Slack channels",
    authUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    scopes: [
      "chat:write",
      "chat:write.public",
      "channels:read",
      "groups:read",
      "im:read",
      "mpim:read",
      "users:read",
      "users:read.email",
    ],
    clientId: process.env.SLACK_CLIENT_ID || "",
    clientSecret: process.env.SLACK_CLIENT_SECRET || "",
    redirectUri:
      process.env.NEXT_PUBLIC_BASE_URL +
      "/api/integrations/oauth/callback/slack",
  },

  google: {
    id: "google",
    name: "Google Sheets",
    description: "Read from and write to Google Sheets for data logging",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirectUri:
      process.env.NEXT_PUBLIC_BASE_URL +
      "/api/integrations/oauth/callback/google",
  },
};

/**
 * Get provider configuration by ID
 */
export function getProvider(providerId: string): OAuthProvider | null {
  return OAUTH_PROVIDERS[providerId] || null;
}

/**
 * Get all available providers
 */
export function getAllProviders(): OAuthProvider[] {
  return Object.values(OAUTH_PROVIDERS);
}

/**
 * Validate provider configuration
 */
export function validateProviderConfig(providerId: string): {
  valid: boolean;
  missing: string[];
} {
  const provider = getProvider(providerId);
  if (!provider) {
    return { valid: false, missing: ["Provider not found"] };
  }

  const missing: string[] = [];

  if (!provider.clientId) {
    missing.push(`${providerId.toUpperCase()}_CLIENT_ID`);
  }

  if (!provider.clientSecret) {
    missing.push(`${providerId.toUpperCase()}_CLIENT_SECRET`);
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
