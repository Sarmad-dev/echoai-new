/**
 * Workflow Rate Limiter
 * 
 * Implements rate limiting for workflow executions to prevent system overload
 * and ensure fair resource usage across users and chatbots.
 */

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (userId: string, chatbotId?: string) => string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number; // seconds
}

export interface RateLimitEntry {
  count: number;
  resetTime: Date;
  firstRequest: Date;
}

export class WorkflowRateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig) {
    this.config = {
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: (userId: string, chatbotId?: string) => 
        chatbotId ? `${userId}:${chatbotId}` : userId,
      ...config
    };

    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Checks if a request is allowed under the rate limit
   */
  checkLimit(userId: string, chatbotId?: string): RateLimitResult {
    const key = this.config.keyGenerator(userId, chatbotId);
    const now = new Date();
    
    let entry = this.limits.get(key);
    
    // Create new entry if doesn't exist or window has expired
    if (!entry || now >= entry.resetTime) {
      entry = {
        count: 0,
        resetTime: new Date(now.getTime() + this.config.windowMs),
        firstRequest: now
      };
    }

    // Check if limit exceeded
    if (entry.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter: Math.ceil((entry.resetTime.getTime() - now.getTime()) / 1000)
      };
    }

    // Increment counter and update entry
    entry.count++;
    this.limits.set(key, entry);

    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetTime: entry.resetTime
    };
  }

  /**
   * Records a request completion (for conditional counting)
   */
  recordRequest(userId: string, success: boolean, chatbotId?: string): void {
    if (
      (success && this.config.skipSuccessfulRequests) ||
      (!success && this.config.skipFailedRequests)
    ) {
      // Decrement the count for skipped requests
      const key = this.config.keyGenerator(userId, chatbotId);
      const entry = this.limits.get(key);
      if (entry && entry.count > 0) {
        entry.count--;
        this.limits.set(key, entry);
      }
    }
  }

  /**
   * Gets current usage for a user/chatbot
   */
  getCurrentUsage(userId: string, chatbotId?: string): {
    count: number;
    remaining: number;
    resetTime: Date;
  } {
    const key = this.config.keyGenerator(userId, chatbotId);
    const entry = this.limits.get(key);
    const now = new Date();

    if (!entry || now >= entry.resetTime) {
      return {
        count: 0,
        remaining: this.config.maxRequests,
        resetTime: new Date(now.getTime() + this.config.windowMs)
      };
    }

    return {
      count: entry.count,
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetTime: entry.resetTime
    };
  }

  /**
   * Resets the rate limit for a specific user/chatbot
   */
  reset(userId: string, chatbotId?: string): void {
    const key = this.config.keyGenerator(userId, chatbotId);
    this.limits.delete(key);
  }

  /**
   * Gets all current rate limit entries (for monitoring)
   */
  getAllEntries(): Array<{
    key: string;
    count: number;
    remaining: number;
    resetTime: Date;
    firstRequest: Date;
  }> {
    const now = new Date();
    const entries: Array<{
      key: string;
      count: number;
      remaining: number;
      resetTime: Date;
      firstRequest: Date;
    }> = [];

    for (const [key, entry] of Array.from(this.limits.entries())) {
      if (now < entry.resetTime) {
        entries.push({
          key,
          count: entry.count,
          remaining: Math.max(0, this.config.maxRequests - entry.count),
          resetTime: entry.resetTime,
          firstRequest: entry.firstRequest
        });
      }
    }

    return entries.sort((a, b) => b.count - a.count);
  }

  /**
   * Updates the rate limit configuration
   */
  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Cleans up expired entries
   */
  private cleanup(): void {
    const now = new Date();
    for (const [key, entry] of Array.from(this.limits.entries())) {
      if (now >= entry.resetTime) {
        this.limits.delete(key);
      }
    }
  }
}

/**
 * Multi-tier rate limiter with different limits for different user types
 */
export class TieredRateLimiter {
  private limiters: Map<string, WorkflowRateLimiter> = new Map();
  private tierConfig: Map<string, RateLimitConfig>;

  constructor(tierConfigs: Record<string, RateLimitConfig>) {
    this.tierConfig = new Map(Object.entries(tierConfigs));
    
    // Initialize limiters for each tier
    for (const [tier, config] of Array.from(this.tierConfig.entries())) {
      this.limiters.set(tier, new WorkflowRateLimiter(config));
    }
  }

  /**
   * Checks rate limit based on user tier
   */
  checkLimit(
    userId: string, 
    userTier: string, 
    chatbotId?: string
  ): RateLimitResult {
    const limiter = this.limiters.get(userTier);
    
    if (!limiter) {
      // Default to most restrictive tier if tier not found
      const defaultLimiter = this.limiters.values().next().value;
      return defaultLimiter?.checkLimit(userId, chatbotId) || {
        allowed: false,
        remaining: 0,
        resetTime: new Date(),
        retryAfter: 60
      };
    }

    return limiter.checkLimit(userId, chatbotId);
  }

