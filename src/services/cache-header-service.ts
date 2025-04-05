import { AssetConfig } from '../types/cache-config';
import { CacheHeaderService } from './interfaces';
import { ServiceFactory } from './service-factory';
import { logger } from '../utils/logger';

/**
 * Implementation of CacheHeaderService for managing cache headers
 */
export class CacheHeaderServiceImpl implements CacheHeaderService {
  /**
   * Create a new CacheHeaderServiceImpl
   */
  constructor() {
    logger.debug('CacheHeaderServiceImpl initialized');
  }

  /**
   * Calculate Cache-Control header based on response status and config
   * @param status The HTTP status code
   * @param config The asset configuration
   * @returns A Cache-Control header value or empty string
   */
  public getCacheControlHeader(status: number, config: AssetConfig): string {
    if (!config.ttl) return '';

    // Map status code to appropriate TTL
    let ttl = 0;
    if (status >= 200 && status < 300) ttl = config.ttl.ok;
    else if (status >= 300 && status < 400) ttl = config.ttl.redirects;
    else if (status >= 400 && status < 500) ttl = config.ttl.clientError;
    else if (status >= 500 && status < 600) ttl = config.ttl.serverError;

    return ttl > 0 ? `public, max-age=${ttl}` : '';
  }
  
  /**
   * Apply cache headers to a response
   * @param response The response to modify
   * @param request The original request
   * @param config The asset configuration
   * @returns The modified response
   */
  public applyCacheHeaders(
    response: Response, 
    request: Request, 
    config: AssetConfig
  ): Response {
    // Create a new response to modify headers
    const newResponse = new Response(response.body, response);
    
    // Get dependencies through factory
    const cacheTagService = ServiceFactory.getCacheTagService();
    
    // Set Cache-Control header based on response status
    const cacheControl = this.getCacheControlHeader(response.status, config);
    if (cacheControl) {
      newResponse.headers.set('Cache-Control', cacheControl);
    }
    
    // Set Cache-Tag header for debugging and external systems
    const assetType = 'assetType' in config ? (config as Record<string, string>).assetType : 'default';
    const cacheTags = cacheTagService.generateTags(request, assetType);
    if (cacheTags && cacheTags.length > 0) {
      // Format tags according to Cloudflare's requirements
      const formattedTags = cacheTagService.formatTagsForHeader(cacheTags);
      if (formattedTags) {
        newResponse.headers.set('Cache-Tag', formattedTags);
      }
    }
    
    // Add debug header if needed - check both request header and environment variable
    const debugMode = request.headers.get('debug') === 'true' || 
                     (globalThis as unknown as Record<string, string>).DEBUG_MODE === 'true';
    
    if (debugMode) {
      newResponse.headers.set(
        'x-cache-debug',
        JSON.stringify({
          assetType,
          cacheKey: new URL(request.url).pathname,
          ttl: config.ttl,
          cacheTags,
          environment: (globalThis as unknown as Record<string, string>).ENVIRONMENT || 'development',
          worker: {
            name: (globalThis as unknown as Record<string, string>).name || 'caching',
            version: (globalThis as unknown as Record<string, string>).VERSION || 'dev'
          }
        }),
      );
    }
    
    logger.debug('Applied cache headers', {
      url: request.url,
      statusCode: response.status,
      assetType,
      cacheControl
    });
    
    return newResponse;
  }
}

// For backwards compatibility during refactoring
export class DefaultCacheHeaderService extends CacheHeaderServiceImpl {}