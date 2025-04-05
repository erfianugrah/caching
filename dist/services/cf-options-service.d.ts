import { AssetConfig, CfCacheOptions } from '../types/cache-config';
import { CfOptionsService } from './interfaces';
/**
 * Implementation of CfOptionsService for generating CloudFlare cache options
 */
export declare class DefaultCfOptionsService implements CfOptionsService {
    /**
     * Generate CloudFlare-specific cache options
     * @param request The request
     * @param config The asset configuration
     * @returns CloudFlare cache options
     */
    getCfOptions(request: Request, config: AssetConfig): CfCacheOptions;
}
export declare const CfOptionsGenerator: DefaultCfOptionsService;
