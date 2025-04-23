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
   * @param response Optional response object to extract Age header for dynamic TTL calculation
   * @returns A Cache-Control header value or empty string
   */
  public getCacheControlHeader(status: number, config: AssetConfig, response?: Response): string {
    if (!config.ttl) return '';

    // Map status code to appropriate TTL
    let ttl = 0;
    if (status >= 200 && status < 300) ttl = config.ttl.ok;
    else if (status >= 300 && status < 400) ttl = config.ttl.redirects;
    else if (status >= 400 && status < 500) ttl = config.ttl.clientError;
    else if (status >= 500 && status < 600) ttl = config.ttl.serverError;

    // If no TTL or response is available, use the standard logic
    if (ttl <= 0 || !response) {
      return ttl > 0 ? `public, max-age=${ttl}` : 'no-store';
    }

    // Extract Age header if present to determine remaining TTL
    const ageHeader = response.headers.get('Age');
    let age = 0;
    if (ageHeader) {
      const parsedAge = parseInt(ageHeader, 10);
      if (!isNaN(parsedAge) && parsedAge >= 0) {
        age = parsedAge;
      }
    }

    // Calculate remaining TTL for the browser cache
    const remainingTtl = Math.max(0, Math.floor(ttl - age));
    
    // Log the calculation for debugging
    logger.debug('Dynamic TTL calculation', {
      originalTtl: ttl,
      ageHeader,
      parsedAge: age,
      remainingTtl,
      status
    });
    
    // Return appropriate Cache-Control header
    return remainingTtl > 0 ? `public, max-age=${remainingTtl}` : 'no-store';
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
    
    // Set Cache-Control header based on response status and Age header
    const cacheControl = this.getCacheControlHeader(response.status, config, response);
    if (cacheControl) {
      newResponse.headers.set('Cache-Control', cacheControl);
    }
    
    // Keep the Age header in the response to browsers
    // This allows browsers to see how long the resource has been in the edge cache
    
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
      // Get the Age header value before we remove it for debugging purposes
      const ageHeader = response.headers.get('Age');
      
      newResponse.headers.set(
        'x-cache-debug',
        JSON.stringify({
          assetType,
          cacheKey: new URL(request.url).pathname,
          ttl: config.ttl,
          cacheTags,
          cfAge: ageHeader, // Include original CF Age header for debugging
          calculatedCacheControl: cacheControl, // Include the calculated Cache-Control value
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
      cacheControl,
      originalAge: response.headers.get('Age'),
      dynamicTtlAdjusted: response.headers.get('Age') ? true : false
    });
    
    return newResponse;
  }
}

// For backwards compatibility during refactoring
export class DefaultCacheHeaderService extends CacheHeaderServiceImpl {}