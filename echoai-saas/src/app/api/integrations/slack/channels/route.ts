import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/supabase-server";
import * as crypto from "crypto";

// Token decryption function (copied from OAuth2Manager)
function decryptToken(encryptedText: string): string {
  const encryptionKey = process.env.INTEGRATION_ENCRYPTION_KEY || 'default-key-change-in-production'
  const algorithm = 'aes-256-cbc'
  const key = crypto.scryptSync(encryptionKey, 'salt', 32)
  const parts = encryptedText.split(':')

  if (parts.length === 2) {
    // New format: iv:encrypted
    const [ivHex, encrypted] = parts
    const iv = Buffer.from(ivHex, 'hex')
    const decipher = crypto.createDecipheriv(algorithm, key, iv)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } else if (parts.length === 3) {
    // Old GCM format: iv:authTag:encrypted - handle gracefully
    const [, , encrypted] = parts
    const decipher = crypto.createDecipher(algorithm, key)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } else {
    throw new Error('Invalid encrypted data format')
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const integrationId = searchParams.get('integrationId');

    const supabase = await createClient();

    let integration;
    let error;

    if (integrationId) {
      // Get specific integration
      const result = await supabase
        .from("Integration")
        .select("*")
        .eq("id", integrationId)
        .eq("userId", session.user.id)
        .eq("provider", "slack")
        .single();
      
      integration = result.data;
      error = result.error;
    } else {
      // Get user's active Slack integration (backward compatibility)
      const result = await supabase
        .from("Integration")
        .select("*")
        .eq("userId", session.user.id)
        .eq("provider", "slack")
        .eq("isActive", true)
        .single();
      
      integration = result.data;
      error = result.error;
    }

    if (error || !integration) {
      return NextResponse.json(
        { error: "Slack integration not found" },
        { status: 404 }
      );
    }

    try {
      // Decrypt the integration tokens before using
      const decryptedIntegration = {
        ...integration,
        accessToken: decryptToken(integration.accessToken),
        refreshToken: integration.refreshToken ? decryptToken(integration.refreshToken) : undefined
      }

      const { SlackApiClient } = await import(
        "@/lib/integrations/slack-client"
      );
      const client = new SlackApiClient(decryptedIntegration);

      // Get channels
      const channels = await client.getChannels();

      // Format channels for the UI
      const formattedChannels = channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        type: channel.is_private ? "private_channel" : "channel",
        isPrivate: channel.is_private,
        isMember: channel.is_member,
        memberCount: channel.num_members,
      }));

      return NextResponse.json({
        channels: formattedChannels,
      });
    } catch (error) {
      console.error("Error fetching Slack channels:", error);
      return NextResponse.json(
        { error: "Failed to fetch channels" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in Slack channels API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
