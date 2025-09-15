import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/database";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get("userEmail");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";

    if (!userEmail) {
      return NextResponse.json(
        { error: "User email is required" },
        { status: 400 }
      );
    }

    const offset = (page - 1) * limit;

    // Build query
    let query = supabaseAdmin
      .from("Conversation")
      .select(`
        id,
        createdAt,
        updatedAt,
        status,
        Message!inner (
          id,
          content,
          createdAt,
          role
        )
      `)
      .eq("customerEmail", userEmail)
      .order("updatedAt", { ascending: false })
      .range(offset, offset + limit - 1);

    // Add search filter if provided
    if (search) {
      query = query.ilike("Message.content", `%${search}%`);
    }

    const { data: conversations, error } = await query;

    if (error) {
      console.error("Error fetching conversation history:", error);
      return NextResponse.json(
        { error: "Failed to fetch conversation history" },
        { status: 500 }
      );
    }

    // Process conversations to get preview and message count
    const processedConversations = (conversations || []).map((conv: any) => {
      const messages = conv.Message || [];
      const lastMessage = messages
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      
      return {
        sessionId: conv.id,
        id: conv.id,
        preview: lastMessage?.content || "No messages",
        lastMessage: lastMessage?.content || "No messages",
        messageCount: messages.length,
        timestamp: conv.updatedAt,
        createdAt: conv.createdAt,
        status: conv.status,
      };
    });

    const response = NextResponse.json(processedConversations);

    // Add CORS headers
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");

    return response;
  } catch (error) {
    console.error("Conversation history API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}