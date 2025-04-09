/**
 * Configuration schemas using Zod for validation and type safety
 * These schemas define the structure and validation rules for all configuration objects
 * used throughout the caching service.
 */

import { z } from 'zod';

/**
 * Schema for TTL configuration by status code
 */
export const ttlConfigSchema = z.object({
  // Required TTL settings for different status code ranges
  ok: z.number().int().nonnegative(),
  redirects: z.number().int().nonnegative(),
  clientError: z.number().int().nonnegative(),
  serverError: z.number().int().nonnegative(),
  
  // Optional TTL for informational responses
  info: z.number().int().nonnegative().optional(),
  
  // Allow additional numeric TTLs for specific status codes
}).catchall(z.number().int().nonnegative().optional());

/**
 * Schema for query parameter handling configuration
 */
export const queryParamConfigSchema = z.object({
  // Whether to include query parameters in the cache key
  include: z.boolean(),
  
  // Specific parameters to include (if empty and include=true, include all)
  includeParams: z.array(z.string()).optional(),
  
  // Specific parameters to exclude
  excludeParams: z.array(z.string()).optional(),
  
  // Whether to sort query parameters alphabetically
  sortParams: z.boolean().optional(),
  
  // Whether to normalize query parameter values (lowercase)
  normalizeValues: z.boolean().optional(),
});

/**
 * Schema for variant configuration
 * Variants allow for multiple cache entries based on request attributes
 */
export const variantConfigSchema = z.object({
  // Headers to include in the cache key
  headers: z.array(z.string()).optional(),
  
  // Cookies to include in the cache key
  cookies: z.array(z.string()).optional(),
  
  // Client hints to include in the cache key
  clientHints: z.array(z.string()).optional(),
  
  // Whether to include the Accept header in the cache key
  useAcceptHeader: z.boolean().optional(),
  
  // Whether to include User-Agent in the cache key
  useUserAgent: z.boolean().optional(),
  
  // Whether to include client IP in the cache key
  useClientIP: z.boolean().optional(),
});

/**
 * Schema for cache directives configuration
 */
export const cacheDirectivesConfigSchema = z.object({
  private: z.boolean().optional(),
  staleWhileRevalidate: z.number().int().nonnegative().optional(),
  staleIfError: z.number().int().nonnegative().optional(),
  mustRevalidate: z.boolean().optional(),
  noCache: z.boolean().optional(),
  noStore: z.boolean().optional(),
  immutable: z.boolean().optional(),
});

/**
 * Schema for asset-specific cache configuration
 * Note: The regex field is stored as a string and converted to RegExp when used
 */
export const assetConfigSchema = z.object({
  // Regular expression pattern for matching URLs (stored as string)
  regexPattern: z.string(),
  
  // Whether to include query parameters in cache key
  useQueryInCacheKey: z.boolean(),
  
  // Enhanced query parameter handling
  queryParams: queryParamConfigSchema.optional(),
  
  // Support for variants based on request attributes
  variants: variantConfigSchema.optional(),
  
  // TTL configuration by status code
  ttl: ttlConfigSchema,
  
  // Content optimizations
  imageOptimization: z.boolean().optional(),
  minifyCss: z.boolean().optional(),
  
  // Cache control directive settings
  cacheDirectives: cacheDirectivesConfigSchema.optional(),
  
  // Whether to prevent cache control override
  preventCacheControlOverride: z.boolean().optional(),
});

/**
 * Schema for asset type configuration (asset config with type information)
 */
export const assetTypeConfigSchema = assetConfigSchema.extend({
  // Asset type identifier
  assetType: z.string(),
});

/**
 * Schema for complete asset configuration map
 */
export const assetConfigMapSchema = z.record(z.string(), assetConfigSchema);

/**
 * Schema for logging configuration
 */
export const loggingConfigSchema = z.object({
  // Log level
  level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).default('INFO'),
  
  // Whether to include detailed debug information
  includeDebugInfo: z.boolean().default(false),
  
  // Sample rate for logging (0-1, percentage of requests to log)
  sampleRate: z.number().min(0).max(1).default(1),
  
  // Whether to redact sensitive information in logs
  redactSensitiveInfo: z.boolean().default(true),
  
  // Whether to include performance metrics in logs
  performanceMetrics: z.boolean().default(true),
  
  // Path patterns to always log, regardless of sample rate
  alwaysLogPaths: z.array(z.string()).default([]),
  
  // Path patterns to never log, regardless of sample rate
  neverLogPaths: z.array(z.string()).default([]),
});

/**
 * Schema for environment configuration
 */
export const environmentConfigSchema = z.object({
  // Current environment (development, staging, production)
  environment: z.string().default('development'),
  
  // Log level (backward compatibility)
  logLevel: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).default('INFO'),
  
  // Debug mode flag (backward compatibility)
  debugMode: z.boolean().default(false),
  
  // Maximum number of cache tags allowed
  maxCacheTags: z.number().int().positive().default(10),
  
  // Namespace to prefix cache tags with
  cacheTagNamespace: z.string().default('cf'),
  
  // Application version
  version: z.string().default('dev'),
  
  // KV namespace name for configuration storage
  configKvNamespace: z.string().optional(),
  
  // Configuration refresh interval in seconds
  configRefreshInterval: z.number().int().positive().default(300),
  
  // Detailed logging configuration
  logging: loggingConfigSchema.optional(),
});

/**
 * Helper type for parsed asset config with RegExp
 * This is the runtime type after converting the stored string pattern to RegExp
 */
export type ParsedAssetConfig = z.infer<typeof assetConfigSchema> & { regex: RegExp };

/**
 * Helper type for parsed asset type config with RegExp
 */
export type ParsedAssetTypeConfig = z.infer<typeof assetTypeConfigSchema> & { regex: RegExp };

/**
 * Function to convert stored asset config to runtime config with RegExp
 * @param config The stored asset config with string regexPattern
 * @returns Runtime asset config with compiled RegExp
 */
export function parseAssetConfig(config: z.infer<typeof assetConfigSchema>): ParsedAssetConfig {
  return {
    ...config,
    regex: new RegExp(config.regexPattern),
  };
}

/**
 * Function to convert stored asset type config to runtime config with RegExp
 * @param config The stored asset type config with string regexPattern
 * @returns Runtime asset type config with compiled RegExp
 */
export function parseAssetTypeConfig(config: z.infer<typeof assetTypeConfigSchema>): ParsedAssetTypeConfig {
  return {
    ...config,
    regex: new RegExp(config.regexPattern),
  };
}

/**
 * Function to serialize a runtime configuration with RegExp to a storable format
 * @param config Configuration with RegExp
 * @returns Configuration with string regexPattern
 */
export function serializeAssetConfig(config: ParsedAssetConfig | { regex: RegExp, [key: string]: unknown }): z.infer<typeof assetConfigSchema> {
  // Extract the regex pattern as a string and remove any existing regexPattern to avoid duplication
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { regex, regexPattern: _unused, ...rest } = config as { regex: RegExp, regexPattern?: string, [key: string]: unknown };
  const newRegexPattern = regex.source;
  
  // Return config with regex as string
  return {
    regexPattern: newRegexPattern,
    ...rest,
  } as z.infer<typeof assetConfigSchema>;
}