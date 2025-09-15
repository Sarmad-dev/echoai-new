import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/database";

// Get all chatbots for a user
export async function GET(request: NextRequest) {
  try {
    // Get user ID from headers (set by middleware)
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from("User")
      .select("plan")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Type assertion to handle Supabase type inference issues
    const userData = user as any;

    // Get chatbots
    const { data: chatbots, error: chatbotsError } = await supabaseAdmin
      .from("Chatbot")
      .select("*")
      .eq("userId", userId)
      .order("createdAt", { ascending: false });

    if (chatbotsError) {
      throw chatbotsError;
    }

    // Get counts for each chatbot
    const transformedChatbots = await Promise.all(
      (chatbots || []).map(async (chatbot: any) => {
        // Get document count
        const { count: documentCount } = await supabaseAdmin
          .from("Document")
          .select("*", { count: "exact", head: true })
          .eq("chatbotId", chatbot.id);

        // Get conversation count
        const { count: conversationCount } = await supabaseAdmin
          .from("Conversation")
          .select("*", { count: "exact", head: true })
          .eq("chatbotId", chatbot.id);

        return {
          ...chatbot,
          _count: {
            documents: documentCount || 0,
            conversations: conversationCount || 0,
          },
        };
      })
    );

    const userPlan = userData.plan as "FREE" | "PRO";
    return NextResponse.json({
      chatbots: transformedChatbots,
      limits: {
        maxChatbots: userPlan === "PRO" ? 3 : 1,
        currentCount: transformedChatbots.length,
      },
    });
  } catch (error) {
    console.error("Error fetching chatbots:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Create a new chatbot
export async function POST(request: NextRequest) {
  try {
    // Get user ID from headers (set by middleware)
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from("User")
      .select("plan")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Type assertion to handle Supabase type inference issues
    const userData = user as any;

    // Check chatbot limits
    const { count: existingChatbots, error: countError } = await supabaseAdmin
      .from("Chatbot")
      .select("*", { count: "exact", head: true })
      .eq("userId", userId);

    if (countError) {
      throw countError;
    }

    const userPlan = userData.plan as "FREE" | "PRO";
    const maxChatbots = userPlan === "PRO" ? 3 : 1;
    if ((existingChatbots || 0) >= maxChatbots) {
      return NextResponse.json(
        {
          error: `You've reached the limit of ${maxChatbots} chatbot${
            maxChatbots > 1 ? "s" : ""
          } for your ${userPlan.toLowerCase()} plan`,
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, welcomeMessage, primaryColor } = body;

    const { data: chatbot, error: createError } = await supabaseAdmin
      .from("Chatbot")
      .insert({
        name: name || `Chatbot ${(existingChatbots || 0) + 1}`,
        welcomeMessage: welcomeMessage || "Hello! How can I help you today?",
        primaryColor: primaryColor || "#3B82F6",
        userId,
      } as any)
      .select("*")
      .single();

    if (createError) {
      throw createError;
    }

    // New chatbots have 0 documents and conversations
    const transformedChatbot = {
      ...(chatbot as any),
      _count: {
        documents: 0,
        conversations: 0,
      },
    };

    return NextResponse.json(transformedChatbot, { status: 201 });
  } catch (error) {
    console.error("Error creating chatbot:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
