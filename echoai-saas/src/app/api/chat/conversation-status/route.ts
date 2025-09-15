import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/supabase-server";
import { ConversationStatus } from "@/types/database";

const updateStatusSchema = z.object({
  conversationId: z.string().min(1, "Conversation ID is required"),
  status: z.nativeEnum(ConversationStatus),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get conversation status
    const { data: conversation, error } = await supabase
      .from("Conversation")
      .select("status")
      .eq("id", conversationId)
      .single();

    if (error) {
      console.error("Error fetching conversation status:", error);
      return NextResponse.json(
        { error: "Failed to fetch conversation status" },
        { status: 500 }
      );
    }

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: conversation.status || ConversationStatus.AI_HANDLING,
    });
  } catch (error) {
    console.error("Error in conversation status API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = updateStatusSchema.parse(body);

    const supabase = await createClient();

    // Update conversation status
    const { data: conversation, error } = await supabase
      .from("Conversation")
      .update({ status: validatedData.status })
      .eq("id", validatedData.conversationId)
      .select("status")
      .single();

    if (error) {
      console.error("Error updating conversation status:", error);
      return NextResponse.json(
        { error: "Failed to update conversation status" },
        { status: 500 }
      );
    }

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      status: conversation.status,
    });
  } catch (error) {
    console.error("Error in conversation status update API:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
