import { AssetConfig, CfCacheOptions } from '../types/cache-config';
import { BaseCachingStrategy } from './caching-strategy';
import { ServiceFactory } from '../services/service-factory';
import { logger } from '../utils/logger';

/**
 * Caching strategy for media manifest files (m3u8, mpd)
 */
export class ManifestCachingStrategy extends BaseCachingStrategy {
  // Content types this strategy can handle
  private supportedTypes = [
    'application/vnd.apple.mpegurl',
    'application/x-mpegurl',
    'application/dash+xml',
    'application/vnd.ms-sstr+xml',
    'text/plain'
  ];

  /**
   * Check if this strategy can handle the given content type and extension
   * @param contentType The content type to check
   * @returns True if this strategy can handle the content type
   */
  canHandle(contentType: string): boolean {
    return this.supportedTypes.some(type => 
      contentType === type || contentType.startsWith(`${type};`)
    );
  }

  /**
   * Apply manifest-specific caching rules to a response
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
    
    // Add Cache-Control header based on status - manifests get shorter TTLs
    const cacheControlHeader = cacheHeaderService.getCacheControlHeader(
      response.status,
      config
    );
    if (cacheControlHeader) {
      newResponse.headers.set('Cache-Control', cacheControlHeader);
    }
    
    // Add manifest-specific headers
    if (!newResponse.headers.has('Vary')) {
      newResponse.headers.set('Vary', 'Accept-Encoding');
    }
    
    // Add appropriate content-type for manifest files
    const url = new URL(request.url);
    const extension = url.pathname.split('.').pop()?.toLowerCase();
    
    if (extension === 'm3u8') {
      newResponse.headers.set('Content-Type', 'application/vnd.apple.mpegurl');
    } else if (extension === 'mpd') {
      newResponse.headers.set('Content-Type', 'application/dash+xml');
    }
    
    // CORS headers for manifest files (important for cross-domain media players)
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Range');
    
    // Add cache tags for manifest content
    try {
      const tags = cacheTagService.generateTags(request, 'manifest');
      if (tags && tags.length > 0) {
        const tagHeader = cacheTagService.formatTagsForHeader(tags);
        newResponse.headers.set('Cache-Tag', tagHeader);
        logger.debug('Added manifest cache tags', { count: tags.length });
      }
    } catch (error) {
      // Important: we deliberately don't set Cache-Tag header on error
      // We need to remove it in case a header was set earlier
      newResponse.headers.delete('Cache-Tag');
      logger.warn('Failed to add cache tags to manifest response', {
        url: request.url,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    return newResponse;
  }

  /**
   * Get Cloudflare-specific cache options for manifest content
   * @param request Original request
   * @param config Asset configuration
   * @returns Cloudflare cache options
   */
  getCacheOptions(request: Request, config: AssetConfig): CfCacheOptions {
    const cacheKeyService = ServiceFactory.getCacheKeyService();
    const cacheTagService = ServiceFactory.getCacheTagService();
    
    // Generate cache key
    let cacheKey;
    try {
      cacheKey = cacheKeyService.getCacheKey(request, config);
    } catch (error) {
      // Fallback to the URL if we can't generate a cache key
      logger.error('Failed to generate cache key for manifest content', {
        url: request.url,
        error: error instanceof Error ? error.message : String(error)
      });
      cacheKey = request.url;
    }
    
    // Generate cache tags for manifest assets
    const cacheTags = cacheTagService.generateTags(request, 'manifest');
    
    // Return Cloudflare-specific options for manifest files
    // Manifest files have much shorter TTLs than media content
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
      cacheTags: cacheTags && cacheTags.length > 0 ? cacheTags : undefined
    };
  }
}