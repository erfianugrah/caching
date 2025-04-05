import { AssetConfig } from '../types/cache-config';
import { CacheKeyService } from './interfaces';
/**
 * Implementation of CacheKeyService for generating cache keys
 */
export declare class DefaultCacheKeyService implements CacheKeyService {
    /**
     * Generate a cache key for the given request and config
     * @param request The request to generate a key for
     * @param config The asset configuration
     * @returns A cache key string
     */
    getCacheKey(request: Request, config: AssetConfig): string;
}
export declare const CacheKeyGenerator: DefaultCacheKeyService;
