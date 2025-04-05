import { TelemetryService, TelemetryReport } from './telemetry-service';
import { CacheAnalyticsService, CacheAnalytics } from './cache-analytics';
import { logger } from '../utils/logger';

/**
 * Complete telemetry report including all metrics
 */
export interface CompleteTelemetryReport {
  timestamp: string;
  performanceMetrics: TelemetryReport;
  cacheAnalytics: CacheAnalytics;
}

/**
 * Options for report generation
 */
export interface ReportingOptions {
  includePerformance: boolean;
  includeCacheAnalytics: boolean;
  detailedBreakdown: boolean;
}

/**
 * Service for generating telemetry reports
 */
export class ReportingService {
  private static instance: ReportingService;
  private telemetryService: TelemetryService;
  private cacheAnalyticsService: CacheAnalyticsService;
  
  /**
   * Create a new reporting service
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.telemetryService = TelemetryService.getInstance();
    this.cacheAnalyticsService = CacheAnalyticsService.getInstance();
    logger.debug('ReportingService initialized');
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): ReportingService {
    if (!ReportingService.instance) {
      ReportingService.instance = new ReportingService();
    }
    return ReportingService.instance;
  }
  
  /**
   * Generate a complete telemetry report
   * @param options Report generation options
   * @returns The complete telemetry report
   */
  generateReport(options: ReportingOptions = {
    includePerformance: true,
    includeCacheAnalytics: true,
    detailedBreakdown: true
  }): CompleteTelemetryReport {
    const timestamp = new Date().toISOString();
    
    // Get performance metrics if requested
    const performanceMetrics = options.includePerformance
      ? this.telemetryService.generateReport()
      : undefined;
      
    // Get cache analytics if requested
    const cacheAnalytics = options.includeCacheAnalytics
      ? this.cacheAnalyticsService.getAnalytics()
      : undefined;
    
    // Remove detailed breakdowns if not requested
    if (performanceMetrics && !options.detailedBreakdown) {
      delete performanceMetrics.byStrategy;
      delete performanceMetrics.byContentType;
      delete performanceMetrics.byAssetType;
      delete performanceMetrics.byStatusCode;
    }
    
    if (cacheAnalytics && !options.detailedBreakdown) {
      delete cacheAnalytics.byAssetType;
    }
    
    return {
      timestamp,
      performanceMetrics,
      cacheAnalytics
    } as CompleteTelemetryReport;
  }
  
  /**
   * Reset all telemetry data
   */
  resetAll(): void {
    this.telemetryService.reset();
    this.cacheAnalyticsService.reset();
    logger.debug('All telemetry data reset');
  }
  
  /**
   * Schedule periodic reporting
   * @param intervalMs Interval in milliseconds
   * @param callback Function to call with the report
   * @returns Interval ID for clearing the interval
   */
  schedulePeriodicReporting(
    intervalMs: number,
    callback: (report: CompleteTelemetryReport) => void
  ): NodeJS.Timeout {
    logger.info('Scheduled periodic reporting', { intervalMs });
    
    return setInterval(() => {
      const report = this.generateReport();
      callback(report);
    }, intervalMs);
  }
  
  /**
   * Generate a summarized report as a string
   * @returns String representation of the report
   */
  generateSummaryString(): string {
    const report = this.generateReport({
      includePerformance: true,
      includeCacheAnalytics: true,
      detailedBreakdown: false
    });
    
    let summary = '';
    
    // Format timestamp
    summary += `Telemetry Report: ${report.timestamp}\n\n`;
    
    // Performance metrics
    if (report.performanceMetrics) {
      const perf = report.performanceMetrics;
      summary += `Performance Metrics:\n`;
      summary += `  Total Requests: ${perf.totalRequests}\n`;
      summary += `  Average Duration: ${perf.averageDuration.toFixed(2)}ms\n`;
      summary += `  Cache Hit Rate: ${(perf.cacheHitRate * 100).toFixed(2)}%\n`;
      summary += `  Error Rate: ${(perf.errorRate * 100).toFixed(2)}%\n\n`;
    }
    
    // Cache analytics
    if (report.cacheAnalytics) {
      const cache = report.cacheAnalytics;
      summary += `Cache Analytics:\n`;
      summary += `  Total Operations: ${cache.totalOperations}\n`;
      summary += `  Hit Rate: ${(cache.hitRate * 100).toFixed(2)}%\n`;
      summary += `  Miss Rate: ${(cache.missRate * 100).toFixed(2)}%\n`;
      summary += `  Average Hit Time: ${cache.averageHitTime.toFixed(2)}ms\n`;
      summary += `  Average Miss Time: ${cache.averageMissTime.toFixed(2)}ms\n`;
    }
    
    return summary;
  }
}