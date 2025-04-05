import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DirectPlayCachingStrategy } from '../strategies/direct-play-caching-strategy';
import { ServiceFactory } from '../services/service-factory';
import { logger } from '../utils/logger';

// Original mock implementations to restore in beforeEach
const originalMocks = {
  getCacheKey: vi.fn(() => 'https://example.com/Download/video.mp4'),
  generateTags: vi.fn(() => ['cf:host:example.com', 'cf:type:directPlay', 'cf:path:Download']),
  formatTagsForHeader: vi.fn((tags) => tags.join(',')),
  getCacheControlHeader: vi.fn(() => 'public, max-age=31556952')
};

// Mock dependencies
vi.mock('../services/service-factory', () => ({
  ServiceFactory: {
    getCacheKeyService: vi.fn(() => ({
      getCacheKey: originalMocks.getCacheKey
    })),
    getCacheTagService: vi.fn(() => ({
      generateTags: originalMocks.generateTags,
      formatTagsForHeader: originalMocks.formatTagsForHeader
    })),
    getCacheHeaderService: vi.fn(() => ({
      getCacheControlHeader: originalMocks.getCacheControlHeader
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

describe('DirectPlayCachingStrategy', () => {
  let strategy: DirectPlayCachingStrategy;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset the mocks to their original implementations
    originalMocks.getCacheKey.mockImplementation(() => 'https://example.com/Download/video.mp4');
    originalMocks.generateTags.mockImplementation(() => ['cf:host:example.com', 'cf:type:directPlay', 'cf:path:Download']);
    originalMocks.formatTagsForHeader.mockImplementation((tags) => tags.join(','));
    originalMocks.getCacheControlHeader.mockImplementation(() => 'public, max-age=31556952');
    
    strategy = new DirectPlayCachingStrategy();
  });
  
  describe('canHandle', () => {
    it('should always return false as strategy is selected by URL pattern', () => {
      // DirectPlay strategy is selected by URL pattern, not content type
      expect(strategy.canHandle('application/octet-stream')).toBe(false);
      expect(strategy.canHandle('video/mp4')).toBe(false);
    });
  });
  
  describe('applyCaching', () => {
    it('should apply cache headers to direct download files', () => {
      // Setup
      const request = new Request('https://example.com/Download/video.mp4');
      const response = new Response(new ArrayBuffer(1024), {
        headers: { 'Content-Type': 'application/octet-stream' }
      });
      const config = {
        ttl: { ok: 31556952, redirects: 30, clientError: 10, serverError: 0 },
        useQueryInCacheKey: false,
        regex: /.*/
      };
      
      // Execute
      const result = strategy.applyCaching(response, request, config);
      
      // Verify
      expect(result.headers.get('Cache-Control')).toBe('public, max-age=31556952');
      expect(result.headers.get('Cache-Tag')).toBe('cf:host:example.com,cf:type:directPlay,cf:path:Download');
      expect(result.headers.get('Content-Disposition')).toBe('attachment; filename="video.mp4"');
    });
    
    it('should preserve existing Content-Disposition header', () => {
      // Setup
      const request = new Request('https://example.com/Download/video.mp4');
      const response = new Response(new ArrayBuffer(1024), {
        headers: { 
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': 'attachment; filename="custom-name.mp4"'
        }
      });
      const config = {
        ttl: { ok: 31556952, redirects: 30, clientError: 10, serverError: 0 },
        useQueryInCacheKey: false,
        regex: /.*/
      };
      
      // Execute
      const result = strategy.applyCaching(response, request, config);
      
      // Verify existing headers are preserved
      expect(result.headers.get('Content-Disposition')).toBe('attachment; filename="custom-name.mp4"');
    });
    
    it('should handle filenames with unusual characters', () => {
      // Setup
      const request = new Request('https://example.com/Download/file with spaces.mp4');
      const response = new Response(new ArrayBuffer(1024), {
        headers: { 'Content-Type': 'application/octet-stream' }
      });
      const config = {
        ttl: { ok: 31556952, redirects: 30, clientError: 10, serverError: 0 },
        useQueryInCacheKey: false,
        regex: /.*/
      };
      
      // Execute
      const result = strategy.applyCaching(response, request, config);
      
      // Verify
      expect(result.headers.get('Content-Disposition')).toBe('attachment; filename="file with spaces.mp4"');
    });
    
    it('should handle URLs without a filename', () => {
      // Setup
      const request = new Request('https://example.com/Download/');
      const response = new Response(new ArrayBuffer(1024), {
        headers: { 'Content-Type': 'application/octet-stream' }
      });
      const config = {
        ttl: { ok: 31556952, redirects: 30, clientError: 10, serverError: 0 },
        useQueryInCacheKey: false,
        regex: /.*/
      };
      
      // Execute
      const result = strategy.applyCaching(response, request, config);
      
      // Verify it uses 'file' as the default filename
      expect(result.headers.get('Content-Disposition')).toBe('attachment; filename="file"');
    });
    
    it('should handle error when trying to generate cache tags', () => {
      // Setup
      const request = new Request('https://example.com/Download/video.mp4');
      const response = new Response(new ArrayBuffer(1024), {
        headers: { 'Content-Type': 'application/octet-stream' }
      });
      const config = {
        ttl: { ok: 31556952, redirects: 30, clientError: 10, serverError: 0 },
        useQueryInCacheKey: false,
        regex: /.*/
      };
      
      // Add Cache-Tag to response to ensure it's removed on error
      response.headers.set('Cache-Tag', 'some-existing-tag');
      
      // Mock tags generation to throw an error
      const cacheTagService = ServiceFactory.getCacheTagService() as any;
      cacheTagService.generateTags.mockImplementation(() => {
        throw new Error('Failed to generate tags');
      });
      
      // Execute - should not throw an error
      const result = strategy.applyCaching(response, request, config);
      
      // Verify basic headers are still set
      expect(result.headers.get('Cache-Control')).toBe('public, max-age=31556952');
      expect(result.headers.get('Content-Disposition')).toBe('attachment; filename="video.mp4"');
      expect(result.headers.has('Cache-Tag')).toBe(false);
      
      // Verify that warning was logged
      expect(logger.warn).toHaveBeenCalled();
    });
  });
  
  describe('getCacheOptions', () => {
    it('should generate options for direct play content', () => {
      // Setup
      const request = new Request('https://example.com/Download/video.mp4');
      const config = {
        ttl: { ok: 31556952, redirects: 30, clientError: 10, serverError: 0 },
        useQueryInCacheKey: false,
        regex: /.*/
      };
      
      // Execute
      const options = strategy.getCacheOptions(request, config);
      
      // Verify
      expect(options.cacheKey).toBe('https://example.com/Download/video.mp4');
      expect(options.minify.css).toBe(false);
      expect(options.minify.javascript).toBe(false);
      expect(options.minify.html).toBe(false);
      expect(options.polish).toBe('off');
      expect(options.cacheTags).toEqual(['cf:host:example.com', 'cf:type:directPlay', 'cf:path:Download']);
      expect(options.cacheEverything).toBe(true);
      expect(options.cacheTtlByStatus).toEqual({
        '200-299': 31556952,
        '301-302': 30,
        '400-499': 10,
        '500-599': 0
      });
    });
    
    it('should omit cacheTags when empty', () => {
      // Setup
      const request = new Request('https://example.com/Download/video.mp4');
      const config = {
        ttl: { ok: 31556952, redirects: 30, clientError: 10, serverError: 0 },
        useQueryInCacheKey: false,
        regex: /.*/
      };
      
      // Mock tags generation to return empty array
      const cacheTagService = ServiceFactory.getCacheTagService() as any;
      cacheTagService.generateTags.mockImplementation(() => []);
      
      // Execute
      const options = strategy.getCacheOptions(request, config);
      
      // Verify
      expect(options.cacheTags).toBeUndefined();
    });
    
    it('should handle error when generating cache key', () => {
      // Setup
      const request = new Request('https://example.com/Download/video.mp4');
      const config = {
        ttl: { ok: 31556952, redirects: 30, clientError: 10, serverError: 0 },
        useQueryInCacheKey: false,
        regex: /.*/
      };
      
      // Mock cache key generation to throw an error
      const cacheKeyService = ServiceFactory.getCacheKeyService() as any;
      cacheKeyService.getCacheKey.mockImplementation(() => {
        throw new Error('Failed to generate cache key');
      });
      
      // Execute - should not throw
      const options = strategy.getCacheOptions(request, config);
      
      // Verify fallback behavior - should use URL as cache key
      expect(options.cacheKey).toBe('https://example.com/Download/video.mp4');
      
      // Verify that error was logged
      expect(logger.error).toHaveBeenCalled();
    });
    
    it('should handle custom TTL settings', () => {
      // Setup
      const request = new Request('https://example.com/Download/video.mp4');
      const config = {
        ttl: { ok: 3600, redirects: 60, clientError: 30, serverError: 10 }, // Custom TTLs
        useQueryInCacheKey: false,
        regex: /.*/
      };
      
      // Execute
      const options = strategy.getCacheOptions(request, config);
      
      // Verify TTLs are correctly mapped
      expect(options.cacheTtlByStatus).toEqual({
        '200-299': 3600,
        '301-302': 60,
        '400-499': 30,
        '500-599': 10
      });
    });
    
    it('should handle requests with query parameters', () => {
      // Setup
      const request = new Request('https://example.com/Download/video.mp4?token=abc123');
      const config = {
        ttl: { ok: 31556952, redirects: 30, clientError: 10, serverError: 0 },
        useQueryInCacheKey: true, // Include query params in cache key
        regex: /.*/
      };
      
      // Mock cache key generation for this test
      const cacheKeyService = ServiceFactory.getCacheKeyService() as any;
      cacheKeyService.getCacheKey.mockImplementation(() => 'mock-cache-key-with-query');
      
      // Execute
      const options = strategy.getCacheOptions(request, config);
      
      // Verify cache key service was called
      expect(cacheKeyService.getCacheKey).toHaveBeenCalled();
      expect(options.cacheKey).toBe('mock-cache-key-with-query');
    });
  });
});