import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createErrorResponse } from "@/lib/api-validation";
import { createClient } from "@/lib/supabase/supabase-server";

const escalationSchema = z.object({
  conversation_id: z.string().min(1, "Conversation ID is required"),
  chatbot_id: z.string().min(1, "Chatbot ID is required"),
  escalation_type: z.string().min(1, "Escalation type is required"),
  reason: z.string().min(1, "Reason is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = escalationSchema.parse(body);

    const supabaseAdmin = await createClient()

    // Update conversation status to awaiting human response
    const { error: updateError } = await supabaseAdmin
      .from("Conversation")
      .update({
        status: "AWAITING_HUMAN_RESPONSE" as const,
        escalationReason: validatedData.reason,
        escalatedAt: new Date().toISOString(),
      })
      .eq("id", validatedData.conversation_id);

    if (updateError) {
      console.error("Error updating conversation for escalation:", updateError);
      return createErrorResponse("Failed to escalate conversation", 500);
    }

    // Add system message about escalation
    const { error: messageError } = await supabaseAdmin
      .from("Message")
      .insert({
        conversationId: validatedData.conversation_id,
        content: `Conversation escalated to human support. Reason: ${validatedData.reason}`,
        role: "system" as const,
      });

    if (messageError) {
      console.error("Error adding escalation message:", messageError);
      // Don't fail the request for this
    }

    const response = NextResponse.json({
      success: true,
      message: "Conversation escalated successfully",
      conversationId: validatedData.conversation_id,
    });

    // Add CORS headers
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");

    return response;
  } catch (error) {
    console.error("Escalation API error:", error);

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