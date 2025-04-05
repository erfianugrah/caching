import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioCachingStrategy } from '../strategies/audio-caching-strategy';
import { ServiceFactory } from '../services/service-factory';
import { logger } from '../utils/logger';

// Original mock implementations to restore in beforeEach
const originalMocks = {
  getCacheKey: vi.fn(() => 'example.com/audio/song.mp3'),
  generateTags: vi.fn(() => ['cf:host:example.com', 'cf:type:audio', 'cf:ext:mp3']),
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

describe('AudioCachingStrategy', () => {
  let strategy: AudioCachingStrategy;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset the mocks to their original implementations
    originalMocks.getCacheKey.mockImplementation(() => 'example.com/audio/song.mp3');
    originalMocks.generateTags.mockImplementation(() => ['cf:host:example.com', 'cf:type:audio', 'cf:ext:mp3']);
    originalMocks.formatTagsForHeader.mockImplementation((tags) => tags.join(','));
    originalMocks.getCacheControlHeader.mockImplementation(() => 'public, max-age=31556952');
    
    strategy = new AudioCachingStrategy();
  });
  
  describe('canHandle', () => {
    it('should handle common audio content types', () => {
      expect(strategy.canHandle('audio/mpeg')).toBe(true);
      expect(strategy.canHandle('audio/mp3')).toBe(true);
      expect(strategy.canHandle('audio/wav')).toBe(true);
      expect(strategy.canHandle('audio/flac')).toBe(true);
      expect(strategy.canHandle('audio/ogg')).toBe(true);
    });
    
    it('should handle content types with parameters', () => {
      expect(strategy.canHandle('audio/mpeg;charset=UTF-8')).toBe(true);
      expect(strategy.canHandle('audio/mp3;codec=mp3')).toBe(true);
    });
    
    it('should handle all audio/* content types', () => {
      expect(strategy.canHandle('audio/unknown-format')).toBe(true);
    });
    
    it('should not handle non-audio content types', () => {
      expect(strategy.canHandle('video/mp4')).toBe(false);
      expect(strategy.canHandle('image/jpeg')).toBe(false);
      expect(strategy.canHandle('application/json')).toBe(false);
    });
  });
  
  describe('applyCaching', () => {
    it('should apply cache headers to audio files', () => {
      // Setup
      const request = new Request('https://example.com/audio/song.mp3');
      const response = new Response(new ArrayBuffer(1024), {
        headers: { 'Content-Type': 'audio/mpeg' }
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
      expect(result.headers.get('Cache-Tag')).toBe('cf:host:example.com,cf:type:audio,cf:ext:mp3');
      expect(result.headers.get('Vary')).toBe('Accept-Encoding');
      expect(result.headers.get('Content-Disposition')).toBe('inline');
    });
    
    it('should preserve existing Content-Disposition header', () => {
      // Setup
      const request = new Request('https://example.com/audio/song.mp3');
      const response = new Response(new ArrayBuffer(1024), {
        headers: { 
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': 'attachment; filename="song.mp3"'
        }
      });
      const config = {
        ttl: { ok: 31556952, redirects: 30, clientError: 10, serverError: 0 },
        useQueryInCacheKey: false,
        regex: /.*/
      };
      
      // Execute
      const result = strategy.applyCaching(response, request, config);
      
      // Verify
      expect(result.headers.get('Content-Disposition')).toBe('attachment; filename="song.mp3"');
    });
    
    it('should not overwrite existing Vary header', () => {
      // Setup
      const request = new Request('https://example.com/audio/song.mp3');
      const response = new Response(new ArrayBuffer(1024), {
        headers: { 
          'Content-Type': 'audio/mpeg',
          'Vary': 'Accept-Range'
        }
      });
      const config = {
        ttl: { ok: 31556952, redirects: 30, clientError: 10, serverError: 0 },
        useQueryInCacheKey: false,
        regex: /.*/
      };
      
      // Execute
      const result = strategy.applyCaching(response, request, config);
      
      // Verify Vary header is preserved
      expect(result.headers.get('Vary')).toBe('Accept-Range');
    });
    
    it('should handle error when trying to generate cache tags', () => {
      // Setup
      const request = new Request('https://example.com/audio/song.mp3');
      const response = new Response(new ArrayBuffer(1024), {
        headers: { 'Content-Type': 'audio/mpeg' }
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
      expect(result.headers.get('Content-Disposition')).toBe('inline');
      expect(result.headers.has('Cache-Tag')).toBe(false);
      
      // Verify that warning was logged
      expect(logger.warn).toHaveBeenCalled();
    });
  });
  
  describe('getCacheOptions', () => {
    it('should generate options for audio files', () => {
      // Setup
      const request = new Request('https://example.com/audio/song.mp3');
      const config = {
        ttl: { ok: 31556952, redirects: 30, clientError: 10, serverError: 0 },
        useQueryInCacheKey: false,
        regex: /.*/
      };
      
      // Execute
      const options = strategy.getCacheOptions(request, config);
      
      // Verify
      expect(options.cacheKey).toBe('example.com/audio/song.mp3');
      expect(options.minify.css).toBe(false);
      expect(options.minify.javascript).toBe(false);
      expect(options.minify.html).toBe(false);
      expect(options.polish).toBe('off');
      expect(options.cacheTags).toEqual(['cf:host:example.com', 'cf:type:audio', 'cf:ext:mp3']);
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
      const request = new Request('https://example.com/audio/song.mp3');
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
      const request = new Request('https://example.com/audio/song.mp3');
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
      expect(options.cacheKey).toBe('https://example.com/audio/song.mp3');
      
      // Verify that error was logged
      expect(logger.error).toHaveBeenCalled();
    });
    
    it('should handle requests with query parameters', () => {
      // Setup
      const request = new Request('https://example.com/audio/song.mp3?quality=high');
      const config = {
        ttl: { ok: 31556952, redirects: 30, clientError: 10, serverError: 0 },
        useQueryInCacheKey: true, // Include query params in cache key
        regex: /.*/
      };
      
      // Reset mocks and configure specific implementations
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