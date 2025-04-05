import { AssetConfig, CfCacheOptions } from '../types/cache-config';
import { CfOptionsService } from './interfaces';
import { CacheKeyGenerator } from './cache-key-service';
import { TagGenerator } from './cache-tag-service';

/**
 * Implementation of CfOptionsService for generating CloudFlare cache options
 */
export class DefaultCfOptionsService implements CfOptionsService {
  /**
   * Generate CloudFlare-specific cache options
   * @param request The request
   * @param config The asset configuration
   * @returns CloudFlare cache options
   */
  public getCfOptions(request: Request, config: AssetConfig): CfCacheOptions {
    // Generate dynamic cache tags based on request and asset type
    const assetType = 'assetType' in config ? (config as any).assetType : 'default';
    const cacheTags = TagGenerator.generateTags(request, assetType);
    
    // Generate cache key
    const cacheKey = CacheKeyGenerator.getCacheKey(request, config);

    return {
      cacheKey,
      polish: config.imageOptimization ? 'lossy' : 'off',
      minify: {
        javascript: false,
        css: config.minifyCss || false,
        html: false,
      },
      mirage: config.imageOptimization || false,
      cacheEverything: true,
      cacheTtlByStatus: {
        '100-199': config.ttl?.info || 0,
        '200-299': config.ttl?.ok || 0,
        '300-399': config.ttl?.redirects || 0,
        '400-499': config.ttl?.clientError || 0,
        '500-599': config.ttl?.serverError || 0,
      },
      cacheTags,
    };
  }
}

// Export default implementation
export const CfOptionsGenerator = new DefaultCfOptionsService();