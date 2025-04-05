import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CfOptionsServiceImpl } from '../services/cf-options-service';
import { AssetTypeConfig } from '../types/cache-config';
import { ServiceFactory } from '../services/service-factory';

// Mock service factory
vi.mock('../services/service-factory', () => {
  return {
    ServiceFactory: {
      getCacheTagService: vi.fn(() => ({
        generateTags: vi.fn(() => ['tag1', 'tag2']),
        validateTag: vi.fn(() => true),
        formatTagsForHeader: vi.fn((tags) => tags.join(','))
      })),
      getCacheKeyService: vi.fn(() => ({
        getCacheKey: vi.fn(() => 'example.com/test')
      }))
    }
  };
});

describe('CfOptionsService', () => {
  const service = new CfOptionsServiceImpl();
  let mockCacheTagService: any;
  let mockCacheKeyService: any;
  
  // Reset mocks before each test
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Setup mock services
    mockCacheTagService = {
      generateTags: vi.fn(() => ['tag1', 'tag2']),
      validateTag: vi.fn(() => true),
      formatTagsForHeader: vi.fn((tags) => tags.join(','))
    };
    
    mockCacheKeyService = {
      getCacheKey: vi.fn(() => 'example.com/test')
    };
    
    // Setup service mocks
    vi.mocked(ServiceFactory.getCacheTagService).mockReturnValue(mockCacheTagService);
    vi.mocked(ServiceFactory.getCacheKeyService).mockReturnValue(mockCacheKeyService);
    
    // Setup global environment variables for testing
    (globalThis as any).CACHE_TAG_NAMESPACE = 'test';
    (globalThis as any).MAX_CACHE_TAGS = '10';
    (globalThis as any).ENVIRONMENT = 'test';
    (globalThis as any).LOG_LEVEL = 'DEBUG';
    (globalThis as any).DEBUG_MODE = 'true';
  });
  
  // Test configurations
  const imageConfig: AssetTypeConfig = {
    assetType: 'image',
    regex: /.*/,
    useQueryInCacheKey: true,
    imageOptimization: true,
    ttl: {
      ok: 3600,
      redirects: 300,
      clientError: 60,
      serverError: 0,
    },
  };
  
  const cssConfig: AssetTypeConfig = {
    assetType: 'css',
    regex: /.*/,
    useQueryInCacheKey: true,
    minifyCss: true,
    ttl: {
      ok: 1800,
      redirects: 300,
      clientError: 60,
      serverError: 0,
      info: 30,
    },
  };
  
  const defaultConfig: AssetTypeConfig = {
    assetType: 'default',
    regex: /.*/,
    useQueryInCacheKey: true,
    ttl: {
      ok: 0,
      redirects: 0,
      clientError: 0,
      serverError: 0,
    },
  };

  it('should generate correct CF options for image assets', () => {
    // Setup
    const request = new Request('https://example.com/image.jpg');
    
    // Execute
    const options = service.getCfOptions(request, imageConfig);
    
    // Verify
    expect(options.cacheKey).toBe('example.com/test');
    expect(options.polish).toBe('lossy');
    expect(options.mirage).toBe(true);
    expect(options.minify.css).toBe(false);
    expect(options.cacheTags).toEqual(['tag1', 'tag2']);
    expect(options.cacheTtlByStatus['200-299']).toBe(3600);
    
    // Check dependencies
    expect(mockCacheTagService.generateTags).toHaveBeenCalledWith(request, 'image');
    expect(mockCacheKeyService.getCacheKey).toHaveBeenCalledWith(request, imageConfig);
  });

  it('should generate correct CF options for CSS assets', () => {
    // Setup
    const request = new Request('https://example.com/styles.css');
    
    // Execute
    const options = service.getCfOptions(request, cssConfig);
    
    // Verify
    expect(options.polish).toBe('off');
    expect(options.mirage).toBe(false);
    expect(options.minify.css).toBe(true);
    expect(options.minify.javascript).toBe(false);
    expect(options.minify.html).toBe(false);
    expect(options.cacheTtlByStatus['100-199']).toBe(30);
    expect(options.cacheTtlByStatus['200-299']).toBe(1800);
    
    // Check dependencies
    expect(mockCacheTagService.generateTags).toHaveBeenCalledWith(request, 'css');
  });

  it('should handle assets with no optimization settings', () => {
    // Setup
    const request = new Request('https://example.com/document.pdf');
    
    // Execute
    const options = service.getCfOptions(request, defaultConfig);
    
    // Verify
    expect(options.polish).toBe('off');
    expect(options.mirage).toBe(false);
    expect(options.minify.css).toBe(false);
    expect(options.cacheTtlByStatus['200-299']).toBe(0);
    
    // Check dependencies
    expect(mockCacheTagService.generateTags).toHaveBeenCalledWith(request, 'default');
  });

  it('should always set cacheEverything to true', () => {
    // Setup
    const request = new Request('https://example.com/test');
    
    // Execute
    const options = service.getCfOptions(request, defaultConfig);
    
    // Verify
    expect(options.cacheEverything).toBe(true);
  });
});