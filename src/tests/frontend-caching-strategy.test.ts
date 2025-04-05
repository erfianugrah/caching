import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FrontEndCachingStrategy } from '../strategies/frontend-caching-strategy';
import { ServiceFactory } from '../services/service-factory';
import { logger } from '../utils/logger';

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('FrontEndCachingStrategy', () => {
  let strategy: FrontEndCachingStrategy;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock dependencies before the test
    vi.mock('../services/service-factory', () => ({
      ServiceFactory: {
        getCacheKeyService: vi.fn(() => ({
          getCacheKey: vi.fn(() => 'example.com/style.css')
        })),
        getCacheTagService: vi.fn(() => ({
          generateTags: vi.fn(() => ['cf:host:example.com', 'cf:type:frontEnd', 'cf:ext:css']),
          formatTagsForHeader: vi.fn((tags) => tags.join(','))
        })),
        getCacheHeaderService: vi.fn(() => ({
          getCacheControlHeader: vi.fn(() => 'public, max-age=3600')
        }))
      }
    }));
    
    strategy = new FrontEndCachingStrategy();
  });
  
  describe('canHandle', () => {
    it('should handle CSS content type', () => {
      expect(strategy.canHandle('text/css')).toBe(true);
    });
    
    it('should handle JavaScript content types', () => {
      expect(strategy.canHandle('text/javascript')).toBe(true);
      expect(strategy.canHandle('application/javascript')).toBe(true);
      expect(strategy.canHandle('application/x-javascript')).toBe(true);
    });
    
    it('should handle content types with charset', () => {
      expect(strategy.canHandle('text/css;charset=UTF-8')).toBe(true);
      expect(strategy.canHandle('application/javascript;charset=UTF-8')).toBe(true);
    });
    
    it('should not handle non-frontend content types', () => {
      expect(strategy.canHandle('image/jpeg')).toBe(false);
      expect(strategy.canHandle('text/html')).toBe(false);
      expect(strategy.canHandle('application/json')).toBe(false);
    });
  });
  
  describe('applyCaching', () => {
    it('should apply cache headers to CSS files', () => {
      // Setup
      const request = new Request('https://example.com/styles/main.css');
      const response = new Response('body { color: red; }', {
        headers: { 'Content-Type': 'text/css' }
      });
      const config = {
        minifyCss: true,
        ttl: { ok: 3600, redirects: 60, clientError: 10, serverError: 0 },
        useQueryInCacheKey: true,
        regex: /.*/
      };
      
      // Execute
      const result = strategy.applyCaching(response, request, config);
      
      // Verify
      expect(result.headers.get('Cache-Control')).toBe('public, max-age=3600');
      expect(result.headers.get('Cache-Tag')).toBe('cf:host:example.com,cf:type:frontEnd,cf:ext:css');
      expect(result.headers.get('Vary')).toBe('Accept-Encoding');
    });
    
    it('should apply cache headers to JavaScript files', () => {
      // Setup
      const request = new Request('https://example.com/scripts/app.js');
      const response = new Response('console.log("Hello");', {
        headers: { 'Content-Type': 'application/javascript' }
      });
      const config = {
        ttl: { ok: 3600, redirects: 60, clientError: 10, serverError: 0 },
        useQueryInCacheKey: true,
        regex: /.*/
      };
      
      // Execute
      const result = strategy.applyCaching(response, request, config);
      
      // Verify
      expect(result.headers.get('Cache-Control')).toBe('public, max-age=3600');
      expect(result.headers.get('Cache-Tag')).toBe('cf:host:example.com,cf:type:frontEnd,cf:ext:css');
      expect(result.headers.get('Vary')).toBe('Accept-Encoding');
    });
    
    it('should preserve existing headers', () => {
      // Setup
      const request = new Request('https://example.com/styles/main.css');
      const response = new Response('body { color: red; }', {
        headers: { 
          'Content-Type': 'text/css',
          'X-Custom-Header': 'custom-value'
        }
      });
      const config = {
        minifyCss: true,
        ttl: { ok: 3600, redirects: 60, clientError: 10, serverError: 0 },
        useQueryInCacheKey: true,
        regex: /.*/
      };
      
      // Execute
      const result = strategy.applyCaching(response, request, config);
      
      // Verify existing headers are preserved
      expect(result.headers.get('Content-Type')).toBe('text/css');
      expect(result.headers.get('X-Custom-Header')).toBe('custom-value');
    });
    
    it('should not overwrite existing Vary header', () => {
      // Setup
      const request = new Request('https://example.com/styles/main.css');
      const response = new Response('body { color: red; }', {
        headers: { 
          'Content-Type': 'text/css',
          'Vary': 'Accept'
        }
      });
      const config = {
        minifyCss: true,
        ttl: { ok: 3600, redirects: 60, clientError: 10, serverError: 0 },
        useQueryInCacheKey: true,
        regex: /.*/
      };
      
      // Execute
      const result = strategy.applyCaching(response, request, config);
      
      // Verify Vary header is preserved
      expect(result.headers.get('Vary')).toBe('Accept');
    });
    
    it('should handle errors when generating tags', () => {
      // Setup
      const request = new Request('https://example.com/styles/main.css');
      const response = new Response('body { color: red; }', {
        headers: { 'Content-Type': 'text/css' }
      });
      const config = {
        minifyCss: true,
        ttl: { ok: 3600, redirects: 60, clientError: 10, serverError: 0 },
        useQueryInCacheKey: true,
        regex: /.*/
      };
      
      // We need to temporarily override the mock for this specific test
      const originalCacheTagService = ServiceFactory.getCacheTagService;
      
      // Override with mock that throws error
      ServiceFactory.getCacheTagService = vi.fn().mockReturnValue({
        generateTags: vi.fn().mockImplementation(() => {
          throw new Error('Failed to generate tags');
        }),
        formatTagsForHeader: vi.fn()
      });
      
      try {
        // Execute - should not throw
        const result = strategy.applyCaching(response, request, config);
        
        // Verify
        expect(result.headers.get('Cache-Control')).toBe('public, max-age=3600');
        // Verify that the warning was logged when the error was caught
        expect(logger.warn).toHaveBeenCalledWith('Failed to add cache tags to frontend response', expect.objectContaining({
          error: 'Failed to generate tags',
          url: 'https://example.com/styles/main.css'
        }));
      } finally {
        // Restore the original mock
        ServiceFactory.getCacheTagService = originalCacheTagService;
      }
    });
  });
  
  describe('getCacheOptions', () => {
    it('should generate options with CSS minification enabled', () => {
      // Setup
      const request = new Request('https://example.com/styles/main.css');
      const config = {
        minifyCss: true,
        ttl: { ok: 3600, redirects: 60, clientError: 10, serverError: 0 },
        useQueryInCacheKey: true,
        regex: /.*/
      };
      
      // Execute
      const options = strategy.getCacheOptions(request, config);
      
      // Verify
      expect(options.cacheKey).toBe('example.com/style.css');
      expect(options.minify.css).toBe(true);
      expect(options.minify.javascript).toBe(true);
      expect(options.minify.html).toBe(false);
      expect(options.cacheTags).toEqual(['cf:host:example.com', 'cf:type:frontEnd', 'cf:ext:css']);
      expect(options.cacheEverything).toBe(true);
      expect(options.cacheTtlByStatus).toEqual({
        '200-299': 3600,
        '301-302': 60,
        '400-499': 10,
        '500-599': 0
      });
    });
    
    it('should generate options with CSS minification disabled', () => {
      // Setup
      const request = new Request('https://example.com/styles/main.css');
      const config = {
        minifyCss: false,
        ttl: { ok: 3600, redirects: 60, clientError: 10, serverError: 0 },
        useQueryInCacheKey: true,
        regex: /.*/
      };
      
      // Execute
      const options = strategy.getCacheOptions(request, config);
      
      // Verify
      expect(options.cacheKey).toBe('example.com/style.css');
      expect(options.minify.css).toBe(false);
      expect(options.minify.javascript).toBe(true);
      expect(options.minify.html).toBe(false);
    });
    
    it('should handle undefined minifyCss', () => {
      // Setup
      const request = new Request('https://example.com/styles/main.css');
      const config = {
        ttl: { ok: 3600, redirects: 60, clientError: 10, serverError: 0 },
        useQueryInCacheKey: true,
        regex: /.*/
      };
      
      // Execute
      const options = strategy.getCacheOptions(request, config);
      
      // Verify
      expect(options.minify.css).toBe(false);
    });
  });
});