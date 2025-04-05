import { AssetConfig, CfCacheOptions } from '../types/cache-config';

/**
 * Interface for content-type specific caching strategies
 */
export interface CachingStrategy {
  /**
   * Apply content-specific caching rules to a response
   * @param response Original response
   * @param request Original request
   * @param config Asset configuration
   * @returns Modified response with appropriate caching headers
   */
  applyCaching(response: Response, request: Request, config: AssetConfig): Response;
  
  /**
   * Get Cloudflare-specific cache options for this content type
   * @param request Original request
   * @param config Asset configuration
   * @returns Cloudflare cache options
   */
  getCacheOptions(request: Request, config: AssetConfig): CfCacheOptions;
  
  /**
   * Check if this strategy can handle the given content type
   * @param contentType The content type to check
   * @returns True if this strategy can handle the content type
   */
  canHandle(contentType: string): boolean;
}

/**
 * Abstract base class for caching strategies with common functionality
 */
export abstract class BaseCachingStrategy implements CachingStrategy {
  /**
   * Apply content-specific caching rules to a response
   * @param response Original response
   * @param request Original request
   * @param config Asset configuration
   * @returns Modified response with appropriate caching headers
   */
  abstract applyCaching(response: Response, request: Request, config: AssetConfig): Response;
  
  /**
   * Get Cloudflare-specific cache options for this content type
   * @param request Original request
   * @param config Asset configuration
   * @returns Cloudflare cache options
   */
  abstract getCacheOptions(request: Request, config: AssetConfig): CfCacheOptions;
  
  /**
   * Check if this strategy can handle the given content type
   * @param contentType The content type to check
   * @returns True if this strategy can handle the content type
   */
  abstract canHandle(contentType: string): boolean; // eslint-disable-line @typescript-eslint/no-unused-vars
  
  /**
   * Generate cache TTL options based on status code groupings
   * @param config Asset configuration with TTL settings
   * @returns Object mapping status code ranges to TTL values
   */
  protected generateCacheTtlByStatus(config: AssetConfig): Record<string, number> {
    return {
      '200-299': config.ttl.ok, // OK responses
      '301-302': config.ttl.redirects, // Redirects
      '400-499': config.ttl.clientError, // Client errors
      '500-599': config.ttl.serverError, // Server errors
    };
  }
}