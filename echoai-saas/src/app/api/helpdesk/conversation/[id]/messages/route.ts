import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRoleProtection } from "@/lib/middleware/role-protection";
import { createClient } from "@/lib/supabase/supabase-server";

// Query parameters validation schema
const getMessagesSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

interface MessageResponse {
  id: string;
  conversationId: string;
  content: string;
  role: "user" | "assistant" | "agent";
  sentiment?: string;
  sentimentScore?: number;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface GetMessagesResponse {
  messages: MessageResponse[];
  totalCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

async function handleGetMessages(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = await createClient();
  try {
    // Get user ID from headers (set by middleware)
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const conversationId = params.id;
    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation ID is required" },
        { status: 400 }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const validatedParams = getMessagesSchema.parse(queryParams);

    // Verify conversation exists and user has access
    const { data: conversation, error: conversationError } = await supabase
      .from("Conversation")
      .select("id")
      .eq("id", conversationId)
      .single();

    if (conversationError || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Build messages query
    let query = supabase
      .from("Message")
      .select("*", { count: "exact" })
      .eq("conversationId", conversationId);

    // Apply sorting
    const sortOrder = validatedParams.sortOrder === "asc" ? true : false;
    query = query.order("createdAt", { ascending: sortOrder });

    // Apply pagination
    const offset = (validatedParams.page - 1) * validatedParams.limit;
    query = query.range(offset, offset + validatedParams.limit - 1);

    const { data: messages, error: messagesError, count } = await query;

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      );
    }

    // Transform messages to response format
    const messageResponses: MessageResponse[] = (messages || []).map((msg) => ({
      id: (msg as any).id,
      conversationId: (msg as any).conversationId,
      content: (msg as any).content,
      role: (msg as any).role as "user" | "assistant" | "agent",
      sentiment: (msg as any).sentiment,
      sentimentScore: (msg as any).sentimentScore,
      metadata: (msg as any).metadata,
      createdAt: (msg as any).createdAt,
      updatedAt: (msg as any).updatedAt,
    }));

    const response: GetMessagesResponse = {
      messages: messageResponses,
      totalCount: count || 0,
      page: validatedParams.page,
      limit: validatedParams.limit,
      hasMore: (count || 0) > validatedParams.page * validatedParams.limit,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Get messages API error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Apply role protection middleware (staff/admin only)
export const GET = withRoleProtection(handleGetMessages, ["staff", "admin"]);

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}