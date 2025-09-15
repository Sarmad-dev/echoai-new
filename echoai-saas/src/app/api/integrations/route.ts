import { NextRequest, NextResponse } from "next/server";
import { OAuth2Manager } from "@/lib/integrations/oauth2-manager";
import {
  getAllProviders,
  validateProviderConfig,
} from "@/lib/integrations/providers";
import { createClient } from "@/lib/supabase/supabase";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // For now, skip user validation to debug the issue
    // TODO: Re-enable user validation once we confirm the integration loading works
    // const supabase = createClient();

    const oauth2Manager = new OAuth2Manager();
    const integrations = await oauth2Manager.getUserIntegrationsForApi(userId);

    // Get available providers with configuration status
    const providers = getAllProviders().map((provider) => {
      const configValidation = validateProviderConfig(provider.id);
      const existingIntegration = integrations.find(
        (i) => i.provider === provider.id
      );

      return {
        id: provider.id,
        name: provider.name,
        description: provider.description,
        configured: configValidation.valid,
        missingConfig: configValidation.missing,
        connected: !!existingIntegration,
        healthStatus: existingIntegration?.healthStatus || "unknown",
        integration: existingIntegration
          ? {
              id: existingIntegration.id,
              isActive: existingIntegration.isActive,
              createdAt: existingIntegration.createdAt,
              lastHealthCheck: existingIntegration.lastHealthCheck,
              config: existingIntegration.config || {},
              // Don't expose sensitive tokens
            }
          : null,
      };
    });

    return NextResponse.json({
      providers,
      integrations: integrations.map((integration) => ({
        ...integration,
        // Remove sensitive data from response
        accessToken: undefined,
        refreshToken: undefined,
      })),
    });
  } catch (error) {
    console.error("Get integrations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch integrations" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const integrationId = searchParams.get("integrationId");
    const userId = searchParams.get("userId");

    if (!integrationId || !userId) {
      return NextResponse.json(
        { error: "integrationId and userId are required" },
        { status: 400 }
      );
    }

    // Validate user owns the integration
    const supabase = createClient();
    const { data: integration, error: integrationError } = await supabase
      .from("Integration")
      .select("userId")
      .eq("id", integrationId)
      .single();

    if (integrationError || !integration || integration.userId !== userId) {
      return NextResponse.json(
        { error: "Integration not found or access denied" },
        { status: 404 }
      );
    }

    const oauth2Manager = new OAuth2Manager();
    const success = await oauth2Manager.deleteIntegration(integrationId);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to delete integration" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete integration error:", error);
    return NextResponse.json(
      { error: "Failed to delete integration" },
      { status: 500 }
    );
  }
}
