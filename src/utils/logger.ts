/**
 * Logging utility using Pino for structured, performant logging
 */
import pino from 'pino';
import { LoggingConfig } from '../types/environment-config';

// Map our LogLevel strings to Pino level values
const LOG_LEVEL_MAP: Record<string, string> = {
  'DEBUG': 'debug',
  'INFO': 'info',
  'WARN': 'warn',
  'ERROR': 'error'
};

// Global logging configuration
let currentLoggingConfig: Partial<LoggingConfig> = {
  level: 'INFO',
  includeDebugInfo: false,
  sampleRate: 1,
  redactSensitiveInfo: true,
  performanceMetrics: true,
  alwaysLogPaths: [],
  neverLogPaths: []
};

// Create a unique request ID if none is provided
// Uses crypto.randomUUID() which is safe inside function context, 
// outside of global scope initialization
const generateRequestId = (): string => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    // Fallback in case randomUUID is not available
    return `req-${Date.now().toString(36)}`;
  }
};

// Generate a unique operation ID for performance tracking
const generateOperationId = (): string => {
  try {
    return crypto.randomUUID().slice(0, 8);
  } catch (e) {
    // Fallback in case randomUUID is not available
    return `op-${Date.now().toString(36)}`;
  }
};

/**
 * Determines if a request should be logged based on sampling configuration
 * @param url URL to check for logging
 * @returns Boolean indicating if the request should be logged
 */
const shouldLogRequest = (url: string): boolean => {
  try {
    const pathname = new URL(url).pathname;
    
    // Always log paths specified in configuration
    if (currentLoggingConfig.alwaysLogPaths?.some(pattern => 
      pathname.includes(pattern) || pathname.match(new RegExp(pattern))
    )) {
      return true;
    }
    
    // Never log paths specified in configuration
    if (currentLoggingConfig.neverLogPaths?.some(pattern => 
      pathname.includes(pattern) || pathname.match(new RegExp(pattern))
    )) {
      return false;
    }
    
    // Apply sampling rate for everything else
    const sampleRate = currentLoggingConfig.sampleRate || 1;
    if (sampleRate >= 1) {
      return true; // Log everything if rate is 100%
    } else if (sampleRate <= 0) {
      return false; // Log nothing if rate is 0%
    } else {
      // Determine if this request falls within the sampling rate
      // Using a simple hash of the URL for consistent sampling
      const urlHash = [...url].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 0);
      const normalizedHash = Math.abs(urlHash) / 2147483647; // Convert to 0-1 range
      return normalizedHash < sampleRate;
    }
  } catch (e) {
    // Default to logging if there's an error in the sampling logic
    return true;
  }
};

// Extract URL parts for better filtering and analysis
const parseUrl = (url: string): Record<string, string> => {
  try {
    const parsed = new URL(url);
    return {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      pathname: parsed.pathname,
      search: parsed.search
    };
  } catch (e) {
    return { url };
  }
};

// Define custom serializers for Cloudflare Workers
const customSerializers = {
  // Enhance error serialization
  err: (err: Error) => {
    return {
      type: err.name,
      message: err.message,
      stack: err.stack,
      code: (err as any).code
    };
  },
  
  // Enhance request serialization
  req: (req: Request) => {
    const urlInfo = parseUrl(req.url);
    
    return {
      method: req.method,
      url: req.url,
      urlParts: urlInfo,
      headers: Object.fromEntries(
        Array.from(req.headers.entries())
          .filter(([key]) => !key.match(/authorization|cookie|x-auth/i))
      ),
      cf: (req as any).cf // Cloudflare specific request data
    };
  },
  
  // Enhance response serialization
  res: (res: Response) => {
    return {
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      size: res.headers.get('content-length') || 'unknown'
    };
  }
};

