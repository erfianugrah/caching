# Logging System

This directory contains utilities for the caching service, including the logging system.

## Pino Logger

The caching service uses [Pino](https://getpino.io) for high-performance, structured logging. Pino provides JSON-based logging with minimal overhead, making it ideal for production environments.

### Configuration

The logger is configured in `logger.ts` and reads the following environment variables:

- `LOG_LEVEL`: Sets the minimum log level ('DEBUG', 'INFO', 'WARN', 'ERROR'). Defaults to 'INFO'.
- `ENVIRONMENT`: The environment name included in all logs. Defaults to 'development'.

These values are set in the `wrangler.jsonc` file under each environment.

### Usage

Import the logger from `utils/logger.ts`:

```typescript
import { logger } from '../utils/logger';

// Basic logging
logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message');

// Structured logging with additional data
logger.info('User logged in', { userId: '123', timestamp: Date.now() });

// Error logging
try {
  // Some code that might throw
} catch (error) {
  logger.error('Operation failed', { error });
}

// Child loggers with context
const requestLogger = logger.child({ requestId: '456', path: '/api/users' });
requestLogger.info('Request received'); // Includes the requestId and path

// Request/Response logging
// This returns a child logger with request context
const reqLogger = logger.logRequest(request, { source: 'api' });

// Later, log the response
logger.logResponse(response, request, {
  duration: 125, // ms
  cached: true,
  assetType: 'image'
});

// Performance measurements
const perf = logger.performance('database-query');
perf.start();
// ... perform operation
perf.end({ records: 42, table: 'users' });
```

### Log Format

Logs are output in JSON format. Examples:

#### Basic Log Entry
```json
{
  "level": "INFO",
  "time": "2025-04-09T14:30:00.000Z",
  "environment": "development",
  "service": "caching-service",
  "worker": "caching",
  "version": "1.0.0",
  "msg": "Cache hit for asset"
}
```

#### Request Log Entry
```json
{
  "level": "INFO",
  "time": "2025-04-09T14:30:00.000Z",
  "environment": "production",
  "service": "caching-service",
  "worker": "caching",
  "requestId": "7fa8c5e934d2",
  "method": "GET",
  "url": "https://jellyfin.erfianugrah.com/Items/7cedf2b1686cba4731cfcf37f124192e/Images/Primary",
  "urlParts": {
    "protocol": "https:",
    "hostname": "jellyfin.erfianugrah.com",
    "pathname": "/Items/7cedf2b1686cba4731cfcf37f124192e/Images/Primary",
    "search": "?fillHeight=375&fillWidth=255&quality=96&tag=8f08adc2ff69ed3b4df7a56dce689ddd"
  },
  "msg": "Request received"
}
```

#### Response Log Entry
```json
{
  "level": "INFO",
  "time": "2025-04-09T14:30:01.235Z",
  "environment": "production", 
  "service": "caching-service",
  "worker": "caching",
  "requestId": "7fa8c5e934d2",
  "method": "GET",
  "url": "https://jellyfin.erfianugrah.com/Items/7cedf2b1686cba4731cfcf37f124192e/Images/Primary",
  "status": 200,
  "duration": 125,
  "cached": true,
  "cacheHit": true,
  "contentType": "image/jpeg",
  "contentLength": "24681",
  "assetType": "image",
  "msg": "GET https://jellyfin.erfianugrah.com/Items/7cedf2b1686cba4731cfcf37f124192e/Images/Primary - Ok"
}
```

#### Performance Measurement
```json
{
  "level": "DEBUG",
  "time": "2025-04-09T14:30:01.240Z",
  "environment": "production",
  "service": "caching-service",
  "operation": "image-transformation",
  "duration": "45.23ms",
  "durationMs": 45,
  "width": 255,
  "height": 375,
  "format": "jpeg",
  "msg": "Operation completed: image-transformation"
}
```

### Benefits

- **Performance**: Pino is designed for high-performance logging with minimal overhead
- **JSON Logging**: All logs are structured JSON for better parsing and analysis
- **Request Tracking**: Track requests with unique IDs through the entire lifecycle
- **URL Parsing**: Automatic URL parsing for better filtering and analysis
- **Performance Measurement**: Easy timing of operations with detailed metrics
- **Context Binding**: Create child loggers with bound context for tracing
- **Error Handling**: Automatic serialization of error objects with stack traces
- **Security**: Automatic filtering of sensitive headers and data
- **Pretty Printing**: Developer-friendly formatting in debug mode

### Advanced Usage

For advanced use cases, you can directly access the Pino logger instance through a child logger wrapper.

```typescript
// Create a wrapper with additional context that will be included in all logs
const wrapper = logger.child({
  module: 'cache-service',
  version: '1.0.0'
});

// All logs from this wrapper will include the module and version properties
wrapper.info('Cache hit for asset', { asset: 'image.jpg' });
```