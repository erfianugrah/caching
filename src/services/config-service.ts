import { z } from 'zod';
import { EnvironmentConfig, LogLevel } from '../types/environment-config';
import { logger } from '../utils/logger';

/**
 * Schema for validating environment configuration
 */
const environmentConfigSchema = z.object({
  environment: z.string().default('development'),
  logLevel: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).default('INFO'),
  debugMode: z.boolean().default(false),
  maxCacheTags: z.number().int().positive().default(10),
  cacheTagNamespace: z.string().default('cf'),
  version: z.string().default('dev'),
});

/**
 * Service for managing application configuration
 */
export class ConfigService {
  private config: EnvironmentConfig;

  /**
   * Create a new ConfigService instance
   */
  constructor() {
    this.config = this.loadConfig();
    this.logConfig();
  }

  /**
   * Get the current configuration
   * @returns The current environment configuration
   */
  getConfig(): EnvironmentConfig {
    return this.config;
  }

  /**
   * Load configuration from environment variables
   * @returns Validated environment configuration
   */
  private loadConfig(): EnvironmentConfig {
    try {
      // Get environment variables with type safety
      const environment = (globalThis as any).ENVIRONMENT;
      const logLevel = (globalThis as any).LOG_LEVEL;
      const debugMode = (globalThis as any).DEBUG_MODE === 'true';
      const maxCacheTags = parseInt((globalThis as any).MAX_CACHE_TAGS || '10', 10);
      const cacheTagNamespace = (globalThis as any).CACHE_TAG_NAMESPACE;
      const version = (globalThis as any).VERSION;

      // Parse and validate configuration
      return environmentConfigSchema.parse({
        environment,
        logLevel: logLevel as LogLevel,
        debugMode,
        maxCacheTags,
        cacheTagNamespace,
        version,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Configuration validation errors, using defaults', { 
          errors: error.errors 
        });
        // Return default values if validation fails
        return environmentConfigSchema.parse({});
      }
      
      // For other errors, log and use defaults
      logger.error('Failed to load configuration', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return environmentConfigSchema.parse({});
    }
  }

  /**
   * Log the current configuration
   */
  private logConfig(): void {
    logger.info('Configuration loaded', {
      environment: this.config.environment,
      logLevel: this.config.logLevel,
      debugMode: this.config.debugMode ? 'enabled' : 'disabled',
      maxCacheTags: this.config.maxCacheTags,
      version: this.config.version
    });
  }
}