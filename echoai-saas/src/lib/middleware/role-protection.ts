import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { Database } from "../../types/database";

type UserRole = "user" | "staff" | "admin";

interface RoleProtectionOptions {
  requiredRoles: UserRole[];
  redirectTo?: string;
  unauthorizedMessage?: string;
}

/**
 * Middleware function to verify user roles for help desk access
 * Checks if the authenticated user has one of the required roles
 */
export async function createRoleProtectionMiddleware(
  options: RoleProtectionOptions
) {
  return async function roleProtectionMiddleware(request: NextRequest) {
    const {
      requiredRoles,
      redirectTo = "/unauthorized",
      unauthorizedMessage,
    } = options;

    // Create Supabase client for middleware
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value);
            });
          },
        },
      }
    );

    try {
      // Get the current user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        // User is not authenticated, redirect to login
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Get user profile with role information from the database
      const { data: userProfile, error: profileError } = await supabase
        .from("User")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError || !userProfile) {
        console.error("Error fetching user profile:", profileError);
        // If we can't get the user profile, assume they don't have access
        return createUnauthorizedResponse(
          request,
          redirectTo,
          unauthorizedMessage
        );
      }

      // Check if user has one of the required roles
      const userRole = (userProfile as any).role as UserRole;
      const hasRequiredRole = requiredRoles.includes(userRole);

      if (!hasRequiredRole) {
        return createUnauthorizedResponse(
          request,
          redirectTo,
          unauthorizedMessage
        );
      }

      // User has required role, allow access
      return NextResponse.next();
    } catch (error) {
      console.error("Error in role protection middleware:", error);
      return createUnauthorizedResponse(
        request,
        redirectTo,
        "Authentication error occurred"
      );
    }
  };
}

/**
 * Route protection wrapper that checks for 'staff' or 'admin' roles
 * This is a convenience function for help desk routes
 */
export function createHelpDeskProtection() {
  return createRoleProtectionMiddleware({
    requiredRoles: ["staff", "admin"],
    redirectTo: "/unauthorized",
    unauthorizedMessage: "Access denied. Staff or admin role required.",
  });
}

/**
 * Creates an unauthorized response with proper redirect and error handling
 */
function createUnauthorizedResponse(
  request: NextRequest,
  redirectTo: string,
  message?: string
): NextResponse {
  const unauthorizedUrl = new URL(redirectTo, request.url);

  if (message) {
    unauthorizedUrl.searchParams.set("error", message);
  }

  // Add the original URL for potential redirect after authorization
  unauthorizedUrl.searchParams.set("from", request.nextUrl.pathname);

  return NextResponse.redirect(unauthorizedUrl);
}

/**
 * Utility function to check if a user has a specific role
 * Can be used in API routes and server components
 */
export async function verifyUserRole(
  userId: string,
  requiredRoles: UserRole[]
): Promise<{ hasAccess: boolean; userRole?: UserRole; error?: string }> {
  try {
    // Create a server-side Supabase client
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll: () => [],
          setAll: () => {},
        },
      }
    );

    const { data: userProfile, error } = await supabase
      .from("User")
      .select("role")
      .eq("id", userId)
      .single();

    if (error || !userProfile) {
      return {
        hasAccess: false,
        error: "User profile not found",
      };
    }

    const userRole = (userProfile as any).role as UserRole;
    const hasAccess = requiredRoles.includes(userRole);

    return {
      hasAccess,
      userRole,
    };
  } catch (error) {
    console.error("Error verifying user role:", error);
    return {
      hasAccess: false,
      error: "Failed to verify user role",
    };
  }
}

/**
 * Higher-order function that wraps API route handlers with role protection
 */
export function withRoleProtection(
  handler: (request: NextRequest, context: any) => Promise<NextResponse>,
  requiredRoles: UserRole[]
) {
  return async function protectedHandler(request: NextRequest, context: any) {
    // Get user ID from headers (set by the main middleware)
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Verify user role
    const { hasAccess, error } = await verifyUserRole(userId, requiredRoles);
    console.log("Has Access: ", hasAccess);
    if (!hasAccess) {
      return NextResponse.json(
        { error: error || "Insufficient permissions" },
        { status: 403 }
      );
    }

    // User has required role, proceed with the original handler
    return handler(request, context);
  };
}
