import { AssetConfig, AssetTypeConfig, CfCacheOptions } from '../types/cache-config';

/**
 * Service for detecting asset type from request
 */
export interface AssetTypeService {
  /**
   * Get configuration for a specific request
   */
  getConfigForRequest(request: Request): AssetTypeConfig;
}

/**
 * Service for generating cache keys
 */
export interface CacheKeyService {
  /**
   * Generate a cache key for the given request and config
   */
  getCacheKey(request: Request, config: AssetConfig): string;
}

/**
 * Service for managing cache headers
 */
export interface CacheHeaderService {
  /**
   * Generate Cache-Control header based on response status and config
   */
  getCacheControlHeader(status: number, config: AssetConfig): string;
  
  /**
   * Apply cache headers to a response
   */
  applyCacheHeaders(response: Response, request: Request, config: AssetConfig): Response;
}

/**
 * Service for generating cache tags
 */
export interface CacheTagService {
  /**
   * Generate cache tags for the given request and asset type
   */
  generateTags(request: Request, assetType: string): string[];
  
  /**
   * Validate a cache tag to ensure it meets Cloudflare requirements
   */
  validateTag(tag: string): boolean;
  
  /**
   * Format a list of cache tags for inclusion in a header
   */
  formatTagsForHeader(tags: string[]): string;
}

/**
 * Service for generating CloudFlare cache options
 */
export interface CfOptionsService {
  /**
   * Generate CloudFlare-specific cache options
   */
  getCfOptions(request: Request, config: AssetConfig): CfCacheOptions;
}