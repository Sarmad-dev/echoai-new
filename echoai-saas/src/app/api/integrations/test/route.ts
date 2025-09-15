import { NextRequest, NextResponse } from "next/server";
import { OAuth2Manager } from "@/lib/integrations/oauth2-manager";
import { createClient } from "@/lib/supabase/supabase-server";
import { getServerSession } from "@/lib/auth";
import * as crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { integrationId } = await request.json();

    // Get user from session instead of request body
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    if (!integrationId) {
      return NextResponse.json(
        { error: "integrationId is required" },
        { status: 400 }
      );
    }

    // Validate user owns the integration
    const supabase = await createClient();
    const { data: integration, error: integrationError } = await supabase
      .from("Integration")
      .select("*")
      .eq("id", integrationId)
      .eq("userId", userId)
      .single();

    if (integrationError || !integration) {
      return NextResponse.json(
        { error: "Integration not found or access denied" },
        { status: 404 }
      );
    }

    // Perform provider-specific connection test directly
    try {
      let testResult: { success: boolean; error?: string };

      // Test connection based on provider
      switch (integration.provider) {
        case "slack":
          testResult = await testSlackConnection(integration);
          break;
        case "hubspot":
          testResult = await testHubSpotConnection(integration);
          break;
        case "google":
          testResult = await testGoogleConnection(integration);
          break;
        default:
          testResult = {
            success: false,
            error: `Unsupported provider: ${integration.provider}`,
          };
      }

      const healthStatus = testResult.success ? "healthy" : "error";

      // Update the health status in the database
      await supabase
        .from("Integration")
        .update({
          healthStatus: healthStatus.toUpperCase(),
          lastHealthCheck: new Date().toISOString(),
        })
        .eq("id", integrationId);

      return NextResponse.json({
        status: healthStatus,
        healthStatus,
        message: testResult.success
          ? "Connection test successful"
          : testResult.error || "Connection test failed",
      });
    } catch (error) {
      // Update health status to error
      const errorMessage =
        error instanceof Error ? error.message : "Connection test failed";

      await supabase
        .from("Integration")
        .update({
          healthStatus: "ERROR",
          lastHealthCheck: new Date().toISOString(),
        })
        .eq("id", integrationId);

      return NextResponse.json({
        status: "error",
        healthStatus: "error",
        message: errorMessage,
      });
    }
  } catch (error) {
    console.error("Test connection error:", error);
    return NextResponse.json(
      { error: "Failed to test connection" },
      { status: 500 }
    );
  }
}

// Token decryption function (copied from OAuth2Manager)
function decryptToken(encryptedText: string): string {
  const encryptionKey =
    process.env.INTEGRATION_ENCRYPTION_KEY ||
    "default-key-change-in-production";
  const algorithm = "aes-256-cbc";
  const key = crypto.scryptSync(encryptionKey, "salt", 32);
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

// Helper functions for testing different providers
async function testSlackConnection(
  integration: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = decryptToken(integration.accessToken);
    const response = await fetch("https://slack.com/api/auth.test", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Slack API error: ${response.status}`,
      };
    }

    const data = await response.json();
    if (!data.ok) {
      return {
        success: false,
        error: `Slack API error: ${data.error}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Network error during Slack test",
    };
  }
}

async function testHubSpotConnection(
  integration: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = decryptToken(integration.accessToken);
    const response = await fetch(
      "https://api.hubapi.com/account-info/v3/api-usage/daily",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      return {
        success: false,
        error: `HubSpot API error: ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Network error during HubSpot test",
    };
  }
}

async function testGoogleConnection(
  integration: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = decryptToken(integration.accessToken);
    const response = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      return {
        success: false,
        error: `Google API error: ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Network error during Google test",
    };
  }
}
