import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceFactory } from '../services/service-factory';
import { AssetTypeService, CacheKeyService, CacheHeaderService, CacheTagService, CfOptionsService } from '../services/interfaces';
import { logger } from '../utils/logger';

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}));

// Setup environment variables for testing
beforeEach(() => {
  // Setup global environment variables for testing
  (globalThis as any).CACHE_TAG_NAMESPACE = 'test';
  (globalThis as any).MAX_CACHE_TAGS = '10';
  (globalThis as any).ENVIRONMENT = 'test';
  (globalThis as any).LOG_LEVEL = 'DEBUG';
  (globalThis as any).DEBUG_MODE = 'true';
  vi.clearAllMocks();
});

describe('ServiceFactory', () => {
  describe('Singleton pattern', () => {
    it('should return the same service instance on multiple calls', () => {
      const service1 = ServiceFactory.getCacheKeyService();
      const service2 = ServiceFactory.getCacheKeyService();
      
      expect(service1).toBe(service2);
    });
    
    it('should return the same instance for all services', () => {
      const assetTypeService1 = ServiceFactory.getAssetTypeService();
      const assetTypeService2 = ServiceFactory.getAssetTypeService();
      const cacheKeyService1 = ServiceFactory.getCacheKeyService();
      const cacheKeyService2 = ServiceFactory.getCacheKeyService();
      const cacheHeaderService1 = ServiceFactory.getCacheHeaderService();
      const cacheHeaderService2 = ServiceFactory.getCacheHeaderService();
      const cacheTagService1 = ServiceFactory.getCacheTagService();
      const cacheTagService2 = ServiceFactory.getCacheTagService();
      const cfOptionsService1 = ServiceFactory.getCfOptionsService();
      const cfOptionsService2 = ServiceFactory.getCfOptionsService();
      
      expect(assetTypeService1).toBe(assetTypeService2);
      expect(cacheKeyService1).toBe(cacheKeyService2);
      expect(cacheHeaderService1).toBe(cacheHeaderService2);
      expect(cacheTagService1).toBe(cacheTagService2);
      expect(cfOptionsService1).toBe(cfOptionsService2);
    });
  });
  
  describe('Service availability', () => {
    it('should have all services available immediately', () => {
      // Test that all services can be retrieved
      expect(ServiceFactory.getAssetTypeService()).toBeDefined();
      expect(ServiceFactory.getCacheKeyService()).toBeDefined();
      expect(ServiceFactory.getCacheHeaderService()).toBeDefined();
      expect(ServiceFactory.getCacheTagService()).toBeDefined();
      expect(ServiceFactory.getCfOptionsService()).toBeDefined();
      expect(ServiceFactory.getConfigService()).toBeDefined();
    });
    
    it('should provide correct types for all services', () => {
      // Check type interfaces are correctly implemented
      const assetTypeService = ServiceFactory.getAssetTypeService();
      const cacheKeyService = ServiceFactory.getCacheKeyService();
      const cacheHeaderService = ServiceFactory.getCacheHeaderService();
      const cacheTagService = ServiceFactory.getCacheTagService();
      const cfOptionsService = ServiceFactory.getCfOptionsService();
      
      expect(typeof assetTypeService.getConfigForRequest).toBe('function');
      expect(typeof cacheKeyService.getCacheKey).toBe('function');
      expect(typeof cacheHeaderService.getCacheControlHeader).toBe('function');
      expect(typeof cacheHeaderService.applyCacheHeaders).toBe('function');
      expect(typeof cacheTagService.generateTags).toBe('function');
      expect(typeof cacheTagService.validateTag).toBe('function');
      expect(typeof cacheTagService.formatTagsForHeader).toBe('function');
      expect(typeof cfOptionsService.getCfOptions).toBe('function');
    });
  });
  
  describe('Error handling', () => {
    it('should always return a valid service even under error conditions', () => {
      // Test with environment variables missing
      delete (globalThis as any).CACHE_TAG_NAMESPACE;
      delete (globalThis as any).MAX_CACHE_TAGS;
      
      // Services should still be available
      expect(ServiceFactory.getCacheTagService()).toBeDefined();
      expect(ServiceFactory.getCacheKeyService()).toBeDefined();
    });
  });
});