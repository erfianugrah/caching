import { AssetConfig, CfCacheOptions } from '../types/cache-config';
import { BaseCachingStrategy } from './caching-strategy';
import { ServiceFactory } from '../services/service-factory';
import { logger } from '../utils/logger';

/**
 * Default caching strategy used as a fallback
 */
export class DefaultCachingStrategy extends BaseCachingStrategy {
  /**
   * Check if this strategy can handle the given content type
   * @param contentType The content type to check
   * @returns Always returns true as this is the default strategy
   */
  canHandle(_contentType: string): boolean { // eslint-disable-line @typescript-eslint/no-unused-vars
    return true; // Default strategy handles all content types
  }

  /**
   * Apply default caching rules to a response
   * @param response Original response
   * @param request Original request
   * @param config Asset configuration
   * @returns Modified response with appropriate caching headers
   */
  applyCaching(response: Response, request: Request, config: AssetConfig): Response {
    const cacheHeaderService = ServiceFactory.getCacheHeaderService();
    
    // Create a new response with the same body
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers)
    });
    
    // Add Cache-Control header based on status
    const cacheControlHeader = cacheHeaderService.getCacheControlHeader(
      response.status,
      config
    );
    newResponse.headers.set('Cache-Control', cacheControlHeader);
    
    logger.debug('Applied default caching strategy', { 
      url: request.url,
      status: response.status
    });
    
    return newResponse;
  }

  /**
   * Get Cloudflare-specific cache options
   * @param request Original request
   * @param config Asset configuration
   * @returns Cloudflare cache options
   */
  getCacheOptions(request: Request, config: AssetConfig): CfCacheOptions {
    const cacheKeyService = ServiceFactory.getCacheKeyService();
    
    // Generate cache key
    const cacheKey = cacheKeyService.getCacheKey(request, config);
    
    // Return basic Cloudflare options
    return {
      cacheKey,
      polish: 'off',
      minify: {
        javascript: false,
        css: config.minifyCss || false,
        html: false
      },
      mirage: false,
      cacheEverything: true,
      cacheTtlByStatus: this.generateCacheTtlByStatus(config)
    };
  }
}