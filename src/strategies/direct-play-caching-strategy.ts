import { AssetConfig, CfCacheOptions } from '../types/cache-config';
import { BaseCachingStrategy } from './caching-strategy';
import { ServiceFactory } from '../services/service-factory';
import { logger } from '../utils/logger';

/**
 * Caching strategy for direct play/download assets
 */
export class DirectPlayCachingStrategy extends BaseCachingStrategy {
  /**
   * Check if this strategy can handle the given content type
   * @param contentType The content type to check
   * @returns True if this strategy can handle paths containing /Download
   */
  canHandle(_contentType: string): boolean { // eslint-disable-line @typescript-eslint/no-unused-vars
    // Direct play is usually identified by URL pattern rather than content type
    // This will be handled by the command layer which checks the assetType
    return false;
  }

  /**
   * Apply direct play specific caching rules to a response
   * @param response Original response
   * @param request Original request
   * @param config Asset configuration
   * @returns Modified response with appropriate caching headers
   */
  applyCaching(response: Response, request: Request, config: AssetConfig): Response {
    const cacheHeaderService = ServiceFactory.getCacheHeaderService();
    const cacheTagService = ServiceFactory.getCacheTagService();
    
    // Create a new response with the same body
    // Add Cache-Control header based on status
    // Use applyCacheHeaders instead of getCacheControlHeader
    const processedResponse = cacheHeaderService.applyCacheHeaders(response, request, config);
    
    // Ensure appropriate content disposition headers for downloads
    if (!processedResponse.headers.has('Content-Disposition')) {
      // Extract filename from URL path
      const url = new URL(request.url);
      const encodedFilename = url.pathname.split('/').pop() || 'file';
      // Decode the filename to handle spaces and special characters
      const filename = decodeURIComponent(encodedFilename);
      processedResponse.headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    }
    
    // Add cache tags for direct play/download content
    try {
      const tags = cacheTagService.generateTags(request, 'directPlay');
      if (tags && tags.length > 0) {
        const tagHeader = cacheTagService.formatTagsForHeader(tags);
        processedResponse.headers.set('Cache-Tag', tagHeader);
        logger.debug('Added direct play cache tags', { count: tags.length });
      }
    } catch (error) {
      // Important: we deliberately don't set Cache-Tag header on error
      // We need to remove it in case a header was set earlier
      processedResponse.headers.delete('Cache-Tag');
      logger.warn('Failed to add cache tags to direct play response', {
        url: request.url,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    return processedResponse;
  }

  /**
   * Get Cloudflare-specific cache options for direct play/download content
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
      logger.error('Failed to generate cache key for direct play content', {
        url: request.url,
        error: error instanceof Error ? error.message : String(error)
      });
      cacheKey = request.url;
    }
    
    // Generate cache tags for direct play/download assets
    const cacheTags = cacheTagService.generateTags(request, 'directPlay');
    
    // Direct play files should be served as-is
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