  /**
   * Records request completion
   */
  recordRequest(
    userId: string, 
    userTier: string, 
    chatbotId: string | undefined, 
    success: boolean
  ): void {
    const limiter = this.limiters.get(userTier);
    limiter?.recordRequest(userId, success, chatbotId);
  }

  /**
   * Gets usage across all tiers
   */
  getAllUsage(): Array<{
    tier: string;
    entries: Array<{
      key: string;
      count: number;
      remaining: number;
      resetTime: Date;
    }>;
  }> {
    const usage: Array<{
      tier: string;
      entries: Array<{
        key: string;
        count: number;
        remaining: number;
        resetTime: Date;
      }>;
    }> = [];

    for (const [tier, limiter] of Array.from(this.limiters.entries())) {
      usage.push({
        tier,
        entries: limiter.getAllEntries()
      });
    }

    return usage;
  }

  /**
   * Updates configuration for a specific tier
   */
  updateTierConfig(tier: string, config: RateLimitConfig): void {
    this.tierConfig.set(tier, config);
    this.limiters.set(tier, new WorkflowRateLimiter(config));
  }
}

/**
 * Adaptive rate limiter that adjusts limits based on system load
 */
export class AdaptiveRateLimiter extends WorkflowRateLimiter {
  private baseConfig: RateLimitConfig;
  private systemLoadThresholds: {
    low: number;    // < 30% load
    medium: number; // 30-70% load  
    high: number;   // > 70% load
  };
  private loadMultipliers: {
    low: number;    // Increase limits
    medium: number; // Normal limits
    high: number;   // Decrease limits
  };

  constructor(
    baseConfig: RateLimitConfig,
    options: {
      systemLoadThresholds?: typeof AdaptiveRateLimiter.prototype.systemLoadThresholds;
      loadMultipliers?: typeof AdaptiveRateLimiter.prototype.loadMultipliers;
    } = {}
  ) {
    super(baseConfig);
    this.baseConfig = baseConfig;
    
    this.systemLoadThresholds = {
      low: 0.3,
      medium: 0.7,
      high: 1.0,
      ...options.systemLoadThresholds
    };

    this.loadMultipliers = {
      low: 1.5,    // 50% more requests allowed
      medium: 1.0, // Normal limits
      high: 0.5,   // 50% fewer requests allowed
      ...options.loadMultipliers
    };

    // Update limits based on system load every 30 seconds
    setInterval(() => this.updateLimitsBasedOnLoad(), 30000);
  }

  /**
   * Gets current system load (simplified - in production use actual metrics)
   */
  private getCurrentSystemLoad(): number {
    // In production, this would integrate with actual system metrics
    // For now, simulate based on active executions and memory usage
    
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      const memoryLoad = memUsage.heapUsed / memUsage.heapTotal;
      
      // Simplified load calculation
      return Math.min(memoryLoad * 1.2, 1.0);
    }

    return 0.5; // Default moderate load
  }

  /**
   * Updates rate limits based on current system load
   */
  private updateLimitsBasedOnLoad(): void {
    const currentLoad = this.getCurrentSystemLoad();
    let multiplier: number;

    if (currentLoad < this.systemLoadThresholds.low) {
      multiplier = this.loadMultipliers.low;
    } else if (currentLoad < this.systemLoadThresholds.medium) {
      multiplier = this.loadMultipliers.medium;
    } else {
      multiplier = this.loadMultipliers.high;
    }

    // Update the configuration
    const newMaxRequests = Math.floor(this.baseConfig.maxRequests * multiplier);
    
    this.updateConfig({
      ...this.baseConfig,
      maxRequests: Math.max(1, newMaxRequests) // Ensure at least 1 request allowed
    });

    console.log(`Adaptive rate limiter: Load ${(currentLoad * 100).toFixed(1)}%, ` +
                `Multiplier ${multiplier}, Max requests: ${newMaxRequests}`);
  }
}

// Default rate limiters for different scenarios
export const defaultRateLimiters = {
  // Per-user limits
  perUser: new WorkflowRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,    // 100 executions per minute per user
    keyGenerator: (userId) => `user:${userId}`
  }),

  // Per-chatbot limits  
  perChatbot: new WorkflowRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50,     // 50 executions per minute per chatbot
    keyGenerator: (userId, chatbotId) => `chatbot:${chatbotId}`
  }),

  // Tiered limits based on user plan
  tiered: new TieredRateLimiter({
    free: {
      windowMs: 60 * 1000,
      maxRequests: 10, // 10 per minute for free users
    },
    pro: {
      windowMs: 60 * 1000,
      maxRequests: 100, // 100 per minute for pro users
    },
    enterprise: {
      windowMs: 60 * 1000,
      maxRequests: 1000, // 1000 per minute for enterprise
    }
  }),

  // Adaptive limiter that responds to system load
  adaptive: new AdaptiveRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 50, // Base limit
  })
};