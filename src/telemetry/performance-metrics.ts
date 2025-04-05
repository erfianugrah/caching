import { TelemetryService } from './telemetry-service';
import { randomUUID } from 'node:crypto';

/**
 * Class for measuring performance of operations
 */
export class PerformanceTracker {
  private operationId: string;
  private startTime: number;
  private strategy: string;
  private contentType: string;
  private assetType: string;
  private telemetry: TelemetryService;
  
  /**
   * Create a new performance tracker
   * @param strategy Strategy being used
   * @param contentType Content type being processed
   * @param assetType Asset type being processed 
   */
  constructor(strategy: string, contentType: string, assetType: string) {
    this.operationId = randomUUID();
    this.startTime = performance.now();
    this.strategy = strategy;
    this.contentType = contentType;
    this.assetType = assetType;
    this.telemetry = TelemetryService.getInstance();
    
    // Register start with telemetry service
    this.telemetry.startOperation(
      this.operationId,
      this.strategy,
      this.contentType,
      this.assetType
    );
  }
  
  /**
   * End measurement and record metrics
   * @param status HTTP status code
   * @param cacheHit Whether the request was served from cache
   * @param error Whether an error occurred
   */
  end(status: number, cacheHit: boolean = false, error: boolean = false): void {
    this.telemetry.endOperation(
      this.operationId,
      this.strategy,
      this.contentType,
      this.assetType,
      status,
      cacheHit,
      error
    );
  }
  
  /**
   * Create a tracker and automatically measure execution time of a function
   * @param strategy Strategy being used
   * @param contentType Content type being processed
   * @param assetType Asset type being processed
   * @param fn Function to measure
   * @returns The result of the function
   */
  static async measure<T>(
    strategy: string,
    contentType: string,
    assetType: string,
    fn: () => Promise<{ result: T; status: number; cacheHit: boolean }>
  ): Promise<T> {
    const tracker = new PerformanceTracker(strategy, contentType, assetType);
    
    try {
      const { result, status, cacheHit } = await fn();
      tracker.end(status, cacheHit, false);
      return result;
    } catch (error) {
      tracker.end(500, false, true);
      throw error;
    }
  }
}

/**
 * Decorator for measuring method performance
 * @param strategy Strategy name or method to extract it
 * @param contentType Content type or method to extract it
 * @param assetType Asset type or method to extract it
 */
export function measure(
  strategy: string | ((instance: unknown, args: unknown[]) => string),
  contentType: string | ((instance: unknown, args: unknown[]) => string),
  assetType: string | ((instance: unknown, args: unknown[]) => string)
) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: unknown[]) {
      // Extract values or use functions to get them dynamically
      const strategyValue = typeof strategy === 'function' 
        ? strategy(this, args) 
        : strategy;
        
      const contentTypeValue = typeof contentType === 'function'
        ? contentType(this, args)
        : contentType;
        
      const assetTypeValue = typeof assetType === 'function'
        ? assetType(this, args)
        : assetType;
      
      // Create tracker
      const tracker = new PerformanceTracker(
        strategyValue,
        contentTypeValue,
        assetTypeValue
      );
      
      try {
        // Execute original method
        const result = await originalMethod.apply(this, args);
        
        // Determine status and cache hit
        let status = 200;
        let cacheHit = false;
        
        if (result instanceof Response) {
          status = result.status;
          cacheHit = result.headers.get('CF-Cache-Status') === 'HIT';
        }
        
        // End tracking
        tracker.end(status, cacheHit, false);
        return result as unknown;
      } catch (error) {
        // End tracking with error
        tracker.end(500, false, true);
        throw error;
      }
    };
    
    return descriptor;
  };
}