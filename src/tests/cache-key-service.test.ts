import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultCacheKeyService } from '../services/cache-key-service';
import { AssetConfig } from '../types/cache-config';

// Setup environment variables for testing
beforeEach(() => {
  // Setup global environment variables for testing
  (globalThis as any).CACHE_TAG_NAMESPACE = 'test';
  (globalThis as any).MAX_CACHE_TAGS = '10';
  (globalThis as any).ENVIRONMENT = 'test';
  (globalThis as any).LOG_LEVEL = 'DEBUG';
  (globalThis as any).DEBUG_MODE = 'true';
});

describe('CacheKeyService', () => {
  const service = new DefaultCacheKeyService();
  
  // Test configurations
  const queryConfig: AssetConfig = {
    regex: /.*/,
    useQueryInCacheKey: true,
    ttl: {
      ok: 60,
      redirects: 30,
      clientError: 10,
      serverError: 0,
    },
  };
  
  const noQueryConfig: AssetConfig = {
    regex: /.*/,
    useQueryInCacheKey: false,
    ttl: {
      ok: 60,
      redirects: 30,
      clientError: 10,
      serverError: 0,
    },
  };

  it('should include query parameters when useQueryInCacheKey is true', () => {
    const request = new Request('https://example.com/path?param1=value1&param2=value2');
    const cacheKey = service.getCacheKey(request, queryConfig);
    
    expect(cacheKey).toBe('example.com/path?param1=value1&param2=value2');
  });

  it('should exclude query parameters when useQueryInCacheKey is false', () => {
    const request = new Request('https://example.com/path?param1=value1&param2=value2');
    const cacheKey = service.getCacheKey(request, noQueryConfig);
    
    expect(cacheKey).toBe('example.com/path');
  });

  it('should handle paths without query parameters', () => {
    const request = new Request('https://example.com/path');
    const cacheKeyWithQuery = service.getCacheKey(request, queryConfig);
    const cacheKeyNoQuery = service.getCacheKey(request, noQueryConfig);
    
    expect(cacheKeyWithQuery).toBe('example.com/path');
    expect(cacheKeyNoQuery).toBe('example.com/path');
  });

  it('should handle paths with hash fragments', () => {
    const request = new Request('https://example.com/path?param=value#fragment');
    const cacheKey = service.getCacheKey(request, queryConfig);
    
    // Hash fragments should not be included in the cache key
    expect(cacheKey).toBe('example.com/path?param=value');
  });

  it('should handle root paths', () => {
    const request = new Request('https://example.com/');
    const cacheKey = service.getCacheKey(request, noQueryConfig);
    
    expect(cacheKey).toBe('example.com/');
  });
});