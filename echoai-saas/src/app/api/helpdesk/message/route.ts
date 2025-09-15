import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRoleProtection } from "@/lib/middleware/role-protection";
import { ConversationStatus } from "@/types/database";
import { createClient } from "@/lib/supabase/supabase-server";

// Request validation schema
const sendMessageSchema = z.object({
  conversationId: z.string().min(1, "Conversation ID is required"),
  content: z
    .string()
    .min(1, "Message content is required")
    .max(2000, "Message too long"),
});

interface SendMessageRequest {
  conversationId: string;
  content: string;
}

interface SendMessageResponse {
  success: boolean;
  message: {
    id: string;
    conversationId: string;
    content: string;
    role: "assistant";
    createdAt: string;
  };
  conversationStatus: ConversationStatus;
}

async function handleSendMessage(request: NextRequest): Promise<NextResponse> {
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
    const validatedData = sendMessageSchema.parse(body) as SendMessageRequest;

    // Verify conversation exists and get current status
    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from("Conversation")
      .select("id, status, userId, chatbotId")
      .eq("id", validatedData.conversationId)
      .single();

    if (conversationError || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Insert agent message
    const { data: message, error: messageError } = await supabaseAdmin
      .from("Message")
      .insert({
        conversationId: validatedData.conversationId,
        content: validatedData.content,
        role: "assistant",
      } as any)
      .select("id, conversationId, content, role, createdAt")
      .single();

    if (messageError || !message) {
      console.error("Error inserting agent message:", messageError);
      return NextResponse.json(
        { error: "Failed to send message" },
        { status: 500 }
      );
    }

    // Keep conversation status as AWAITING_HUMAN_RESPONSE and ensure it's assigned to current agent
    // This ensures the AI won't respond to subsequent customer messages
    const { error: updateError } = await supabaseAdmin
      .from("Conversation")
      .update({
        status: ConversationStatus.AWAITING_HUMAN_RESPONSE,
        assignedTo: userId,
        updatedAt: new Date().toISOString(),
      } as any)
      .eq("id", validatedData.conversationId);

    if (updateError) {
      console.error("Error updating conversation status:", updateError);
      // Don't fail the request if status update fails, message was sent successfully
    }

    // Broadcast message to embedded widgets via Supabase Realtime
    // The message will be automatically broadcast due to Supabase Realtime subscriptions
    // on the Message table that embedded widgets are listening to

    const response: SendMessageResponse = {
      success: true,
      message: {
        id: (message as any).id,
        conversationId: (message as any).conversationId,
        content: (message as any).content,
        role: (message as any).role as "assistant",
        createdAt: (message as any).createdAt,
      },
      conversationStatus: ConversationStatus.AWAITING_HUMAN_RESPONSE,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Help desk message API error:", error);

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
export const POST = withRoleProtection(handleSendMessage, ["staff", "admin"]);

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
