/**
 * Cache configuration interfaces
 */
/**
 * TTL configuration by status code
 */
export interface TtlConfig {
    ok: number;
    redirects: number;
    clientError: number;
    serverError: number;
    info?: number;
}
/**
 * Asset-specific cache configuration
 */
export interface AssetConfig {
    regex: RegExp;
    useQueryInCacheKey: boolean;
    ttl: TtlConfig;
    imageOptimization?: boolean;
    minifyCss?: boolean;
}
/**
 * Asset configuration with type information
 */
export interface AssetTypeConfig extends AssetConfig {
    assetType: string;
}
/**
 * CloudFlare specific cache options
 */
export interface CfCacheOptions {
    cacheKey: string;
    polish: string;
    minify: {
        javascript: boolean;
        css: boolean;
        html: boolean;
    };
    mirage: boolean;
    cacheEverything: boolean;
    cacheTtlByStatus: {
        [key: string]: number;
    };
    cacheTags?: string[];
}
/**
 * Map of asset types to configurations
 */
export interface AssetConfigMap {
    [key: string]: AssetConfig;
}
