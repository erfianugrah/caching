import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultCacheKeyService } from '../services/cache-key-service';
// Setup environment variables for testing
beforeEach(() => {
    // Setup global environment variables for testing
    globalThis.CACHE_TAG_NAMESPACE = 'test';
    globalThis.MAX_CACHE_TAGS = '10';
    globalThis.ENVIRONMENT = 'test';
    globalThis.LOG_LEVEL = 'DEBUG';
    globalThis.DEBUG_MODE = 'true';
});
describe('CacheKeyService', () => {
    const service = new DefaultCacheKeyService();
    // Test configurations
    const queryConfig = {
        regex: /.*/,
        useQueryInCacheKey: true,
        ttl: {
            ok: 60,
            redirects: 30,
            clientError: 10,
            serverError: 0,
        },
    };
    const noQueryConfig = {
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
//# sourceMappingURL=cache-key-service.test.js.map