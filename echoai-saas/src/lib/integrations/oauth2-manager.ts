import { createClient } from "../supabase/supabase";
import * as crypto from "crypto";

export interface OAuthProvider {
  id: string;
  name: string;
  description: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface Integration {
  id: string;
  userId: string;
  provider: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiry?: Date;
  config: Record<string, any>;
  isActive: boolean;
  healthStatus?: "HEALTHY" | "WARNING" | "ERROR" | "UNKNOWN";
  lastHealthCheck?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
}

export class OAuth2Manager {
  private supabase = createClient();
  private encryptionKey: string;

  constructor() {
    this.encryptionKey =
      process.env.INTEGRATION_ENCRYPTION_KEY ||
      "default-key-change-in-production";
  }

  /**
   * Encrypt sensitive token data
   */
  private encrypt(text: string): string {
    const algorithm = "aes-256-cbc";
    const key = crypto.scryptSync(this.encryptionKey, "salt", 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    return iv.toString("hex") + ":" + encrypted;
  }

  /**
   * Decrypt sensitive token data
   */
  private decrypt(encryptedText: string): string {
    const algorithm = "aes-256-cbc";
    const key = crypto.scryptSync(this.encryptionKey, "salt", 32);
    const parts = encryptedText.split(":");

    if (parts.length === 2) {
      // New format: iv:encrypted
      const [ivHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, "hex");
      const decipher = crypto.createDecipheriv(algorithm, key, iv);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } else if (parts.length === 3) {
      // Old GCM format: iv:authTag:encrypted - handle gracefully
      const [, , encrypted] = parts;
      const decipher = crypto.createDecipher(algorithm, key);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } else {
      throw new Error("Invalid encrypted data format");
    }
  }

  /**
   * Generate OAuth authorization URL with state parameter
   */
  async generateAuthUrl(
    provider: OAuthProvider,
    userId: string
  ): Promise<string> {
    const state = crypto.randomBytes(32).toString("hex");

    // Store state in session or database for validation
    await this.storeOAuthState(state, userId, provider.id);

    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: provider.redirectUri,
      scope: provider.scopes.join(" "),
      response_type: "code",
      state: state,
      access_type: "offline", // For refresh tokens
      prompt: "consent", // Force consent to get refresh token
    });

    return `${provider.authUrl}?${params.toString()}`;
  }

  /**
   * Store OAuth state for CSRF protection
   */
  private async storeOAuthState(
    state: string,
    userId: string,
    providerId: string
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store in database with proper table name
    const { error } = await this.supabase.from("OAuthState").upsert({
      state,
      userId,
      providerId,
      expiresAt: expiresAt.toISOString(),
    });

    if (error) {
      throw new Error(`Failed to store OAuth state: ${error.message}`);
    }
  }

  /**
   * Validate OAuth state parameter
   */
  private async validateOAuthState(
    state: string
  ): Promise<{ userId: string; providerId: string } | null> {
    const { data, error } = await this.supabase
      .from("OAuthState")
      .select("*")
      .eq("state", state)
      .single();

    if (error || !data) {
      return null;
    }

    // Check if state has expired
    if (new Date(data.expiresAt) < new Date()) {
      // Clean up expired state
      await this.supabase.from("OAuthState").delete().eq("state", state);
      return null;
    }

    // Clean up used state
    await this.supabase.from("OAuthState").delete().eq("state", state);

    return {
      userId: data.userId,
      providerId: data.providerId,
    };
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    provider: OAuthProvider,
    code: string,
    state: string
  ): Promise<{
    integration: Integration;
    tokenResponse: OAuthTokenResponse;
  } | null> {
    // Validate state parameter
    const stateData = await this.validateOAuthState(state);
    if (!stateData) {
      throw new Error("Invalid or expired OAuth state");
    }

    // Exchange code for token
    const tokenResponse = await this.requestAccessToken(provider, code);

    // Calculate token expiry
    const tokenExpiry = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : undefined;

    // Create integration record
    const integration = await this.createIntegration({
      userId: stateData.userId,
      provider: provider.id,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      tokenExpiry,
      config: {
        scope: tokenResponse.scope,
        tokenType: tokenResponse.token_type,
      },
    });

    // Fetch and store provider-specific connection details
    try {
      const connectionDetails = await this.fetchProviderConnectionDetails(
        provider.id,
        tokenResponse.access_token
      );

      if (connectionDetails) {
        await this.updateIntegrationConnectionDetails(
          integration.id,
          connectionDetails
        );
        
        // Update the integration object with connection details for return
        integration.config = {
          ...integration.config,
          connectionDetails,
        };
      }
    } catch (error) {
      console.error("Failed to fetch connection details during OAuth:", error);
      // Don't fail the entire OAuth flow if connection details fetch fails
    }

    return { integration, tokenResponse };
  }

