import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  validateAndSanitizeMessage,
  createErrorResponse,
  chatRateLimiter,
} from "@/lib/api-validation";
import { createClient } from "@/lib/supabase/supabase-server";

// Enhanced chat request schema
const enhancedChatRequestSchema = z.object({
  message: z.string().min(1, "Message cannot be empty"),
  apiKey: z.string().min(1, "API key is required"),
  chatbotId: z.string().optional(),
  conversationId: z.string().optional(),
  conversation_id: z.string().optional(), // Alternative naming
  sessionId: z.string().optional(),
  userEmail: z.string().email().optional(),
  imageUrl: z.string().url().optional(),
  enableEnhancedFeatures: z.boolean().default(true),
  enableProactiveQuestions: z.boolean().default(true),
  enableTopicSuggestions: z.boolean().default(true),
  enableConversationActions: z.boolean().default(true),
  enableIntelligenceMetadata: z.boolean().default(false),
});

// Enhanced response interface
interface EnhancedChatResponse {
  response: string;
  proactive_questions?: string[];
  suggested_topics?: string[];
  conversation_actions?: Array<{
    action_type: string;
    priority: number;
    content: string;
    reasoning: string;
    confidence: number;
    metadata?: Record<string, any>;
  }>;
  intelligence_metadata?: {
    conversation_id: string;
    user_id: string;
    chatbot_id?: string;
    context_understanding: number;
    proactive_score: number;
    helpfulness_score: number;
    conversation_flow_score: number;
    user_satisfaction_prediction: number;
    escalation_risk: number;
    lead_potential: number;
    topics_covered: string[];
    user_goals_identified: string[];
    knowledge_gaps_found: string[];
  };
  context_used: boolean;
  sources_count: number;
  confidence_score: number;
  sentiment: string;
  sentiment_score?: number;
  conversation_id: string;
  session_id?: string;
  lead_analysis?: Record<string, any>;
}

// Type definitions for better type safety
interface UserData {
  userId: string;
  email: string;
  plan: string;
}

interface ConversationRecord {
  id: string;
  status: string;
}

interface ChatbotWithUser {
  id: string;
  name: string;
  apiKey: string;
  userId: string;
  User: {
    id: string;
    email: string;
    apiKey: string;
    plan: string;
  }[];
}

interface UserRecord {
  id: string;
  email: string;
  apiKey: string;
  plan: string;
}

// Helper function to validate API key and get user
async function validateApiKey(
  apiKey: string,
  chatbotId?: string
): Promise<UserData | null> {
  if (chatbotId) {
    const supabaseAdmin = await createClient();
    // Widget request - validate chatbot API key
    const { data: chatbot, error } = await supabaseAdmin
      .from("Chatbot")
      .select(
        `
        id,
        name,
        apiKey,
        userId,
        User (
          id,
          email,
          apiKey,
          plan
        )
      `
      )
      .eq("id", chatbotId)
      .eq("apiKey", apiKey)
      .single();

    if (error || !chatbot) {
      return null;
    }

    const typedChatbot = chatbot as ChatbotWithUser;

    return {
      userId: typedChatbot.User[0].id,
      email: typedChatbot.User[0].email,
      plan: typedChatbot.User[0].plan,
    };
  }

  const supabaseAdmin = await createClient();

  // Direct API request - validate user API key
  const { data: user, error } = await supabaseAdmin
    .from("User")
    .select("id, email, apiKey, plan")
    .eq("apiKey", apiKey)
    .single();

  if (error || !user) {
    return null;
  }

  const typedUser = user as UserRecord;

  return {
    userId: typedUser.id,
    email: typedUser.email,
    plan: typedUser.plan,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabaseAdmin = await createClient();

    // Sanitize message
    if (body.message) {
      body.message = validateAndSanitizeMessage(body.message);
    }

    const validatedData = enhancedChatRequestSchema.parse(body);

    // Validate API key
    const user = await validateApiKey(
      validatedData.apiKey,
      validatedData.chatbotId
    );
    if (!user) {
      return createErrorResponse("Invalid API key", 401);
    }

    // Rate limiting
    const clientIp =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (!chatRateLimiter.isAllowed(`${user.userId}-${clientIp}`)) {
      return createErrorResponse(
        "Too many requests. Please try again later.",
        429,
        {
          remainingRequests: chatRateLimiter.getRemainingRequests(
            `${user.userId}-${clientIp}`
          ),
        }
      );
    }

    // Check if conversation exists and is awaiting human response
    const conversationId =
      validatedData.conversationId || validatedData.conversation_id;

    if (conversationId) {
      const { data: existingConversation, error: conversationError } =
        await supabaseAdmin
          .from("Conversation")
          .select("id, status")
          .eq("id", conversationId)
          .single();

      console.log("Conversation Status: ", existingConversation?.status)

      if (
        !conversationError &&
        existingConversation &&
        (existingConversation as ConversationRecord).status ===
          "AWAITING_HUMAN_RESPONSE"
      ) {
        // Just store the user message and return a response indicating human will respond
        await supabaseAdmin.from("Message").insert({
          conversationId: conversationId,
          content: validatedData.message,
          role: "user" as const,
          sessionId: validatedData.sessionId || null,
          imageUrl: validatedData.imageUrl || null,
        });

        // Also update the conversation's customerEmail if not already set
        if (validatedData.userEmail) {
          await supabaseAdmin
            .from("Conversation")
            .update({ customerEmail: validatedData.userEmail })
            .eq("id", conversationId)
            .is("customerEmail", null);
        }

        const response = NextResponse.json({
          response:
            "Your message has been received. A human agent will respond shortly.",
          sentiment: "neutral",
          conversation_id: conversationId,
          awaitingHuman: true,
          proactive_questions: [],
          suggested_topics: [],
          conversation_actions: [],
          context_used: false,
          sources_count: 0,
          confidence_score: 1.0,
        });

        // Add CORS headers
        response.headers.set("Access-Control-Allow-Origin", "*");
        response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        response.headers.set("Access-Control-Allow-Headers", "Content-Type");

        return response;
      }
    }

    // Prepare FastAPI request
    const fastApiUrl = process.env.FASTAPI_URL || "http://localhost:8000";

    const fastApiRequest = {
      message: validatedData.message,
      api_key: validatedData.apiKey,
      conversation_id: conversationId,
      chatbot_id: validatedData.chatbotId,
      user_email: validatedData.userEmail,
      session_id: validatedData.sessionId,
      image_url: validatedData.imageUrl,
      enable_proactive_questions: validatedData.enableProactiveQuestions,
      enable_topic_suggestions: validatedData.enableTopicSuggestions,
      enable_conversation_actions: validatedData.enableConversationActions,
      enable_intelligence_metadata: validatedData.enableIntelligenceMetadata,
      enable_fallback_strategies: true,
      avoid_i_dont_know: true,
    };

    // Check if streaming is requested
    const acceptHeader = request.headers.get("accept");
    const isStreamingRequest =
      acceptHeader?.includes("text/stream") ||
      acceptHeader?.includes("text/event-stream");

    if (isStreamingRequest) {
      // Use enhanced streaming endpoint
      return handleEnhancedStreaming(
        fastApiUrl,
        fastApiRequest,
        user.userId,
        validatedData.userEmail
      );
    } else {
      // Use enhanced chat endpoint
      return handleEnhancedChat(
        fastApiUrl,
        fastApiRequest,
        user.userId,
        validatedData.sessionId,
        validatedData.userEmail
      );
    }
  } catch (error) {
    console.error("Enhanced chat API error:", error);

    if (error instanceof z.ZodError) {
      return createErrorResponse("Validation failed", 400, error.issues);
    }

    if (error instanceof TypeError && error.message.includes("fetch")) {
      return createErrorResponse(
        "AI service unavailable",
        503,
        "Could not connect to AI processing service"
      );
    }

    return createErrorResponse("Internal server error", 500);
  }
}

