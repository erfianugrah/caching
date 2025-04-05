import { AssetConfigMap, AssetTypeConfig } from '../types/cache-config';
import { AssetTypeService } from './interfaces';
/**
 * Implementation of AssetTypeService for detecting asset types in requests
 */
export declare class DefaultAssetTypeService implements AssetTypeService {
    private assetConfigs;
    /**
     * Create a new AssetTypeService
     * @param assetConfigs Map of asset types to configurations
     */
    constructor(assetConfigs: AssetConfigMap);
    /**
     * Get the configuration for a request
     * @param request The request to get configuration for
     * @returns The matched asset configuration with type information
     */
    getConfigForRequest(request: Request): AssetTypeConfig;
}
export declare const defaultAssetConfigs: AssetConfigMap;
export declare const DefaultAssetService: DefaultAssetTypeService;