// Create a Pino logger instance
const createPinoLogger = () => {
  // Get environment variables
  const environment = (globalThis as any).ENVIRONMENT || 'development';
  const envLogLevel = ((globalThis as any).LOG_LEVEL || 'INFO').toUpperCase();
  const envDebugMode = ((globalThis as any).DEBUG_MODE || 'false').toLowerCase() === 'true';
  
  // Generate a pseudo-unique instance ID for this worker instance (without using crypto in global scope)
  // crypto.randomUUID() can't be used here as it's not allowed in global scope
  const workerInstanceId = `worker-${Date.now().toString(36)}`;
  const startTimestamp = new Date().toISOString();
  
  // Determine effective log level using following precedence:
  // 1. Current logging configuration (from KV)
  // 2. Environment variable
  // 3. Debug mode override
  // 4. Default to INFO
  const configLogLevel = currentLoggingConfig.level;
  const effectiveLogLevel = configLogLevel || 
    (envDebugMode || environment === 'development' ? 'DEBUG' : envLogLevel);
  
  console.log(`Initializing logger with level: ${effectiveLogLevel} (environment: ${environment}, debugMode: ${envDebugMode}, configLevel: ${configLogLevel}, workerInstanceId: ${workerInstanceId})`);
  
  // Configure Pino options
  const pinoOptions: pino.LoggerOptions = {
    // Map our log level to Pino level
    level: LOG_LEVEL_MAP[effectiveLogLevel] || 'info',
    
    // Add base properties to all logs
    base: { 
      environment,
      service: 'caching-service',
      version: (globalThis as any).VERSION || '1.0.0',
      worker: 'caching',
      workerInstanceId,
      workerStartTime: startTimestamp,
      loggingSampleRate: currentLoggingConfig.sampleRate || 1
    },
    
    // Configure timestamp generation
    timestamp: pino.stdTimeFunctions.isoTime,
    
    // Configure serializers for common objects
    serializers: {
      ...pino.stdSerializers,
      ...customSerializers,
      // Apply redaction if configured
      ...(currentLoggingConfig.redactSensitiveInfo ? {
        req: (req: Request) => {
          const urlInfo = parseUrl(req.url);
          
          const headers = Object.fromEntries(
            Array.from(req.headers.entries())
              // Redact sensitive headers
              .filter(([key]) => !key.match(/authorization|cookie|x-auth|api-key|password|token|secret/i))
          );
          
          return {
            method: req.method,
            url: req.url,
            urlParts: urlInfo,
            headers,
            cf: (req as any).cf // Cloudflare specific request data
          };
        }
      } : {})
    },

    // Format for Cloudflare Workers environment
    formatters: {
      level: (label: string) => {
        return { level: label.toUpperCase() };
      },
      bindings: (bindings) => {
        return {
          ...bindings,
          pid: undefined // Remove pid as it's not meaningful in Cloudflare Workers
        };
      }
    },
    
    // Enable pretty printing in debug mode
    transport: currentLoggingConfig.includeDebugInfo || envDebugMode ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    } : undefined
  };

  return pino(pinoOptions);
};

// Create the Pino logger instance
let pinoLogger = createPinoLogger();

/**
 * Updates the logger configuration based on the provided config
 * This allows dynamic reconfiguration of logging behavior at runtime
 * @param config New logging configuration
 */
export function updateLoggerConfig(config: Partial<LoggingConfig>): void {
  // Update our current configuration
  currentLoggingConfig = {
    ...currentLoggingConfig,
    ...config
  };
  
  // Recreate the logger with new configuration
  pinoLogger = createPinoLogger();
  
  // Log the configuration change
  pinoLogger.info({
    event: 'logger_reconfigured',
    newConfig: {
      level: currentLoggingConfig.level,
      includeDebugInfo: currentLoggingConfig.includeDebugInfo,
      sampleRate: currentLoggingConfig.sampleRate,
      redactSensitiveInfo: currentLoggingConfig.redactSensitiveInfo,
      performanceMetrics: currentLoggingConfig.performanceMetrics
    }
  }, 'Logger configuration updated');
}

