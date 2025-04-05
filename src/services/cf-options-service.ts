import { AssetConfig, CfCacheOptions } from '../types/cache-config';
import { CfOptionsService } from './interfaces';
import { ServiceFactory } from './service-factory';
import { logger } from '../utils/logger';

/**
 * Implementation of CfOptionsService for generating CloudFlare cache options
 */
export class CfOptionsServiceImpl implements CfOptionsService {
  /**
   * Create a new CfOptionsServiceImpl
   */
  constructor() {
    logger.debug('CfOptionsServiceImpl initialized');
  }

  /**
   * Generate CloudFlare-specific cache options
   * @param request The request
   * @param config The asset configuration
   * @returns CloudFlare cache options
   */
  public getCfOptions(request: Request, config: AssetConfig): CfCacheOptions {
    // Get the services through factory to avoid circular dependencies
    const cacheTagService = ServiceFactory.getCacheTagService();
    const cacheKeyService = ServiceFactory.getCacheKeyService();
    
    // Generate dynamic cache tags based on request and asset type
    const assetType = 'assetType' in config ? (config as Record<string, string>).assetType : 'default';
    const cacheTags = cacheTagService.generateTags(request, assetType);
    
    // Generate cache key
    const cacheKey = cacheKeyService.getCacheKey(request, config);

    const options: CfCacheOptions = {
      cacheKey,
      polish: config.imageOptimization ? 'lossy' as const : 'off' as const,
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
    
    logger.debug('Generated CF options', { 
      assetType, 
      cacheKey,
      cacheTags: cacheTags.length
    });
    
    return options;
  }
}

// For backwards compatibility during refactoring
export class DefaultCfOptionsService extends CfOptionsServiceImpl {}