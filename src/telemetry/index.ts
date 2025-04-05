/**
 * Telemetry module for performance and cache metrics
 */

// Export all telemetry components
export * from './telemetry-service';
export * from './performance-metrics';
export * from './cache-analytics';
export * from './reporting-service';

// Export default instances
import { TelemetryService } from './telemetry-service';
import { CacheAnalyticsService } from './cache-analytics';
import { ReportingService } from './reporting-service';

// Default service instances for easy access
export const telemetry = TelemetryService.getInstance();
export const cacheAnalytics = CacheAnalyticsService.getInstance();
export const reporting = ReportingService.getInstance();

// Convenience function to initialize all telemetry services
export function initializeTelemetry(): void {
  // Access instances to ensure they are created
  TelemetryService.getInstance();
  CacheAnalyticsService.getInstance();
  ReportingService.getInstance();
}

// Default export for convenient imports
export default {
  telemetry,
  cacheAnalytics,
  reporting,
  initializeTelemetry
};