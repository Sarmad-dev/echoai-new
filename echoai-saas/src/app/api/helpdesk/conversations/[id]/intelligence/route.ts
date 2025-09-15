import { NextRequest, NextResponse } from "next/server";
import { withRoleProtection } from "@/lib/middleware/role-protection";
import { createClient } from "@/lib/supabase/supabase-server";

interface ConversationIntelligenceData {
  leadPotential: number;
  topicsCovered: string[];
  escalationRisk: number;
  proactiveScore: number;
  helpfulnessScore: number;
  knowledgeGapsFound: string[];
  userGoalsIdentified: string[];
  contextUnderstanding: number;
  conversationFlowScore: number;
  userSatisfactionPrediction: number;
}

async function handleGetConversationIntelligence(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabaseAdmin = await createClient();
  
  try {
    const conversationId = params.id;
    
    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation ID is required" },
        { status: 400 }
      );
    }

    // Fetch conversation intelligence data
    const { data: intelligence, error } = await supabaseAdmin
      .from("ConversationIntelligence")
      .select("intelligenceData, contextUnderstanding, proactiveScore, helpfulnessScore")
      .eq("conversationId", conversationId)
      .single();

    if (error) {
      console.error("Error fetching conversation intelligence:", error);
      return NextResponse.json(
        { error: "Failed to fetch conversation intelligence" },
        { status: 500 }
      );
    }

    if (!intelligence) {
      return NextResponse.json(
        { error: "No intelligence data found for this conversation" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      intelligenceData: intelligence.intelligenceData as ConversationIntelligenceData,
      contextUnderstanding: intelligence.contextUnderstanding,
      proactiveScore: intelligence.proactiveScore,
      helpfulnessScore: intelligence.helpfulnessScore,
    });
  } catch (error) {
    console.error("Get conversation intelligence API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Apply role protection middleware (staff/admin only)
export const GET = withRoleProtection(handleGetConversationIntelligence, [
  "staff",
  "admin",
]);

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}