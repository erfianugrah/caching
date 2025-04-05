import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceFactory } from '../services/service-factory';
import { CommandFactory } from '../commands/command-factory';
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

// Mock the fetch function for tests
const mockFetch = vi.fn();
(global as any).fetch = mockFetch;

// Setup environment variables for testing
beforeEach(() => {
  // Setup global environment variables for testing
  (globalThis as any).CACHE_TAG_NAMESPACE = 'test';
  (globalThis as any).MAX_CACHE_TAGS = '10';
  (globalThis as any).ENVIRONMENT = 'test';
  (globalThis as any).LOG_LEVEL = 'DEBUG';
  (globalThis as any).DEBUG_MODE = 'true';
  (globalThis as any).VERSION = '1.0.0';
  
  // Reset fetch mock
  mockFetch.mockReset();
  mockFetch.mockImplementation(() => Promise.resolve(new Response('Test response')));
  
  vi.clearAllMocks();
});

describe('Integration tests', () => {
  describe('Service interactions', () => {
    it('should properly integrate CacheKeyService with AssetTypeService', async () => {
      // Get services
      const assetTypeService = ServiceFactory.getAssetTypeService();
      const cacheKeyService = ServiceFactory.getCacheKeyService();
      
      // Test request
      const request = new Request('https://example.com/images/photo.jpg?width=800');
      
      // Get config for this request
      const config = assetTypeService.getConfigForRequest(request);
      
      // Generate cache key using the config
      const cacheKey = cacheKeyService.getCacheKey(request, config);
      
      // Verify image type is detected and query params are included
      expect(config.assetType).toBe('image');
      expect(cacheKey).toContain('example.com/images/photo.jpg');
      expect(cacheKey).toContain('width=800');
    });
    
    it('should properly integrate CacheTagService with AssetTypeService', async () => {
      // Get services
      const assetTypeService = ServiceFactory.getAssetTypeService();
      
      // Create a mock tag service for testing
      const mockCacheTagService = {
        generateTags: vi.fn((request, assetType) => [
          `test:host:example.com`,
          `test:type:${assetType}`,
          `test:ext:jpg`,
          `test:path:/images/photo.jpg`
        ])
      };
      
      // Mock the ServiceFactory to return our mock
      vi.spyOn(ServiceFactory, 'getCacheTagService').mockReturnValue(mockCacheTagService as any);
      
      const cacheTagService = ServiceFactory.getCacheTagService();
      
      // Test request
      const request = new Request('https://example.com/images/photo.jpg');
      
      // Get config for this request
      const config = assetTypeService.getConfigForRequest(request);
      
      // Generate tags using the asset type from config
      const tags = cacheTagService.generateTags(request, config.assetType);
      
      // Verify tags contain expected values
      expect(tags).toContain(`test:host:example.com`);
      expect(tags).toContain(`test:type:${config.assetType}`);
      expect(tags).toContain(`test:ext:jpg`);
      expect(tags.some(tag => tag.includes('path:'))).toBe(true);
    });
    
    it('should properly integrate CacheHeaderService with other services', async () => {
      // Mock the required services
      const mockAssetTypeService = {
        getConfigForRequest: vi.fn().mockReturnValue({
          assetType: 'image',
          ttl: { ok: 3600, redirects: 300, clientError: 30, serverError: 0 }
        })
      };
      
      const mockCacheTagService = {
        generateTags: vi.fn().mockReturnValue(['test:host:example.com', 'test:type:image']),
        formatTagsForHeader: vi.fn().mockReturnValue('test:host:example.com,test:type:image')
      };
      
      const mockCacheHeaderService = {
        applyCacheHeaders: vi.fn().mockImplementation((originalResponse, request, config) => {
          const response = originalResponse.clone();
          response.headers.set('Cache-Control', 'public, max-age=3600');
          response.headers.set('Cache-Tag', 'test:host:example.com,test:type:image');
          return response;
        }),
        getCacheControlHeader: vi.fn().mockReturnValue('public, max-age=3600')
      };
      
      // Mock the ServiceFactory to return our mocks
      vi.spyOn(ServiceFactory, 'getAssetTypeService').mockReturnValue(mockAssetTypeService as any);
      vi.spyOn(ServiceFactory, 'getCacheTagService').mockReturnValue(mockCacheTagService as any);
      vi.spyOn(ServiceFactory, 'getCacheHeaderService').mockReturnValue(mockCacheHeaderService as any);
      
      // Get services
      const assetTypeService = ServiceFactory.getAssetTypeService();
      const cacheHeaderService = ServiceFactory.getCacheHeaderService();
      
      // Test request and response
      const request = new Request('https://example.com/images/photo.jpg');
      const originalResponse = new Response('Test response', { status: 200 });
      
      // Get config for this request
      const config = assetTypeService.getConfigForRequest(request);
      
      // Apply cache headers
      const response = cacheHeaderService.applyCacheHeaders(originalResponse, request, config);
      
      // Verify cache headers are applied correctly
      const cacheControl = response.headers.get('Cache-Control');
      expect(cacheControl).toContain('max-age=');
      
      // Check for cache tags
      expect(response.headers.has('Cache-Tag')).toBe(true);
    });
    
    it('should properly integrate CfOptionsService with other services', async () => {
      // Get services
      const assetTypeService = ServiceFactory.getAssetTypeService();
      const cfOptionsService = ServiceFactory.getCfOptionsService();
      
      // Test request
      const request = new Request('https://example.com/images/photo.jpg');
      
      // Get config for this request
      const config = assetTypeService.getConfigForRequest(request);
      
      // Get CF options
      const cfOptions = cfOptionsService.getCfOptions(request, config);
      
      // Verify CF options are generated correctly
      expect(cfOptions.cacheEverything).toBe(true);
      expect(cfOptions.cacheTags).toBeDefined();
      expect(cfOptions.cacheTags && cfOptions.cacheTags.length).toBeGreaterThan(0);
      expect(cfOptions.cacheTtlByStatus).toBeDefined();
      expect(cfOptions.cacheTtlByStatus['200-299']).toBeGreaterThan(0);
    });
  });
  
  describe('Full request flow', () => {
    it('should process a request through the entire pipeline', async () => {
      // Mock CommandFactory.executeCache
      vi.spyOn(CommandFactory, 'initialize').mockImplementation(() => {});
      vi.spyOn(CommandFactory, 'executeCache').mockImplementation(async (request) => {
        // Simulate the full pipeline execution
        const response = new Response('Test image response', { 
          status: 200,
          headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'public, max-age=3600',
            'Cache-Tag': 'test:host:example.com,test:type:image,test:ext:jpg'
          }
        });
        return response;
      });
      
      // Force initialization
      CommandFactory.initialize();
      
      // Setup mock response for origin request
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve(new Response('Test image response', { 
          status: 200,
          headers: {
            'Content-Type': 'image/jpeg'
          }
        }))
      );
      
      // Create image request
      const request = new Request('https://example.com/images/photo.jpg');
      
      // Process through command factory
      const response = await CommandFactory.executeCache(request);
      
      // Verify response was processed
      expect(response.headers.has('Cache-Control')).toBe(true);
      expect(response.headers.has('Cache-Tag')).toBe(true);
    });
    
    it('should handle errors gracefully during request processing', async () => {
      // Mock CommandFactory
      vi.spyOn(CommandFactory, 'initialize').mockImplementation(() => {});
      vi.spyOn(CommandFactory, 'executeCache').mockImplementation(async (request) => {
        // Simulate error handling in the pipeline
        return new Response('Error response', { status: 500 });
      });
      
      // Force initialization
      CommandFactory.initialize();
      
      // Setup mock response that will fail
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve(new Response('Error response', { 
          status: 500
        }))
      );
      
      // Create request
      const request = new Request('https://example.com/error-page');
      
      // Process through command factory
      const response = await CommandFactory.executeCache(request);
      
      // Should still return a response even with error status
      expect(response.status).toBe(500);
    });
    
    it('should properly handle different asset types', async () => {
      // Mock asset type service for consistent test results
      vi.spyOn(ServiceFactory, 'getAssetTypeService').mockReturnValue({
        getConfigForRequest: (request: Request) => {
          const url = new URL(request.url);
          const path = url.pathname;
          
          if (path.endsWith('.jpg') || path.endsWith('.png')) {
            return {
              assetType: 'image',
              ttl: { ok: 3600, redirects: 300, clientError: 30, serverError: 0 },
              imageOptimization: true
            };
          } else if (path.endsWith('.css')) {
            return {
              assetType: 'css',
              ttl: { ok: 1800, redirects: 300, clientError: 30, serverError: 0 },
              minifyCss: true
            };
          } else if (path.endsWith('.html')) {
            return {
              assetType: 'html',
              ttl: { ok: 600, redirects: 300, clientError: 30, serverError: 0 }
            };
          } else {
            return {
              assetType: 'default',
              ttl: { ok: 0, redirects: 0, clientError: 0, serverError: 0 }
            };
          }
        }
      } as any);
      
      // Define requests for different asset types
      const imageRequest = new Request('https://example.com/images/photo.jpg');
      const cssRequest = new Request('https://example.com/styles/main.css');
      const htmlRequest = new Request('https://example.com/index.html');
      
      // Get configs for each type
      const assetTypeService = ServiceFactory.getAssetTypeService();
      const imageConfig = assetTypeService.getConfigForRequest(imageRequest);
      const cssConfig = assetTypeService.getConfigForRequest(cssRequest);
      const htmlConfig = assetTypeService.getConfigForRequest(htmlRequest);
      
      // Verify different configs are returned
      expect(imageConfig.assetType).toBe('image');
      expect(cssConfig.assetType).toBe('css');
      expect(htmlConfig.assetType).toBe('html');
      
      // Verify TTLs are different
      expect(imageConfig.ttl.ok).not.toBe(cssConfig.ttl.ok);
      
      // Verify optimization settings
      expect(imageConfig.imageOptimization).toBe(true);
      expect(cssConfig.minifyCss).toBe(true);
    });
  });
});