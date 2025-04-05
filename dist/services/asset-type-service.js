/**
 * Implementation of AssetTypeService for detecting asset types in requests
 */
export class DefaultAssetTypeService {
    /**
     * Create a new AssetTypeService
     * @param assetConfigs Map of asset types to configurations
     */
    constructor(assetConfigs) {
        this.assetConfigs = assetConfigs;
    }
    /**
     * Get the configuration for a request
     * @param request The request to get configuration for
     * @returns The matched asset configuration with type information
     */
    getConfigForRequest(request) {
        const url = new URL(request.url);
        // Find matching asset type based on regex
        for (const [assetType, config] of Object.entries(this.assetConfigs)) {
            if (config.regex.test(url.pathname)) {
                return {
                    assetType,
                    ...config,
                };
            }
        }
        // Default config for unmatched assets
        return {
            assetType: 'default',
            useQueryInCacheKey: true,
            regex: /.*/,
            ttl: {
                ok: 0, // Don't cache by default
                redirects: 0,
                clientError: 0,
                serverError: 0,
            },
        };
    }
}
// Default configurations for common asset types
export const defaultAssetConfigs = {
    video: {
        regex: /(.*\/Video)|(.*\.(m4s|mp4|ts|avi|mpeg|mpg|mkv|bin|webm|vob|flv|m2ts|mts|3gp|m4v|wmv|qt))$/,
        useQueryInCacheKey: false,
        ttl: {
            ok: 31556952, // 1 year
            redirects: 30,
            clientError: 10,
            serverError: 0,
        },
    },
    image: {
        regex: /(.*\/Images)|(.*\.(jpg|jpeg|png|bmp|pict|tif|tiff|webp|gif|heif|exif|bat|bpg|ppm|pgn|pbm|pnm))$/,
        useQueryInCacheKey: true,
        imageOptimization: true,
        ttl: {
            ok: 3600, // 1 hour
            redirects: 30,
            clientError: 10,
            serverError: 0,
        },
    },
    frontEnd: {
        regex: /^.*\.(css|js)$/,
        useQueryInCacheKey: true,
        minifyCss: true,
        ttl: {
            ok: 3600, // 1 hour
            redirects: 30,
            clientError: 10,
            serverError: 0,
        },
    },
    audio: {
        regex: /(.*\/Audio)|(.*\.(flac|aac|mp3|alac|aiff|wav|ogg|aiff|opus|ape|wma|3gp))$/,
        useQueryInCacheKey: false,
        ttl: {
            ok: 31556952, // 1 year
            redirects: 30,
            clientError: 10,
            serverError: 0,
        },
    },
    directPlay: {
        regex: /.*(\/Download)/,
        useQueryInCacheKey: false,
        ttl: {
            ok: 31556952, // 1 year
            redirects: 30,
            clientError: 10,
            serverError: 0,
        },
    },
    manifest: {
        regex: /^.*\.(m3u8|mpd)$/,
        useQueryInCacheKey: false,
        ttl: {
            ok: 3, // 3 seconds
            redirects: 2,
            clientError: 1,
            serverError: 0,
        },
    },
};
// Export default implementation
export const DefaultAssetService = new DefaultAssetTypeService(defaultAssetConfigs);
//# sourceMappingURL=asset-type-service.js.map