/**
 * Database Service for Server-Side Operations
 * 
 * Provides a centralized service for database operations using Supabase
 * with proper error handling and type safety.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './database';

export class DatabaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: any,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class DatabaseService {
  private client: ReturnType<typeof createClient<Database>> | null = null;

  /**
   * Get the Supabase client instance (lazy-loaded)
   */
  getClient() {
    if (!this.client) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceRoleKey) {
        throw new DatabaseError(
          'Missing Supabase configuration',
          'CONFIGURATION_ERROR',
          undefined,
          { 
            hasUrl: !!supabaseUrl, 
            hasServiceKey: !!serviceRoleKey 
          }
        );
      }

      this.client = createClient<Database>(supabaseUrl, serviceRoleKey);
    }
    return this.client;
  }

  /**
   * Execute a database operation with comprehensive error handling
   */
  async executeQuery<T>(
    operation: () => Promise<{ data: T | null; error: any }>,
    context?: string
  ): Promise<T> {
    try {
      const { data, error } = await operation();
      
      console.log(`Database query result for ${context}:`, { data, error });
      
      if (error) {
        throw this.createDatabaseError(error, context);
      }
      
      // For array results, null should be treated as empty array
      if (data === null) {
        // Check if this is likely an array query based on context
        if (context && (context.includes('list') || context.includes('List'))) {
          console.log(`Treating null result as empty array for ${context}`);
          return [] as unknown as T;
        }
        
        throw new DatabaseError(
          'No data returned from database operation',
          'NO_DATA_RETURNED',
          undefined,
          { context }
        );
      }
      
      return data;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      
      // Handle unexpected errors
      console.error('Unexpected database error:', error);
      throw new DatabaseError(
        'Unexpected database error occurred',
        'UNEXPECTED_ERROR',
        error,
        { context }
      );
    }
  }

  /**
   * Execute a database operation that may return null (for optional results)
   */
  async executeOptionalQuery<T>(
    operation: () => Promise<{ data: T | null; error: any }>,
    context?: string
  ): Promise<T | null> {
    try {
      const { data, error } = await operation();
      
      if (error) {
        throw this.createDatabaseError(error, context);
      }
      
      return data;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      
      // Handle unexpected errors
      console.error('Unexpected database error:', error);
      throw new DatabaseError(
        'Unexpected database error occurred',
        'UNEXPECTED_ERROR',
        error,
        { context }
      );
    }
  }

  /**
   * Create a structured database error from Supabase error
   */
  private createDatabaseError(error: any, context?: string): DatabaseError {
    console.error('Database operation failed:', error, { context });

    // Handle specific Supabase error codes
    if (error.code) {
      switch (error.code) {
        case '23505': // Unique constraint violation
          return new DatabaseError(
            'A record with this information already exists',
            'DUPLICATE_RECORD',
            error,
            { context, constraint: error.constraint }
          );
        
        case '23503': // Foreign key constraint violation
          return new DatabaseError(
            'Referenced record does not exist',
            'FOREIGN_KEY_VIOLATION',
            error,
            { context, constraint: error.constraint }
          );
        
        case '23502': // Not null constraint violation
          return new DatabaseError(
            'Required field is missing',
            'MISSING_REQUIRED_FIELD',
            error,
            { context, column: error.column }
          );
        
        case '42501': // Insufficient privilege
          return new DatabaseError(
            'Insufficient permissions for this operation',
            'PERMISSION_DENIED',
            error,
            { context }
          );
        
        case 'PGRST116': // No rows found (PostgREST specific)
          return new DatabaseError(
            'Record not found',
            'RECORD_NOT_FOUND',
            error,
            { context }
          );
        
        default:
          return new DatabaseError(
            `Database operation failed: ${error.message}`,
            'DATABASE_ERROR',
            error,
            { context, code: error.code }
          );
      }
    }

    // Handle network/connection errors
    if (error.message?.includes('fetch')) {
      return new DatabaseError(
        'Database connection failed',
        'CONNECTION_ERROR',
        error,
        { context }
      );
    }

    // Generic database error
    return new DatabaseError(
      `Database error: ${error.message || 'Unknown error'}`,
      'DATABASE_ERROR',
      error,
      { context }
    );
  }
}

// Singleton instance
export const databaseService = new DatabaseService();