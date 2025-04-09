import { ConfigService } from './config-service';
import { 
  AssetTypeService, 
  CacheKeyService, 
  CacheHeaderService, 
  CacheTagService, 
  CfOptionsService,
  RequestProcessingService
} from './interfaces';
import { logger } from '../utils/logger';

// Direct imports of service implementations
import { DefaultAssetTypeService } from './asset-type-service';
import { DefaultCacheKeyService } from './cache-key-service';
import { DefaultCacheHeaderService } from './cache-header-service';
import { DefaultCacheTagService } from './cache-tag-service';
import { DefaultCfOptionsService } from './cf-options-service';
import { DefaultRequestProcessingService } from './request-processing-service';
import { DebugService } from './debug-service';

/**
 * Simple factory for creating service instances
 * All services are eagerly initialized to avoid timing issues
 */
export class ServiceFactory {
  // Singleton services
  private static configService: ConfigService = new ConfigService();
  private static assetTypeService: AssetTypeService = new DefaultAssetTypeService();
  private static cacheKeyService: CacheKeyService = new DefaultCacheKeyService();
  private static cacheHeaderService: CacheHeaderService = new DefaultCacheHeaderService();
  private static cacheTagService: CacheTagService = new DefaultCacheTagService();
  private static cfOptionsService: CfOptionsService = new DefaultCfOptionsService();
  private static requestProcessingService: RequestProcessingService = new DefaultRequestProcessingService();
  private static debugService: DebugService = DebugService.getInstance();

  // Initialize all services immediately
  static {
    logger.debug('ServiceFactory initialized with all services');
  }

  /**
   * Get the configuration service
   * @returns Configuration service instance
   */
  static getConfigService(): ConfigService {
    return this.configService;
  }

  /**
   * Get the AssetTypeService
   * @returns AssetTypeService instance
   */
  static getAssetTypeService(): AssetTypeService {
    return this.assetTypeService;
  }

  /**
   * Get the CacheKeyService
   * @returns CacheKeyService instance
   */
  static getCacheKeyService(): CacheKeyService {
    return this.cacheKeyService;
  }

  /**
   * Get the CacheHeaderService
   * @returns CacheHeaderService instance
   */
  static getCacheHeaderService(): CacheHeaderService {
    return this.cacheHeaderService;
  }

  /**
   * Get the CacheTagService
   * @returns CacheTagService instance
   */
  static getCacheTagService(): CacheTagService {
    return this.cacheTagService;
  }

  /**
   * Get the CfOptionsService
   * @returns CfOptionsService instance
   */
  static getCfOptionsService(): CfOptionsService {
    return this.cfOptionsService;
  }
  
  /**
   * Get the RequestProcessingService
   * @returns RequestProcessingService instance
   */
  static getRequestProcessingService(): RequestProcessingService {
    return this.requestProcessingService;
  }
  
  /**
   * Get the DebugService
   * @returns DebugService instance
   */
  static getDebugService(): DebugService {
    return this.debugService;
  }
}