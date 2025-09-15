import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/supabase-server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const supabase = await createClient();

    // First validate that the session exists and is accessible
    const { data: session, error: sessionError } = await supabase
      .from("ConversationSession")
      .select(
        `
        id,
        isActive,
        externalUser:ExternalUser!inner(email),
        chatbot:Chatbot!inner(id, name)
      `
      )
      .eq("id", id)
      .single();

    if (sessionError) {
      if (sessionError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching session:", sessionError);
      return NextResponse.json(
        { error: "Failed to fetch session" },
        { status: 500 }
      );
    }

    // Get messages for the session
    const {
      data: messages,
      error: messagesError,
      count,
    } = await supabase
      .from("Message")
      .select("*", { count: "exact" })
      .eq("sessionId", id)
      .order("createdAt", { ascending: true })
      .range(offset, offset + limit - 1);

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      session: {
        id: session.id,
        isActive: session.isActive,
        userEmail: (session.externalUser as { email?: string })?.email,
        chatbotName: (session.chatbot as { name?: string })?.name,
      },
      messages: messages || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error in session messages GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
