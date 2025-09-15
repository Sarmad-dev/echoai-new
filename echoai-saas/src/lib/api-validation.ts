/**
 * Validation utilities for API routes
 * These functions help ensure proper request/response validation and sanitization
 */

import { z } from 'zod';

// Common validation schemas
export const apiKeySchema = z.string().min(1, 'API key is required');

export const urlSchema = z.string().url({ message: 'Invalid URL format' });

export const fileSchema = z.object({
  name: z.string(),
  size: z.number().positive('File size must be positive'),
  type: z.string().refine(
    (type) => ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(type),
    'File must be PDF or DOCX'
  ),
});

export const messageSchema = z.string()
  .min(1, 'Message cannot be empty')
  .max(1000, 'Message too long')
  .refine(
    (message) => message.trim().length > 0,
    'Message cannot be only whitespace'
  );

// Request validation schemas
export const trainRequestSchema = z.object({
  urls: z.array(urlSchema).optional(),
  files: z.array(fileSchema).optional(),
  instructions: z.string().max(5000, 'Instructions too long').optional(),
  chatbotId: z.string().min(1, 'Chatbot ID is required').optional(),
  replaceExisting: z.boolean().optional(),
}).refine(
  (data) => (data.urls && data.urls.length > 0) || (data.files && data.files.length > 0) || (data.instructions && data.instructions.trim().length > 0),
  'At least one URL, file, or instruction must be provided'
);

export const chatRequestSchema = z.object({
  message: messageSchema,
  apiKey: apiKeySchema,
  conversationId: z.string().regex(/^conv_[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/, { message: 'Invalid conversation ID format' }).optional().nullable(),
  chatbotId: z.string().min(1, 'Chatbot ID is required').optional(),
  userEmail: z.string().email('Invalid email format').optional(),
});

// Response validation schemas
export const trainResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  documentsProcessed: z.number().nonnegative(),
  instructionsProcessed: z.number().nonnegative().optional(),
  embeddingsGenerated: z.number().nonnegative().optional(),
});

export const chatResponseSchema = z.object({
  response: z.string(),
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  conversationId: z.string().regex(/^conv_[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/, { message: 'Invalid conversation ID format' }),
});

// Error response schema
export const errorResponseSchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
});

/**
 * Sanitize user input to prevent XSS and other attacks
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Validate and sanitize a message
 */
export function validateAndSanitizeMessage(message: string): string {
  const sanitized = sanitizeInput(message);
  return messageSchema.parse(sanitized);
}

/**
 * Validate API key format (basic validation)
 */
export function validateApiKey(apiKey: string): boolean {
  try {
    apiKeySchema.parse(apiKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate URL format
 */
export function validateUrl(url: string): boolean {
  try {
    urlSchema.parse(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate file type and size
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  try {
    fileSchema.parse({
      name: file.name,
      size: file.size,
      type: file.type,
    });
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        valid: false, 
        error: error.issues.map(issue => issue.message).join(', ')
      };
    }
    return { valid: false, error: 'Invalid file' };
  }
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  message: string, 
  status: number = 500, 
  details?: unknown
): Response {
  return new Response(
    JSON.stringify({
      error: message,
      details,
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Create standardized success response
 */
export function createSuccessResponse<T>(data: T, status: number = 200): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Rate limiting helper (basic implementation)
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    
    return true;
  }

  getRemainingRequests(identifier: string): number {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    return Math.max(0, this.maxRequests - validRequests.length);
  }
}

// Export singleton rate limiter instances
export const chatRateLimiter = new RateLimiter(50, 60000); // 50 requests per minute
export const trainRateLimiter = new RateLimiter(10, 60000); // 10 requests per minute