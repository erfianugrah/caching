import { logger } from '../utils/logger';

/**
 * Metrics for a specific operation or content type
 */
export interface PerformanceMetrics {
  // Timing metrics
  totalDuration: number;
  count: number;
  min: number;
  max: number;
  
  // Cache performance
  cacheHits: number;
  cacheMisses: number;
  
  // Error metrics
  errors: number;
}

/**
 * Telemetry report structure
 */
export interface TelemetryReport {
  // Overall metrics
  totalRequests: number;
  averageDuration: number;
  cacheHitRate: number;
  errorRate: number;
  
  // Metrics by category (optional for flexible reporting)
  byStrategy?: Record<string, PerformanceMetrics>;
  byContentType?: Record<string, PerformanceMetrics>;
  byAssetType?: Record<string, PerformanceMetrics>;
  byStatusCode?: Record<string, number>;
}

/**
 * Service for collecting and reporting telemetry data
 */
export class TelemetryService {
  private static instance: TelemetryService;
  
  // Metrics storage
  private strategyMetrics: Map<string, PerformanceMetrics> = new Map();
  private contentTypeMetrics: Map<string, PerformanceMetrics> = new Map();
  private assetTypeMetrics: Map<string, PerformanceMetrics> = new Map();
  private statusCodes: Map<number, number> = new Map();
  
  // Overall counters
  private totalRequests = 0;
  private totalDuration = 0;
  private totalCacheHits = 0;
  private totalCacheMisses = 0;
  private totalErrors = 0;
  
  // Performance tracking
  private activeOperations: Map<string, number> = new Map();
  
  /**
   * Create a new telemetry service
   * Private constructor for singleton pattern
   */
  private constructor() {
    logger.debug('TelemetryService initialized');
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }
  
  /**
   * Track the start of a strategy operation
   * @param operationId Unique ID for this operation
   * @param strategy Strategy name
   * @param contentType Content type being processed
   * @param assetType Asset type being processed
   */
  startOperation(operationId: string, strategy: string, contentType: string, assetType: string): void {
    this.activeOperations.set(operationId, performance.now());
    
    this.totalRequests++;
    
    logger.debug('Operation started', { 
      operationId, 
      strategy, 
      contentType,
      assetType
    });
  }
  
  /**
   * Track the end of a strategy operation
   * @param operationId Unique ID for this operation
   * @param strategy Strategy name
   * @param contentType Content type being processed
   * @param assetType Asset type being processed
   * @param status Response status code
   * @param cacheHit Whether the request was served from cache
   * @param error Whether an error occurred
   */
  endOperation(
    operationId: string, 
    strategy: string, 
    contentType: string, 
    assetType: string,
    status: number,
    cacheHit: boolean = false,
    error: boolean = false
  ): void {
    // Get operation start time
    const startTime = this.activeOperations.get(operationId);
    if (!startTime) {
      logger.warn('Cannot end operation that was not started', { operationId });
      return;
    }
    
    // Calculate duration
    const endTime = performance.now();
    const duration = endTime - startTime;
    this.activeOperations.delete(operationId);
    
    // Track overall metrics
    this.totalDuration += duration;
    if (cacheHit) {
      this.totalCacheHits++;
    } else {
      this.totalCacheMisses++;
    }
    if (error) {
      this.totalErrors++;
    }
    
    // Track status code
    this.incrementMapCounter(this.statusCodes, status);
    
    // Track by strategy
    this.updateMetrics(this.strategyMetrics, strategy, duration, cacheHit, error);
    
    // Track by content type
    this.updateMetrics(this.contentTypeMetrics, contentType, duration, cacheHit, error);
    
    // Track by asset type
    this.updateMetrics(this.assetTypeMetrics, assetType, duration, cacheHit, error);
    
    logger.debug('Operation completed', { 
      operationId, 
      duration,
      strategy,
      status,
      cacheHit
    });
  }
  
  /**
   * Get a full telemetry report
   * @returns Telemetry report with all metrics
   */
  generateReport(): TelemetryReport {
    const totalRequests = this.totalRequests;
    const averageDuration = totalRequests > 0 ? this.totalDuration / totalRequests : 0;
    const cacheHitRate = totalRequests > 0 ? this.totalCacheHits / totalRequests : 0;
    const errorRate = totalRequests > 0 ? this.totalErrors / totalRequests : 0;
    
    return {
      totalRequests,
      averageDuration,
      cacheHitRate,
      errorRate,
      byStrategy: this.mapToRecord(this.strategyMetrics),
      byContentType: this.mapToRecord(this.contentTypeMetrics),
      byAssetType: this.mapToRecord(this.assetTypeMetrics),
      byStatusCode: this.mapToRecord(this.statusCodes)
    };
  }
  
  /**
   * Clear all telemetry data
   */
  reset(): void {
    this.strategyMetrics.clear();
    this.contentTypeMetrics.clear();
    this.assetTypeMetrics.clear();
    this.statusCodes.clear();
    this.activeOperations.clear();
    
    this.totalRequests = 0;
    this.totalDuration = 0;
    this.totalCacheHits = 0;
    this.totalCacheMisses = 0;
    this.totalErrors = 0;
    
    logger.debug('Telemetry metrics reset');
  }
  
  /**
   * Update metrics for a specific category
   */
  private updateMetrics(
    metricsMap: Map<string, PerformanceMetrics>,
    key: string,
    duration: number,
    cacheHit: boolean,
    error: boolean
  ): void {
    // Use a default empty metrics object if not yet in the map
    if (!metricsMap.has(key)) {
      metricsMap.set(key, {
        totalDuration: 0,
        count: 0,
        min: Infinity,
        max: 0,
        cacheHits: 0,
        cacheMisses: 0,
        errors: 0
      });
    }
    
    // Get and update metrics
    const metrics = metricsMap.get(key)!;
    metrics.totalDuration += duration;
    metrics.count++;
    metrics.min = Math.min(metrics.min, duration);
    metrics.max = Math.max(metrics.max, duration);
    
    if (cacheHit) {
      metrics.cacheHits++;
    } else {
      metrics.cacheMisses++;
    }
    
    if (error) {
      metrics.errors++;
    }
    
    // Save updated metrics
    metricsMap.set(key, metrics);
  }
  
  /**
   * Increment a counter in a map
   */
  private incrementMapCounter<T>(map: Map<T, number>, key: T): void {
    const currentValue = map.get(key) || 0;
    map.set(key, currentValue + 1);
  }
  
  /**
   * Convert a map to a plain object record
   */
  private mapToRecord<T>(map: Map<string | number, T>): Record<string, T> {
    return Array.from(map.entries()).reduce((obj, [key, value]) => {
      obj[String(key)] = value;
      return obj;
    }, {} as Record<string, T>);
  }
}