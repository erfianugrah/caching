import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DefaultCachingStrategy } from '../strategies/default-caching-strategy';
import { ServiceFactory } from '../services/service-factory';

// Mock the ServiceFactory
vi.mock('../services/service-factory', () => {
  return {
    ServiceFactory: {
      getCacheHeaderService: vi.fn(),
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

describe('DefaultCachingStrategy', () => {
  let strategy: DefaultCachingStrategy;
  let mockCacheHeaderService: {
    getCacheControlHeader: ReturnType<typeof vi.fn>;
  };
  let mockCacheKeyService: {
    getCacheKey: ReturnType<typeof vi.fn>;
  };
  
  // Create typed references to mocked functions
  let typedGetCacheHeaderService: ReturnType<typeof vi.fn>;
  let typedGetCacheKeyService: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create strategy instance
    strategy = new DefaultCachingStrategy();
    
    // Create mock services
    mockCacheHeaderService = {
      getCacheControlHeader: vi.fn().mockReturnValue('public, max-age=3600')
    };
    
    mockCacheKeyService = {
      getCacheKey: vi.fn().mockReturnValue('default-key')
    };
    
    // Configure service factory to return mocks
    typedGetCacheHeaderService = ServiceFactory.getCacheHeaderService as unknown as ReturnType<typeof vi.fn>;
    typedGetCacheHeaderService.mockReturnValue(mockCacheHeaderService);
    
    typedGetCacheKeyService = ServiceFactory.getCacheKeyService as unknown as ReturnType<typeof vi.fn>;
    typedGetCacheKeyService.mockReturnValue(mockCacheKeyService);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('canHandle', () => {
    it('should handle all content types as a fallback strategy', () => {
      const contentTypes = [
        'text/html',
        'application/json',
        'video/mp4',
        'image/jpeg',
        'application/octet-stream',
        'text/plain',
        'audio/mpeg',
        '' // Empty content type
      ];
      
      for (const type of contentTypes) {
        expect(strategy.canHandle(type)).toBe(true);
      }
    });
  });
  
  describe('applyCaching', () => {
    it('should apply basic caching headers to any response', () => {
      // Create test request and response
      const request = new Request('https://example.com/any-resource');
      const response = new Response('test-content', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain'
        }
      });
      
      // Configure asset config
      const config = {
        regex: /\.*$/,
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
      
      // Verify cache control header was set
      expect(result.headers.get('Cache-Control')).toBe('public, max-age=3600');
      
      // Verify interaction with header service
      expect(mockCacheHeaderService.getCacheControlHeader).toHaveBeenCalledWith(
        200, 
        config
      );
    });
    
    it('should preserve original response status and headers', () => {
      // Create test request and response with custom headers
      const request = new Request('https://example.com/resource');
      const originalHeaders = new Headers({
        'Content-Type': 'application/json',
        'X-Custom-Header': 'custom-value',
        'Content-Language': 'en-US'
      });
      
      const response = new Response('{"test": true}', {
        status: 201,
        statusText: 'Created',
        headers: originalHeaders
      });
      
      // Configure asset config
      const config = {
        regex: /\.*$/,
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
      
      // Verify status and original headers are preserved
      expect(result.status).toBe(201);
      expect(result.statusText).toBe('Created');
      expect(result.headers.get('Content-Type')).toBe('application/json');
      expect(result.headers.get('X-Custom-Header')).toBe('custom-value');
      expect(result.headers.get('Content-Language')).toBe('en-US');
    });
    
    it('should handle error responses correctly', () => {
      // Create test request and error response
      const request = new Request('https://example.com/not-found');
      const response = new Response('Not Found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain'
        }
      });
      
      // Configure asset config
      const config = {
        regex: /\.*$/,
        useQueryInCacheKey: true,
        ttl: {
          ok: 3600,
          redirects: 300,
          clientError: 60,
          serverError: 10
        }
      };
      
      // Mock different Cache-Control header for error
      mockCacheHeaderService.getCacheControlHeader.mockReturnValueOnce('public, max-age=60');
      
      // Call method under test
      const result = strategy.applyCaching(response, request, config);
      
      // Verify error status is preserved
      expect(result.status).toBe(404);
      
      // Verify cache control uses error TTL
      expect(result.headers.get('Cache-Control')).toBe('public, max-age=60');
      
      // Verify interaction with service
      expect(mockCacheHeaderService.getCacheControlHeader).toHaveBeenCalledWith(
        404, 
        config
      );
    });
  });
  
  describe('getCacheOptions', () => {
    it('should generate basic Cloudflare cache options', () => {
      // Create test request
      const request = new Request('https://example.com/resource');
      
      // Configure asset config without CSS minification
      const config = {
        regex: /\.*$/,
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
      
      // Verify options
      expect(options).toEqual({
        cacheKey: 'default-key',
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
          '301-302': 300,
          '400-499': 60,
          '500-599': 10
        }
      });
      
      // Verify interaction with service
      expect(mockCacheKeyService.getCacheKey).toHaveBeenCalledWith(request, config);
    });
    
    it('should enable CSS minification when specified in config', () => {
      // Create test request
      const request = new Request('https://example.com/styles.css');
      
      // Configure asset config with CSS minification
      const config = {
        regex: /\.css$/,
        useQueryInCacheKey: true,
        ttl: {
          ok: 3600,
          redirects: 300,
          clientError: 60,
          serverError: 10
        },
        minifyCss: true
      };
      
      // Call method under test
      const options = strategy.getCacheOptions(request, config);
      
      // Verify CSS minification is enabled
      expect(options.minify.css).toBe(true);
    });
  });
});