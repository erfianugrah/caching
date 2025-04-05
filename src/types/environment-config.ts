/**
 * Environment configuration interfaces
 */

/**
 * Log levels supported by the application
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * Environment configuration settings
 */
export interface EnvironmentConfig {
  /**
   * Current environment (development, staging, production)
   */
  environment: string;
  
  /**
   * Current log level
   */
  logLevel: LogLevel;
  
  /**
   * Whether debug mode is enabled
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
}