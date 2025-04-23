import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImageCachingStrategy } from '../strategies/image-caching-strategy';
import { ServiceFactory } from '../services/service-factory';

// Mock the ServiceFactory
vi.mock('../services/service-factory', () => {
  return {
    ServiceFactory: {
      getCacheHeaderService: vi.fn(),
      getCacheTagService: vi.fn(),
      getCacheKeyService: vi.fn()
    }
  };
});

// Mock the logger
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

describe('ImageCachingStrategy', () => {
  let strategy: ImageCachingStrategy;
  let mockCacheHeaderService: any;
  let mockCacheTagService: any;
  let mockCacheKeyService: any;
  
  // Create typed references to mocked functions
  let typedGetCacheHeaderService: ReturnType<typeof vi.fn>;
  let typedGetCacheTagService: ReturnType<typeof vi.fn>;
  let typedGetCacheKeyService: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create strategy instance
    strategy = new ImageCachingStrategy();
    
    // Create mock services
    mockCacheHeaderService = {
      getCacheControlHeader: vi.fn().mockReturnValue('public, max-age=3600'),
      applyCacheHeaders: vi.fn().mockImplementation(response => {
        const newResponse = new Response(response.body, response);
        newResponse.headers.set('Cache-Control', 'public, max-age=3600');
        return newResponse;
      })
    };
    
    mockCacheTagService = {
      generateTags: vi.fn().mockReturnValue(['image', 'png']),
      formatTagsForHeader: vi.fn().mockReturnValue('image,png'),
      validateTag: vi.fn().mockReturnValue(true)
    };
    
    mockCacheKeyService = {
      getCacheKey: vi.fn().mockReturnValue('image-key')
    };
    
    // Configure service factory to return mocks
    typedGetCacheHeaderService = ServiceFactory.getCacheHeaderService as unknown as ReturnType<typeof vi.fn>;
    typedGetCacheHeaderService.mockReturnValue(mockCacheHeaderService);
    
    typedGetCacheTagService = ServiceFactory.getCacheTagService as unknown as ReturnType<typeof vi.fn>;
    typedGetCacheTagService.mockReturnValue(mockCacheTagService);
    
    typedGetCacheKeyService = ServiceFactory.getCacheKeyService as unknown as ReturnType<typeof vi.fn>;
    typedGetCacheKeyService.mockReturnValue(mockCacheKeyService);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('canHandle', () => {
    it('should handle image content types', () => {
      // Test all supported image types
      const supportedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        'image/bmp',
        'image/tiff',
        'image/x-icon'
      ];
      
      for (const type of supportedTypes) {
        expect(strategy.canHandle(type)).toBe(true);
      }
    });
    
    it('should not handle non-image content types', () => {
      const unsupportedTypes = [
        'video/mp4',
        'text/html',
        'application/json',
        'text/css',
        'application/javascript',
        'audio/mpeg'
      ];
      
      for (const type of unsupportedTypes) {
        expect(strategy.canHandle(type)).toBe(false);
      }
    });
  });
  
  describe('applyCaching', () => {
    it('should apply appropriate headers to image responses', () => {
      // Create test request and response
      const request = new Request('https://example.com/image.png');
      const response = new Response('test-image-data', {
        status: 200,
        headers: {
          'Content-Type': 'image/png'
        }
      });
      
      // Configure asset config
      const config = {
        regex: /\.png$/,
        useQueryInCacheKey: true,
        ttl: {
          ok: 3600,
          redirects: 300,
          clientError: 60,
          serverError: 10
        },
        imageOptimization: true
      };
      
      // Call method under test
      const result = strategy.applyCaching(response, request, config);
      
      // Verify cache control header was set
      expect(result.headers.get('Cache-Control')).toBe('public, max-age=3600');
      
      // Verify Vary header was set
      expect(result.headers.get('Vary')).toBe('Accept');
      
      // Verify cache tag was set
      expect(result.headers.get('Cache-Tag')).toBe('image,png');
      
      // Verify interactions with services
      expect(mockCacheHeaderService.applyCacheHeaders).toHaveBeenCalledWith(
        response,
        request,
        config
      );
      
      expect(mockCacheTagService.generateTags).toHaveBeenCalledWith(
        request, 
        'image'
      );
    });
    
    it('should preserve existing Vary header if present', () => {
      // Create test request and response with existing Vary header
      const request = new Request('https://example.com/image.jpg');
      const response = new Response('test-image-data', {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Vary': 'User-Agent'
        }
      });
      
      // Configure asset config
      const config = {
        regex: /\.jpg$/,
        useQueryInCacheKey: true,
        ttl: {
          ok: 3600,
          redirects: 300,
          clientError: 60,
          serverError: 10
        }
      };
      
      // Call method under test
      const result = strategy.applyCaching(response, request, config);
      
      // Verify Vary header was preserved
      expect(result.headers.get('Vary')).toBe('User-Agent');
    });
    
    it('should handle errors in tag generation gracefully', () => {
      // Configure tag service to throw an error
      mockCacheTagService.generateTags.mockImplementationOnce(() => {
        throw new Error('Tag generation failed');
      });
      
      // Create test request and response
      const request = new Request('https://example.com/image.png');
      const response = new Response('test-image-data', {
        status: 200,
        headers: {
          'Content-Type': 'image/png'
        }
      });
      
      // Configure asset config
      const config = {
        regex: /\.png$/,
        useQueryInCacheKey: true,
        ttl: {
          ok: 3600,
          redirects: 300,
          clientError: 60,
          serverError: 10
        }
      };
      
      // Call method under test - should not throw
      const result = strategy.applyCaching(response, request, config);
      
      // Verify cache control header was still set
      expect(result.headers.get('Cache-Control')).toBe('public, max-age=3600');
      
      // Verify no cache tag was set
      expect(result.headers.has('Cache-Tag')).toBe(false);
    });
  });
  
  describe('getCacheOptions', () => {
    it('should generate correct Cloudflare options for image content with optimization enabled', () => {
      // Create test request
      const request = new Request('https://example.com/image.png');
      
      // Configure asset config with image optimization
      const config = {
        regex: /\.png$/,
        useQueryInCacheKey: true,
        ttl: {
          ok: 3600,
          redirects: 300,
          clientError: 60,
          serverError: 10
        },
        imageOptimization: true
      };
      
      // Call method under test
      const options = strategy.getCacheOptions(request, config);
      
      // Verify options
      expect(options).toEqual({
        cacheKey: 'image-key',
        polish: 'lossy',
        minify: {
          javascript: false,
          css: false,
          html: false
        },
        mirage: true,
        cacheEverything: true,
        cacheTtlByStatus: {
          '200-299': 3600,
          '301-302': 300,
          '400-499': 60,
          '500-599': 10
        },
        cacheTags: ['image', 'png']
      });
      
      // Verify service interactions
      expect(mockCacheKeyService.getCacheKey).toHaveBeenCalledWith(request, config);
      expect(mockCacheTagService.generateTags).toHaveBeenCalledWith(request, 'image');
    });
    
    it('should disable optimization when imageOptimization is false', () => {
      // Create test request
      const request = new Request('https://example.com/image.svg');
      
      // Configure asset config without image optimization (e.g., for SVGs)
      const config = {
        regex: /\.svg$/,
        useQueryInCacheKey: true,
        ttl: {
          ok: 3600,
          redirects: 300,
          clientError: 60,
          serverError: 10
        },
        imageOptimization: false
      };
      
      // Call method under test
      const options = strategy.getCacheOptions(request, config);
      
      // Verify options
      expect(options.polish).toBe('off');
      expect(options.mirage).toBe(false);
    });
    
    it('should not include cacheTags when tag list is empty', () => {
      // Make tag service return empty array
      mockCacheTagService.generateTags.mockReturnValueOnce([]);
      
      // Create test request
      const request = new Request('https://example.com/image.png');
      
      // Configure asset config
      const config = {
        regex: /\.png$/,
        useQueryInCacheKey: true,
        ttl: {
          ok: 3600,
          redirects: 300,
          clientError: 60,
          serverError: 10
        }
      };
      
      // Call method under test
      const options = strategy.getCacheOptions(request, config);
      
      // Verify cacheTags is undefined (not included)
      expect(options.cacheTags).toBeUndefined();
    });
  });
});