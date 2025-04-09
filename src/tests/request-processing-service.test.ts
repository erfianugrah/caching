import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DefaultRequestProcessingService } from '../services/request-processing-service';
import { ServiceFactory } from '../services/service-factory';
import { StrategyFactory } from '../strategies/strategy-factory';

// Mock dependencies
vi.mock('../services/service-factory', () => {
  return {
    ServiceFactory: {
      getAssetTypeService: vi.fn(),
      getCacheKeyService: vi.fn(),
      getCacheHeaderService: vi.fn(),
      getCacheTagService: vi.fn(),
      getCfOptionsService: vi.fn()
    }
  };
});

vi.mock('../strategies/strategy-factory', () => {
  return {
    StrategyFactory: {
      getStrategyForContentType: vi.fn()
    }
  };
});

vi.mock('../utils/logger', () => {
  return {
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
  };
});

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('DefaultRequestProcessingService', () => {
  let service: DefaultRequestProcessingService;
  // Type the mock services with appropriate interfaces
  let mockAssetTypeService: {
    getConfigForRequest: ReturnType<typeof vi.fn>;
  };
  let mockStrategy: {
    constructor: { name: string };
    getCacheOptions: ReturnType<typeof vi.fn>;
    applyCaching: ReturnType<typeof vi.fn>;
  };
  
  // Typed factory function references for use in tests
  let typedAssetTypeServiceFn: ReturnType<typeof vi.fn>;
  let typedStrategyFactoryFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create service instance
    service = new DefaultRequestProcessingService();

    // Set up mocks
    mockAssetTypeService = {
      getConfigForRequest: vi.fn()
    };
    
    mockStrategy = {
      constructor: { name: 'MockStrategy' },
      getCacheOptions: vi.fn(),
      applyCaching: vi.fn()
    };

    // Configure mock return values
    mockAssetTypeService.getConfigForRequest.mockReturnValue({
      assetType: 'test',
      regex: /test/,
      useQueryInCacheKey: true,
      ttl: {
        ok: 3600,
        redirects: 300,
        clientError: 60,
        serverError: 10
      }
    });

    mockStrategy.getCacheOptions.mockReturnValue({
      cacheKey: 'test-key',
      polish: 'off',
      minify: {
        javascript: false,
        css: false,
        html: false
      },
      mirage: false,
      cacheEverything: true,
      cacheTtlByStatus: {
        '200-299': 3600,
        '300-399': 300,
        '400-499': 60,
        '500-599': 10
      }
    });

    mockStrategy.applyCaching.mockImplementation(response => response);

    // Assign mocks to factories with proper typing
    typedAssetTypeServiceFn = ServiceFactory.getAssetTypeService as unknown as ReturnType<typeof vi.fn>;
    typedAssetTypeServiceFn.mockReturnValue(mockAssetTypeService);
    
    typedStrategyFactoryFn = StrategyFactory.getStrategyForContentType as unknown as ReturnType<typeof vi.fn>;
    typedStrategyFactoryFn.mockReturnValue(mockStrategy);

    // Set up fetch mock
    mockFetch.mockResolvedValue(new Response('Test response', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'CF-Cache-Status': 'HIT'
      }
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('prepareRequest', () => {
    it('should analyze and prepare a request', async () => {
      // Create test request
      const request = new Request('https://example.com/test.js');
      
      // Call the method under test
      const result = await service.prepareRequest(request);
      
      // Verify expected behaviors - using bound methods with arrow functions
      expect(typedAssetTypeServiceFn).toHaveBeenCalled();
      expect(mockAssetTypeService.getConfigForRequest).toHaveBeenCalledWith(request);
      expect(typedStrategyFactoryFn).toHaveBeenCalled();
      expect(mockStrategy.getCacheOptions).toHaveBeenCalled();
      
      // Verify result structure and content
      expect(result).toHaveProperty('config');
      expect(result).toHaveProperty('contentType');
      expect(result).toHaveProperty('strategyName', 'MockStrategy');
      expect(result).toHaveProperty('cfOptions');
      expect(result).toHaveProperty('context');
      
      // Verify context
      expect(result.context).toHaveProperty('operationId');
      expect(result.context).toHaveProperty('assetType', 'test');
      expect(result.context).toHaveProperty('startTime');
    });
    
    it('should map file extensions to correct content types', async () => {
      // Test a variety of file extensions
      const testExtensions = [
        { url: 'https://example.com/test.jpg', expectedContentType: 'image/jpeg' },
        { url: 'https://example.com/test.png', expectedContentType: 'image/png' },
        { url: 'https://example.com/test.css', expectedContentType: 'text/css' },
        { url: 'https://example.com/test.js', expectedContentType: 'application/javascript' },
        { url: 'https://example.com/test.mp3', expectedContentType: 'audio/mpeg' },
        { url: 'https://example.com/test.mp4', expectedContentType: 'video/mp4' },
        { url: 'https://example.com/test.m3u8', expectedContentType: 'application/vnd.apple.mpegurl' }
      ];
      
      for (const test of testExtensions) {
        // Override asset type detection to return the extension
        const ext = test.url.split('.').pop() || '';
        let assetType = 'default';
        
        if (ext === 'jpg' || ext === 'png') assetType = 'image';
        else if (ext === 'css' || ext === 'js') assetType = 'frontEnd';
        else if (ext === 'mp3') assetType = 'audio';
        else if (ext === 'mp4') assetType = 'video';
        else if (ext === 'm3u8') assetType = 'manifest';
        
        mockAssetTypeService.getConfigForRequest.mockReturnValue({
          assetType,
          regex: new RegExp(ext),
          useQueryInCacheKey: true,
          ttl: {
            ok: 3600,
            redirects: 300,
            clientError: 60,
            serverError: 10
          }
        });
        
        const request = new Request(test.url);
        const result = await service.prepareRequest(request);
        
        expect(result.contentType).toBe(test.expectedContentType);
      }
    });
    
    it('should respect Accept header for content negotiation', async () => {
      // Setup asset type that uses Accept header
      mockAssetTypeService.getConfigForRequest.mockReturnValue({
        assetType: 'image', 
        regex: /test/,
        useQueryInCacheKey: true,
        ttl: { ok: 3600, redirects: 300, clientError: 60, serverError: 10 }
      });
      
      // Test with different Accept headers
      const acceptHeaders = [
        { accept: 'image/webp', expectedContentType: 'image/webp' },
        { accept: 'image/avif', expectedContentType: 'image/avif' },
        { accept: 'video/webm', expectedContentType: 'video/webm' }
      ];
      
      for (const test of acceptHeaders) {
        const headers = new Headers();
        headers.set('Accept', test.accept);
        
        // Create request with Accept header
        const request = new Request('https://example.com/test', { headers });
        
        // Need to mock URL without extension to trigger Accept header logic
        if (test.accept.startsWith('image')) {
          mockAssetTypeService.getConfigForRequest.mockReturnValue({
            assetType: 'image',
            regex: /test/,
            useQueryInCacheKey: true,
            ttl: { ok: 3600, redirects: 300, clientError: 60, serverError: 10 }
          });
        } else if (test.accept.startsWith('video')) {
          mockAssetTypeService.getConfigForRequest.mockReturnValue({
            assetType: 'video',
            regex: /test/,
            useQueryInCacheKey: true,
            ttl: { ok: 3600, redirects: 300, clientError: 60, serverError: 10 }
          });
        }
        
        const result = await service.prepareRequest(request);
        expect(result.contentType).toBe(test.expectedContentType);
      }
    });

    it('should handle service errors gracefully', async () => {
      // Mock a failing service
      typedAssetTypeServiceFn.mockImplementationOnce(() => {
        throw new Error('Service failure test');
      });
      
      const request = new Request('https://example.com/test');
      
      // The error should be propagated out
      await expect(service.prepareRequest(request)).rejects.toThrow('Service failure test');
      
      // Restore normal behavior
      typedAssetTypeServiceFn.mockReturnValue(mockAssetTypeService);
    });
  });

  describe('fetchWithCaching', () => {
    it('should fetch with cache options', async () => {
      const request = new Request('https://example.com/test');
      const cfOptions = {
        cacheKey: 'test-key',
        polish: 'off' as const,
        minify: {
          javascript: false,
          css: false,
          html: false
        },
        mirage: false,
        cacheEverything: true,
        cacheTtlByStatus: {
          '200-299': 3600
        }
      };
      
      const response = await service.fetchWithCaching(request, cfOptions);
      
      expect(mockFetch).toHaveBeenCalledWith(request, {
        cf: cfOptions
      });
      
      expect(response.status).toBe(200);
    });
    
    it('should handle fetch errors', async () => {
      // Set up fetch to throw an error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      const request = new Request('https://example.com/test');
      const cfOptions = {
        cacheKey: 'test-key',
        polish: 'off' as const,
        minify: {
          javascript: false,
          css: false,
          html: false
        },
        mirage: false,
        cacheEverything: true,
        cacheTtlByStatus: {
          '200-299': 3600
        }
      };
      
      // The method should throw a FetchError
      await expect(service.fetchWithCaching(request, cfOptions))
        .rejects.toThrow('Failed to fetch from origin');
    });
  });

  describe('processResponse', () => {
    it('should apply caching to the response', async () => {
      const request = new Request('https://example.com/test');
      const response = new Response('Test content', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain'
        }
      });
      
      const context = {
        operationId: 'test-op-id',
        assetType: 'test',
        contentType: 'text/plain',
        strategyName: 'MockStrategy',
        startTime: performance.now()
      };
      
      // Mock strategy to return a modified response
      mockStrategy.applyCaching.mockReturnValue(
        new Response('Modified content', {
          status: 200,
          headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'max-age=3600'
          }
        })
      );
      
      const result = await service.processResponse(response, request, context);
      
      // Check that the strategy was used to apply caching
      expect(mockStrategy.applyCaching).toHaveBeenCalled();
      expect(result.headers.get('Cache-Control')).toBe('max-age=3600');
    });
  });
});