/**
 * Logger wrapper for backward compatibility
 */
export class Logger {
  /**
   * Log a debug message
   * @param message Message to log
   * @param data Additional data to log
   */
  public debug(message: string, data?: any): void {
    pinoLogger.debug(data || {}, message);
  }
  
  /**
   * Log an info message
   * @param message Message to log
   * @param data Additional data to log
   */
  public info(message: string, data?: any): void {
    pinoLogger.info(data || {}, message);
  }
  
  /**
   * Log a warning message
   * @param message Message to log
   * @param data Additional data to log
   */
  public warn(message: string, data?: any): void {
    pinoLogger.warn(data || {}, message);
  }
  
  /**
   * Log an error message
   * @param message Message to log
   * @param data Additional data to log
   */
  public error(message: string, data?: any): void {
    pinoLogger.error(data || {}, message);
  }
  
  /**
   * Create a child logger with additional context
   * @param bindings Context data to include in all logs
   * @returns A new logger instance
   */
  public child(bindings: Record<string, unknown>): Logger {
    const childPino = pinoLogger.child(bindings);
    return new PinoLoggerWrapper(childPino);
  }
  
  /**
   * Log the start of a request
   * @param request The HTTP request object
   * @param data Additional data to include
   * @returns A logger with request context for further logging
   */
  public logRequest(request: Request, data?: Record<string, unknown>): Logger {
    const requestId = request.headers.get('x-request-id') || generateRequestId();
    const method = request.method;
    const url = request.url;
    const urlParts = parseUrl(url);
    
    const requestData = {
      requestId,
      method,
      url,
      urlParts,
      ...data
    };
    
    // Apply log sampling based on configuration
    const shouldLog = shouldLogRequest(url);
    
    // Create a child logger with request context
    const childLogger = this.child({ 
      requestId, 
      method, 
      url,
      sampled: shouldLog
    });
    
    // Only log the request if it passes the sampling filter
    if (shouldLog) {
      pinoLogger.info({ req: request, ...requestData, sampled: true }, 'Request received');
    } else {
      // For non-sampled requests, log at debug level with minimal info
      pinoLogger.debug({ 
        requestId,
        method,
        path: urlParts.pathname,
        sampled: false
      }, 'Request received (not sampled)');
    }
    
    // Return the child logger
    return childLogger;
  }
  
  /**
   * Log the completion of a request with response data
   * @param response The HTTP response object
   * @param request The original HTTP request
   * @param data Additional data like timing
   */
  public logResponse(response: Response, request: Request, data?: Record<string, unknown>): void {
    const requestId = request.headers.get('x-request-id') || 'unknown';
    const duration = data?.duration || 0;
    const cached = data?.cached || false;
    
    // Build the response log object
    const responseData = {
      requestId,
      method: request.method,
      url: request.url,
      status: response.status,
      statusText: response.statusText,
      duration,
      cached,
      cacheHit: cached,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
      ...data
    };
    
    // Apply log sampling based on configuration
    // Always log errors regardless of sampling configuration
    const statusGroup = Math.floor(response.status / 100);
    const isError = statusGroup >= 4;
    const shouldLog = isError || shouldLogRequest(request.url);
    
    // Only fully log the response if it's an error or passes the sampling filter
    if (isError) {
      // Always log errors regardless of sampling
      if (statusGroup === 5) {
        pinoLogger.error({ res: response, ...responseData, sampled: true }, `${request.method} ${responseData.url} - Server Error ${response.status}`);
      } else {
        pinoLogger.warn({ res: response, ...responseData, sampled: true }, `${request.method} ${responseData.url} - Client Error ${response.status}`);
      }
    } else if (shouldLog) {
      // Log successful responses that pass the sampling filter
      pinoLogger.info({ res: response, ...responseData, sampled: true }, `${request.method} ${responseData.url} - ${response.statusText || 'Ok'}`);
    } else {
      // For non-sampled successful responses, log at debug level with minimal info
      pinoLogger.debug({ 
        requestId,
        method: request.method,
        path: parseUrl(request.url).pathname,
        status: response.status,
        duration,
        cached,
        sampled: false
      }, `${request.method} ${parseUrl(request.url).pathname} - ${response.status}`);
    }
    
    // If performance metrics are enabled, log detailed timing information
    if (currentLoggingConfig.performanceMetrics && typeof duration === 'number' && duration > 0) {
      const performanceData = {
        url: request.url,
        method: request.method,
        status: response.status,
        cached,
        duration,
        requestId
      };
      
      // Only log slow responses if not being sampled
      const isSlowResponse = typeof duration === 'number' && duration > 1000; // 1 second threshold
      
      if (shouldLog || isSlowResponse) {
        const level = isSlowResponse ? 'warn' : 'debug';
        pinoLogger[level]({ 
          ...performanceData,
          event: 'response_timing'
        }, `Response timing ${isSlowResponse ? '(slow)' : ''}`);
      }
    }
  }
  
