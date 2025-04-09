import { EnvironmentConfig, LogLevel } from '../types/environment-config';
import { AssetConfigMap } from '../types/cache-config';
import { logger, updateLoggerConfig } from '../utils/logger';
import { environmentConfigSchema } from '../config/schemas';
import { KVConfigService } from '../config/kv-config-service';
import { getConfigKvNamespace } from '../config/kv-namespace-provider';
import { defaultAssetConfigs } from './asset-type-service';
import { z } from 'zod';

/**
 * Service for managing application configuration
 * 
 * This service provides a unified interface for accessing configuration,
 * supporting both environment variables and KV-stored configuration.
 * It automatically handles loading, validation, and caching of
 * configuration values from multiple sources.
 */
export class ConfigService {
  private envConfig: EnvironmentConfig;
  private kvConfigService: KVConfigService | null = null;
  private initialized = false;

  /**
   * Create a new ConfigService instance
   */
  constructor() {
    // Load basic config from environment variables
    this.envConfig = this.loadEnvConfig();
    this.logConfig();
  }

  /**
   * Initialize the service with KV storage
   * This is called lazily to ensure KV binding is available
   */
  private async initialize(): Promise<void> {
    // Add request ID and track initialization sequence
    const initStartTime = performance.now();
    // Safe to use crypto.randomUUID here as it's inside a function
    const initId = `init-${crypto.randomUUID().slice(0, 8)}`;
    
    logger.debug('Config service initialization starting', {
      initId,
      alreadyInitialized: this.initialized,
      initSequence: 'start'
    });
    
    if (this.initialized) {
      logger.debug('Config service already initialized, skipping', {
        initId,
        initSequence: 'skip',
        initDuration: 0
      });
      return;
    }

    try {
      // Get KV namespace name from config
      const kvNamespaceName = this.envConfig.configKvNamespace;
      
      logger.debug('Resolving KV namespace', {
        initId,
        kvNamespaceName,
        initSequence: 'resolving-namespace'
      });
      
      // Resolve the KV namespace
      const resolveStartTime = performance.now();
      const kvNamespace = getConfigKvNamespace(kvNamespaceName);
      const resolveTime = performance.now() - resolveStartTime;
      
      logger.debug('KV namespace resolution result', {
        initId,
        kvNamespaceResolved: !!kvNamespace,
        kvNamespaceName,
        resolveDuration: resolveTime.toFixed(2) + 'ms',
        initSequence: 'namespace-resolved'
      });
      
      // Create KV config service
      const createStartTime = performance.now();
      this.kvConfigService = new KVConfigService(
        kvNamespace,
        this.envConfig,
        defaultAssetConfigs
      );
      const createTime = performance.now() - createStartTime;
      
      logger.debug('KV config service created', {
        initId,
        createDuration: createTime.toFixed(2) + 'ms',
        initSequence: 'service-created',
        hasKvNamespace: !!kvNamespace
      });
      
      // If KV is available, load environment config from KV
      if (kvNamespace) {
        const loadStartTime = performance.now();
        this.envConfig = await this.kvConfigService.getEnvironmentConfig();
        const loadTime = performance.now() - loadStartTime;
        
        // Apply logging configuration if present
        if (this.envConfig.logging) {
          logger.info('Updating logger configuration from KV', {
            initId, 
            logLevel: this.envConfig.logging.level,
            sampleRate: this.envConfig.logging.sampleRate,
            performanceMetrics: this.envConfig.logging.performanceMetrics
          });
          
          updateLoggerConfig(this.envConfig.logging);
        }
        
        logger.info('Configuration loaded from KV', {
          initId,
          loadDuration: loadTime.toFixed(2) + 'ms',
          initSequence: 'config-loaded',
          environment: this.envConfig.environment,
          version: this.envConfig.version
        });
      } else {
        logger.warn('No KV namespace available, using environment config only', {
          initId,
          initSequence: 'using-env-only'
        });
      }
    } catch (error) {
      logger.error('Failed to initialize KV config service', {
        initId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        initSequence: 'error'
      });
    }
    
    this.initialized = true;
    const initDuration = performance.now() - initStartTime;
    
    logger.info('Config service initialization complete', {
      initId,
      initDuration: initDuration.toFixed(2) + 'ms',
      hasKvConfigService: !!this.kvConfigService,
      initSequence: 'complete'
    });
  }

  /**
   * Get the current environment configuration
   * @param forceRefresh Whether to force a refresh from KV
   * @returns The current environment configuration
   */
  async getConfig(forceRefresh = false): Promise<EnvironmentConfig> {
    // Ensure initialization
    await this.initialize();
    
    // Get config from KV if available
    if (this.kvConfigService) {
      return await this.kvConfigService.getEnvironmentConfig(forceRefresh);
    }
    
    // Fall back to environment config
    return this.envConfig;
  }

  /**
   * Get the synchronous environment configuration
   * This is the environment configuration loaded from variables,
   * not from KV (which requires async)
   * @returns The current environment configuration from environment variables
   */
  getEnvConfig(): EnvironmentConfig {
    return this.envConfig;
  }

