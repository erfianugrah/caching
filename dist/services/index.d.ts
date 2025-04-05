/**
 * Service container providing access to all caching services
 */
export declare const Services: {
    assetType: import("./asset-type-service").DefaultAssetTypeService;
    cacheKey: import("./cache-key-service").DefaultCacheKeyService;
    cacheHeader: import("./cache-header-service").DefaultCacheHeaderService;
    cacheTag: import("./cache-tag-service").DefaultCacheTagService;
    cfOptions: import("./cf-options-service").DefaultCfOptionsService;
};
export * from './asset-type-service';
export * from './cache-key-service';
export * from './cache-header-service';
export * from './cache-tag-service';
export * from './cf-options-service';
export * from './interfaces';
