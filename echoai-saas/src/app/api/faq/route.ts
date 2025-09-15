import { createClient } from "@/lib/supabase/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get("chatbotId");

    if (!chatbotId) {
      return NextResponse.json(
        { error: "Chatbot ID is required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = await createClient()

    // Fetch FAQs for the chatbot
    const { data: faqs, error } = await supabaseAdmin
      .from("FAQ")
      .select("id, question, answer, category, popularity")
      .eq("chatbotId", chatbotId)
      .eq("isActive", true)
      .order("popularity", { ascending: false });

    if (error) {
      console.error("Error fetching FAQs:", error);
      return NextResponse.json(
        { error: "Failed to fetch FAQs" },
        { status: 500 }
      );
    }

    const response = NextResponse.json(faqs || []);

    // Add CORS headers
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");

    return response;
  } catch (error) {
    console.error("FAQ API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { chatbotId, question, answer, category, displayOrder } =
      await request.json();

    if (!chatbotId || !question || !answer) {
      return NextResponse.json(
        { error: "Missing required fields: chatbotId, question, answer" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify chatbot exists and user has access
    const { data: chatbot, error: chatbotError } = await supabase
      .from("Chatbot")
      .select("id, userId")
      .eq("id", chatbotId)
      .single();

    if (chatbotError || !chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    // Create FAQ
    const { data: faq, error: createError } = await supabase
      .from("FAQ")
      .insert({
        chatbotId,
        question,
        answer,
        category: category || null,
        displayOrder: displayOrder || 0,
        isActive: true,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating FAQ:", createError);
      return NextResponse.json(
        { error: "Failed to create FAQ" },
        { status: 500 }
      );
    }

    return NextResponse.json(faq, { status: 201 });
  } catch (error) {
    console.error("Error in FAQ POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}
