import { TagGenerator } from './cache-tag-service';
/**
 * Implementation of CacheHeaderService for managing cache headers
 */
export class DefaultCacheHeaderService {
    /**
     * Calculate Cache-Control header based on response status and config
     * @param status The HTTP status code
     * @param config The asset configuration
     * @returns A Cache-Control header value or empty string
     */
    getCacheControlHeader(status, config) {
        if (!config.ttl)
            return '';
        // Map status code to appropriate TTL
        let ttl = 0;
        if (status >= 200 && status < 300)
            ttl = config.ttl.ok;
        else if (status >= 300 && status < 400)
            ttl = config.ttl.redirects;
        else if (status >= 400 && status < 500)
            ttl = config.ttl.clientError;
        else if (status >= 500 && status < 600)
            ttl = config.ttl.serverError;
        return ttl > 0 ? `public, max-age=${ttl}` : '';
    }
    /**
     * Apply cache headers to a response
     * @param response The response to modify
     * @param request The original request
     * @param config The asset configuration
     * @returns The modified response
     */
    applyCacheHeaders(response, request, config) {
        // Create a new response to modify headers
        const newResponse = new Response(response.body, response);
        // Set Cache-Control header based on response status
        const cacheControl = this.getCacheControlHeader(response.status, config);
        if (cacheControl) {
            newResponse.headers.set('Cache-Control', cacheControl);
        }
        // Set Cache-Tag header for debugging and external systems
        const assetType = 'assetType' in config ? config.assetType : 'default';
        const cacheTags = TagGenerator.generateTags(request, assetType);
        if (cacheTags && cacheTags.length > 0) {
            // Format tags according to Cloudflare's requirements
            const formattedTags = TagGenerator.formatTagsForHeader(cacheTags);
            if (formattedTags) {
                newResponse.headers.set('Cache-Tag', formattedTags);
            }
        }
        // Add debug header if needed - check both request header and environment variable
        const debugMode = request.headers.get('debug') === 'true' ||
            globalThis.DEBUG_MODE === 'true';
        if (debugMode) {
            newResponse.headers.set('x-cache-debug', JSON.stringify({
                assetType,
                cacheKey: new URL(request.url).pathname,
                ttl: config.ttl,
                cacheTags,
                environment: globalThis.ENVIRONMENT || 'development',
                worker: {
                    name: globalThis.name || 'caching',
                    version: globalThis.VERSION || 'dev'
                }
            }));
        }
        return newResponse;
    }
}
// Export default implementation
export const CacheHeaderManager = new DefaultCacheHeaderService();
//# sourceMappingURL=cache-header-service.js.map