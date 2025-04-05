import { AssetConfig } from '../types/cache-config';
import { CacheKeyService } from './interfaces';
import { logger } from '../utils/logger';

/**
 * Implementation of CacheKeyService for generating cache keys
 */
export class CacheKeyServiceImpl implements CacheKeyService {
  /**
   * Create a new CacheKeyServiceImpl
   */
  constructor() {
    logger.debug('CacheKeyServiceImpl initialized');
  }
  
  /**
   * Generate a cache key for the given request and config
   * @param request The request to generate a key for
   * @param config The asset configuration
   * @returns A cache key string
   */
  public getCacheKey(request: Request, config: AssetConfig): string {
    const url = new URL(request.url);
    
    // Handle basic case first (for backward compatibility)
    if (!config.queryParams && !config.variants) {
      const cacheKey = config.useQueryInCacheKey
        ? `${url.hostname}${url.pathname}${url.search}`
        : `${url.hostname}${url.pathname}`;
        
      logger.debug('Cache key generated (legacy mode)', { cacheKey });
      return cacheKey;
    }
    
    // Base key always includes hostname and pathname
    let cacheKey = `${url.hostname}${url.pathname}`;
    
    // Add query parameters if configured
    if (config.queryParams?.include && url.search) {
      const queryString = this.processQueryParams(url, config);
      if (queryString) {
        cacheKey += queryString;
      }
    }
    
    // Add variants if configured
    if (config.variants) {
      const variantKey = this.processVariants(request, config);
      if (variantKey) {
        cacheKey += `|${variantKey}`;
      }
    }
    
    logger.debug('Cache key generated', { cacheKey });
    return cacheKey;
  }
  
  /**
   * Process variants based on configuration
   * @param request The request to process
   * @param config The asset configuration
   * @returns A variant key string or empty string if no variants
   */
  private processVariants(request: Request, config: AssetConfig): string {
    if (!config.variants) {
      return '';
    }
    
    const variants: string[] = [];
    
    // Process header variants
    if (config.variants.headers?.length) {
      for (const headerName of config.variants.headers) {
        const headerValue = request.headers.get(headerName);
        if (headerValue) {
          variants.push(`h:${headerName}=${headerValue}`);
        }
      }
    }
    
    // Process Accept header
    if (config.variants.useAcceptHeader) {
      const accept = request.headers.get('Accept');
      if (accept) {
        // Simplify Accept header to main content type
        const mainType = accept.split(',')[0]?.trim();
        if (mainType) {
          variants.push(`accept=${mainType}`);
        }
      }
    }
    
    // Process User-Agent
    if (config.variants.useUserAgent) {
      const ua = request.headers.get('User-Agent');
      if (ua) {
        // Extract device category (mobile/desktop) from UA
        const isMobile = /mobile|android|iphone|ipad|ipod/i.test(ua);
        variants.push(`ua=${isMobile ? 'mobile' : 'desktop'}`);
      }
    }
    
    // Process client hints
    if (config.variants.clientHints?.length) {
      for (const hint of config.variants.clientHints) {
        const hintHeader = `Sec-CH-${hint}`;
        const hintValue = request.headers.get(hintHeader);
        if (hintValue) {
          variants.push(`ch:${hint}=${hintValue}`);
        }
      }
    }
    
    // Process cookies
    if (config.variants.cookies?.length) {
      const cookieHeader = request.headers.get('Cookie');
      if (cookieHeader) {
        const cookies = this.parseCookies(cookieHeader);
        for (const cookieName of config.variants.cookies) {
          if (cookies[cookieName]) {
            variants.push(`c:${cookieName}=${cookies[cookieName]}`);
          }
        }
      }
    }
    
    // Client IP variant
    if (config.variants.useClientIP) {
      const clientIP = request.headers.get('CF-Connecting-IP') || 
                       request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim();
      if (clientIP) {
        variants.push(`ip=${clientIP}`);
      }
    }
    
    return variants.join('&');
  }
  
  /**
   * Parse cookies from Cookie header
   * @param cookieHeader The Cookie header value
   * @returns An object of cookie name-value pairs
   */
  private parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    
    cookieHeader.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        cookies[name] = value;
      }
    });
    
    return cookies;
  }
  
  /**
   * Process query parameters based on configuration
   * @param url The URL to process
   * @param config The asset configuration
   * @returns A processed query string
   */
  private processQueryParams(url: URL, config: AssetConfig): string {
    if (!config.queryParams) {
      return url.search; // Return as is if no config
    }
    
    // Get all search parameters
    const searchParams = url.searchParams;
    const params: [string, string][] = [];
    
    // Convert to array of [key, value] pairs for processing
    for (const [key, value] of searchParams.entries()) {
      // Skip excluded parameters
      if (config.queryParams.excludeParams?.includes(key)) {
        continue;
      }
      
      // Only include specific parameters if configured
      if (config.queryParams.includeParams?.length && 
          !config.queryParams.includeParams.includes(key)) {
        continue;
      }
      
      // Normalize values if configured
      const processedValue = config.queryParams.normalizeValues 
        ? value.toLowerCase() 
        : value;
      
      params.push([key, processedValue]);
    }
    
    // Sort parameters if configured
    if (config.queryParams.sortParams) {
      params.sort((a, b) => a[0].localeCompare(b[0]));
    }
    
    // Reconstruct query string
    if (params.length === 0) {
      return '';
    }
    
    // Build the query string
    const queryString = '?' + params.map(([key, value]) => {
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    }).join('&');
    
    return queryString;
  }
}

// For backwards compatibility during refactoring
export class DefaultCacheKeyService extends CacheKeyServiceImpl {}