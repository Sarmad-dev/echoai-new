import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/supabase-server";
import { supabaseAdmin } from "@/lib/supabase/database";

export async function GET(
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
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: chatbotId } = await params;

    // Verify the chatbot belongs to the user
    const { data: chatbot, error: chatbotError } = await supabaseAdmin
      .from("Chatbot")
      .select("id, instructions")
      .eq("id", chatbotId)
      .eq("userId", userId)
      .single();

    if (chatbotError || !chatbot) {
      return NextResponse.json(
        { error: "Chatbot not found" },
        { status: 404 }
      );
    }

    // Type assertion to ensure proper typing
    const chatbotData = chatbot as { id: string; instructions: string | null };

    // Get instructions from FastAPI service
    let fastApiInstructions = [];
    try {
      const fastApiUrl = process.env.FASTAPI_URL || "http://localhost:8000";
      const instructionsResponse = await fetch(
        `${fastApiUrl}/api/instructions?chatbot_id=${chatbotId}&active_only=true&limit=100`,
        {
          method: "GET",
        }
      );

      if (instructionsResponse.ok) {
        const instructionsData = await instructionsResponse.json();
        fastApiInstructions = instructionsData.instructions || [];
      }
    } catch (error) {
      console.warn("Could not fetch FastAPI instructions:", error);
    }

    return NextResponse.json({
      success: true,
      data: {
        chatbot_instructions: chatbotData.instructions,
        training_instructions: fastApiInstructions,
        total_instructions: fastApiInstructions.length + (chatbotData.instructions ? 1 : 0)
      }
    });

  } catch (error) {
    console.error("Get instructions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}