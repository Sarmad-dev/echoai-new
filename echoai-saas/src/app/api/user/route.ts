import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/supabase-server";
import { supabaseAdmin } from "@/lib/supabase/database";

export async function GET() {
  try {
    const supabase = await createClient();

    // Get session first, then extract user
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    const user = session?.user;

    // TEMPORARY: For testing without authentication, use the actual user ID from database
    const userId = user?.id || "1dd1fa9b-3bcc-48d5-819e-79dde1d539c5";

    if (authError && !user) {
      console.warn(
        "No authenticated user, using existing test user ID for testing"
      );
    }

    // Get user data including API key from database using Supabase
    const { data: userData, error } = await supabaseAdmin
      .from("User")
      .select("id, email, apiKey")
      .eq("id", userId)
      .single();

    // If user doesn't exist in our database, create them
    if (error || !userData) {
      const { data: newUser, error: createError } = await supabaseAdmin
        .from("User")
        .insert({
          id: userId,
          email: user?.email || "temp@example.com",
        } as any)
        .select("id, email, apiKey")
        .single();

      if (createError) {
        throw createError;
      }

      return NextResponse.json(newUser);
    }

    return NextResponse.json(userData);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
