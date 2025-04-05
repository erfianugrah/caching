import { DefaultAssetService } from './asset-type-service';
import { CacheKeyGenerator } from './cache-key-service';
import { CacheHeaderManager } from './cache-header-service';
import { TagGenerator } from './cache-tag-service';
import { CfOptionsGenerator } from './cf-options-service';

/**
 * Service container providing access to all caching services
 */
export const Services = {
  assetType: DefaultAssetService,
  cacheKey: CacheKeyGenerator,
  cacheHeader: CacheHeaderManager,
  cacheTag: TagGenerator,
  cfOptions: CfOptionsGenerator,
};

// Re-export all services
export * from './asset-type-service';
export * from './cache-key-service';
export * from './cache-header-service'; 
export * from './cache-tag-service';
export * from './cf-options-service';
export * from './interfaces';