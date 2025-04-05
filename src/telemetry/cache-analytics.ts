import { logger } from '../utils/logger';

/**
 * Cache operation types
 */
export enum CacheOperation {
  HIT = 'hit',
  MISS = 'miss',
  EXPIRED = 'expired',
  BYPASS = 'bypass',
  ERROR = 'error'
}

/**
 * Cache analytics metrics
 */
export interface CacheAnalytics {
  // Overall metrics
  totalOperations: number;
  hitRate: number;
  missRate: number;
  errorRate: number;
  
  // Operation counts
  hits: number;
  misses: number;
  expired: number;
  bypass: number;
  errors: number;
  
  // Metrics by type (optional for flexible reporting)
  byAssetType?: Record<string, {
    operations: number;
    hitRate: number;
    missRate: number;
  }>;
  
  // Time-based metrics
  averageHitTime: number;
  averageMissTime: number;
}

/**
 * Service for tracking cache performance metrics
 */
export class CacheAnalyticsService {
  private static instance: CacheAnalyticsService;
  
  // Overall counters
  private totalOperations = 0;
  private hits = 0;
  private misses = 0;
  private expired = 0;
  private bypass = 0;
  private errors = 0;
  
  // Timing data
  private hitTimes: number[] = [];
  private missTimes: number[] = [];
  
  // Metrics by asset type
  private assetTypeMetrics: Map<string, {
    operations: number;
    hits: number;
    misses: number;
  }> = new Map();
  
  /**
   * Create a new cache analytics service
   * Private constructor for singleton pattern
   */
  private constructor() {
    logger.debug('CacheAnalyticsService initialized');
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): CacheAnalyticsService {
    if (!CacheAnalyticsService.instance) {
      CacheAnalyticsService.instance = new CacheAnalyticsService();
    }
    return CacheAnalyticsService.instance;
  }
  
  /**
   * Track a cache operation
   * @param operation The cache operation (hit, miss, etc.)
   * @param assetType The type of asset
   * @param duration The operation duration in ms
   */
  trackOperation(operation: CacheOperation, assetType: string, duration?: number): void {
    this.totalOperations++;
    
    // Update overall counters
    switch (operation) {
      case CacheOperation.HIT:
        this.hits++;
        if (duration !== undefined) {
          this.hitTimes.push(duration);
        }
        break;
      case CacheOperation.MISS:
        this.misses++;
        if (duration !== undefined) {
          this.missTimes.push(duration);
        }
        break;
      case CacheOperation.EXPIRED:
        this.expired++;
        break;
      case CacheOperation.BYPASS:
        this.bypass++;
        break;
      case CacheOperation.ERROR:
        this.errors++;
        break;
    }
    
    // Update asset type metrics
    if (!this.assetTypeMetrics.has(assetType)) {
      this.assetTypeMetrics.set(assetType, {
        operations: 0,
        hits: 0,
        misses: 0
      });
    }
    
    const metrics = this.assetTypeMetrics.get(assetType)!;
    metrics.operations++;
    
    if (operation === CacheOperation.HIT) {
      metrics.hits++;
    } else if (operation === CacheOperation.MISS) {
      metrics.misses++;
    }
    
    this.assetTypeMetrics.set(assetType, metrics);
    
    logger.debug('Cache operation tracked', {
      operation,
      assetType,
      duration
    });
  }
  
  /**
   * Track cache operation from a response
   * @param response The response to analyze
   * @param assetType The type of asset
   * @param duration The operation duration in ms
   */
  trackFromResponse(response: Response, assetType: string, duration?: number): void {
    const cacheStatus = response.headers.get('CF-Cache-Status');
    
    let operation: CacheOperation;
    switch (cacheStatus) {
      case 'HIT':
        operation = CacheOperation.HIT;
        break;
      case 'MISS':
        operation = CacheOperation.MISS;
        break;
      case 'EXPIRED':
        operation = CacheOperation.EXPIRED;
        break;
      case 'BYPASS':
        operation = CacheOperation.BYPASS;
        break;
      case 'ERROR':
        operation = CacheOperation.ERROR;
        break;
      default:
        // If no cache status, assume it's a miss
        operation = CacheOperation.MISS;
    }
    
    this.trackOperation(operation, assetType, duration);
  }
  
  /**
   * Get cache analytics metrics
   * @returns Analytics data
   */
  getAnalytics(): CacheAnalytics {
    const hitRate = this.totalOperations > 0 ? this.hits / this.totalOperations : 0;
    const missRate = this.totalOperations > 0 ? this.misses / this.totalOperations : 0;
    const errorRate = this.totalOperations > 0 ? this.errors / this.totalOperations : 0;
    
    // Calculate average times
    const avgHitTime = this.hitTimes.length > 0 
      ? this.hitTimes.reduce((sum, time) => sum + time, 0) / this.hitTimes.length
      : 0;
      
    const avgMissTime = this.missTimes.length > 0
      ? this.missTimes.reduce((sum, time) => sum + time, 0) / this.missTimes.length
      : 0;
    
    // Format asset type metrics
    const byAssetType: Record<string, { operations: number; hitRate: number; missRate: number }> = {};
    
    this.assetTypeMetrics.forEach((metrics, assetType) => {
      byAssetType[assetType] = {
        operations: metrics.operations,
        hitRate: metrics.operations > 0 ? metrics.hits / metrics.operations : 0,
        missRate: metrics.operations > 0 ? metrics.misses / metrics.operations : 0
      };
    });
    
    return {
      totalOperations: this.totalOperations,
      hitRate,
      missRate,
      errorRate,
      hits: this.hits,
      misses: this.misses,
      expired: this.expired,
      bypass: this.bypass,
      errors: this.errors,
      byAssetType,
      averageHitTime: avgHitTime,
      averageMissTime: avgMissTime
    };
  }
  
  /**
   * Reset analytics data
   */
  reset(): void {
    this.totalOperations = 0;
    this.hits = 0;
    this.misses = 0;
    this.expired = 0;
    this.bypass = 0;
    this.errors = 0;
    
    this.hitTimes = [];
    this.missTimes = [];
    this.assetTypeMetrics.clear();
    
    logger.debug('Cache analytics reset');
  }
}