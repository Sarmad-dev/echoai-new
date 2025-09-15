import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/supabase-server";
import { z } from "zod";

const updateExternalUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = await createClient();

    const { data: user, error } = await supabase
      .from("ExternalUser")
      .select(`
        *,
        conversationSessions:ConversationSession(
          id,
          chatbotId,
          isActive,
          createdAt,
          updatedAt,
          chatbot:Chatbot(
            id,
            name
          )
        )
      `)
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching user:", error);
      return NextResponse.json(
        { error: "Failed to fetch user" },
        { status: 500 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error in external user GET:", error);
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
    const validatedData = updateExternalUserSchema.parse(body);

    const supabase = await createClient();

    // Check if user exists
    const { error: checkError } = await supabase
      .from("ExternalUser")
      .select("id")
      .eq("id", id)
      .single();

    if (checkError) {
      if (checkError.code === "PGRST116") {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }
      console.error("Error checking user:", checkError);
      return NextResponse.json(
        { error: "Failed to check user" },
        { status: 500 }
      );
    }

    // Update user
    const { data: updatedUser, error: updateError } = await supabase
      .from("ExternalUser")
      .update({
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating user:", updateError);
      return NextResponse.json(
        { error: "Failed to update user" },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error in external user PUT:", error);
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

    // Check if user exists
    const { error: checkError } = await supabase
      .from("ExternalUser")
      .select("id")
      .eq("id", id)
      .single();

    if (checkError) {
      if (checkError.code === "PGRST116") {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }
      console.error("Error checking user:", checkError);
      return NextResponse.json(
        { error: "Failed to check user" },
        { status: 500 }
      );
    }

    // Delete user (cascade will handle related sessions)
    const { error: deleteError } = await supabase
      .from("ExternalUser")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting user:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete user" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error in external user DELETE:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}