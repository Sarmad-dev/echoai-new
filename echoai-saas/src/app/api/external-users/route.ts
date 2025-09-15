import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/supabase-server";
import { z } from "zod";

const createExternalUserSchema = z.object({
  email: z.string().email("Invalid email format"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});



export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createExternalUserSchema.parse(body);

    const supabase = await createClient();

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from("ExternalUser")
      .select("id, email")
      .eq("email", validatedData.email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking existing user:", checkError);
      return NextResponse.json(
        { error: "Failed to check existing user" },
        { status: 500 }
      );
    }

    // Create new external user
    const { data: newUser, error: createError } = await supabase
      .from("ExternalUser")
      .insert({
        email: validatedData.email,
        firstName: validatedData.firstName || null,
        lastName: validatedData.lastName || null,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating external user:", createError);
      return NextResponse.json(
        { error: "Failed to create external user" },
        { status: 500 }
      );
    }

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error in external user creation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const supabase = await createClient();

    if (email) {
      // Get specific user by email
      const { data: user, error } = await supabase
        .from("ExternalUser")
        .select("*")
        .eq("email", email)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return NextResponse.json(
            { error: "User not found" },
            { status: 404 }
          );
        }
        console.error("Error fetching user:", error);
        return NextResponse.json(
          { error: "Failed to fetch user" },
          { status: 500 }
        );
      }

      return NextResponse.json(user);
    } else {
      // Get all users with pagination
      const { data: users, error, count } = await supabase
        .from("ExternalUser")
        .select("*", { count: "exact" })
        .order("createdAt", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error("Error fetching users:", error);
        return NextResponse.json(
          { error: "Failed to fetch users" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        users: users || [],
        total: count || 0,
        limit,
        offset,
      });
    }
  } catch (error) {
    console.error("Error in external users GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}