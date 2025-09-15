import { SlackChannelOption, SlackUserOption, SlackConnectionResponse } from '@/types/slack';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface SlackCacheConfig {
  connectionTTL: number; // 5 minutes
  channelsTTL: number;   // 15 minutes
  usersTTL: number;      // 30 minutes
  maxEntries: number;    // Maximum cache entries
}

const DEFAULT_CACHE_CONFIG: SlackCacheConfig = {
  connectionTTL: 5 * 60 * 1000,      // 5 minutes
  channelsTTL: 15 * 60 * 1000,       // 15 minutes
  usersTTL: 30 * 60 * 1000,          // 30 minutes
  maxEntries: 100
};

/**
 * In-memory cache for Slack data with TTL support
 */
export class SlackCache {
  private static instance: SlackCache;
  private cache = new Map<string, CacheEntry<any>>();
  private config: SlackCacheConfig;

  private constructor(config: Partial<SlackCacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    
    // Clean up expired entries periodically
    setInterval(() => this.cleanup(), 60000); // Every minute
  }

  static getInstance(config?: Partial<SlackCacheConfig>): SlackCache {
    if (!SlackCache.instance) {
      SlackCache.instance = new SlackCache(config);
    }
    return SlackCache.instance;
  }

  /**
   * Generate cache key for different data types
   */
  private generateKey(type: 'connection' | 'channels' | 'users', integrationId?: string): string {
    const baseKey = integrationId ? `${type}:${integrationId}` : type;
    return baseKey;
  }

  /**
   * Set cache entry with appropriate TTL
   */
  private set<T>(key: string, data: T, ttl: number): void {
    // Enforce max entries limit
    if (this.cache.size >= this.config.maxEntries) {
      this.evictOldest();
    }

    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl
    });
  }

  /**
   * Get cache entry if not expired
   */
  private get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Cache connection status
   */
  setConnection(data: SlackConnectionResponse, integrationId?: string): void {
    const key = this.generateKey('connection', integrationId);
    this.set(key, data, this.config.connectionTTL);
  }

  /**
   * Get cached connection status
   */
  getConnection(integrationId?: string): SlackConnectionResponse | null {
    const key = this.generateKey('connection', integrationId);
    return this.get<SlackConnectionResponse>(key);
  }

  /**
   * Cache channels data
   */
  setChannels(data: SlackChannelOption[], integrationId?: string): void {
    const key = this.generateKey('channels', integrationId);
    this.set(key, data, this.config.channelsTTL);
  }

  /**
   * Get cached channels data
   */
  getChannels(integrationId?: string): SlackChannelOption[] | null {
    const key = this.generateKey('channels', integrationId);
    return this.get<SlackChannelOption[]>(key);
  }

  /**
   * Cache users data
   */
  setUsers(data: SlackUserOption[], integrationId?: string): void {
    const key = this.generateKey('users', integrationId);
    this.set(key, data, this.config.usersTTL);
  }

  /**
   * Get cached users data
   */
  getUsers(integrationId?: string): SlackUserOption[] | null {
    const key = this.generateKey('users', integrationId);
    return this.get<SlackUserOption[]>(key);
  }

  /**
   * Check if data is available in cache (even if stale)
   */
  hasStaleData(type: 'connection' | 'channels' | 'users', integrationId?: string): boolean {
    const key = this.generateKey(type, integrationId);
    return this.cache.has(key);
  }

  /**
   * Get stale data (ignoring expiration)
   */
  getStaleData<T>(type: 'connection' | 'channels' | 'users', integrationId?: string): T | null {
    const key = this.generateKey(type, integrationId);
    const entry = this.cache.get(key);
    return entry ? entry.data : null;
  }

  /**
   * Clear specific cache entry
   */
  clear(type: 'connection' | 'channels' | 'users', integrationId?: string): void {
    const key = this.generateKey(type, integrationId);
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Clear cache for specific integration
   */
  clearIntegration(integrationId: string): void {
    const keysToDelete = Array.from(this.cache.keys()).filter(key => 
      key.includes(integrationId)
    );
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalEntries: number;
    expiredEntries: number;
    cacheHitRate: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    const now = Date.now();
    let expiredCount = 0;
    let oldestTimestamp = Infinity;
    let newestTimestamp = 0;

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expiredCount++;
      }
      
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
      
      if (entry.timestamp > newestTimestamp) {
        newestTimestamp = entry.timestamp;
      }
    }

    return {
      totalEntries: this.cache.size,
      expiredEntries: expiredCount,
      cacheHitRate: this.cache.size > 0 ? (this.cache.size - expiredCount) / this.cache.size : 0,
      oldestEntry: oldestTimestamp !== Infinity ? new Date(oldestTimestamp) : undefined,
      newestEntry: newestTimestamp > 0 ? new Date(newestTimestamp) : undefined
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.debug(`Cleaned up ${keysToDelete.length} expired cache entries`);
    }
  }

  /**
   * Evict oldest entry when cache is full
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.debug(`Evicted oldest cache entry: ${oldestKey}`);
    }
  }
}

/**
 * Enhanced SlackConnectionUtils with caching support
 */