  /**
   * Make HTTP request to exchange code for access token
   */
  private async requestAccessToken(
    provider: OAuthProvider,
    code: string
  ): Promise<OAuthTokenResponse> {
    const params = new URLSearchParams({
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: provider.redirectUri,
    });

    const response = await fetch(provider.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Create integration record in database
   */
  private async createIntegration(data: {
    userId: string;
    provider: string;
    accessToken: string;
    refreshToken?: string;
    tokenExpiry?: Date;
    config: Record<string, any>;
  }): Promise<Integration> {
    const encryptedAccessToken = this.encrypt(data.accessToken);
    const encryptedRefreshToken = data.refreshToken
      ? this.encrypt(data.refreshToken)
      : null;

    const { data: integration, error } = await this.supabase
      .from("Integration")
      .insert({
        userId: data.userId,
        provider: data.provider,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiry: data.tokenExpiry?.toISOString(),
        config: data.config,
        isActive: true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create integration: ${error.message}`);
    }

    return {
      ...integration,
      accessToken: data.accessToken, // Return decrypted for immediate use
      refreshToken: data.refreshToken,
      tokenExpiry: data.tokenExpiry,
      createdAt: new Date(integration.createdAt),
      updatedAt: new Date(integration.updatedAt),
    };
  }

  /**
   * Get integration by user ID and provider
   */
  async getIntegration(userId: string, provider: string): Promise<Integration | null> {
    const { data, error } = await this.supabase
      .from("Integration")
      .select("*")
      .eq("userId", userId)
      .eq("provider", provider)
      .eq("isActive", true)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      ...data,
      accessToken: this.decrypt(data.accessToken),
      refreshToken: data.refreshToken
        ? this.decrypt(data.refreshToken)
        : undefined,
      tokenExpiry: data.tokenExpiry ? new Date(data.tokenExpiry) : undefined,
      healthStatus: data.healthStatus || "UNKNOWN",
      lastHealthCheck: data.lastHealthCheck,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };
  }

  /**
   * Get integration by ID with decrypted tokens
   */
  async getIntegrationById(integrationId: string): Promise<Integration | null> {
    const { data, error } = await this.supabase
      .from("Integration")
      .select("*")
      .eq("id", integrationId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      ...data,
      accessToken: this.decrypt(data.accessToken),
      refreshToken: data.refreshToken
        ? this.decrypt(data.refreshToken)
        : undefined,
      tokenExpiry: data.tokenExpiry ? new Date(data.tokenExpiry) : undefined,
      healthStatus: data.healthStatus || "UNKNOWN",
      lastHealthCheck: data.lastHealthCheck,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };
  }

  /**
   * Get all integrations for a user
   */
  async getUserIntegrations(userId: string): Promise<Integration[]> {
    const { data, error } = await this.supabase
      .from("Integration")
      .select("*")
      .eq("userId", userId)
      .eq("isActive", true)
      .order("createdAt", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch integrations: ${error.message}`);
    }

    return data.map((integration: any) => ({
      ...integration,
      accessToken: this.decrypt(integration.accessToken),
      refreshToken: integration.refreshToken
        ? this.decrypt(integration.refreshToken)
        : undefined,
      tokenExpiry: integration.tokenExpiry
        ? new Date(integration.tokenExpiry)
        : undefined,
      healthStatus: integration.healthStatus || "UNKNOWN",
      lastHealthCheck: integration.lastHealthCheck,
      createdAt: new Date(integration.createdAt),
      updatedAt: new Date(integration.updatedAt),
    }));
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(
    integrationId: string,
    provider: OAuthProvider
  ): Promise<Integration | null> {
    const integration = await this.getIntegrationById(integrationId);
    if (!integration || !integration.refreshToken) {
      return null;
    }

    try {
      const params = new URLSearchParams({
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
        refresh_token: integration.refreshToken,
        grant_type: "refresh_token",
      });

      const response = await fetch(provider.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const tokenResponse: OAuthTokenResponse = await response.json();

      // Calculate new expiry
      const tokenExpiry = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : undefined;

      // Update integration with new tokens
      const encryptedAccessToken = this.encrypt(tokenResponse.access_token);
      const encryptedRefreshToken = tokenResponse.refresh_token
        ? this.encrypt(tokenResponse.refresh_token)
        : integration.refreshToken; // Keep existing if not provided

      const { data, error } = await this.supabase
        .from("Integration")
        .update({
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiry: tokenExpiry?.toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .eq("id", integrationId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update integration: ${error.message}`);
      }

      return {
        ...data,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token || integration.refreshToken,
        tokenExpiry,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
      };
    } catch (error) {
      console.error("Token refresh failed:", error);

      // Mark integration as inactive if refresh fails
      await this.supabase
        .from("Integration")
        .update({ isActive: false })
        .eq("id", integrationId);

      return null;
    }
  }

  /**
   * Test integration connection
   */
  async testConnection(
    integrationId: string
  ): Promise<{ success: boolean; error?: string }> {
    const integration = await this.getIntegrationById(integrationId);
    if (!integration) {
      return { success: false, error: "Integration not found" };
    }

    // Check if token is expired
    if (integration.tokenExpiry && integration.tokenExpiry < new Date()) {
      return { success: false, error: "Token expired" };
    }

    // Perform provider-specific connection test
    try {
      const testResult = await this.performProviderHealthCheck(integration);
      return testResult;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Connection test failed",
      };
    }
  }

  /**
   * Perform provider-specific health check
   */
  private async performProviderHealthCheck(
    integration: Integration
  ): Promise<{ success: boolean; error?: string }> {
    const headers = {
      Authorization: `Bearer ${integration.accessToken}`,
      "Content-Type": "application/json",
    };

    try {
      switch (integration.provider) {
        case "hubspot":
          // Test HubSpot connection by getting account info
          const hubspotResponse = await fetch(
            "https://api.hubapi.com/account-info/v3/api-usage/daily",
            {
              headers,
            }
          );
          if (!hubspotResponse.ok) {
            return {
              success: false,
              error: `HubSpot API error: ${hubspotResponse.status}`,
            };
          }
          break;

        case "slack":
          // Test Slack connection by getting auth info
          const slackResponse = await fetch("https://slack.com/api/auth.test", {
            headers,
          });
          if (!slackResponse.ok) {
            return {
              success: false,
              error: `Slack API error: ${slackResponse.status}`,
            };
          }
          const slackData = await slackResponse.json();
          if (!slackData.ok) {
            return {
              success: false,
              error: `Slack API error: ${slackData.error}`,
            };
          }
          break;

        case "google":
          // Test Google connection by getting user info
          const googleResponse = await fetch(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            {
              headers,
            }
          );
          if (!googleResponse.ok) {
            return {
              success: false,
              error: `Google API error: ${googleResponse.status}`,
            };
          }
          break;

        case "salesforce":
          // Test Salesforce connection by getting user info
          // Note: Salesforce uses instance URL, so this is a basic test
          const sfResponse = await fetch(
            "https://login.salesforce.com/services/oauth2/userinfo",
            {
              headers,
            }
          );
          if (!sfResponse.ok) {
            return {
              success: false,
              error: `Salesforce API error: ${sfResponse.status}`,
            };
          }
          break;

        default:
          // For unknown providers, just check if we have a valid token
          return { success: true };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Network error during health check",
      };
    }
  }

  /**
   * Deactivate integration
   */
  async deactivateIntegration(integrationId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("Integration")
      .update({ isActive: false })
      .eq("id", integrationId);

    return !error;
  }

  /**
   * Delete integration permanently
   */
  async deleteIntegration(integrationId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("Integration")
      .delete()
      .eq("id", integrationId);

    return !error;
  }

  /**
   * Update integration health status
   */
  async updateHealthStatus(
    integrationId: string,
    status: "HEALTHY" | "WARNING" | "ERROR" | "UNKNOWN",
    errorMessage?: string,
    responseTime?: number
  ): Promise<void> {
    const now = new Date().toISOString();

    // Update integration health status
    const { error: integrationError } = await this.supabase
      .from("Integration")
      .update({
        healthStatus: status,
        lastHealthCheck: now,
      })
      .eq("id", integrationId);

    if (integrationError) {
      console.error(
        "Failed to update integration health status:",
        integrationError
      );
      return;
    }

    // Log health check result
    const { error: logError } = await this.supabase
      .from("IntegrationHealthLog")
      .insert({
        integrationId,
        status,
        errorMessage,
        responseTime,
        checkedAt: now,
      });

    if (logError) {
      console.error("Failed to log health check result:", logError);
    }
  }

  /**
   * Convert database enum values to API response values
   */
  private mapHealthStatusToApi(
    dbStatus: "HEALTHY" | "WARNING" | "ERROR" | "UNKNOWN"
  ): "healthy" | "warning" | "error" | "unknown" {
    const mapping = {
      HEALTHY: "healthy" as const,
      WARNING: "warning" as const,
      ERROR: "error" as const,
      UNKNOWN: "unknown" as const,
    };
    return mapping[dbStatus];
  }

  /**
   * Convert API values to database enum values
   */
  private mapHealthStatusToDb(
    apiStatus: "healthy" | "warning" | "error" | "unknown"
  ): "HEALTHY" | "WARNING" | "ERROR" | "UNKNOWN" {
    const mapping = {
      healthy: "HEALTHY" as const,
      warning: "WARNING" as const,
      error: "ERROR" as const,
      unknown: "UNKNOWN" as const,
    };
    return mapping[apiStatus];
  }

  /**
   * Get integration with health status mapped for API response
   */
  async getIntegrationWithHealthForApi(integrationId: string): Promise<
    | (Omit<Integration, "healthStatus"> & {
        healthStatus: "healthy" | "warning" | "error" | "unknown";
      })
    | null
  > {
    const integration = await this.getIntegrationById(integrationId);
    if (!integration) return null;

    return {
      ...integration,
      healthStatus: this.mapHealthStatusToApi(
        integration.healthStatus || "UNKNOWN"
      ),
    };
  }

  /**
   * Get all integrations for a user with health status mapped for API response
   */
  async getUserIntegrationsForApi(userId: string): Promise<
    (Omit<Integration, "healthStatus"> & {
      healthStatus: "healthy" | "warning" | "error" | "unknown";
    })[]
  > {
    const integrations = await this.getUserIntegrations(userId);

    return integrations.map((integration) => ({
      ...integration,
      healthStatus: this.mapHealthStatusToApi(
        integration.healthStatus || "UNKNOWN"
      ),
    }));
  }

  /**
   * Update integration health status with API values
   */
  async updateHealthStatusFromApi(
    integrationId: string,
    status: "healthy" | "warning" | "error",
    errorMessage?: string,
    responseTime?: number
  ): Promise<void> {
    const dbStatus = this.mapHealthStatusToDb(status);
    await this.updateHealthStatus(
      integrationId,
      dbStatus,
      errorMessage,
      responseTime
    );
  }

  /**
   * Clean up expired OAuth states
   */
  async cleanupExpiredOAuthStates(): Promise<void> {
    const { error } = await this.supabase
      .from("OAuthState")
      .delete()
      .lt("expiresAt", new Date().toISOString());

    if (error) {
      console.error("Failed to cleanup expired OAuth states:", error);
    }
  }

  /**
   * Fetch provider-specific connection details
   */
  async fetchProviderConnectionDetails(
    provider: string,
    accessToken: string
  ): Promise<Record<string, any> | null> {
    try {
      switch (provider) {
        case "slack":
          return await this.fetchSlackConnectionDetails(accessToken);
        case "hubspot":
          return await this.fetchHubSpotConnectionDetails(accessToken);
        default:
          return null;
      }
    } catch (error) {
      console.error(`Failed to fetch ${provider} connection details:`, error);
      return null;
    }
  }

  /**
   * Fetch Slack workspace and user information
   */
  private async fetchSlackConnectionDetails(
    accessToken: string
  ): Promise<Record<string, any> | null> {
    try {
      // Get auth test info (includes team and user details)
      const authResponse = await fetch("https://slack.com/api/auth.test", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!authResponse.ok) {
        throw new Error(`Slack auth.test API error: ${authResponse.status}`);
      }

      const authData = await authResponse.json();
      if (!authData.ok) {
        throw new Error(`Slack auth.test error: ${authData.error}`);
      }

      // Get team info for more details
      const teamResponse = await fetch("https://slack.com/api/team.info", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      let teamData = null;
      if (teamResponse.ok) {
        const teamResult = await teamResponse.json();
        if (teamResult.ok) {
          teamData = teamResult.team;
        }
      }

      return {
        workspaceName: authData.team || teamData?.name || "Unknown Workspace",
        workspaceId: authData.team_id,
        userId: authData.user_id,
        userName: authData.user,
        botUserId: authData.bot_id,
        url: authData.url,
        teamDomain: teamData?.domain,
        teamIcon: teamData?.icon?.image_68,
        connectedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Failed to fetch Slack connection details:", error);
      return null;
    }
  }

  /**
   * Fetch HubSpot portal and account information
   */
  private async fetchHubSpotConnectionDetails(
    accessToken: string
  ): Promise<Record<string, any> | null> {
    try {
      // Get account info
      const accountResponse = await fetch(
        "https://api.hubapi.com/account-info/v3/details",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!accountResponse.ok) {
        throw new Error(`HubSpot account API error: ${accountResponse.status}`);
      }

      const accountData = await accountResponse.json();

      // Get user info (access token info)
      const tokenResponse = await fetch(
        "https://api.hubapi.com/oauth/v1/access-tokens/" + accessToken,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      let tokenData = null;
      if (tokenResponse.ok) {
        tokenData = await tokenResponse.json();
      }

      return {
        portalName: accountData.companyName || "Unknown Portal",
        portalId: accountData.portalId?.toString(),
        accountType: accountData.accountType,
        currency: accountData.currency,
        timeZone: accountData.timeZone,
        userId: tokenData?.user_id?.toString(),
        userEmail: tokenData?.user,
        scopes: tokenData?.scopes || [],
        hubDomain: tokenData?.hub_domain,
        connectedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Failed to fetch HubSpot connection details:", error);
      return null;
    }
  }

  /**
   * Update integration with connection details
   */
  async updateIntegrationConnectionDetails(
    integrationId: string,
    connectionDetails: Record<string, any>
  ): Promise<void> {
    try {
      // Get current integration to merge with existing config
      const integration = await this.getIntegrationById(integrationId);
      if (!integration) {
        throw new Error("Integration not found");
      }

      // Merge connection details with existing config
      const updatedConfig = {
        ...integration.config,
        connectionDetails,
      };

      const { error } = await this.supabase
        .from("Integration")
        .update({
          config: updatedConfig,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", integrationId);

      if (error) {
        throw new Error(`Failed to update integration config: ${error.message}`);
      }
    } catch (error) {
      console.error("Failed to update integration connection details:", error);
      throw error;
    }
  }

  /**
   * Get provider-specific connection details from integration config
   */
  async getProviderConnectionDetails(
    integrationId: string
  ): Promise<Record<string, any> | null> {
    try {
      const integration = await this.getIntegrationById(integrationId);
      if (!integration) {
        return null;
      }

      return integration.config?.connectionDetails || null;
    } catch (error) {
      console.error("Failed to get provider connection details:", error);
      return null;
    }
  }
}
