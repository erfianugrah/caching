/**
 * Services module exports
 */

// Export interfaces for public use
export * from './interfaces';

// Export the ServiceFactory as the primary way to access services
export * from './service-factory';

// Export the config service
export { ConfigService } from './config-service';

// Export asset type configs for testing
export { defaultAssetConfigs } from './asset-type-service';

// Export the RequestProcessingService for direct use
export { DefaultRequestProcessingService } from './request-processing-service';

/**
 * Backwards compatibility layer for tests
 * @deprecated Use ServiceFactory instead
 */
export const Services = {
  get assetType() {
    return ServiceFactory.getAssetTypeService();
  },
  get cacheKey() {
    return ServiceFactory.getCacheKeyService();
  },
  get cacheHeader() {
    return ServiceFactory.getCacheHeaderService();
  },
  get cacheTag() {
    return ServiceFactory.getCacheTagService();
  },
  get cfOptions() {
    return ServiceFactory.getCfOptionsService();
  },
  get requestProcessing() {
    return ServiceFactory.getRequestProcessingService();
  }
};

import { ServiceFactory } from './service-factory';