  /**
   * Get all asset configurations
   * @param forceRefresh Whether to force a refresh from KV
   * @returns Map of asset type to configuration
   */
  async getAssetConfigs(forceRefresh = false): Promise<AssetConfigMap> {
    // Ensure initialization
    await this.initialize();
    
    // Get configs from KV if available
    if (this.kvConfigService) {
      return await this.kvConfigService.getAssetConfigs(forceRefresh);
    }
    
    // Fall back to default asset configs
    return defaultAssetConfigs;
  }

  /**
   * Get a specific asset configuration by type
   * @param assetType The asset type to get configuration for
   * @param forceRefresh Whether to force a refresh from KV
   * @returns The asset configuration or null if not found
   */
  async getAssetConfig(assetType: string, forceRefresh = false): Promise<AssetConfigMap[string] | null> {
    // Ensure initialization
    await this.initialize();
    
    // Get config from KV if available
    if (this.kvConfigService) {
      return await this.kvConfigService.getAssetConfig(assetType, forceRefresh);
    }
    
    // Fall back to default asset config
    return defaultAssetConfigs[assetType] || null;
  }

  /**
   * Save environment configuration to KV
   * @param config The environment configuration to save
   * @returns True if saved successfully
   */
  async saveConfig(config: EnvironmentConfig): Promise<boolean> {
    // Ensure initialization
    await this.initialize();
    
    // Save to KV if available
    if (this.kvConfigService) {
      const result = await this.kvConfigService.saveEnvironmentConfig(config);
      
      if (result) {
        // Update local config
        this.envConfig = config;
        this.logConfig();
        
        // Apply logging configuration if present
        if (config.logging) {
          logger.info('Updating logger configuration after config save', { 
            logLevel: config.logging.level,
            sampleRate: config.logging.sampleRate,
            performanceMetrics: config.logging.performanceMetrics
          });
          
          updateLoggerConfig(config.logging);
        }
      }
      
      return result;
    }
    
    logger.warn('No KV storage available for saving configuration');
    return false;
  }

  /**
   * Save an asset configuration to KV
   * @param assetType The asset type to save
   * @param config The asset configuration to save
   * @returns True if saved successfully
   */
  async saveAssetConfig(assetType: string, config: AssetConfigMap[string]): Promise<boolean> {
    // Ensure initialization
    await this.initialize();
    
    // Save to KV if available
    if (this.kvConfigService) {
      return await this.kvConfigService.saveAssetConfig(assetType, config);
    }
    
    logger.warn('No KV storage available for saving asset configuration');
    return false;
  }

  /**
   * Delete an asset configuration from KV
   * @param assetType The asset type to delete
   * @returns True if deleted successfully
   */
  async deleteAssetConfig(assetType: string): Promise<boolean> {
    // Ensure initialization
    await this.initialize();
    
    // Delete from KV if available
    if (this.kvConfigService) {
      return await this.kvConfigService.deleteAssetConfig(assetType);
    }
    
    logger.warn('No KV storage available for deleting asset configuration');
    return false;
  }

  /**
   * Load configuration from environment variables
   * @returns Validated environment configuration
   */
  private loadEnvConfig(): EnvironmentConfig {
    try {
      // Get environment variables with type safety
      const environment = (globalThis as any).ENVIRONMENT;
      const logLevel = (globalThis as any).LOG_LEVEL;
      const debugMode = (globalThis as any).DEBUG_MODE === 'true';
      const maxCacheTags = parseInt((globalThis as any).MAX_CACHE_TAGS || '10', 10);
      const cacheTagNamespace = (globalThis as any).CACHE_TAG_NAMESPACE;
      const version = (globalThis as any).VERSION;
      const configKvNamespace = (globalThis as any).CONFIG_KV_NAMESPACE;
      const configRefreshInterval = parseInt((globalThis as any).CONFIG_REFRESH_INTERVAL || '300', 10);

      // Parse and validate configuration
      return environmentConfigSchema.parse({
        environment,
        logLevel: logLevel as LogLevel,
        debugMode,
        maxCacheTags,
        cacheTagNamespace,
        version,
        configKvNamespace,
        configRefreshInterval,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Configuration validation errors, using defaults', { 
          errors: error.errors 
        });
        // Return default values if validation fails
        return environmentConfigSchema.parse({});
      }
      
      // For other errors, log and use defaults
      logger.error('Failed to load configuration', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return environmentConfigSchema.parse({});
    }
  }

  /**
   * Log the current configuration
   */
  private logConfig(): void {
    logger.info('Configuration loaded', {
      environment: this.envConfig.environment,
      logLevel: this.envConfig.logLevel,
      debugMode: this.envConfig.debugMode ? 'enabled' : 'disabled',
      maxCacheTags: this.envConfig.maxCacheTags,
      kvNamespace: this.envConfig.configKvNamespace || 'none',
      version: this.envConfig.version
    });
  }
}