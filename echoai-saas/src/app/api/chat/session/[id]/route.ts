import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/supabase-server";
import { z } from "zod";

const updateSessionSchema = z.object({
  memoryBuffer: z.record(z.string(), z.any()).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = await createClient();

    const { data: session, error } = await supabase
      .from("ConversationSession")
      .select(`
        *,
        externalUser:ExternalUser(*),
        chatbot:Chatbot(id, name, isActive),
        messages:Message(
          id,
          content,
          role,
          sentimentScore,
          createdAt
        )
      `)
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching session:", error);
      return NextResponse.json(
        { error: "Failed to fetch session" },
        { status: 500 }
      );
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error("Error in session GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = updateSessionSchema.parse(body);

    const supabase = await createClient();

    // Check if session exists
    const { error: checkError } = await supabase
      .from("ConversationSession")
      .select("id")
      .eq("id", id)
      .single();

    if (checkError) {
      if (checkError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }
      console.error("Error checking session:", checkError);
      return NextResponse.json(
        { error: "Failed to check session" },
        { status: 500 }
      );
    }

    // Update session
    const updateData: Record<string, string | boolean | Record<string, unknown> | null> = {
      updatedAt: new Date().toISOString(),
    };

    if (validatedData.memoryBuffer !== undefined) {
      updateData.memoryBuffer = validatedData.memoryBuffer;
    }

    if (validatedData.isActive !== undefined) {
      updateData.isActive = validatedData.isActive;
    }

    const { data: updatedSession, error: updateError } = await supabase
      .from("ConversationSession")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating session:", updateError);
      return NextResponse.json(
        { error: "Failed to update session" },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedSession);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error in session PUT:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = await createClient();

    // Check if session exists
    const { error: checkError } = await supabase
      .from("ConversationSession")
      .select("id")
      .eq("id", id)
      .single();

    if (checkError) {
      if (checkError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }
      console.error("Error checking session:", checkError);
      return NextResponse.json(
        { error: "Failed to check session" },
        { status: 500 }
      );
    }

    // Soft delete by deactivating the session
    const { data: deactivatedSession, error: deactivateError } = await supabase
      .from("ConversationSession")
      .update({ 
        isActive: false,
        updatedAt: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (deactivateError) {
      console.error("Error deactivating session:", deactivateError);
      return NextResponse.json(
        { error: "Failed to deactivate session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      message: "Session deactivated successfully",
      session: deactivatedSession
    });
  } catch (error) {
    console.error("Error in session DELETE:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}