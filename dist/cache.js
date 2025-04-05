import { Services } from './services';
import { logger } from './utils/logger';
// Log startup information
const environment = globalThis.ENVIRONMENT || 'development';
const logLevel = globalThis.LOG_LEVEL || 'INFO';
const debugMode = globalThis.DEBUG_MODE === 'true' ? 'enabled' : 'disabled';
const maxTags = globalThis.MAX_CACHE_TAGS || '10';
logger.info('Caching service starting up', {
    environment,
    logLevel,
    debugMode,
    maxTags,
    version: globalThis.VERSION || 'dev'
});
/**
 * Main worker handler for the caching service
 */
export default {
    /**
     * Handle fetch requests
     * @param request The request to handle
     * @returns The cached response
     */
    async fetch(request) {
        try {
            // Get configuration for this request
            const config = Services.assetType.getConfigForRequest(request);
            logger.debug('Asset type detected', { type: config.assetType });
            // Get Cloudflare-specific options with dynamically generated cache tags
            const cfOptions = Services.cfOptions.getCfOptions(request, config);
            logger.debug('CF options generated', { cfOptions });
            // Fetch with cache configuration
            const originalResponse = await fetch(request, {
                cf: cfOptions // Type cast because Cloudflare types aren't exact
            });
            logger.info('Fetched response', {
                status: originalResponse.status,
                url: request.url
            });
            // Apply cache headers and return
            const response = Services.cacheHeader.applyCacheHeaders(originalResponse, request, config);
            return response;
        }
        catch (error) {
            // Log error and return a generic error response
            logger.error('Error processing request', {
                url: request.url,
                error: error instanceof Error ? error.message : String(error)
            });
            return new Response('Cache service error', {
                status: 500,
                headers: {
                    'Content-Type': 'text/plain',
                    'Cache-Control': 'no-store'
                }
            });
        }
    },
};
//# sourceMappingURL=cache.js.map