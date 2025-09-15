import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/supabase-server";
import {
  trainRequestSchema,
  validateFile,
  createErrorResponse,
  trainRateLimiter,
  sanitizeInput,
} from "@/lib/api-validation";
import type { FastAPIIngestResponse, TrainRequestData } from "@/types/api";

export async function POST(request: NextRequest) {
  try {
    // Authentication validation
    const supabase = await createClient();
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    const user = session?.user;

    const userId = user?.id as string;

    if (authError && !user) {
      console.warn(
        "No authenticated user, using temporary user ID for testing"
      );
    }

    // Rate limiting
    const clientIp =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (!trainRateLimiter.isAllowed(`${userId}-${clientIp}`)) {
      return createErrorResponse(
        "Too many requests. Please try again later.",
        429,
        {
          remainingRequests: trainRateLimiter.getRemainingRequests(
            `${userId}-${clientIp}`
          ),
        }
      );
    }

    // Verify user exists in database
    const { data: userData, error: userError } = await supabase
      .from("User")
      .select("id, apiKey")
      .eq("id", userId)
      .single();

    if (userError || !userData) {
      return createErrorResponse("User not found", 404);
    }

    // Parse request data
    const contentType = request.headers.get("content-type");
    let requestData: TrainRequestData = {};
    let files: File[] = [];
    let chatbotId: string | null = null;
    let replaceExisting = false;

    if (contentType?.includes("multipart/form-data")) {
      // Handle FormData for file uploads
      const formData = await request.formData();

      // Extract chatbot ID
      chatbotId = formData.get("chatbotId") as string;

      // Extract replace existing flag
      const replaceExistingStr = formData.get("replaceExisting") as string;
      replaceExisting = replaceExistingStr === "true";

      // Extract URLs from form data
      const urlsString = formData.get("urls") as string;
      if (urlsString) {
        try {
          const parsedUrls = JSON.parse(urlsString);
          // Sanitize URLs
          requestData.urls = Array.isArray(parsedUrls)
            ? parsedUrls.map((url: string) => sanitizeInput(url))
            : [sanitizeInput(parsedUrls)];
        } catch {
          requestData.urls = [sanitizeInput(urlsString)]; // Single URL as string
        }
      }

      // Extract instructions from form data
      const instructionsString = formData.get("instructions") as string;
      if (instructionsString) {
        requestData.instructions = sanitizeInput(instructionsString);
      }

      // Extract and validate files from form data
      const fileEntries = formData.getAll("files") as File[];
      files = fileEntries.filter(
        (file) => file instanceof File && file.size > 0
      );

      // Validate each file
      for (const file of files) {
        const validation = validateFile(file);
        if (!validation.valid) {
          return createErrorResponse(
            `Invalid file "${file.name}": ${validation.error}`,
            400
          );
        }
      }

      if (files.length > 0) {
        requestData.files = files;
      }
    } else {
      // Handle JSON request
      const jsonData = (await request.json()) as TrainRequestData & {
        chatbotId?: string;
        replaceExisting?: boolean;
      };
      requestData = jsonData;
      chatbotId = jsonData.chatbotId || null;
      replaceExisting = jsonData.replaceExisting || false;

      // Sanitize URLs in JSON request
      if (requestData.urls) {
        requestData.urls = requestData.urls.map((url: string) =>
          sanitizeInput(url)
        );
      }
    }

    // Validate chatbot ID is provided
    if (!chatbotId) {
      return createErrorResponse("Chatbot ID is required", 400);
    }

    // Verify the chatbot belongs to the user
    const { data: chatbot, error: chatbotError } = await supabase
      .from("Chatbot")
      .select("id")
      .eq("id", chatbotId)
      .eq("userId", userId)
      .single();

    if (chatbotError || !chatbot) {
      return createErrorResponse("Chatbot not found", 404);
    }

    // Validate request data first
    const validatedData = trainRequestSchema.parse(requestData);

    // If replaceExisting is true, clear existing documents
    if (replaceExisting) {
      await supabase.from("Document").delete().eq("chatbotId", chatbotId);
    }

    // Update chatbot with instructions if provided
    if (validatedData.instructions) {
      await supabase
        .from("Chatbot")
        .update({ instructions: validatedData.instructions })
        .eq("id", chatbotId);
    }

    // Prepare FastAPI request
    const fastApiUrl = process.env.FASTAPI_URL || "http://localhost:8000";
    const fastApiFormData = new FormData();

    // Add user ID and chatbot ID to request
    fastApiFormData.append("user_id", userId);
    fastApiFormData.append("chatbot_id", chatbotId);

    // Add URLs if provided
    if (validatedData.urls && validatedData.urls.length > 0) {
      fastApiFormData.append("urls", JSON.stringify(validatedData.urls));
      console.log("Sending URLs:", validatedData.urls);
    }

    // Add files if provided
    if (files.length > 0) {
      files.forEach((file, index) => {
        fastApiFormData.append("files", file);
        console.log(
          `Adding file ${index}: ${file.name}, size: ${file.size}, type: ${file.type}`
        );
      });
    }

    console.log("Processing training request:");
    console.log("User ID:", userId);
    console.log("Files count:", files.length);
    console.log("URLs count:", validatedData.urls?.length || 0);
    console.log("Has instructions:", !!validatedData.instructions);

    let documentsProcessed = 0;
    let instructionsProcessed = 0;
    let embeddingsGenerated = 0;

    // Use the enhanced ingest endpoint to process everything together
    console.log("Processing all training data via enhanced ingest endpoint");

    const ingestFormData = new FormData();
    ingestFormData.append("user_id", userId);
    ingestFormData.append("chatbot_id", chatbotId);

    // Add URLs if provided
    if (validatedData.urls && validatedData.urls.length > 0) {
      ingestFormData.append("urls", JSON.stringify(validatedData.urls));
    }

    // Add files if provided
    if (files.length > 0) {
      files.forEach((file) => {
        ingestFormData.append("files", file);
      });
    }

    // Add instructions if provided
    if (validatedData.instructions) {
      ingestFormData.append("instructions", validatedData.instructions);
    }

    const ingestResponse = await fetch(`${fastApiUrl}/api/ingest`, {
      method: "POST",
      body: ingestFormData,
    });

    if (!ingestResponse.ok) {
      const errorText = await ingestResponse.text();
      console.error("Enhanced ingestion error:", errorText);
      return createErrorResponse(
        "Failed to process training data",
        ingestResponse.status,
        { fastApiError: errorText }
      );
    }

    const ingestResult: FastAPIIngestResponse = await ingestResponse.json();
    documentsProcessed = ingestResult.documents_processed;
    embeddingsGenerated = ingestResult.documents_processed;

    const processingStats = ingestResult.processing_stats
    const vectorStorageStats = ingestResult.vector_storage_stats

    console.log("Processing Stats: ", processingStats)
    console.log("Vector Stats: ", vectorStorageStats)
    console.log("Embeddings: ", embeddingsGenerated)

    // Count instructions if they were provided
    if (validatedData.instructions) {
      instructionsProcessed = 1;
      embeddingsGenerated += 1; // Add one for the instruction embedding
    }

    // Create a mock response object for compatibility
    const fastApiResponse = {
      ok: true,
      json: async () => ({
        success: true,
        message: `Successfully processed ${documentsProcessed} documents and ${instructionsProcessed} instructions`,
        documents_processed: documentsProcessed,
        instructions_processed: instructionsProcessed,
        embeddings_generated: embeddingsGenerated,
      }),
    };

    const fastApiResult: any = await fastApiResponse.json();

    // Return success response
    return NextResponse.json({
      success: fastApiResult.success,
      message: fastApiResult.message,
      documentsProcessed: fastApiResult.documents_processed || 0,
      instructionsProcessed: fastApiResult.instructions_processed || 0,
      embeddingsGenerated: fastApiResult.embeddings_generated || 0,
    });
  } catch (error) {
    console.error("Train API error:", error);

    if (error instanceof z.ZodError) {
      return createErrorResponse("Validation failed", 400, error.issues);
    }

    if (error instanceof TypeError && error.message.includes("fetch")) {
      return createErrorResponse(
        "FastAPI service unavailable",
        503,
        "Could not connect to AI processing service"
      );
    }

    return createErrorResponse("Internal server error", 500);
  }
}
