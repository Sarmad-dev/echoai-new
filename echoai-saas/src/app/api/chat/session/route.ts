import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createErrorResponse } from "@/lib/api-validation";
import { createClient } from "@/lib/supabase/supabase-server";

const sessionRequestSchema = z.object({
  chatbotId: z.string().min(1, "Chatbot ID is required"),
  externalUserEmail: z.string().email().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = sessionRequestSchema.parse(body);

    const supabaseAdmin = await createClient()

    // Create a new session/conversation
    const { data: conversation, error } = await supabaseAdmin
      .from("Conversation")
      .insert({
        chatbotId: validatedData.chatbotId,
        customerEmail: validatedData.externalUserEmail || null,
        status: "AI_HANDLING" as const,
      })
      .select("id")
      .single();

    if (error || !conversation) {
      console.error("Error creating conversation:", error);
      return createErrorResponse("Failed to create session", 500);
    }

    const response = NextResponse.json({
      sessionId: conversation.id,
      conversationId: conversation.id,
      conversation_id: conversation.id, // Also include snake_case for compatibility
    });

    // Add CORS headers
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");

    return response;
  } catch (error) {
    console.error("Session creation error:", error);

    if (error instanceof z.ZodError) {
      return createErrorResponse("Validation failed", 400, error.issues);
    }

    return createErrorResponse("Internal server error", 500);
  }
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}