import { NextRequest, NextResponse } from "next/server";
import { analyticsService } from "@/lib/analytics/analytics-service";

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pattern = searchParams.get("pattern");

    // Clear cache with optional pattern
    analyticsService.clearCache(pattern || undefined);

    return NextResponse.json({
      success: true,
      message: pattern 
        ? `Cache cleared for pattern: ${pattern}`
        : "All analytics cache cleared"
    });
  } catch (error) {
    console.error("Error clearing analytics cache:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to clear analytics cache",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const stats = analyticsService.getCacheStats();

    return NextResponse.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error("Error getting cache stats:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get cache statistics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}