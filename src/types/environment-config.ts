/**
 * Environment configuration interfaces
 */

/**
 * Log levels supported by the application
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * Logging configuration settings
 */
export interface LoggingConfig {
  /**
   * Current log level
   */
  level: LogLevel;
  
  /**
   * Whether to include detailed debug information
   */
  includeDebugInfo: boolean;
  
  /**
   * Sample rate for logging (0-1, percentage of requests to log)
   */
  sampleRate: number;
  
  /**
   * Whether to redact sensitive information in logs
   */
  redactSensitiveInfo: boolean;
  
  /**
   * Whether to include performance metrics in logs
   */
  performanceMetrics: boolean;
  
  /**
   * Path patterns to always log, regardless of sample rate
   */
  alwaysLogPaths: string[];
  
  /**
   * Path patterns to never log, regardless of sample rate
   */
  neverLogPaths: string[];
}

/**
 * Environment configuration settings
 */
export interface EnvironmentConfig {
  /**
   * Current environment (development, staging, production)
   */
  environment: string;
  
  /**
   * Current log level (backward compatibility)
   * @deprecated Use logging.level instead
   */
  logLevel: LogLevel;
  
  /**
   * Whether debug mode is enabled (backward compatibility)
   * @deprecated Use logging.includeDebugInfo instead
   */
  debugMode: boolean;
  
  /**
   * Maximum number of cache tags allowed
   */
  maxCacheTags: number;
  
  /**
   * Namespace to prefix cache tags with
   */
  cacheTagNamespace: string;
  
  /**
   * Application version
   */
  version: string;

  /**
   * KV namespace name for configuration storage
   * If provided, configuration will be stored and retrieved from this KV namespace
   */
  configKvNamespace?: string;
  
  /**
   * Configuration refresh interval in seconds
   * How often to check for updated configurations in KV
   */
  configRefreshInterval: number;
  
  /**
   * Detailed logging configuration
   */
  logging?: LoggingConfig;
}