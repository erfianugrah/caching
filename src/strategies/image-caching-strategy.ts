import { AssetConfig, CfCacheOptions } from '../types/cache-config';
import { BaseCachingStrategy } from './caching-strategy';
import { ServiceFactory } from '../services/service-factory';
import { logger } from '../utils/logger';

/**
 * Caching strategy for image content
 */
export class ImageCachingStrategy extends BaseCachingStrategy {
  // Content types this strategy can handle
  private supportedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/tiff',
    'image/x-icon'
  ];

  /**
   * Check if this strategy can handle the given content type
   * @param contentType The content type to check
   * @returns True if this strategy can handle the content type
   */
  canHandle(contentType: string): boolean {
    return this.supportedTypes.some(type => contentType === type);
  }

  /**
   * Apply image-specific caching rules to a response
   * @param response Original response
   * @param request Original request
   * @param config Asset configuration
   * @returns Modified response with appropriate caching headers
   */
  applyCaching(response: Response, request: Request, config: AssetConfig): Response {
    const cacheHeaderService = ServiceFactory.getCacheHeaderService();
    const cacheTagService = ServiceFactory.getCacheTagService();
    
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
    
    // Add image-specific headers
    if (!newResponse.headers.has('Vary')) {
      newResponse.headers.set('Vary', 'Accept');
    }
    
    // Add cache tags for image content
    try {
      const tags = cacheTagService.generateTags(request, 'image');
      if (tags.length > 0) {
        const tagHeader = cacheTagService.formatTagsForHeader(tags);
        newResponse.headers.set('Cache-Tag', tagHeader);
        logger.debug('Added image cache tags', { count: tags.length });
      }
    } catch (error) {
      logger.warn('Failed to add cache tags to image response', {
        url: request.url,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    return newResponse;
  }

  /**
   * Get Cloudflare-specific cache options for image content
   * @param request Original request
   * @param config Asset configuration
   * @returns Cloudflare cache options
   */
  getCacheOptions(request: Request, config: AssetConfig): CfCacheOptions {
    const cacheKeyService = ServiceFactory.getCacheKeyService();
    const cacheTagService = ServiceFactory.getCacheTagService();
    
    // Generate cache key
    const cacheKey = cacheKeyService.getCacheKey(request, config);
    
    // Generate cache tags for images
    const cacheTags = cacheTagService.generateTags(request, 'image');
    
    // Return Cloudflare-specific options optimized for images
    return {
      cacheKey,
      // Enable Polish for image optimization if configured
      polish: config.imageOptimization ? 'lossy' : 'off',
      minify: {
        javascript: false,
        css: false,
        html: false
      },
      mirage: config.imageOptimization || false,
      cacheEverything: true,
      cacheTtlByStatus: this.generateCacheTtlByStatus(config),
      cacheTags: cacheTags.length > 0 ? cacheTags : undefined
    };
  }
}