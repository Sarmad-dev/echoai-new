import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dryRun") === "true";
    const maxAgeHours = parseInt(searchParams.get("maxAgeHours") || "24");

    const supabase = await createClient();

    // Calculate cutoff time
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);

    // Find inactive sessions older than cutoff time
    const { data: inactiveSessions, error: findError } = await supabase
      .from("ConversationSession")
      .select(`
        id,
        externalUserId,
        chatbotId,
        updatedAt,
        externalUser:ExternalUser!inner(email),
        chatbot:Chatbot!inner(name)
      `)
      .eq("isActive", true)
      .lt("updatedAt", cutoffTime.toISOString());

    if (findError) {
      console.error("Error finding inactive sessions:", findError);
      return NextResponse.json(
        { error: "Failed to find inactive sessions" },
        { status: 500 }
      );
    }

    if (!inactiveSessions || inactiveSessions.length === 0) {
      return NextResponse.json({
        message: "No inactive sessions found for cleanup",
        sessionsFound: 0,
        sessionsDeactivated: 0,
        dryRun,
      });
    }

    let deactivatedCount = 0;

    if (!dryRun) {
      // Deactivate the sessions
      const sessionIds = inactiveSessions.map(session => session.id);
      
      const { error: deactivateError } = await supabase
        .from("ConversationSession")
        .update({ 
          isActive: false,
          updatedAt: new Date().toISOString()
        })
        .in("id", sessionIds);

      if (deactivateError) {
        console.error("Error deactivating sessions:", deactivateError);
        return NextResponse.json(
          { error: "Failed to deactivate sessions" },
          { status: 500 }
        );
      }

      deactivatedCount = sessionIds.length;
    }

    return NextResponse.json({
      message: dryRun 
        ? "Dry run completed - no sessions were deactivated"
        : `Successfully deactivated ${deactivatedCount} inactive sessions`,
      sessionsFound: inactiveSessions.length,
      sessionsDeactivated: deactivatedCount,
      dryRun,
      cutoffTime: cutoffTime.toISOString(),
      maxAgeHours,
      sessions: inactiveSessions.map(session => ({
        id: session.id,
        userEmail: (session.externalUser as any)?.email,
        chatbotName: (session.chatbot as any)?.name,
        lastActivity: session.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Error in session cleanup:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const maxAgeHours = parseInt(searchParams.get("maxAgeHours") || "24");

    const supabase = await createClient();

    // Calculate cutoff time
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);

    // Get statistics about sessions
    const [
      { count: activeSessions, error: activeError },
      { count: inactiveSessions, error: inactiveError },
      { count: expiredSessions, error: expiredError }
    ] = await Promise.all([
      // Active sessions
      supabase
        .from("ConversationSession")
        .select("id", { count: "exact", head: true })
        .eq("isActive", true)
        .gte("updatedAt", cutoffTime.toISOString()),
      
      // Inactive sessions (marked as inactive)
      supabase
        .from("ConversationSession")
        .select("id", { count: "exact", head: true })
        .eq("isActive", false),
      
      // Expired sessions (active but old)
      supabase
        .from("ConversationSession")
        .select("id", { count: "exact", head: true })
        .eq("isActive", true)
        .lt("updatedAt", cutoffTime.toISOString())
    ]);

    if (activeError || inactiveError || expiredError) {
      console.error("Error getting session statistics:", { activeError, inactiveError, expiredError });
      return NextResponse.json(
        { error: "Failed to get session statistics" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      statistics: {
        activeSessions: activeSessions || 0,
        inactiveSessions: inactiveSessions || 0,
        expiredSessions: expiredSessions || 0,
        totalSessions: (activeSessions || 0) + (inactiveSessions || 0),
      },
      cutoffTime: cutoffTime.toISOString(),
      maxAgeHours,
    });
  } catch (error) {
    console.error("Error in session cleanup GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}