import { NextRequest } from "next/server";

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: NextRequest) => Promise<string> | string; // Function to generate unique key
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// In-memory store for rate limiting (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Simple in-memory rate limiter
 * In production, this should be replaced with Redis or a distributed cache
 */
export async function rateLimit(
  request: NextRequest,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req) => getDefaultKey(req),
  } = options;

  // Generate unique key for this request
  const key = await keyGenerator(request);
  const now = Date.now();
  const windowStart = now - windowMs;

  // Clean up expired entries
  cleanupExpiredEntries(windowStart);

  // Get or create entry for this key
  let entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime <= now) {
    // Create new window
    entry = {
      count: 0,
      resetTime: now + windowMs,
    };
  }

  // Check if limit exceeded
  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter,
    };
  }

  // Increment counter
  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Generate default key based on IP address and user agent
 */
function getDefaultKey(request: NextRequest): string {
  // Extract IP from headers (NextRequest doesn't have direct ip property)
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") || // Cloudflare
    request.headers.get("x-client-ip") ||
    "unknown";

  const userAgent = request.headers.get("user-agent") || "unknown";

  // Create a simple hash of IP + User Agent for basic fingerprinting
  return `${ip}:${userAgent.slice(0, 50)}`;
}

/**
 * Clean up expired entries from the rate limit store
 */
function cleanupExpiredEntries(windowStart: number): void {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime <= windowStart) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Clear all rate limit entries (useful for testing)
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}

/**
 * Get current rate limit status for a key without incrementing
 */
export async function getRateLimitStatus(
  request: NextRequest,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req) => getDefaultKey(req),
  } = options;

  const key = await keyGenerator(request);
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime <= now) {
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests,
      resetTime: now + windowMs,
    };
  }

  const remaining = Math.max(0, maxRequests - entry.count);
  const success = remaining > 0;

  return {
    success,
    limit: maxRequests,
    remaining,
    resetTime: entry.resetTime,
    retryAfter: success ? undefined : Math.ceil((entry.resetTime - now) / 1000),
  };
}

/**
 * Rate limiting middleware for API routes
 */
export function createRateLimitMiddleware(options: RateLimitOptions) {
  return async (request: NextRequest) => {
    const result = await rateLimit(request, options);

    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          retryAfter: result.retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": result.retryAfter?.toString() || "60",
            "X-RateLimit-Limit": result.limit.toString(),
            "X-RateLimit-Remaining": result.remaining.toString(),
            "X-RateLimit-Reset": result.resetTime.toString(),
          },
        }
      );
    }

    return null; // Continue to next middleware/handler
  };
}

/**
 * Rate limit configuration presets
 */
export const rateLimitPresets = {
  // Very strict - for sensitive operations
  strict: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  },

  // Standard - for regular API calls
  standard: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
  },

  // Generous - for high-frequency operations
  generous: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
  },

  // Per-user validation - for connection validation
  validation: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
  },
} as const;
