import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiCachingStrategy } from '../strategies/api-caching-strategy';
import { ServiceFactory } from '../services/service-factory';
import { logger } from '../utils/logger';

// Mock dependencies
vi.mock('../services/service-factory', () => ({
  ServiceFactory: {
    getCacheKeyService: vi.fn(() => ({
      getCacheKey: vi.fn(() => 'example.com/api/data')
    })),
    getCacheTagService: vi.fn(() => ({
      generateTags: vi.fn(() => ['cf:host:example.com', 'cf:type:api', 'cf:path:data']),
      formatTagsForHeader: vi.fn((tags) => tags.join(','))
    })),
    getCacheHeaderService: vi.fn(() => ({
      getCacheControlHeader: vi.fn(() => 'public, max-age=60')
    }))
  }
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('ApiCachingStrategy', () => {
  let strategy: ApiCachingStrategy;
  
  beforeEach(() => {
    vi.clearAllMocks();
    strategy = new ApiCachingStrategy();
  });
  
  describe('canHandle', () => {
    it('should handle common API content types', () => {
      expect(strategy.canHandle('application/json')).toBe(true);
      expect(strategy.canHandle('application/xml')).toBe(true);
      expect(strategy.canHandle('text/xml')).toBe(true);
      expect(strategy.canHandle('application/ld+json')).toBe(true);
    });
    
    it('should handle content types with parameters', () => {
      expect(strategy.canHandle('application/json;charset=UTF-8')).toBe(true);
      expect(strategy.canHandle('application/xml;charset=UTF-8')).toBe(true);
    });
    
    it('should not handle non-API content types', () => {
      expect(strategy.canHandle('text/html')).toBe(false);
      expect(strategy.canHandle('image/jpeg')).toBe(false);
      expect(strategy.canHandle('text/plain')).toBe(false);
    });
  });
  
  describe('applyCaching', () => {
    it('should apply cache headers to API responses', () => {
      // Setup
      const request = new Request('https://example.com/api/data');
      const response = new Response('{"data": "example"}', {
        headers: { 'Content-Type': 'application/json' }
      });
      const config = {
        ttl: { ok: 60, redirects: 30, clientError: 10, serverError: 0 },
        useQueryInCacheKey: true,
        regex: /.*/
      };
      
      // Execute
      const result = strategy.applyCaching(response, request, config);
      
      // Verify
      expect(result.headers.get('Cache-Control')).toBe('public, max-age=60');
      expect(result.headers.get('Cache-Tag')).toBe('cf:host:example.com,cf:type:api,cf:path:data');
      expect(result.headers.get('Vary')).toBe('Accept, Accept-Encoding, Origin');
      expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });
    
    it('should preserve existing headers', () => {
      // Setup
      const request = new Request('https://example.com/api/data');
      const response = new Response('{"data": "example"}', {
        headers: { 
          'Content-Type': 'application/json',
          'X-Custom-Header': 'custom-value'
        }
      });
      const config = {
        ttl: { ok: 60, redirects: 30, clientError: 10, serverError: 0 },
        useQueryInCacheKey: true,
        regex: /.*/
      };
      
      // Execute
      const result = strategy.applyCaching(response, request, config);
      
      // Verify existing headers are preserved
      expect(result.headers.get('Content-Type')).toBe('application/json');
      expect(result.headers.get('X-Custom-Header')).toBe('custom-value');
    });
    
    it('should not overwrite existing security headers', () => {
      // Setup
      const request = new Request('https://example.com/api/data');
      const response = new Response('{"data": "example"}', {
        headers: { 
          'Content-Type': 'application/json',
          'X-Content-Type-Options': 'nosniff',
          'Vary': 'Accept-Language'
        }
      });
      const config = {
        ttl: { ok: 60, redirects: 30, clientError: 10, serverError: 0 },
        useQueryInCacheKey: true,
        regex: /.*/
      };
      
      // Execute
      const result = strategy.applyCaching(response, request, config);
      
      // Verify headers are preserved
      expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(result.headers.get('Vary')).toBe('Accept-Language');
    });
  });
  
  describe('getCacheOptions', () => {
    it('should generate options for API responses', () => {
      // Setup
      const request = new Request('https://example.com/api/data');
      const config = {
        ttl: { ok: 60, redirects: 30, clientError: 10, serverError: 0 },
        useQueryInCacheKey: true,
        regex: /.*/
      };
      
      // Execute
      const options = strategy.getCacheOptions(request, config);
      
      // Verify
      expect(options.cacheKey).toBe('example.com/api/data');
      expect(options.minify.css).toBe(false);
      expect(options.minify.javascript).toBe(false);
      expect(options.minify.html).toBe(false);
      expect(options.polish).toBe('off');
      expect(options.cacheTags).toEqual(['cf:host:example.com', 'cf:type:api', 'cf:path:data']);
      expect(options.cacheEverything).toBe(false); // API uses standard Cache-Control
      expect(options.cacheTtlByStatus).toEqual({
        '200-299': 60,
        '301-302': 30,
        '400-499': 10,
        '500-599': 0
      });
    });
  });
});