  /**
   * Create a performance measurement logger
   * @param operation The operation being timed
   * @returns An object with start and end methods
   */
  public performance(operation: string): { startTime: number, start: () => void; end: (data?: Record<string, unknown>) => void } {
    let startTime: number = 0;
    const operationId = generateOperationId();
    
    return {
      startTime,
      start: () => {
        startTime = performance.now();
        pinoLogger.debug({
          operation,
          operationId,
          event: 'start',
          timestamp: new Date().toISOString()
        }, `Starting operation: ${operation}`);
        return startTime;
      },
      end: (data: Record<string, unknown> = {}) => {
        const duration = performance.now() - startTime;
        // Verify duration is reasonable (should never be more than a minute in Cloudflare Workers)
        const validatedDuration = (duration > 0 && duration < 60000) ? duration : 0;
        pinoLogger.debug({ 
          operation, 
          operationId,
          event: 'end',
          timestamp: new Date().toISOString(),
          duration: `${validatedDuration.toFixed(2)}ms`,
          durationMs: Math.round(validatedDuration),
          startTime: startTime,
          endTime: performance.now(),
          ...data
        }, `Operation completed: ${operation}`);
      }
    };
  }
}

/**
 * Logger wrapper for Pino child loggers
 */
class PinoLoggerWrapper extends Logger {
  private childLogger: pino.Logger;
  
  constructor(logger: pino.Logger) {
    super();
    this.childLogger = logger;
  }
  
  public debug(message: string, data?: any): void {
    this.childLogger.debug(data || {}, message);
  }
  
  public info(message: string, data?: any): void {
    this.childLogger.info(data || {}, message);
  }
  
  public warn(message: string, data?: any): void {
    this.childLogger.warn(data || {}, message);
  }
  
  public error(message: string, data?: any): void {
    this.childLogger.error(data || {}, message);
  }
  
  public child(bindings: Record<string, unknown>): Logger {
    const childPino = this.childLogger.child(bindings);
    return new PinoLoggerWrapper(childPino);
  }
  
  public logRequest(request: Request, data?: Record<string, unknown>): Logger {
    const requestId = request.headers.get('x-request-id') || generateRequestId();
    const method = request.method;
    const url = request.url;
    const urlParts = parseUrl(url);
    
    const requestData = {
      requestId,
      method,
      url,
      urlParts,
      ...data
    };
    
    // Apply log sampling based on configuration
    const shouldLog = shouldLogRequest(url);
    
    // Create a child logger with request context
    const childLogger = this.child({ 
      requestId, 
      method, 
      url,
      sampled: shouldLog
    });
    
    // Only log the request if it passes the sampling filter
    if (shouldLog) {
      this.childLogger.info({ req: request, ...requestData, sampled: true }, 'Request received');
    } else {
      // For non-sampled requests, log at debug level with minimal info
      this.childLogger.debug({ 
        requestId,
        method,
        path: urlParts.pathname,
        sampled: false
      }, 'Request received (not sampled)');
    }
    
    // Return the child logger
    return childLogger;
  }
  
