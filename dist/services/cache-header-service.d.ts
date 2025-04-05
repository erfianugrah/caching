import { AssetConfig } from '../types/cache-config';
import { CacheHeaderService } from './interfaces';
/**
 * Implementation of CacheHeaderService for managing cache headers
 */
export declare class DefaultCacheHeaderService implements CacheHeaderService {
    /**
     * Calculate Cache-Control header based on response status and config
     * @param status The HTTP status code
     * @param config The asset configuration
     * @returns A Cache-Control header value or empty string
     */
    getCacheControlHeader(status: number, config: AssetConfig): string;
    /**
     * Apply cache headers to a response
     * @param response The response to modify
     * @param request The original request
     * @param config The asset configuration
     * @returns The modified response
     */
    applyCacheHeaders(response: Response, request: Request, config: AssetConfig): Response;
}
export declare const CacheHeaderManager: DefaultCacheHeaderService;
