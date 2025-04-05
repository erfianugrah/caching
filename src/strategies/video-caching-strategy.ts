import { AssetConfig, CfCacheOptions } from '../types/cache-config';
import { BaseCachingStrategy } from './caching-strategy';
import { ServiceFactory } from '../services/service-factory';
import { logger } from '../utils/logger';

/**
 * Caching strategy for video content
 */
export class VideoCachingStrategy extends BaseCachingStrategy {
  // Content types this strategy can handle
  private supportedTypes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/x-matroska',
    'video/x-msvideo',
    'video/quicktime',
    'video/x-ms-wmv',
    'video/mpeg',
    'video/3gpp',
    'application/x-mpegURL', // HLS manifest
    'application/dash+xml' // DASH manifest
  ];

  /**
   * Check if this strategy can handle the given content type
   * @param contentType The content type to check
   * @returns True if this strategy can handle the content type
   */
  canHandle(contentType: string): boolean {
    return this.supportedTypes.some(type => contentType.startsWith(type));
  }

  /**
   * Apply video-specific caching rules to a response
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
    
    // Add video-specific headers
    newResponse.headers.set('Accept-Ranges', 'bytes');
    
    // Add cache tags for video content
    try {
      const tags = cacheTagService.generateTags(request, 'video');
      if (tags.length > 0) {
        const tagHeader = cacheTagService.formatTagsForHeader(tags);
        newResponse.headers.set('Cache-Tag', tagHeader);
        logger.debug('Added video cache tags', { count: tags.length });
      }
    } catch (error) {
      logger.warn('Failed to add cache tags to video response', {
        url: request.url,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    return newResponse;
  }

  /**
   * Get Cloudflare-specific cache options for video content
   * @param request Original request
   * @param config Asset configuration
   * @returns Cloudflare cache options
   */
  getCacheOptions(request: Request, config: AssetConfig): CfCacheOptions {
    const cacheKeyService = ServiceFactory.getCacheKeyService();
    const cacheTagService = ServiceFactory.getCacheTagService();
    
    // Generate cache key
    const cacheKey = cacheKeyService.getCacheKey(request, config);
    
    // Generate cache tags for videos
    const cacheTags = cacheTagService.generateTags(request, 'video');
    
    // Return Cloudflare-specific options optimized for video
    return {
      cacheKey,
      polish: 'off',
      minify: {
        javascript: false,
        css: false,
        html: false
      },
      mirage: false,
      cacheEverything: true,
      cacheTtlByStatus: this.generateCacheTtlByStatus(config),
      cacheTags: cacheTags.length > 0 ? cacheTags : undefined
    };
  }
}