async function handleEnhancedChat(
  fastApiUrl: string,
  fastApiRequest: any,
  userId: string,
  sessionId?: string,
  userEmail?: string
) {
  try {
    const response = await fetch(`${fastApiUrl}/api/enhanced-chat/widget`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fastApiRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("FastAPI enhanced chat error:", errorText);
      return createErrorResponse(
        "Failed to generate enhanced response",
        response.status,
        { fastApiError: errorText }
      );
    }

    const enhancedResult: EnhancedChatResponse = await response.json();

    // Note: Message storage is handled by the FastAPI service to avoid duplicate
    // message storage. The FastAPI enhanced RAG service already saves both user and
    // assistant messages to the database.

    const nextResponse = NextResponse.json(enhancedResult);

    // Add CORS headers
    nextResponse.headers.set("Access-Control-Allow-Origin", "*");
    nextResponse.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    nextResponse.headers.set("Access-Control-Allow-Headers", "Content-Type");

    return nextResponse;
  } catch (error) {
    throw error;
  }
}

async function handleEnhancedStreaming(
  fastApiUrl: string,
  fastApiRequest: any,
  userId: string,
  userEmail?: string
) {
  try {
    const response = await fetch(`${fastApiUrl}/api/enhanced-stream/widget`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(fastApiRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("FastAPI enhanced streaming error:", errorText);
      return createErrorResponse(
        "Failed to generate enhanced streaming response",
        response.status,
        { fastApiError: errorText }
      );
    }

    // Create a readable stream for the response
    const encoder = new TextEncoder();
    let fullResponse = "";
    let conversationId = "";
    let sentiment = "";
    let enhancedData: Partial<EnhancedChatResponse> = {};

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const reader = response.body?.getReader();
          if (!reader) {
            controller.error(new Error("No response body"));
            return;
          }

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              // Note: Message storage is handled by the FastAPI service for enhanced streaming
              // to avoid duplicate message storage. The FastAPI enhanced RAG service already
              // saves both user and assistant messages to the database.
              controller.close();
              break;
            }

            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));

                  if (data.type === "token" && data.content) {
                    fullResponse += data.content;
                  } else if (data.type === "metadata") {
                    if (data.conversation_id)
                      conversationId = data.conversation_id;
                    if (data.sentiment) sentiment = data.sentiment;
                  } else if (data.type === "enhanced_metadata") {
                    // Store enhanced metadata
                    enhancedData = { ...enhancedData, ...data };
                  }

                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
                  );
                } catch (parseError) {
                  console.error(
                    "Error parsing enhanced streaming data:",
                    parseError
                  );
                }
              }
            }
          }
        } catch (error) {
          console.error("Enhanced streaming error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    throw error;
  }
}

// Note: storeEnhancedConversation function removed as message storage is now handled
// entirely by the FastAPI service to prevent duplicate message storage.

// Handle preflight requests
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}
