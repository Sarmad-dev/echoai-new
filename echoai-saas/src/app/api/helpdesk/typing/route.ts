import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRoleProtection } from "@/lib/middleware/role-protection";
import { createClient } from "@/lib/supabase/supabase-server";

// Request validation schema
const typingIndicatorSchema = z.object({
  conversationId: z.string().min(1, "Conversation ID is required"),
  isTyping: z.boolean(),
  userType: z.enum(["agent", "customer"]).default("agent"),
});

interface TypingIndicatorRequest {
  conversationId: string;
  isTyping: boolean;
  userType: "agent" | "customer";
}

async function handleTypingIndicator(request: NextRequest): Promise<NextResponse> {
  const supabaseAdmin = await createClient();
  
  try {
    // Get user ID from headers (set by middleware)
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = typingIndicatorSchema.parse(body) as TypingIndicatorRequest;

    // Verify conversation exists
    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from("Conversation")
      .select("id, status")
      .eq("id", validatedData.conversationId)
      .single();

    if (conversationError || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Broadcast typing indicator via Supabase Realtime
    const channel = supabaseAdmin.channel(`typing-${validatedData.conversationId}`);
    
    if (validatedData.isTyping) {
      // Send typing start event
      await channel.send({
        type: "broadcast",
        event: "typing_start",
        payload: {
          conversationId: validatedData.conversationId,
          userId: userId,
          userType: validatedData.userType,
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      // Send typing stop event
      await channel.send({
        type: "broadcast",
        event: "typing_stop",
        payload: {
          conversationId: validatedData.conversationId,
          userId: userId,
          userType: validatedData.userType,
          timestamp: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      conversationId: validatedData.conversationId,
      isTyping: validatedData.isTyping,
      userType: validatedData.userType,
    });
  } catch (error) {
    console.error("Typing indicator API error:", error);

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
export const POST = withRoleProtection(handleTypingIndicator, ["staff", "admin"]);

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}