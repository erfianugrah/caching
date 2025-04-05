# Telemetry Module

This module provides comprehensive telemetry and analytics for the caching service.

## Overview

The telemetry module tracks performance metrics, cache operations, and generates reports for monitoring and optimization.

## Components

| Component | File | Description |
|-----------|------|-------------|
| Telemetry Service | `telemetry-service.ts` | Core service for tracking operation performance |
| Performance Metrics | `performance-metrics.ts` | Utilities for measuring operation durations |
| Cache Analytics | `cache-analytics.ts` | Tracking of cache hit/miss rates and performance |
| Reporting Service | `reporting-service.ts` | Generation of comprehensive telemetry reports |

## Usage Examples

### Basic Telemetry Tracking

```typescript
import { telemetry } from '../telemetry';

// Start tracking an operation
const operationId = 'unique-id';
telemetry.startOperation(
  operationId,
  'DefaultCachingStrategy',
  'image/jpeg',
  'image'
);

// Process the request
// ...

// End tracking with results
telemetry.endOperation(
  operationId,
  'DefaultCachingStrategy',
  'image/jpeg',
  'image',
  200, // HTTP status
  true, // Cache hit
  false // No error
);
```

### Using Performance Decorators

```typescript
import { measure } from '../telemetry/performance-metrics';

class SomeService {
  @measure(
    'VideoStrategy', // Strategy name
    'video/mp4',     // Content type
    'video'          // Asset type
  )
  async processVideo(request: Request): Promise<Response> {
    // Method implementation...
    return response;
  }
}
```

### Tracking Cache Operations

```typescript
import { cacheAnalytics, CacheOperation } from '../telemetry';

// Track a cache hit
cacheAnalytics.trackOperation(
  CacheOperation.HIT,
  'image',
  15 // Duration in ms
);

// Or track directly from a response
cacheAnalytics.trackFromResponse(
  response,
  'video',
  200 // Duration in ms
);
```

### Generating Reports

```typescript
import { reporting } from '../telemetry';

// Generate a complete report
const report = reporting.generateReport();
console.log(report);

// Generate a summary string
const summary = reporting.generateSummaryString();
console.log(summary);

// Schedule periodic reporting
const intervalId = reporting.schedulePeriodicReporting(
  60000, // Every minute
  (report) => {
    // Send to monitoring system, log, etc.
    console.log(report);
  }
);

// Later, stop reporting
clearInterval(intervalId);
```

## Integration with Strategies

To integrate telemetry with caching strategies, modify the strategy's `applyCaching` method:

```typescript
import { PerformanceTracker } from '../telemetry/performance-metrics';
import { cacheAnalytics } from '../telemetry';

applyCaching(response: Response, request: Request, config: AssetConfig): Response {
  // Create performance tracker
  const tracker = new PerformanceTracker(
    this.constructor.name,
    'image/jpeg',
    'image'
  );
  
  try {
    // Apply caching logic...
    
    // Track cache operation from response
    cacheAnalytics.trackFromResponse(newResponse, 'image');
    
    // End tracking
    tracker.end(newResponse.status, true, false);
    
    return newResponse;
  } catch (error) {
    // End tracking with error
    tracker.end(500, false, true);
    throw error;
  }
}
```

## Data Model

The telemetry system tracks:

1. **Performance Metrics**
   - Operation durations
   - Min/max/average times
   - Request counts

2. **Cache Analytics**
   - Hit/miss rates
   - Cache operation counts
   - Performance by cache status

3. **Detailed Breakdowns**
   - Metrics by strategy
   - Metrics by content type
   - Metrics by asset type
   - Metrics by status code