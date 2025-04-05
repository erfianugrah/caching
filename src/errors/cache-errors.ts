/**
 * Custom error classes for the caching service
 */

/**
 * Base class for all cache-related errors
 */
export class CacheError extends Error {
  /**
   * Create a new CacheError
   * @param message Error message
   * @param metadata Additional metadata about the error
   */
  constructor(message: string, public readonly metadata: Record<string, any> = {}) {
    super(message);
    this.name = 'CacheError';
    // Ensure prototype chain works correctly when extending Error
    Object.setPrototypeOf(this, CacheError.prototype);
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends CacheError {
  constructor(message: string, metadata: Record<string, any> = {}) {
    super(message, metadata);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Error thrown when there's an issue with cache operations
 */
export class CacheOperationError extends CacheError {
  constructor(message: string, metadata: Record<string, any> = {}) {
    super(message, metadata);
    this.name = 'CacheOperationError';
    Object.setPrototypeOf(this, CacheOperationError.prototype);
  }
}

/**
 * Error thrown when there's an issue with fetching resources
 */
export class FetchError extends CacheError {
  constructor(message: string, metadata: Record<string, any> = {}) {
    super(message, metadata);
    this.name = 'FetchError';
    Object.setPrototypeOf(this, FetchError.prototype);
  }
}

/**
 * Error thrown when a service is not found or cannot be initialized
 */
export class ServiceError extends CacheError {
  constructor(message: string, metadata: Record<string, any> = {}) {
    super(message, metadata);
    this.name = 'ServiceError';
    Object.setPrototypeOf(this, ServiceError.prototype);
  }
}

/**
 * Error thrown when there's an issue with cache tags
 */
export class CacheTagError extends CacheError {
  constructor(message: string, metadata: Record<string, any> = {}) {
    super(message, metadata);
    this.name = 'CacheTagError';
    Object.setPrototypeOf(this, CacheTagError.prototype);
  }
}

/**
 * Create an appropriate error response for the client
 * @param error The error that occurred
 * @param request The original request
 * @returns A Response object with appropriate status and headers
 */
export function createErrorResponse(error: unknown, request?: Request): Response {
  let status = 500;
  let message = 'Cache service error';
  const headers = new Headers({
    'Content-Type': 'text/plain',
    'Cache-Control': 'no-store'
  });
  
  // Add debugging information in headers if available
  if (request) {
    headers.set('X-Error-URL', request.url);
  }
  
  // Set appropriate status and message based on error type
  if (error instanceof CacheError) {
    headers.set('X-Error-Type', error.name);
    
    if (error instanceof ConfigurationError) {
      status = 500;
      message = 'Cache configuration error';
    } else if (error instanceof FetchError) {
      status = 502;
      message = 'Error fetching from origin';
    } else if (error instanceof ServiceError) {
      status = 500;
      message = 'Cache service initialization error';
    } else if (error instanceof CacheTagError) {
      status = 500;
      message = 'Cache tag error';
    }
  }
  
  return new Response(message, { 
    status,
    headers
  });
}