import { AssetConfig } from '../types/cache-config';
import { CacheKeyService } from './interfaces';

/**
 * Implementation of CacheKeyService for generating cache keys
 */
export class DefaultCacheKeyService implements CacheKeyService {
  /**
   * Generate a cache key for the given request and config
   * @param request The request to generate a key for
   * @param config The asset configuration
   * @returns A cache key string
   */
  public getCacheKey(request: Request, config: AssetConfig): string {
    const url = new URL(request.url);
    
    return config.useQueryInCacheKey
      ? `${url.hostname}${url.pathname}${url.search}`
      : `${url.hostname}${url.pathname}`;
  }
}

// Export default implementation
export const CacheKeyGenerator = new DefaultCacheKeyService();