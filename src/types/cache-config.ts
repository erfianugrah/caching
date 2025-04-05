/**
 * Cache configuration interfaces
 */

/**
 * TTL configuration by status code
 */
export interface TtlConfig {
  ok: number;
  redirects: number;
  clientError: number;
  serverError: number;
  info?: number;
  // Allow specific status codes as keys
  [statusCode: string]: number | undefined;
}

/**
 * Configuration for query parameters in cache keys
 */
export interface QueryParamConfig {
  // Whether to include query parameters in the cache key
  include: boolean;
  // Specific query parameters to include (if empty and include=true, include all)
  includeParams?: string[];
  // Specific query parameters to exclude
  excludeParams?: string[];
  // Whether to sort query parameters alphabetically
  sortParams?: boolean;
  // Whether to normalize query parameter values (lowercase)
  normalizeValues?: boolean;
}

/**
 * Variant configuration for cache keys
 * Variants allow for multiple cache entries based on request attributes
 */
export interface VariantConfig {
  // Headers to include in the cache key
  headers?: string[];
  // Cookies to include in the cache key
  cookies?: string[];
  // Client hints to include in the cache key (e.g., viewport width, DPR)
  clientHints?: string[];
  // Whether to include the Accept header in the cache key
  useAcceptHeader?: boolean;
  // Whether to include the User-Agent header (or parts of it) in the cache key
  useUserAgent?: boolean;
  // Whether to include the client IP in the cache key
  useClientIP?: boolean;
}

/**
 * Cache directives configuration
 */
export interface CacheDirectivesConfig {
  private?: boolean;
  staleWhileRevalidate?: number;
  staleIfError?: number;
  mustRevalidate?: boolean;
  noCache?: boolean;
  noStore?: boolean;
  immutable?: boolean;
}

/**
 * Asset-specific cache configuration
 */
export interface AssetConfig {
  regex: RegExp;
  useQueryInCacheKey: boolean;
  // Enhanced query parameter handling
  queryParams?: QueryParamConfig;
  // Variant support for creating multiple cache entries
  variants?: VariantConfig;
  ttl: TtlConfig;
  imageOptimization?: boolean;
  minifyCss?: boolean;
  // Additional cache control directives
  cacheDirectives?: CacheDirectivesConfig;
  // Control header override prevention
  preventCacheControlOverride?: boolean;
}

/**
 * Asset configuration with type information
 */
export interface AssetTypeConfig extends AssetConfig {
  assetType: string;
}

/**
 * CloudFlare specific cache options
 */
export interface CfCacheOptions {
  cacheKey: string;
  polish: "lossy" | "lossless" | "off";
  minify: {
    javascript: boolean;
    css: boolean;
    html: boolean;
  };
  mirage: boolean;
  cacheEverything: boolean;
  cacheTtlByStatus: {
    [key: string]: number;
  };
  cacheTags?: string[];
}

/**
 * Map of asset types to configurations
 */
export interface AssetConfigMap {
  [key: string]: AssetConfig;
}