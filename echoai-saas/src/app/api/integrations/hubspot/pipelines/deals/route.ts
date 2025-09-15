import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    // Get user's HubSpot integration
    const { data: integration, error } = await supabase
      .from("Integration")
      .select("*")
      .eq("userId", session.user.id)
      .eq("provider", "hubspot")
      .eq("isActive", true)
      .single();

    if (error || !integration) {
      return NextResponse.json(
        { error: "HubSpot integration not found" },
        { status: 404 }
      );
    }

    try {
      const { HubSpotApiClient } = await import(
        "@/lib/integrations/hubspot-client"
      );
      const client = new HubSpotApiClient(integration);

      // Get deal pipelines
      const pipelines = await client.getDealPipelines();

      return NextResponse.json({
        pipelines,
      });
    } catch (error) {
      console.error("Error fetching HubSpot deal pipelines:", error);
      return NextResponse.json(
        { error: "Failed to fetch deal pipelines" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in HubSpot deal pipelines API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
