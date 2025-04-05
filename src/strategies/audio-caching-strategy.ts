import { AssetConfig, CfCacheOptions } from '../types/cache-config';
import { BaseCachingStrategy } from './caching-strategy';
import { ServiceFactory } from '../services/service-factory';
import { logger } from '../utils/logger';

/**
 * Caching strategy for audio files like MP3, AAC, etc.
 */
export class AudioCachingStrategy extends BaseCachingStrategy {
  // Content types this strategy can handle
  private supportedTypes = [
    'audio/mpeg',
    'audio/mp3',
    'audio/aac',
    'audio/wav',
    'audio/ogg',
    'audio/flac',
    'audio/x-flac',
    'audio/opus',
    'audio/webm',
    'audio/x-wav'
  ];

  /**
   * Check if this strategy can handle the given content type
   * @param contentType The content type to check
   * @returns True if this strategy can handle the content type
   */
  canHandle(contentType: string): boolean {
    return this.supportedTypes.some(type => 
      // Check for exact matches or content types that start with our supported types
      contentType === type || contentType.startsWith(`${type};`) || contentType.startsWith('audio/')
    );
  }

  /**
   * Apply audio-specific caching rules to a response
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
    if (cacheControlHeader) {
      newResponse.headers.set('Cache-Control', cacheControlHeader);
    }
    
    // Add audio-specific headers
    if (!newResponse.headers.has('Vary')) {
      newResponse.headers.set('Vary', 'Accept-Encoding');
    }
    
    // Add appropriate content disposition if not present
    if (!newResponse.headers.has('Content-Disposition')) {
      newResponse.headers.set('Content-Disposition', 'inline');
    }
    
    // Add cache tags for audio content
    try {
      const tags = cacheTagService.generateTags(request, 'audio');
      if (tags && tags.length > 0) {
        const tagHeader = cacheTagService.formatTagsForHeader(tags);
        newResponse.headers.set('Cache-Tag', tagHeader);
        logger.debug('Added audio cache tags', { count: tags.length });
      }
    } catch (error) {
      // Important: we deliberately don't set Cache-Tag header on error
      // We need to remove it in case a header was set earlier
      newResponse.headers.delete('Cache-Tag');
      logger.warn('Failed to add cache tags to audio response', {
        url: request.url,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    return newResponse;
  }

  /**
   * Get Cloudflare-specific cache options for audio content
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
      logger.error('Failed to generate cache key for audio content', {
        url: request.url,
        error: error instanceof Error ? error.message : String(error)
      });
      cacheKey = request.url;
    }
    
    // Generate cache tags for audio assets
    const cacheTags = cacheTagService.generateTags(request, 'audio');
    
    // Audio files are typically not processed further
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