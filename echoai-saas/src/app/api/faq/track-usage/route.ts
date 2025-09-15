import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/database";
import { createErrorResponse } from "@/lib/api-validation";

const trackUsageSchema = z.object({
  faqId: z.string().min(1, "FAQ ID is required"),
  chatbotId: z.string().min(1, "Chatbot ID is required"),
  timestamp: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = trackUsageSchema.parse(body);

    // Update FAQ view count - first get current count, then increment
    const { data: currentFaq, error: fetchError } = await supabaseAdmin
      .from("FAQ")
      .select("viewCount")
      .eq("id", validatedData.faqId)
      .eq("chatbotId", validatedData.chatbotId)
      .single();

    if (!fetchError && currentFaq) {
      const { error } = await (supabaseAdmin as any)
        .from("FAQ")
        .update({
          viewCount: ((currentFaq as any).viewCount || 0) + 1,
        })
        .eq("id", validatedData.faqId)
        .eq("chatbotId", validatedData.chatbotId);

      if (error) {
        console.error("Error tracking FAQ usage:", error);
        // Don't return error as this is not critical
      }
    } else {
      console.error("Error fetching FAQ for view count update:", fetchError);
    }

    const response = NextResponse.json({ success: true });

    // Add CORS headers
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");

    return response;
  } catch (error) {
    console.error("FAQ usage tracking error:", error);

    // Return success even on error since this is not critical
    const response = NextResponse.json({ success: true });
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    return response;
  }
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}
