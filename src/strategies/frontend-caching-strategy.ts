import { AssetConfig, CfCacheOptions } from '../types/cache-config';
import { BaseCachingStrategy } from './caching-strategy';
import { ServiceFactory } from '../services/service-factory';
import { logger } from '../utils/logger';

/**
 * Caching strategy for frontend assets like CSS and JS
 */
export class FrontEndCachingStrategy extends BaseCachingStrategy {
  // Content types this strategy can handle
  private supportedTypes = [
    'text/css',
    'text/javascript',
    'application/javascript',
    'application/x-javascript'
  ];

  /**
   * Check if this strategy can handle the given content type
   * @param contentType The content type to check
   * @returns True if this strategy can handle the content type
   */
  canHandle(contentType: string): boolean {
    return this.supportedTypes.some(type => 
      // Check for exact matches or content types that start with our supported types
      // (to handle variants like text/css;charset=UTF-8)
      contentType === type || contentType.startsWith(`${type};`)
    );
  }

  /**
   * Apply frontend-specific caching rules to a response
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
    
    // Add frontend-specific headers
    if (!processedResponse.headers.has('Vary')) {
      processedResponse.headers.set('Vary', 'Accept-Encoding');
    }
    
    // Add cache tags for frontend content
    try {
      const tags = cacheTagService.generateTags(request, 'frontEnd');
      if (tags.length > 0) {
        const tagHeader = cacheTagService.formatTagsForHeader(tags);
        processedResponse.headers.set('Cache-Tag', tagHeader);
        logger.debug('Added frontend cache tags', { count: tags.length });
      }
    } catch (error) {
      logger.warn('Failed to add cache tags to frontend response', {
        url: request.url,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    return processedResponse;
  }

  /**
   * Get Cloudflare-specific cache options for frontend content
   * @param request Original request
   * @param config Asset configuration
   * @returns Cloudflare cache options
   */
  getCacheOptions(request: Request, config: AssetConfig): CfCacheOptions {
    const cacheKeyService = ServiceFactory.getCacheKeyService();
    const cacheTagService = ServiceFactory.getCacheTagService();
    
    // Generate cache key
    const cacheKey = cacheKeyService.getCacheKey(request, config);
    
    // Generate cache tags for frontend assets
    const cacheTags = cacheTagService.generateTags(request, 'frontEnd');
    
    // Return Cloudflare-specific options optimized for frontend assets
    return {
      cacheKey,
      polish: 'off',
      minify: {
        javascript: true,
        css: Boolean(config.minifyCss),
        html: false
      },
      mirage: false,
      cacheEverything: true,
      cacheTtlByStatus: this.generateCacheTtlByStatus(config),
      cacheTags: cacheTags.length > 0 ? cacheTags : undefined
    };
  }
}