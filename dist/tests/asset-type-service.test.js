import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultAssetTypeService } from '../services/asset-type-service';
// Setup environment variables for testing
beforeEach(() => {
    // Setup global environment variables for testing
    globalThis.CACHE_TAG_NAMESPACE = 'test';
    globalThis.MAX_CACHE_TAGS = '10';
    globalThis.ENVIRONMENT = 'test';
    globalThis.LOG_LEVEL = 'DEBUG';
    globalThis.DEBUG_MODE = 'true';
});
describe('AssetTypeService', () => {
    // Test data
    const testConfigs = {
        video: {
            regex: /\.(mp4|webm)$/i, // Make regex case-insensitive
            useQueryInCacheKey: false,
            ttl: {
                ok: 3600,
                redirects: 60,
                clientError: 10,
                serverError: 0,
            },
        },
        image: {
            regex: /\.(jpg|jpeg|png|webp)$/i, // Make regex case-insensitive
            useQueryInCacheKey: true,
            imageOptimization: true,
            ttl: {
                ok: 1800,
                redirects: 30,
                clientError: 5,
                serverError: 0,
            },
        },
    };
    const service = new DefaultAssetTypeService(testConfigs);
    it('should detect video files correctly', () => {
        const request = new Request('https://example.com/videos/sample.mp4');
        const config = service.getConfigForRequest(request);
        expect(config.assetType).toBe('video');
        expect(config.useQueryInCacheKey).toBe(false);
        expect(config.ttl.ok).toBe(3600);
    });
    it('should detect image files correctly', () => {
        const request = new Request('https://example.com/images/photo.jpg');
        const config = service.getConfigForRequest(request);
        expect(config.assetType).toBe('image');
        expect(config.useQueryInCacheKey).toBe(true);
        expect(config.imageOptimization).toBe(true);
        expect(config.ttl.ok).toBe(1800);
    });
    it('should return default config for unmatched assets', () => {
        const request = new Request('https://example.com/documents/report.pdf');
        const config = service.getConfigForRequest(request);
        expect(config.assetType).toBe('default');
        expect(config.useQueryInCacheKey).toBe(true);
        expect(config.ttl.ok).toBe(0); // No caching by default
    });
    it('should handle case sensitivity in regex matching', () => {
        const request = new Request('https://example.com/videos/SAMPLE.MP4');
        const config = service.getConfigForRequest(request);
        expect(config.assetType).toBe('video');
    });
    it('should work with complex paths', () => {
        const request = new Request('https://example.com/user/123/profile/avatar.png?size=large');
        const config = service.getConfigForRequest(request);
        expect(config.assetType).toBe('image');
    });
});
//# sourceMappingURL=asset-type-service.test.js.map