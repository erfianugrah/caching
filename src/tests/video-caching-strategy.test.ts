import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoCachingStrategy } from '../strategies/video-caching-strategy';
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

describe('VideoCachingStrategy', () => {
  let strategy: VideoCachingStrategy;
  let mockCacheHeaderService: {
    getCacheControlHeader: ReturnType<typeof vi.fn>;
    applyCacheHeaders: ReturnType<typeof vi.fn>;
  };
  let mockCacheTagService: {
    generateTags: ReturnType<typeof vi.fn>;
    formatTagsForHeader: ReturnType<typeof vi.fn>;
    validateTag: ReturnType<typeof vi.fn>;
  };
  let mockCacheKeyService: {
    getCacheKey: ReturnType<typeof vi.fn>;
  };
  
  // Create typed references to mocked functions
  let typedGetCacheHeaderService: ReturnType<typeof vi.fn>;
  let typedGetCacheTagService: ReturnType<typeof vi.fn>;
  let typedGetCacheKeyService: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create strategy instance
    strategy = new VideoCachingStrategy();
    
    // Create mock services
    mockCacheHeaderService = {
      getCacheControlHeader: vi.fn().mockReturnValue('public, max-age=3600'),
      applyCacheHeaders: vi.fn(response => response)
    };
    
    mockCacheTagService = {
      generateTags: vi.fn().mockReturnValue(['video', 'mp4']),
      formatTagsForHeader: vi.fn().mockReturnValue('video,mp4'),
      validateTag: vi.fn().mockReturnValue(true)
    };
    
    mockCacheKeyService = {
      getCacheKey: vi.fn().mockReturnValue('video-key')
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
    it('should handle video content types', () => {
      // Test all supported video types
      const supportedTypes = [
        'video/mp4',
        'video/webm',
        'video/ogg',
        'video/x-matroska',
        'video/x-msvideo',
        'video/quicktime',
        'video/x-ms-wmv',
        'video/mpeg',
        'video/3gpp',
        'application/x-mpegURL',
        'application/dash+xml'
      ];
      
      for (const type of supportedTypes) {
        expect(strategy.canHandle(type)).toBe(true);
      }
    });
    
    it('should handle content types with parameters', () => {
      // Test content types with additional parameters
      const typesWithParams = [
        'video/mp4; codecs=avc1.42E01E, mp4a.40.2',
        'video/webm; codecs=vp9',
        'application/dash+xml; charset=utf-8'
      ];
      
      for (const type of typesWithParams) {
        expect(strategy.canHandle(type)).toBe(true);
      }
    });
    
    it('should not handle non-video content types', () => {
      const unsupportedTypes = [
        'image/jpeg',
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
    it('should apply appropriate headers to video responses', () => {
      // Create test request and response
      const request = new Request('https://example.com/video.mp4');
      const response = new Response('test-video-data', {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4'
        }
      });
      
      // Configure asset config
      const config = {
        regex: /\.mp4$/,
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
      
      // Verify Accept-Ranges header was set for byte range requests
      expect(result.headers.get('Accept-Ranges')).toBe('bytes');
      
      // Verify cache tag was set
      expect(result.headers.get('Cache-Tag')).toBe('video,mp4');
      
      // Verify interactions with services
      expect(mockCacheHeaderService.getCacheControlHeader).toHaveBeenCalledWith(
        200, 
        config
      );
      
      expect(mockCacheTagService.generateTags).toHaveBeenCalledWith(
        request, 
        'video'
      );
    });
    
    it('should handle byte range requests properly', () => {
      // Create test range request and partial response
      const headers = new Headers();
      headers.set('Range', 'bytes=0-1024');
      
      const request = new Request('https://example.com/video.mp4', {
        headers
      });
      
      const responseHeaders = new Headers();
      responseHeaders.set('Content-Type', 'video/mp4');
      responseHeaders.set('Content-Range', 'bytes 0-1024/10240');
      responseHeaders.set('Content-Length', '1025');
      
      const response = new Response('test-partial-video-data', {
        status: 206, // Partial content
        headers: responseHeaders
      });
      
      // Configure asset config
      const config = {
        regex: /\.mp4$/,
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
      
      // Verify partial content headers are preserved
      expect(result.status).toBe(206);
      expect(result.headers.get('Content-Range')).toBe('bytes 0-1024/10240');
      expect(result.headers.get('Content-Length')).toBe('1025');
      
      // Verify Accept-Ranges header is still set
      expect(result.headers.get('Accept-Ranges')).toBe('bytes');
    });
    
    it('should handle errors in tag generation gracefully', () => {
      // Configure tag service to throw an error
      mockCacheTagService.generateTags.mockImplementationOnce(() => {
        throw new Error('Tag generation failed');
      });
      
      // Create test request and response
      const request = new Request('https://example.com/video.mp4');
      const response = new Response('test-video-data', {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4'
        }
      });
      
      // Configure asset config
      const config = {
        regex: /\.mp4$/,
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
      
      // Verify Accept-Ranges header was still set
      expect(result.headers.get('Accept-Ranges')).toBe('bytes');
      
      // Verify no cache tag was set
      expect(result.headers.has('Cache-Tag')).toBe(false);
    });
  });
  
  describe('getCacheOptions', () => {
    it('should generate correct Cloudflare options for video content', () => {
      // Create test request
      const request = new Request('https://example.com/video.mp4');
      
      // Configure asset config
      const config = {
        regex: /\.mp4$/,
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
        cacheKey: 'video-key',
        polish: 'off', // No image optimization for video
        minify: {
          javascript: false,
          css: false,
          html: false
        },
        mirage: false, // No image optimization for video
        cacheEverything: true,
        cacheTtlByStatus: {
          '200-299': 3600,
          '301-302': 300,
          '400-499': 60,
          '500-599': 10
        },
        cacheTags: ['video', 'mp4']
      });
      
      // Verify service interactions
      expect(mockCacheKeyService.getCacheKey).toHaveBeenCalledWith(request, config);
      expect(mockCacheTagService.generateTags).toHaveBeenCalledWith(request, 'video');
    });
    
    it('should handle manifest files correctly', () => {
      // Create test request for HLS manifest
      const request = new Request('https://example.com/playlist.m3u8');
      
      // Configure asset config for manifest
      const config = {
        regex: /\.m3u8$/,
        useQueryInCacheKey: true,
        ttl: {
          ok: 60, // Short TTL for manifests that might change
          redirects: 30,
          clientError: 10,
          serverError: 5
        }
      };
      
      // Mock different tags for manifest
      mockCacheTagService.generateTags.mockReturnValueOnce(['video', 'hls', 'manifest']);
      mockCacheTagService.formatTagsForHeader.mockReturnValueOnce('video,hls,manifest');
      
      // Call method under test
      const options = strategy.getCacheOptions(request, config);
      
      // Verify we're using the manifest TTLs
      expect(options.cacheTtlByStatus['200-299']).toBe(60);
      
      // Verify we're using manifest-specific tags
      expect(options.cacheTags).toEqual(['video', 'hls', 'manifest']);
    });
    
    it('should not include cacheTags when tag list is empty', () => {
      // Make tag service return empty array
      mockCacheTagService.generateTags.mockReturnValueOnce([]);
      
      // Create test request
      const request = new Request('https://example.com/video.webm');
      
      // Configure asset config
      const config = {
        regex: /\.webm$/,
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