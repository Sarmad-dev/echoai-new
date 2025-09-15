import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { Database } from "../../types/database";

type UserRole = 'user' | 'staff' | 'admin';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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

          supabaseResponse = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // 🚨 This call is REQUIRED for Supabase auth session to work
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Add user ID to headers for API routes
  if (request.nextUrl.pathname.startsWith('/api/') && user) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', user.id);
    
    supabaseResponse = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // Route definitions
  const protectedRoutes = ["/dashboard"];
  const authRoutes = ["/login", "/signup"];
  const helpDeskRoutes = ["/helpdesk"];

  const isProtectedRoute = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );
  const isAuthRoute = authRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );
  const isHelpDeskRoute = helpDeskRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  // Basic authentication check for protected routes
  if (isProtectedRoute && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect authenticated users away from auth pages
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Role-based protection for help desk routes
  if (isHelpDeskRoute && user) {
    try {
      // Get user profile with role information
      const { data: userProfile, error: profileError } = await supabase
        .from('User')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError || !userProfile) {
        console.error('Error fetching user profile for help desk access:', profileError);
        const unauthorizedUrl = new URL('/unauthorized', request.url);
        unauthorizedUrl.searchParams.set('error', 'Unable to verify permissions');
        unauthorizedUrl.searchParams.set('from', request.nextUrl.pathname);
        return NextResponse.redirect(unauthorizedUrl);
      }

      // Check if user has staff or admin role
      const userRole = (userProfile as any).role as UserRole;
      const hasHelpDeskAccess = userRole === 'staff' || userRole === 'admin';

      if (!hasHelpDeskAccess) {
        const unauthorizedUrl = new URL('/unauthorized', request.url);
        unauthorizedUrl.searchParams.set('error', 'Access denied. Staff or admin role required.');
        unauthorizedUrl.searchParams.set('from', request.nextUrl.pathname);
        return NextResponse.redirect(unauthorizedUrl);
      }
    } catch (error) {
      console.error('Error in help desk role verification:', error);
      const unauthorizedUrl = new URL('/unauthorized', request.url);
      unauthorizedUrl.searchParams.set('error', 'Authentication error occurred');
      unauthorizedUrl.searchParams.set('from', request.nextUrl.pathname);
      return NextResponse.redirect(unauthorizedUrl);
    }
  }

  // If help desk route but no user, redirect to login
  if (isHelpDeskRoute && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