export class CachedSlackConnectionUtils {
  private static cache = SlackCache.getInstance();

  /**
   * Check connection with caching
   */
  static async checkConnectionCached(integrationId?: string, useStaleOnError = true): Promise<SlackConnectionResponse> {
    // Try to get from cache first
    const cached = this.cache.getConnection(integrationId);
    if (cached) {
      return cached;
    }

    try {
      // Import SlackConnectionUtils dynamically to avoid circular dependency
      const { SlackConnectionUtils } = await import('./slack-utils');
      const response = await SlackConnectionUtils.checkConnection();
      
      // Cache successful responses
      if (response.connected) {
        this.cache.setConnection(response, integrationId);
      }
      
      return response;
    } catch (error) {
      // On error, try to use stale data if available and requested
      if (useStaleOnError) {
        const staleData = this.cache.getStaleData<SlackConnectionResponse>('connection', integrationId);
        if (staleData) {
          console.warn('Using stale connection data due to error:', error);
          return {
            ...staleData,
            error: 'Using cached data due to connection error',
            errorType: 'network_error'
          };
        }
      }
      
      throw error;
    }
  }

  /**
   * Load channels with caching
   */
  static async loadChannelsCached(integrationId?: string, useStaleOnError = true): Promise<SlackChannelOption[]> {
    // Try to get from cache first
    const cached = this.cache.getChannels(integrationId);
    if (cached) {
      return cached;
    }

    try {
      // Import SlackConnectionUtils dynamically to avoid circular dependency
      const { SlackConnectionUtils } = await import('./slack-utils');
      const channels = await SlackConnectionUtils.loadChannels();
      
      // Cache the results
      this.cache.setChannels(channels, integrationId);
      
      return channels;
    } catch (error) {
      // On error, try to use stale data if available and requested
      if (useStaleOnError) {
        const staleData = this.cache.getStaleData<SlackChannelOption[]>('channels', integrationId);
        if (staleData) {
          console.warn('Using stale channels data due to error:', error);
          return staleData;
        }
      }
      
      throw error;
    }
  }

  /**
   * Load users with caching
   */
  static async loadUsersCached(integrationId?: string, useStaleOnError = true): Promise<SlackUserOption[]> {
    // Try to get from cache first
    const cached = this.cache.getUsers(integrationId);
    if (cached) {
      return cached;
    }

    try {
      // Import SlackConnectionUtils dynamically to avoid circular dependency
      const { SlackConnectionUtils } = await import('./slack-utils');
      const users = await SlackConnectionUtils.loadUsers();
      
      // Cache the results
      this.cache.setUsers(users, integrationId);
      
      return users;
    } catch (error) {
      // On error, try to use stale data if available and requested
      if (useStaleOnError) {
        const staleData = this.cache.getStaleData<SlackUserOption[]>('users', integrationId);
        if (staleData) {
          console.warn('Using stale users data due to error:', error);
          return staleData;
        }
      }
      
      throw error;
    }
  }

  /**
   * Clear cache for integration
   */
  static clearCache(integrationId?: string): void {
    if (integrationId) {
      this.cache.clearIntegration(integrationId);
    } else {
      this.cache.clearAll();
    }
  }

  /**
   * Get cache statistics
   */
  static getCacheStats() {
    return this.cache.getStats();
  }
}