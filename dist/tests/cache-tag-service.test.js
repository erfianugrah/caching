import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DefaultCacheTagService } from '../services/cache-tag-service';
import { logger } from '../utils/logger';
// Mock logger
vi.mock('../utils/logger', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }
}));
// Mock environment variables
beforeEach(() => {
    // Setup global environment variables for testing
    globalThis.CACHE_TAG_NAMESPACE = 'test';
    globalThis.MAX_CACHE_TAGS = '10';
    globalThis.ENVIRONMENT = 'test';
    globalThis.LOG_LEVEL = 'DEBUG';
    globalThis.DEBUG_MODE = 'true';
});
describe('CacheTagService', () => {
    const service = new DefaultCacheTagService('test');
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it('should generate tags for a simple URL', () => {
        const req = new Request('https://example.com/path');
        const tags = service.generateTags(req, 'image');
        expect(tags).toContain('test:host:example.com');
        expect(tags).toContain('test:type:image');
        expect(tags).toContain('test:path:/path');
        expect(tags).toContain('test:prefix:/path');
    });
    it('should generate tags for nested paths', () => {
        const req = new Request('https://example.com/a/b/c.jpg');
        const tags = service.generateTags(req, 'image');
        expect(tags).toContain('test:host:example.com');
        expect(tags).toContain('test:type:image');
        expect(tags).toContain('test:ext:jpg');
        expect(tags).toContain('test:path:/a/b/c.jpg');
        expect(tags).toContain('test:prefix:/a');
        expect(tags).toContain('test:prefix:/a/b');
        expect(tags).toContain('test:prefix:/a/b/c.jpg');
    });
    it('should generate a home page tag for root path', () => {
        const req = new Request('https://example.com/');
        const tags = service.generateTags(req, 'html');
        expect(tags).toContain('test:host:example.com');
        expect(tags).toContain('test:type:html');
        expect(tags).toContain('test:page:home');
    });
    it('should handle query parameters properly', () => {
        const req = new Request('https://example.com/search?q=test&page=2');
        const tags = service.generateTags(req, 'api');
        expect(tags).toContain('test:host:example.com');
        expect(tags).toContain('test:type:api');
        expect(tags).toContain('test:path:/search');
        // Query parameters should not be included in tags
        expect(tags.some(tag => tag.includes('q=test'))).toBe(false);
    });
    it('should deduplicate tags', () => {
        // Creating a request where a duplicate tag could happen
        const req = new Request('https://example.com/a/a');
        const tags = service.generateTags(req, 'default');
        // Count occurrences of /a tag
        const count = tags.filter(tag => tag === 'test:prefix:/a').length;
        expect(count).toBe(1);
    });
    it('should limit tags to specified maximum', () => {
        // Create a service with a max of 3 tags
        const limitedService = new DefaultCacheTagService('test', 3);
        const req = new Request('https://example.com/a/b/c/d/e.jpg');
        const tags = limitedService.generateTags(req, 'image');
        // Should only have 3 tags total
        expect(tags.length).toBe(3);
        // Should prioritize the most important tags
        expect(tags).toContain('test:host:example.com');
        expect(tags).toContain('test:type:image');
        expect(tags).toContain('test:ext:jpg');
    });
    it('should prioritize first and last segments for very deep paths', () => {
        // Create a deep path with many segments
        const req = new Request('https://example.com/a/b/c/d/e/f/g/h/i/j/file.txt');
        const tags = service.generateTags(req, 'document');
        // Should include first segments
        expect(tags).toContain('test:prefix:/a');
        expect(tags).toContain('test:prefix:/a/b');
        expect(tags).toContain('test:prefix:/a/b/c');
        // Should include the path
        expect(tags).toContain('test:path:/a/b/c/d/e/f/g/h/i/j/file.txt');
        // Check for file extension
        expect(tags).toContain('test:ext:txt');
        // Should not include middle segments (since we prioritize first and last)
        const middleSegments = tags.some(tag => tag === 'test:prefix:/a/b/c/d' ||
            tag === 'test:prefix:/a/b/c/d/e');
        // Maximum tag count should be respected (10 by default)
        expect(tags.length).toBeLessThanOrEqual(10);
        // First and last segments should be there, but middle ones might not
        // due to the length limitation
        if (tags.length < 10) {
            expect(middleSegments).toBe(false);
        }
    });
    describe('validateTag', () => {
        it('should validate proper tags', () => {
            expect(service.validateTag('test:type:image')).toBe(true);
            expect(service.validateTag('test:ext:jpg')).toBe(true);
            expect(service.validateTag('simple-tag')).toBe(true);
            expect(service.validateTag('with.dots')).toBe(true);
            expect(service.validateTag('with_underscores')).toBe(true);
        });
        it('should reject empty tags', () => {
            expect(service.validateTag('')).toBe(false);
        });
        it('should reject tags with spaces', () => {
            expect(service.validateTag('tag with spaces')).toBe(false);
            expect(service.validateTag(' leading-space')).toBe(false);
            expect(service.validateTag('trailing-space ')).toBe(false);
        });
        it('should reject tags with non-printable ASCII', () => {
            expect(service.validateTag('tag\twith\ttabs')).toBe(false);
            expect(service.validateTag('tag\nwith\nnewlines')).toBe(false);
            expect(service.validateTag('tag\rwith\rcarriage-returns')).toBe(false);
        });
        it('should reject tags that exceed maximum length', () => {
            // Create a very long tag (over 1024 characters)
            const longTag = 'x'.repeat(1025);
            expect(service.validateTag(longTag)).toBe(false);
        });
    });
    describe('formatTagsForHeader', () => {
        it('should format valid tags correctly', () => {
            const tags = ['tag1', 'tag2', 'tag3'];
            expect(service.formatTagsForHeader(tags)).toBe('tag1,tag2,tag3');
        });
        it('should filter out invalid tags', () => {
            const tags = ['valid-tag', 'tag with space', '', 'another-valid'];
            expect(service.formatTagsForHeader(tags)).toBe('valid-tag,another-valid');
        });
        it('should handle empty tag lists', () => {
            expect(service.formatTagsForHeader([])).toBe('');
        });
        it('should truncate header value if it exceeds maximum length', () => {
            // Create a service with a small max header length for testing
            const testService = new DefaultCacheTagService('test');
            // Access and override private property for testing
            Object.defineProperty(testService, 'maxHeaderLength', { value: 15 });
            const tags = ['tag1', 'tag2', 'longtag3'];
            // Should only include "tag1,tag2" (11 chars) as adding "longtag3" would exceed 15 chars
            expect(testService.formatTagsForHeader(tags)).toBe('tag1,tag2');
            // Should log a warning
            expect(logger.warn).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=cache-tag-service.test.js.map