import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ManifestCachingStrategy } from '../strategies/manifest-caching-strategy';
import { ServiceFactory } from '../services/service-factory';
import { logger } from '../utils/logger';

// Original mock implementations to restore in beforeEach
const originalMocks = {
  getCacheKey: vi.fn(() => 'https://example.com/videos/playlist.m3u8'),
  generateTags: vi.fn(() => ['cf:host:example.com', 'cf:type:manifest', 'cf:ext:m3u8']),
  formatTagsForHeader: vi.fn((tags) => tags.join(',')),
  getCacheControlHeader: vi.fn(() => 'public, max-age=3'),
  applyCacheHeaders: vi.fn((response, request, config) => {
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Cache-Control', 'public, max-age=3');
    return newResponse;
  })
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
      getCacheControlHeader: originalMocks.getCacheControlHeader,
      applyCacheHeaders: originalMocks.applyCacheHeaders
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

describe('ManifestCachingStrategy', () => {
  let strategy: ManifestCachingStrategy;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset the mocks to their original implementations
    originalMocks.getCacheKey.mockImplementation(() => 'https://example.com/videos/playlist.m3u8');
    originalMocks.generateTags.mockImplementation(() => ['cf:host:example.com', 'cf:type:manifest', 'cf:ext:m3u8']);
    originalMocks.formatTagsForHeader.mockImplementation((tags) => tags.join(','));
    originalMocks.getCacheControlHeader.mockImplementation(() => 'public, max-age=3');
    
    strategy = new ManifestCachingStrategy();
  });
  
  describe('canHandle', () => {
    it('should handle HLS manifest content types', () => {
      expect(strategy.canHandle('application/vnd.apple.mpegurl')).toBe(true);
      expect(strategy.canHandle('application/x-mpegurl')).toBe(true);
    });
    
    it('should handle DASH manifest content types', () => {
      expect(strategy.canHandle('application/dash+xml')).toBe(true);
    });
    
    it('should handle content types with parameters', () => {
      expect(strategy.canHandle('application/vnd.apple.mpegurl;charset=UTF-8')).toBe(true);
    });
    
    it('should handle plain text (often used for manifests)', () => {
      expect(strategy.canHandle('text/plain')).toBe(true);
    });
    
    it('should not handle non-manifest content types', () => {
      expect(strategy.canHandle('video/mp4')).toBe(false);
      expect(strategy.canHandle('image/jpeg')).toBe(false);
      expect(strategy.canHandle('application/json')).toBe(false);
    });
  });
  
  describe('applyCaching', () => {
    it('should apply cache headers to HLS manifest files', () => {
      // Setup
      const request = new Request('https://example.com/videos/playlist.m3u8');
      const response = new Response('#EXTM3U\n#EXT-X-VERSION:3\n', {
        headers: { 'Content-Type': 'application/vnd.apple.mpegurl' }
      });
      const config = {
        ttl: { ok: 3, redirects: 2, clientError: 1, serverError: 0 },
        useQueryInCacheKey: true,
        regex: /.*/
      };
      
      // Execute
      const result = strategy.applyCaching(response, request, config);
      
      // Verify
      expect(result.headers.get('Cache-Control')).toBe('public, max-age=3');
      expect(result.headers.get('Cache-Tag')).toBe('cf:host:example.com,cf:type:manifest,cf:ext:m3u8');
      expect(result.headers.get('Vary')).toBe('Accept-Encoding');
      expect(result.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(result.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
      expect(result.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Range');
    });
    
    it('should set correct content type for m3u8 files', () => {
      // Setup
      const request = new Request('https://example.com/videos/playlist.m3u8');
      const response = new Response('#EXTM3U\n#EXT-X-VERSION:3\n', {
        headers: { 'Content-Type': 'text/plain' }
      });
      const config = {
        ttl: { ok: 3, redirects: 2, clientError: 1, serverError: 0 },
        useQueryInCacheKey: true,
        regex: /.*/
      };
      
      // Execute
      const result = strategy.applyCaching(response, request, config);
      
      // Verify content type is corrected
      expect(result.headers.get('Content-Type')).toBe('application/vnd.apple.mpegurl');
    });
    
    it('should set correct content type for mpd files', () => {
      // Setup
      const request = new Request('https://example.com/videos/manifest.mpd');
      const response = new Response('<MPD></MPD>', {
        headers: { 'Content-Type': 'text/plain' }
      });
      const config = {
        ttl: { ok: 3, redirects: 2, clientError: 1, serverError: 0 },
        useQueryInCacheKey: true,
        regex: /.*/
      };
      
      // Execute
      const result = strategy.applyCaching(response, request, config);
      
      // Verify content type is corrected
      expect(result.headers.get('Content-Type')).toBe('application/dash+xml');
    });
    
    it('should preserve existing content type if already set correctly', () => {
      // Setup
      const request = new Request('https://example.com/videos/playlist.m3u8');
      const response = new Response('#EXTM3U\n#EXT-X-VERSION:3\n', {
        headers: { 'Content-Type': 'application/vnd.apple.mpegurl' }
      });
      const config = {
        ttl: { ok: 3, redirects: 2, clientError: 1, serverError: 0 },
        useQueryInCacheKey: true,
        regex: /.*/
      };
      
      // Execute
      const result = strategy.applyCaching(response, request, config);
      
      // Verify content type is preserved
      expect(result.headers.get('Content-Type')).toBe('application/vnd.apple.mpegurl');
    });
    
    it('should not modify content type for files with unsupported extensions', () => {
      // Setup
      const request = new Request('https://example.com/videos/manifest.unknown');
      const response = new Response('some content', {
        headers: { 'Content-Type': 'text/plain' }
      });
      const config = {
        ttl: { ok: 3, redirects: 2, clientError: 1, serverError: 0 },
        useQueryInCacheKey: true,
        regex: /.*/
      };
      
      // Execute
      const result = strategy.applyCaching(response, request, config);
      
      // Verify content type is not changed
      expect(result.headers.get('Content-Type')).toBe('text/plain');
    });
    
    it('should handle error when trying to generate cache tags', () => {
      // Setup
      const request = new Request('https://example.com/videos/playlist.m3u8');
      const response = new Response('#EXTM3U\n#EXT-X-VERSION:3\n', {
        headers: { 'Content-Type': 'application/vnd.apple.mpegurl' }
      });
      const config = {
        ttl: { ok: 3, redirects: 2, clientError: 1, serverError: 0 },
        useQueryInCacheKey: true,
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
      expect(result.headers.get('Cache-Control')).toBe('public, max-age=3');
      expect(result.headers.get('Content-Type')).toBe('application/vnd.apple.mpegurl');
      expect(result.headers.has('Cache-Tag')).toBe(false);
      
      // Verify CORS headers are still set
      expect(result.headers.get('Access-Control-Allow-Origin')).toBe('*');
      
      // Verify that warning was logged
      expect(logger.warn).toHaveBeenCalled();
    });
    
    it('should handle files with query parameters', () => {
      // Setup
      const request = new Request('https://example.com/videos/playlist.m3u8?quality=high');
      const response = new Response('#EXTM3U\n#EXT-X-VERSION:3\n', {
        headers: { 'Content-Type': 'text/plain' }
      });
      const config = {
        ttl: { ok: 3, redirects: 2, clientError: 1, serverError: 0 },
        useQueryInCacheKey: true,
        regex: /.*/
      };
      
      // Execute
      const result = strategy.applyCaching(response, request, config);
      
      // Verify content type is still corrected properly
      expect(result.headers.get('Content-Type')).toBe('application/vnd.apple.mpegurl');
    });
  });
  
  describe('getCacheOptions', () => {
    it('should generate options for manifest files with short TTLs', () => {
      // Setup
      const request = new Request('https://example.com/videos/playlist.m3u8');
      const config = {
        ttl: { ok: 3, redirects: 2, clientError: 1, serverError: 0 },
        useQueryInCacheKey: true,
        regex: /.*/
      };
      
      // Execute
      const options = strategy.getCacheOptions(request, config);
      
      // Verify
      expect(options.cacheKey).toBe('https://example.com/videos/playlist.m3u8');
      expect(options.minify.css).toBe(false);
      expect(options.minify.javascript).toBe(false);
      expect(options.minify.html).toBe(false);
      expect(options.polish).toBe('off');
      expect(options.cacheTags).toEqual(['cf:host:example.com', 'cf:type:manifest', 'cf:ext:m3u8']);
      expect(options.cacheEverything).toBe(true);
      expect(options.cacheTtlByStatus).toEqual({
        '200-299': 3,
        '301-302': 2,
        '400-499': 1,
        '500-599': 0
      });
    });
    
    it('should omit cacheTags when empty', () => {
      // Setup
      const request = new Request('https://example.com/videos/playlist.m3u8');
      const config = {
        ttl: { ok: 3, redirects: 2, clientError: 1, serverError: 0 },
        useQueryInCacheKey: true,
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
    
    it('should handle DASH manifests with appropriate TTLs', () => {
      // Setup
      const request = new Request('https://example.com/videos/manifest.mpd');
      const config = {
        ttl: { ok: 5, redirects: 2, clientError: 1, serverError: 0 }, // Different TTLs
        useQueryInCacheKey: true,
        regex: /.*/
      };
      
      // Create specific MPD tags for this test
      const mpdTags = ['cf:host:example.com', 'cf:type:manifest', 'cf:ext:mpd'];
      
      // Mock tags generation to return MPD-specific tags
      const cacheTagService = ServiceFactory.getCacheTagService() as any;
      cacheTagService.generateTags.mockImplementation(() => mpdTags);
      
      // Execute
      const options = strategy.getCacheOptions(request, config);
      
      // Verify
      expect(options.cacheTags).toEqual(mpdTags);
      expect(options.cacheTtlByStatus['200-299']).toBe(5);
    });
    
    it('should handle error when generating cache key', () => {
      // Setup
      const request = new Request('https://example.com/videos/playlist.m3u8');
      const config = {
        ttl: { ok: 3, redirects: 2, clientError: 1, serverError: 0 },
        useQueryInCacheKey: true,
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
      expect(options.cacheKey).toBe('https://example.com/videos/playlist.m3u8');
      
      // Verify that error was logged
      expect(logger.error).toHaveBeenCalled();
    });
    
    it('should handle requests with query parameters', () => {
      // Setup
      const request = new Request('https://example.com/videos/playlist.m3u8?quality=high&format=hls');
      const config = {
        ttl: { ok: 3, redirects: 2, clientError: 1, serverError: 0 },
        useQueryInCacheKey: true,
        queryParams: {
          include: true,
          includeParams: ['quality', 'format'],
          sortParams: true
        },
        regex: /.*/
      };
      
      // Mock cache key generation for this specific test
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