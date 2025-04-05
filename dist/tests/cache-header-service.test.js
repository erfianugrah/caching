import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DefaultCacheHeaderService } from '../services/cache-header-service';
import { TagGenerator } from '../services/cache-tag-service';
// Mock TagGenerator - must be before imports
vi.mock('../services/cache-tag-service', () => {
    return {
        TagGenerator: {
            generateTags: vi.fn(() => ['tag1', 'tag2']),
            validateTag: vi.fn(() => true),
            formatTagsForHeader: vi.fn((tags) => tags.join(','))
        }
    };
});
describe('CacheHeaderService', () => {
    const service = new DefaultCacheHeaderService();
    // Reset mocks before each test
    beforeEach(() => {
        vi.resetAllMocks();
        // Setup global environment variables for testing
        globalThis.CACHE_TAG_NAMESPACE = 'test';
        globalThis.MAX_CACHE_TAGS = '10';
        globalThis.ENVIRONMENT = 'test';
        globalThis.LOG_LEVEL = 'DEBUG';
        globalThis.DEBUG_MODE = 'true';
    });
    // Test configuration
    const config = {
        assetType: 'test',
        regex: /.*/,
        useQueryInCacheKey: true,
        ttl: {
            ok: 3600,
            redirects: 300,
            clientError: 60,
            serverError: 0,
        },
    };
    describe('getCacheControlHeader', () => {
        it('should generate Cache-Control for 2xx responses', () => {
            const header = service.getCacheControlHeader(200, config);
            expect(header).toBe('public, max-age=3600');
        });
        it('should generate Cache-Control for 3xx responses', () => {
            const header = service.getCacheControlHeader(301, config);
            expect(header).toBe('public, max-age=300');
        });
        it('should generate Cache-Control for 4xx responses', () => {
            const header = service.getCacheControlHeader(404, config);
            expect(header).toBe('public, max-age=60');
        });
        it('should generate no Cache-Control for 5xx responses', () => {
            const header = service.getCacheControlHeader(500, config);
            expect(header).toBe('');
        });
        it('should handle unknown status codes', () => {
            const header = service.getCacheControlHeader(700, config);
            expect(header).toBe('');
        });
    });
    describe('applyCacheHeaders', () => {
        it('should apply headers correctly', () => {
            // Setup
            const request = new Request('https://example.com/test');
            const originalResponse = new Response('Test body', { status: 200 });
            // Execute
            const response = service.applyCacheHeaders(originalResponse, request, config);
            // Verify
            expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
            expect(response.headers.get('Cache-Tag')).toBe('tag1,tag2');
            expect(TagGenerator.generateTags).toHaveBeenCalledWith(request, 'test');
        });
        it('should not set Cache-Control for status codes with 0 TTL', () => {
            // Setup
            const zeroTtlConfig = {
                ...config,
                ttl: {
                    ...config.ttl,
                    ok: 0
                }
            };
            const request = new Request('https://example.com/test');
            const originalResponse = new Response('Test body', { status: 200 });
            // Execute
            const response = service.applyCacheHeaders(originalResponse, request, zeroTtlConfig);
            // Verify
            expect(response.headers.has('Cache-Control')).toBe(false);
        });
        it('should include debug headers when debug is true', () => {
            // Setup
            const request = new Request('https://example.com/test', {
                headers: { debug: 'true' }
            });
            const originalResponse = new Response('Test body');
            // Execute
            const response = service.applyCacheHeaders(originalResponse, request, config);
            // Verify
            expect(response.headers.has('x-cache-debug')).toBe(true);
            const debugHeader = response.headers.get('x-cache-debug');
            const debugData = JSON.parse(debugHeader || '{}');
            expect(debugData.assetType).toBe('test');
            expect(debugData.cacheTags).toEqual(['tag1', 'tag2']);
        });
        it('should handle responses without cache tags', () => {
            // Setup
            TagGenerator.generateTags.mockReturnValueOnce([]);
            const request = new Request('https://example.com/test');
            const originalResponse = new Response('Test body');
            // Execute
            const response = service.applyCacheHeaders(originalResponse, request, config);
            // Verify
            expect(response.headers.has('Cache-Tag')).toBe(false);
        });
    });
});
//# sourceMappingURL=cache-header-service.test.js.map