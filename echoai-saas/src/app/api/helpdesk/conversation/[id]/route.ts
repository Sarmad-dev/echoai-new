import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRoleProtection } from "@/lib/middleware/role-protection";
import { ConversationStatus } from "@/types/database";
import { createClient } from "@/lib/supabase/supabase-server";

// Request validation schema for updating conversation metadata
const updateConversationSchema = z.object({
  customerEmail: z.string().email().optional(),
  source: z.string().optional(),
  status: z
    .enum(["AI_HANDLING", "AWAITING_HUMAN_RESPONSE", "RESOLVED"])
    .optional(),
  assignedTo: z.string().nullable().optional(),
});

interface UpdateConversationRequest {
  customerEmail?: string;
  source?: string;
  status?: ConversationStatus;
  assignedTo?: string | null;
}

interface ConversationResponse {
  id: string;
  userId: string;
  customerEmail?: string;
  source?: string;
  status: ConversationStatus;
  assignedTo?: string | null;
  createdAt: string;
  updatedAt: string;
}

async function handleGetConversation(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = await createClient();
  try {
    // Get user ID from headers (set by middleware)
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const conversationId = params.id;
    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation ID is required" },
        { status: 400 }
      );
    }

    // Fetch conversation details
    const { data: conversation, error: fetchError } = await supabase
      .from("Conversation")
      .select(
        `
        id,
        userId,
        customerEmail,
        source,
        status,
        assignedTo,
        createdAt,
        updatedAt
      `
      )
      .eq("id", conversationId)
      .single();

    if (fetchError || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const response: ConversationResponse = {
      id: (conversation as any).id,
      userId: (conversation as any).userId,
      customerEmail: (conversation as any).customerEmail,
      source: (conversation as any).source,
      status: (conversation as any).status as ConversationStatus,
      assignedTo: (conversation as any).assignedTo,
      createdAt: (conversation as any).createdAt,
      updatedAt: (conversation as any).updatedAt,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Get conversation API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function handleUpdateConversation(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const supabase = await createClient();
  try {
    // Get user ID from headers (set by middleware)
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id: conversationId } = await params;
    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation ID is required" },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateConversationSchema.parse(
      body
    ) as UpdateConversationRequest;

    // Verify conversation exists
    const { data: existingConversation, error: fetchError } = await supabase
      .from("Conversation")
      .select("id, status, assignedTo")
      .eq("id", conversationId)
      .single();

    if (fetchError || !existingConversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    // Add fields that are being updated
    if (validatedData.customerEmail !== undefined) {
      updateData.customerEmail = validatedData.customerEmail;
    }

    if (validatedData.source !== undefined) {
      updateData.source = validatedData.source;
    }

    if (validatedData.status !== undefined) {
      updateData.status = validatedData.status;

      // Handle assignment logic based on status change
      if (
        validatedData.status === ConversationStatus.AWAITING_HUMAN_RESPONSE &&
        !(existingConversation as any).assignedTo
      ) {
        // Auto-assign to current user if taking over and not already assigned
        updateData.assignedTo = userId;
      } else if (validatedData.status === ConversationStatus.AI_HANDLING) {
        // Clear assignment when returning to AI
        updateData.assignedTo = null;
      }
    }

    if (validatedData.assignedTo !== undefined) {
      updateData.assignedTo = validatedData.assignedTo;
    }

    // Update conversation
    const { data: updatedConversation, error: updateError } = await supabase
      .from("Conversation")
      .update(updateData as any)
      .eq("id", conversationId)
      .select(
        `
        id,
        userId,
        customerEmail,
        source,
        status,
        assignedTo,
        createdAt,
        updatedAt
      `
      )
      .single();

    if (updateError || !updatedConversation) {
      console.error("Error updating conversation:", updateError);
      return NextResponse.json(
        { error: "Failed to update conversation" },
        { status: 500 }
      );
    }

    // The conversation update will be automatically broadcast via Supabase Realtime
    // to all connected help desk clients

    const response: ConversationResponse = {
      id: (updatedConversation as any).id,
      userId: (updatedConversation as any).userId,
      customerEmail: (updatedConversation as any).customerEmail,
      source: (updatedConversation as any).source,
      status: (updatedConversation as any).status as ConversationStatus,
      assignedTo: (updatedConversation as any).assignedTo,
      createdAt: (updatedConversation as any).createdAt,
      updatedAt: (updatedConversation as any).updatedAt,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Update conversation API error:", error);

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
export const GET = withRoleProtection(handleGetConversation, [
  "staff",
  "admin",
]);
export const PATCH = withRoleProtection(handleUpdateConversation, [
  "staff",
  "admin",
]);

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
