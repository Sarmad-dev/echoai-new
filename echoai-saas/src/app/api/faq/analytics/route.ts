import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const { faqId, chatbotId, action, sessionId, metadata } = await request.json();

    if (!faqId || !chatbotId || !action) {
      return NextResponse.json(
        { error: "Missing required fields: faqId, chatbotId, action" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify FAQ exists
    const { data: faq, error: faqError } = await supabase
      .from("FAQ")
      .select("id, popularity")
      .eq("id", faqId)
      .eq("chatbotId", chatbotId)
      .single();

    if (faqError || !faq) {
      return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
    }

    // Get user agent from headers
    const userAgent = request.headers.get("user-agent");

    // Record analytics event
    const { error: analyticsError } = await supabase
      .from("FAQAnalytics")
      .insert({
        faqId,
        chatbotId,
        action,
        userAgent,
        sessionId,
        metadata,
      });

    if (analyticsError) {
      console.error("Error recording FAQ analytics:", analyticsError);
      // Don't fail the request if analytics fails
    }

    // Update popularity count for click actions
    if (action === "click") {
      const newPopularity = (faq.popularity || 0) + 1;
      const { error: updateError } = await supabase
        .from("FAQ")
        .update({ 
          popularity: newPopularity,
          lastUpdated: new Date().toISOString()
        })
        .eq("id", faqId);

      if (updateError) {
        console.error("Error updating FAQ popularity:", updateError);
        // Don't fail the request if popularity update fails
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in FAQ analytics POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get("chatbotId");
    const faqId = searchParams.get("faqId");
    const timeframe = searchParams.get("timeframe") || "7d"; // 1d, 7d, 30d

    if (!chatbotId) {
      return NextResponse.json(
        { error: "Missing required parameter: chatbotId" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Calculate date range
    const now = new Date();
    const timeframeMap = {
      "1d": 1,
      "7d": 7,
      "30d": 30,
    };
    const days = timeframeMap[timeframe as keyof typeof timeframeMap] || 7;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    let query = supabase
      .from("FAQAnalytics")
      .select(`
        id,
        faqId,
        action,
        createdAt,
        FAQ:faqId (
          id,
          question,
          category,
          popularity
        )
      `)
      .eq("chatbotId", chatbotId)
      .gte("createdAt", startDate.toISOString());

    if (faqId) {
      query = query.eq("faqId", faqId);
    }

    const { data: analytics, error } = await query
      .order("createdAt", { ascending: false });

    if (error) {
      console.error("Error fetching FAQ analytics:", error);
      return NextResponse.json(
        { error: "Failed to fetch analytics" },
        { status: 500 }
      );
    }

    // Aggregate analytics data
    const aggregated = {
      totalViews: 0,
      totalClicks: 0,
      totalSearches: 0,
      topFAQs: [] as any[],
      actionsByDay: {} as Record<string, { views: number; clicks: number; searches: number }>,
    };

    const faqStats = new Map();

    analytics?.forEach((event: any) => {
      // Count by action type
      if (event.action === "view") aggregated.totalViews++;
      if (event.action === "click") aggregated.totalClicks++;
      if (event.action === "search") aggregated.totalSearches++;

      // Group by day
      const day = event.createdAt.split("T")[0];
      if (!aggregated.actionsByDay[day]) {
        aggregated.actionsByDay[day] = { views: 0, clicks: 0, searches: 0 };
      }
      if (event.action === "view") aggregated.actionsByDay[day].views++;
      if (event.action === "click") aggregated.actionsByDay[day].clicks++;
      if (event.action === "search") aggregated.actionsByDay[day].searches++;

      // Track FAQ stats
      if (event.FAQ) {
        const faqKey = event.FAQ.id;
        if (!faqStats.has(faqKey)) {
          faqStats.set(faqKey, {
            faq: event.FAQ,
            views: 0,
            clicks: 0,
            searches: 0,
          });
        }
        const stats = faqStats.get(faqKey);
        if (event.action === "view") stats.views++;
        if (event.action === "click") stats.clicks++;
        if (event.action === "search") stats.searches++;
      }
    });

    // Get top FAQs by engagement
    aggregated.topFAQs = Array.from(faqStats.values())
      .sort((a, b) => (b.clicks + b.views) - (a.clicks + a.views))
      .slice(0, 10);

    return NextResponse.json(aggregated);
  } catch (error) {
    console.error("Error in FAQ analytics GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}