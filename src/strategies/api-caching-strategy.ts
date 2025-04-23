import { AssetConfig, CfCacheOptions } from '../types/cache-config';
import { BaseCachingStrategy } from './caching-strategy';
import { ServiceFactory } from '../services/service-factory';
import { logger } from '../utils/logger';

/**
 * Caching strategy for API responses
 */
export class ApiCachingStrategy extends BaseCachingStrategy {
  // Content types this strategy can handle
  private supportedTypes = [
    'application/json',
    'application/xml',
    'text/xml',
    'application/javascript',
    'application/ld+json'
  ];

  /**
   * Check if this strategy can handle the given content type
   * @param contentType The content type to check
   * @returns True if this strategy can handle the content type
   */
  canHandle(contentType: string): boolean {
    return this.supportedTypes.some(type => 
      contentType === type || contentType.startsWith(`${type};`)
    );
  }

  /**
   * Apply API-specific caching rules to a response
   * @param response Original response
   * @param request Original request
   * @param config Asset configuration
   * @returns Modified response with appropriate caching headers
   */
  applyCaching(response: Response, request: Request, config: AssetConfig): Response {
    const cacheHeaderService = ServiceFactory.getCacheHeaderService();
    const cacheTagService = ServiceFactory.getCacheTagService();
    
    // Create a new response with the same body
    // Apply cache headers, including dynamic TTL based on Age
    const processedResponse = cacheHeaderService.applyCacheHeaders(response, request, config);
    
    // Add API-specific headers
    // Set Vary header for proper cache variations
    if (!processedResponse.headers.has('Vary')) {
      processedResponse.headers.set('Vary', 'Accept, Accept-Encoding, Origin');
    }
    
    // Add standard security headers for API responses if not already present
    if (!processedResponse.headers.has('X-Content-Type-Options')) {
      processedResponse.headers.set('X-Content-Type-Options', 'nosniff');
    }
    
    // Add cache tags for API content
    try {
      const tags = cacheTagService.generateTags(request, 'api');
      if (tags.length > 0) {
        const tagHeader = cacheTagService.formatTagsForHeader(tags);
        processedResponse.headers.set('Cache-Tag', tagHeader);
        logger.debug('Added API cache tags', { count: tags.length });
      }
    } catch (error) {
      logger.warn('Failed to add cache tags to API response', {
        url: request.url,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    return processedResponse;
  }

  /**
   * Get Cloudflare-specific cache options for API content
   * @param request Original request
   * @param config Asset configuration
   * @returns Cloudflare cache options
   */
  getCacheOptions(request: Request, config: AssetConfig): CfCacheOptions {
    const cacheKeyService = ServiceFactory.getCacheKeyService();
    const cacheTagService = ServiceFactory.getCacheTagService();
    
    // Generate cache key
    const cacheKey = cacheKeyService.getCacheKey(request, config);
    
    // Generate cache tags for API assets
    const cacheTags = cacheTagService.generateTags(request, 'api');
    
    // Return Cloudflare-specific options for API responses
    return {
      cacheKey,
      polish: 'off',
      minify: {
        javascript: false,
        css: false,
        html: false
      },
      mirage: false,
      cacheEverything: false, // For APIs, respect standard Cache-Control headers
      cacheTtlByStatus: this.generateCacheTtlByStatus(config),
      cacheTags: cacheTags.length > 0 ? cacheTags : undefined
    };
  }
}