import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRoleProtection } from "@/lib/middleware/role-protection";
import { ConversationStatus } from "@/types/database";
import { createClient } from "@/lib/supabase/supabase-server";

// Query parameters validation schema
const getConversationsSchema = z.object({
  status: z
    .enum(["AI_HANDLING", "AWAITING_HUMAN_RESPONSE", "RESOLVED", "all"])
    .optional()
    .transform(val => val === "all" ? undefined : val), // Transform "all" to undefined (no filter)
  assignedTo: z.string().optional(),
  customerEmail: z.string().optional(),
  source: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z
    .enum(["createdAt", "updatedAt", "customerEmail", "status"])
    .default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
});

interface ConversationWithMetadata {
  id: string;
  userId: string;
  customerEmail?: string;
  source?: string;
  status: ConversationStatus;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage?: {
    content: string;
    role: string;
    createdAt: string;
  };
  sentimentScore?: number;
  duration: number; // in minutes
}

interface GetConversationsResponse {
  conversations: ConversationWithMetadata[];
  totalCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

async function handleGetConversations(
  request: NextRequest
): Promise<NextResponse> {
  const supabaseAdmin = await createClient();
  try {
    // Get user ID from headers (set by middleware)
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    console.log("User ID: ", userId)

    // Parse query parameters
    const url = new URL(request.url);
    
    // Handle multiple values for the same parameter
    const rawParams: Record<string, any> = {};
    for (const [key, value] of url.searchParams.entries()) {
      if (rawParams[key]) {
        // If key already exists, convert to array or add to existing array
        if (Array.isArray(rawParams[key])) {
          rawParams[key].push(value);
        } else {
          rawParams[key] = [rawParams[key], value];
        }
      } else {
        rawParams[key] = value;
      }
    }
    
    // Clean up parameters - handle cases where arrays might be sent
    const queryParams: Record<string, any> = {};
    for (const [key, value] of Object.entries(rawParams)) {
      // Handle arrays (multiple values for same parameter)
      if (Array.isArray(value)) {
        if (key === 'status') {
          continue; // Skip status arrays entirely
        }
        queryParams[key] = value[0]; // Take first element for other fields
      } else if (typeof value === 'string') {
        // Check if the value looks like a JSON array
        if (value.startsWith('[') && value.endsWith(']')) {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed) && parsed.length > 0) {
              // For status, if an array is sent, ignore it (treat as no filter)
              if (key === 'status') {
                continue; // Skip this parameter
              }
              queryParams[key] = parsed[0]; // Take first element for other fields
            } else {
              queryParams[key] = value;
            }
          } catch (e) {
            queryParams[key] = value; // If parsing fails, use as-is
          }
        } else {
          queryParams[key] = value;
        }
      } else {
        queryParams[key] = value;
      }
    }
    const validatedParams = getConversationsSchema.parse(queryParams);

    // Build base query
    let query = supabaseAdmin.from("Conversation").select(`
        id,
        userId,
        customerEmail,
        source,
        status,
        assignedTo,
        createdAt,
        updatedAt,
        messages:Message(
          id,
          content,
          role,
          createdAt,
          sentimentScore
        )
      `);

    // Apply filters
    if (validatedParams.status) {
      query = query.eq("status", validatedParams.status);
    }

    if (validatedParams.assignedTo) {
      query = query.eq("assignedTo", validatedParams.assignedTo);
    }

    if (validatedParams.customerEmail) {
      query = query.ilike(
        "customerEmail",
        `%${validatedParams.customerEmail}%`
      );
    }

    if (validatedParams.source) {
      query = query.ilike("source", `%${validatedParams.source}%`);
    }

    // Apply search across customer email and message content
    if (validatedParams.search) {
      // For message content search, we'll need to use a more complex query
      // For now, search only in customerEmail and source
      query = query.or(
        `customerEmail.ilike.%${validatedParams.search}%,source.ilike.%${validatedParams.search}%`
      );
    }

    // Apply sorting
    const sortColumn = validatedParams.sortBy;
    const sortOrder = validatedParams.sortOrder === "asc" ? true : false;
    query = query.order(sortColumn, { ascending: sortOrder });

    // Apply pagination
    const offset = (validatedParams.page - 1) * validatedParams.limit;
    query = query.range(offset, offset + validatedParams.limit - 1);

    const {
      data: conversations,
      error: conversationsError,
      count,
    } = await query;

    if (conversationsError) {
      console.error("Error fetching conversations:", conversationsError);
      return NextResponse.json(
        { error: "Failed to fetch conversations" },
        { status: 500 }
      );
    }

    // Transform data to include metadata
    const conversationsWithMetadata: ConversationWithMetadata[] = (
      conversations || []
    ).map((conv) => {
      const messages = (conv as any).messages || [];
      const lastMessage =
        messages.length > 0 ? messages[messages.length - 1] : null;

      // Calculate average sentiment score
      const sentimentScores = messages
        .filter((msg: any) => msg.sentimentScore !== null)
        .map((msg: any) => parseFloat(msg.sentimentScore));
      const avgSentiment =
        sentimentScores.length > 0
          ? sentimentScores.reduce(
              (sum: number, score: number) => sum + score,
              0
            ) / sentimentScores.length
          : undefined;

      // Calculate conversation duration in minutes
      const createdAt = new Date((conv as any).createdAt);
      const updatedAt = new Date((conv as any).updatedAt);
      const duration = Math.round(
        (updatedAt.getTime() - createdAt.getTime()) / (1000 * 60)
      );

      return {
        id: (conv as any).id,
        userId: (conv as any).userId,
        customerEmail: (conv as any).customerEmail,
        source: (conv as any).source,
        status: (conv as any).status as ConversationStatus,
        assignedTo: (conv as any).assignedTo,
        createdAt: (conv as any).createdAt,
        updatedAt: (conv as any).updatedAt,
        messageCount: messages.length,
        lastMessage: lastMessage
          ? {
              content:
                lastMessage.content.substring(0, 100) +
                (lastMessage.content.length > 100 ? "..." : ""),
              role: lastMessage.role,
              createdAt: lastMessage.createdAt,
            }
          : undefined,
        sentimentScore: avgSentiment,
        duration,
      };
    });

    const response: GetConversationsResponse = {
      conversations: conversationsWithMetadata,
      totalCount: count || 0,
      page: validatedParams.page,
      limit: validatedParams.limit,
      hasMore: (count || 0) > validatedParams.page * validatedParams.limit,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Get conversations API error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Apply role protection middleware (staff/admin only)
export const GET = withRoleProtection(handleGetConversations, [
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
