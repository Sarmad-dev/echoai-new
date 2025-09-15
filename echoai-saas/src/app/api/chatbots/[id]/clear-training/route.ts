import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/supabase-server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication validation
    const supabase = await createClient();
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    const user = session?.user;
    const userId = user?.id as string;

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: chatbotId } = await params;

    const supabaseAdmin = await createClient()

    // Verify the chatbot belongs to the user
    const { data: chatbot, error: chatbotError } = await supabaseAdmin
      .from("Chatbot")
      .select("id")
      .eq("id", chatbotId)
      .eq("userId", userId)
      .single();

    if (chatbotError || !chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    // Clear documents
    const { error: documentsError } = await supabaseAdmin
      .from("Document")
      .delete()
      .eq("chatbotId", chatbotId);

    if (documentsError) {
      console.error("Error clearing documents:", documentsError);
      return NextResponse.json(
        { error: "Failed to clear documents" },
        { status: 500 }
      );
    }

    // Clear instructions from chatbot
    const { error: instructionsError } = await supabaseAdmin
      .from("Chatbot")
      .update({ instructions: null })
      .eq("id", chatbotId);

    if (instructionsError) {
      console.error("Error clearing instructions:", instructionsError);
      return NextResponse.json(
        { error: "Failed to clear instructions" },
        { status: 500 }
      );
    }

    // Also clear any training instructions from the FastAPI service
    try {
      const fastApiUrl = process.env.FASTAPI_URL || "http://localhost:8000";

      // Get all instructions for this chatbot
      const instructionsResponse = await fetch(
        `${fastApiUrl}/api/instructions?chatbot_id=${chatbotId}&active_only=false&limit=1000`,
        {
          method: "GET",
        }
      );

      if (instructionsResponse.ok) {
        const instructionsData = await instructionsResponse.json();

        // Delete each instruction
        for (const instruction of instructionsData.instructions || []) {
          await fetch(`${fastApiUrl}/api/instructions/${instruction.id}`, {
            method: "DELETE",
          });
        }
      }
    } catch (error) {
      console.warn("Could not clear FastAPI instructions:", error);
      // Don't fail the entire operation if FastAPI is unavailable
    }

    return NextResponse.json({
      success: true,
      message: "Training data cleared successfully",
    });
  } catch (error) {
    console.error("Clear training data error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
