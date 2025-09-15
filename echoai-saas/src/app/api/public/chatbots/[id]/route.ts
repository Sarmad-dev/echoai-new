import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/database";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chatbotId } = await params;

    if (!chatbotId) {
      return NextResponse.json(
        { error: "Chatbot ID is required" },
        { status: 400 }
      );
    }

    // Fetch chatbot data
    const { data: chatbot, error } = await supabaseAdmin
      .from("Chatbot")
      .select("id, name, welcomeMessage, primaryColor")
      .eq("id", chatbotId)
      .single();

    if (error || !chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    // Type assertion for Supabase data
    const chatbotData = chatbot as {
      id: string;
      name: string;
      welcomeMessage: string;
      primaryColor: string;
    };

    // Return public chatbot settings
    const response = NextResponse.json({
      id: chatbotData.id,
      name: chatbotData.name,
      welcomeMessage: chatbotData.welcomeMessage,
      primaryColor: chatbotData.primaryColor,
    });

    // Add CORS headers for external website access
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");

    return response;
  } catch (error) {
    console.error("Error fetching public chatbot data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Handle preflight requests
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}
