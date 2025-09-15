import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  chatRequestSchema,
  validateAndSanitizeMessage,
  createErrorResponse,
  chatRateLimiter,
} from "@/lib/api-validation";
import type {
  FastAPIChatResponse,
  ChatRequestData,
  StreamingChatData,
  UserData,
} from "@/types/api";
import { ConversationStatus } from "@/types/database";
import { createClient } from "@/lib/supabase/supabase-server";
// Type for chatbot with joined user data
interface ChatbotWithUser {
  id: string;
  name: string;
  apiKey: string;
  userId: string;
  User: {
    id: string;
    email: string;
    apiKey: string;
    plan: "FREE" | "PRO";
  }[];
}

// Helper function to validate API key and get user
async function validateApiKey(
  apiKey: string,
  chatbotId?: string
): Promise<UserData | null> {
  const supabaseAdmin = await createClient();
  // If chatbotId is provided, this is a widget request - validate chatbot API key
  if (chatbotId) {
    const { data: chatbot, error } = await supabaseAdmin
      .from("Chatbot")
      .select(
        `
        id,
        name,
        apiKey,
        userId,
        User!inner (
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

    // Type assertion with proper interface
    const chatbotWithUser = chatbot as ChatbotWithUser;

    return {
      id: chatbotWithUser.User[0].id,
      email: chatbotWithUser.User[0].email,
      apiKey: chatbotWithUser.User[0].apiKey,
      plan: chatbotWithUser.User[0].plan,
    };
  }

  // Otherwise, validate user API key directly
  const { data: user, error } = await supabaseAdmin
    .from("User")
    .select("id, email, apiKey, plan")
    .eq("apiKey", apiKey)
    .single();

  if (error || !user) {
    return null;
  }

  // Type assertion to handle Supabase type inference issues
  const userData = user as {
    id: string;
    email: string;
    apiKey: string;
    plan: "FREE" | "PRO";
  };

  return {
    id: userData.id,
    email: userData.email,
    apiKey: userData.apiKey,
    plan: userData.plan as "FREE" | "PRO",
  };
}

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();

    // Sanitize message before validation
    if (body.message) {
      body.message = validateAndSanitizeMessage(body.message);
    }

    const validatedData = chatRequestSchema.parse(body);

    // Validate API key and get user
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

    if (!chatRateLimiter.isAllowed(`${user.id}-${clientIp}`)) {
      return createErrorResponse(
        "Too many requests. Please try again later.",
        429,
        {
          remainingRequests: chatRateLimiter.getRemainingRequests(
            `${user.id}-${clientIp}`
          ),
        }
      );
    }

    const supabaseAdmin = await createClient();

    // Handle session-based conversation if sessionId is provided
    let conversationId = validatedData.conversationId;
    if (body.sessionId) {
      // Verify session exists and get conversation context
      const { data: session, error: sessionError } = await supabaseAdmin
        .from("ConversationSession")
        .select("id, externalUserId, chatbotId")
        .eq("id", body.sessionId)
        .eq("isActive", true)
        .single();

      if (sessionError || !session) {
        return createErrorResponse("Invalid session", 400);
      }

      // Use session-based conversation ID
      conversationId = body.sessionId;
    }

    // Check if conversation exists and is awaiting human response
    let shouldSkipAI = false;
    if (conversationId) {
      const { data: existingConversation } = await supabaseAdmin
        .from("Conversation")
        .select("id, status")
        .eq("id", conversationId)
        .single();

      if (
        existingConversation?.status ===
        ConversationStatus.AWAITING_HUMAN_RESPONSE
      ) {
        shouldSkipAI = true;

        // Just store the user message and return a response indicating human will respond
        await supabaseAdmin.from("Message").insert({
          conversationId: conversationId,
          content: validatedData.message,
          role: "user" as const,
          sessionId: body.sessionId || null,
          imageUrl: body.imageUrl || null,
        } as any);

        // Also update the conversation's customerEmail if not already set
        if (validatedData.userEmail) {
          await supabaseAdmin
            .from("Conversation")
            .update({ customerEmail: validatedData.userEmail } as any)
            .eq("id", conversationId)
            .is("customerEmail", null);
        }

        const response = NextResponse.json({
          response:
            "Your message has been received. A human agent will respond shortly.",
          sentiment: "neutral",
          conversationId: conversationId,
          awaitingHuman: true,
        });

        // Add CORS headers for external website access
        response.headers.set("Access-Control-Allow-Origin", "*");
        response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        response.headers.set("Access-Control-Allow-Headers", "Content-Type");

        return response;
      }
    }

    // Prepare FastAPI request
    const fastApiUrl = process.env.FASTAPI_URL || "http://localhost:8000";
    const chatRequest: ChatRequestData = {
      message: validatedData.message,
      user_id: user.id,
      conversation_id: conversationId || undefined,
      chatbot_id: validatedData.chatbotId || undefined,
    };

    // Add image URL if provided
    if (body.imageUrl) {
      (chatRequest as ChatRequestData & { image_url?: string }).image_url =
        body.imageUrl;
    }

    // Check if streaming is requested
    const acceptHeader = request.headers.get("accept");
    const isStreamingRequest =
      acceptHeader?.includes("text/stream") ||
      acceptHeader?.includes("text/event-stream");

    if (isStreamingRequest) {
      // Handle streaming response
      return handleStreamingChat(
        fastApiUrl,
        chatRequest,
        validatedData.apiKey,
        body.sessionId,
        validatedData.userEmail
      );
    } else {
      // Handle regular JSON response
      return handleRegularChat(
        fastApiUrl,
        chatRequest,
        validatedData.apiKey,
        body.sessionId,
        validatedData.userEmail
      );
    }
  } catch (error) {
    console.error("Chat API error:", error);

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

async function handleRegularChat(
  fastApiUrl: string,
  chatRequest: ChatRequestData,
  apiKey: string,
  sessionId?: string,
  userEmail?: string
) {
  try {
    // Use widget endpoint if chatbot_id is provided, otherwise use regular chat endpoint
    const endpoint = chatRequest.chatbot_id ? "/api/chat/widget" : "/api/chat";
    const isWidgetRequest = chatRequest.chatbot_id !== undefined;

    const requestBody = isWidgetRequest
      ? {
          message: chatRequest.message,
          api_key: apiKey,
          conversation_id: chatRequest.conversation_id,
          chatbot_id: chatRequest.chatbot_id,
        }
      : chatRequest;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (!isWidgetRequest) {
      headers["X-API-Key"] = apiKey;
    }

    const fastApiResponse = await fetch(`${fastApiUrl}${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!fastApiResponse.ok) {
      const errorText = await fastApiResponse.text();
      console.error("FastAPI chat error:", errorText);

      return createErrorResponse(
        "Failed to generate response",
        fastApiResponse.status,
        { fastApiError: errorText }
      );
    }

    const fastApiResult: FastAPIChatResponse = await fastApiResponse.json();

    // Note: Message storage is handled by the FastAPI service to avoid duplicate
    // message storage. The FastAPI RAG service already saves both user and assistant
    // messages to the database.

    const response = NextResponse.json({
      response: fastApiResult.response,
      sentiment: fastApiResult.sentiment,
      conversationId: fastApiResult.conversation_id,
    });

    // Add CORS headers for external website access
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");

    return response;
  } catch (error) {
    throw error;
  }
}

async function handleStreamingChat(
  fastApiUrl: string,
  chatRequest: ChatRequestData,
  apiKey: string,
  sessionId?: string,
  userEmail?: string
) {
  try {
    // Use widget streaming endpoint if chatbot_id is provided
    const endpoint = chatRequest.chatbot_id
      ? "/api/chat/widget/stream"
      : "/api/chat/stream";
    const isWidgetRequest = chatRequest.chatbot_id !== undefined;

    const requestBody = isWidgetRequest
      ? {
          message: chatRequest.message,
          api_key: apiKey,
          conversation_id: chatRequest.conversation_id,
          chatbot_id: chatRequest.chatbot_id,
        }
      : chatRequest;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "text/stream",
    };

    if (!isWidgetRequest) {
      headers["X-API-Key"] = apiKey;
    }

    const fastApiResponse = await fetch(`${fastApiUrl}${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!fastApiResponse.ok) {
      const errorText = await fastApiResponse.text();
      console.error("FastAPI streaming chat error:", errorText);

      return createErrorResponse(
        "Failed to generate streaming response",
        fastApiResponse.status,
        { fastApiError: errorText }
      );
    }

    // Create a readable stream for the response
    const encoder = new TextEncoder();
    let fullResponse = "";
    let conversationId = "";
    let sentiment = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const reader = fastApiResponse.body?.getReader();
          if (!reader) {
            controller.error(new Error("No response body"));
            return;
          }

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              // Note: Message storage is handled by the FastAPI service for streaming
              // to avoid duplicate message storage. The FastAPI RAG service already
              // saves both user and assistant messages to the database.
              controller.close();
              break;
            }

            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data: StreamingChatData = JSON.parse(line.slice(6));

                  if (data.type === "token" && data.content) {
                    fullResponse += data.content;
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
                    );
                  } else if (data.type === "metadata") {
                    // Handle conversation_id and sentiment from either direct fields or metadata
                    if (data.conversation_id) {
                      conversationId = data.conversation_id;
                    } else if (data.metadata?.conversation_id) {
                      conversationId = data.metadata.conversation_id;
                    }

                    if (data.sentiment) {
                      sentiment = data.sentiment;
                    } else if (data.metadata?.sentiment) {
                      sentiment = data.metadata.sentiment;
                    }

                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
                    );
                  } else if (data.type === "done") {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
                    );
                  }
                } catch (parseError) {
                  console.error("Error parsing streaming data:", parseError);
                }
              }
            }
          }
        } catch (error) {
          console.error("Streaming error:", error);
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

// Handle preflight requests
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

// Note: storeConversation function removed as message storage is now handled
// entirely by the FastAPI service to prevent duplicate message storage.