  public logResponse(response: Response, request: Request, data?: Record<string, unknown>): void {
    const requestId = request.headers.get('x-request-id') || 'unknown';
    const duration = data?.duration || 0;
    const cached = data?.cached || false;
    
    // Build the response log object
    const responseData = {
      requestId,
      method: request.method,
      url: request.url,
      status: response.status,
      statusText: response.statusText,
      duration,
      cached,
      cacheHit: cached,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
      ...data
    };
    
    // Apply log sampling based on configuration
    // Always log errors regardless of sampling configuration
    const statusGroup = Math.floor(response.status / 100);
    const isError = statusGroup >= 4;
    const shouldLog = isError || shouldLogRequest(request.url);
    
    // Only fully log the response if it's an error or passes the sampling filter
    if (isError) {
      // Always log errors regardless of sampling
      if (statusGroup === 5) {
        this.childLogger.error({ res: response, ...responseData, sampled: true }, `${request.method} ${responseData.url} - Server Error ${response.status}`);
      } else {
        this.childLogger.warn({ res: response, ...responseData, sampled: true }, `${request.method} ${responseData.url} - Client Error ${response.status}`);
      }
    } else if (shouldLog) {
      // Log successful responses that pass the sampling filter
      this.childLogger.info({ res: response, ...responseData, sampled: true }, `${request.method} ${responseData.url} - ${response.statusText || 'Ok'}`);
    } else {
      // For non-sampled successful responses, log at debug level with minimal info
      this.childLogger.debug({ 
        requestId,
        method: request.method,
        path: parseUrl(request.url).pathname,
        status: response.status,
        duration,
        cached,
        sampled: false
      }, `${request.method} ${parseUrl(request.url).pathname} - ${response.status}`);
    }
    
    // If performance metrics are enabled, log detailed timing information
    if (currentLoggingConfig.performanceMetrics && typeof duration === 'number' && duration > 0) {
      const performanceData = {
        url: request.url,
        method: request.method,
        status: response.status,
        cached,
        duration,
        requestId
      };
      
      // Only log slow responses if not being sampled
      const isSlowResponse = typeof duration === 'number' && duration > 1000; // 1 second threshold
      
      if (shouldLog || isSlowResponse) {
        const level = isSlowResponse ? 'warn' : 'debug';
        this.childLogger[level]({ 
          ...performanceData,
          event: 'response_timing'
        }, `Response timing ${isSlowResponse ? '(slow)' : ''}`);
      }
    }
  }
  
  public performance(operation: string): { startTime: number, start: () => void; end: (data?: Record<string, unknown>) => void } {
    let startTime: number = 0;
    const operationId = generateOperationId();
    
    return {
      startTime,
      start: () => {
        startTime = performance.now();
        this.childLogger.debug({
          operation,
          operationId,
          event: 'start',
          timestamp: new Date().toISOString()
        }, `Starting operation: ${operation}`);
        return startTime;
      },
      end: (data: Record<string, unknown> = {}) => {
        const duration = performance.now() - startTime;
        // Verify duration is reasonable (should never be more than a minute in Cloudflare Workers)
        const validatedDuration = (duration > 0 && duration < 60000) ? duration : 0;
        this.childLogger.debug({ 
          operation, 
          operationId,
          event: 'end',
          timestamp: new Date().toISOString(),
          duration: `${validatedDuration.toFixed(2)}ms`,
          durationMs: Math.round(validatedDuration),
          startTime: startTime,
          endTime: performance.now(),
          ...data
        }, `Operation completed: ${operation}`);
      }
    };
  }
}

// Export the LogLevel enum for compatibility
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Export a singleton logger instance
export const logger = new Logger();