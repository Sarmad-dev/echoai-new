import { NextRequest, NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-validation";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return createErrorResponse("No image file provided", 400);
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return createErrorResponse("Invalid file type", 400);
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return createErrorResponse("File too large", 400);
    }

    // For now, return a mock response since we don't have image storage set up
    // In a real implementation, you would upload to a cloud storage service
    const mockImageUrl = `https://via.placeholder.com/400x300?text=Uploaded+Image`;

    const response = NextResponse.json({
      success: true,
      url: mockImageUrl,
      filename: file.name,
      size: file.size,
      type: file.type,
    });

    // Add CORS headers
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");

    return response;
  } catch (error) {
    console.error("Image upload error:", error);
    return createErrorResponse("Internal server error", 500);
  }
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}