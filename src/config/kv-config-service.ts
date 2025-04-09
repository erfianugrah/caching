/**
 * KV-backed configuration service for dynamic configuration
 * 
 * This service provides the ability to store and retrieve configuration
 * from Cloudflare KV, with built-in validation, caching, and fallbacks
 * to default configurations when KV values are not available.
 */

import { 
  assetConfigMapSchema, 
  assetConfigSchema, 
  environmentConfigSchema, 
  parseAssetConfig,
  serializeAssetConfig,
} from './schemas';
import { logger } from '../utils/logger';
import { EnvironmentConfig } from '../types/environment-config';
import { AssetConfig, AssetConfigMap } from '../types/cache-config';
import { defaultAssetConfigs } from '../services/asset-type-service';
import { z } from 'zod';

/**
 * Two-tier caching system for improved performance
 * - L1: In-memory cache with short TTL (typically 30s) for high frequency access
 * - L2: KV storage for persistence (with standard refresh interval)
 * 
 * This approach significantly reduces KV accesses while still allowing for 
 * timely configuration updates across worker instances.
 */
class TwoTierCache<T> {
  private l1Cache: T | null = null;
  private l1CacheTime: number = 0;
  private l1Ttl: number = 30_000; // 30 seconds L1 cache TTL
  private key: string;
  
  constructor(key: string, l1Ttl?: number) {
    this.key = key;
    if (l1Ttl) this.l1Ttl = l1Ttl;
  }
  
  /**
   * Get an item from the cache
   * @param fetchFn Function to fetch the item if not in cache
   * @param forceRefresh Whether to force a refresh from the source
   * @returns The cached or freshly fetched item
   */
  async get(fetchFn: () => Promise<T>, forceRefresh = false): Promise<T> {
    const now = Date.now();
    const l1Age = now - this.l1CacheTime;
    const l1Valid = !forceRefresh && this.l1Cache && l1Age < this.l1Ttl;
    
    // Log cache state for debugging
    logger.debug('Two-tier cache access', {
      key: this.key,
      level: 'L1',
      hit: l1Valid,
      ttl: this.l1Ttl,
      age: l1Age,
      forceRefresh
    });
    
    // Return from L1 cache if valid
    if (l1Valid) {
      return this.l1Cache!;
    }
    
    // Fetch from source (KV or other)
    try {
      const value = await fetchFn();
      
      // Update L1 cache
      this.l1Cache = value;
      this.l1CacheTime = now;
      
      return value;
    } catch (error) {
      // On error, if we have a cached value, return it even if expired
      if (this.l1Cache) {
        logger.warn('Error fetching from source, using expired cache', {
          key: this.key,
          error: error instanceof Error ? error.message : String(error),
          cacheAge: l1Age
        });
        return this.l1Cache;
      }
      
      // No cache value to fall back to
      throw error;
    }
  }
  
  /**
   * Set a value in the cache
   * @param value The value to cache
   */
  set(value: T): void {
    this.l1Cache = value;
    this.l1CacheTime = Date.now();
    
    logger.debug('Updated two-tier cache', {
      key: this.key,
      level: 'L1',
      time: new Date().toISOString()
    });
  }
  
  /**
   * Invalidate the L1 cache
   */
  invalidate(): void {
    this.l1Cache = null;
    this.l1CacheTime = 0;
    
    logger.debug('Invalidated cache', {
      key: this.key,
      level: 'L1'
    });
  }
}

// KV storage keys
const KV_KEY_ENV_CONFIG = 'environment-config';
const KV_KEY_ASSET_CONFIGS = 'asset-configs';

/**
 * KV Config Service for storing and retrieving configuration from Cloudflare KV
 */
export class KVConfigService {
  // KV namespace for configuration storage
  private kvNamespace: KVNamespace | null = null;

  // Two-tier caching for configurations
  private envConfigCache: TwoTierCache<EnvironmentConfig>;
  private assetConfigCache: TwoTierCache<Map<string, AssetConfig>>;

  // Default configurations
  private defaultEnvConfig: EnvironmentConfig;
  private defaultAssetConfigs: AssetConfigMap;

  // Cache refresh interval
  private configRefreshInterval: number = 300 * 1000; // 5 minutes in milliseconds

  /**
   * Create a new KV Config Service
   * @param namespace Optional KV namespace for configuration storage
   * @param defaultEnvConfig Default environment configuration to use as fallback
   * @param defaultAssetConfigs Default asset configurations to use as fallback
   */
  constructor(
    namespace: KVNamespace | null = null,
    defaultEnvConfig: EnvironmentConfig | null = null,
    defaultAssetConfigs: AssetConfigMap | null = null
  ) {
    this.kvNamespace = namespace;
    
    // Initialize defaults
    this.defaultEnvConfig = defaultEnvConfig || environmentConfigSchema.parse({});
    this.defaultAssetConfigs = defaultAssetConfigs || {};
    
    // Set refresh interval from config
    this.configRefreshInterval = this.defaultEnvConfig.configRefreshInterval * 1000;
    
    // Create two-tier caches
    // Short TTL for environment config (10s) to allow quicker updates of log levels
    this.envConfigCache = new TwoTierCache<EnvironmentConfig>(KV_KEY_ENV_CONFIG, 10_000);
    // Slightly longer TTL for asset configs (30s) as they change less frequently
    this.assetConfigCache = new TwoTierCache<Map<string, AssetConfig>>(KV_KEY_ASSET_CONFIGS, 30_000);
    
    logger.debug('KVConfigService initialized', {
      hasNamespace: !!this.kvNamespace,
      configRefreshInterval: this.configRefreshInterval,
      cacheType: 'two-tier',
      envConfigCacheTtl: 10_000,
      assetConfigCacheTtl: 30_000
    });
  }

  /**
   * Get the environment configuration
   * Loads from KV if available, falls back to default, and caches the result
   * @param forceRefresh Whether to force a refresh from KV
   * @returns The environment configuration
   */
  async getEnvironmentConfig(forceRefresh = false): Promise<EnvironmentConfig> {
    // Use the two-tier cache to fetch the environment config
    return this.envConfigCache.get(async () => {
      // This runs only when L1 cache misses or force refresh requested
      const fetchStartTime = performance.now();
      logger.debug('Fetching environment config (L1 cache miss)', {
        forceRefresh,
        kvNamespaceAvailable: !!this.kvNamespace,
        fetchSource: this.kvNamespace ? 'KV' : 'default'
      });
            
      // Try to load from KV if available
      if (this.kvNamespace) {
        try {
          // Get the configuration with metadata
          const { value: kvConfig, metadata } = await this.kvNamespace.getWithMetadata(KV_KEY_ENV_CONFIG, 'json');
          
          if (kvConfig) {
            // Validate the KV configuration
            logger.debug('Received KV environment config, validating', {
              kvConfigProperties: Object.keys(kvConfig).join(', '),
              configSize: JSON.stringify(kvConfig).length,
              metadata: metadata ? JSON.stringify(metadata) : 'none',
              configVersion: metadata?.version || 'unknown'
            });
            
            // Parse and validate the configuration
            const parsedConfig = environmentConfigSchema.parse(kvConfig);
            
            // Update refresh interval if it changed
            this.configRefreshInterval = parsedConfig.configRefreshInterval * 1000;
            
            const fetchTime = performance.now() - fetchStartTime;
            logger.info('Successfully loaded environment config from KV', {
              environment: parsedConfig.environment,
              logLevel: parsedConfig.logLevel,
              refreshIntervalSeconds: parsedConfig.configRefreshInterval,
              fetchTimeMs: fetchTime.toFixed(2),
              source: 'KV',
              configVersion: metadata?.version || parsedConfig.version || 'unversioned'
            });
            
            return parsedConfig;
          } else {
            logger.warn('KV environment config not found, using defaults', {
              key: KV_KEY_ENV_CONFIG,
              source: 'default'
            });
          }
        } catch (error) {
          if (error instanceof z.ZodError) {
            logger.warn('Invalid environment config in KV, using default', {
              errors: error.errors,
              source: 'default-validation-error'
            });
          } else {
            logger.error('Failed to load environment config from KV', {
              error: error instanceof Error ? error.message : String(error),
              source: 'default-fetch-error'
            });
          }
        }
      }
      
      // Fall back to default configuration
      logger.debug('Using default environment config', {
        environment: this.defaultEnvConfig.environment,
        source: 'default'
      });
      
      return this.defaultEnvConfig;
    }, forceRefresh);
  }

  /**
   * Save environment configuration to KV
   * @param config The environment configuration to save
   * @param metadata Optional metadata to store with the configuration
   * @returns True if saved successfully
   */
  async saveEnvironmentConfig(
    config: EnvironmentConfig, 
    metadata?: { version?: string; createdAt?: string; createdBy?: string; description?: string; }
  ): Promise<boolean> {
    const saveStartTime = performance.now();
    
    try {
      // Validate configuration - will throw if invalid
      const validatedConfig = environmentConfigSchema.parse(config);

      // Prepare metadata - include timestamp and version info
      const configMetadata = {
        version: config.version || '1.0.0',
        environment: config.environment,
        createdAt: new Date().toISOString(),
        ...metadata
      };

      // Save to KV if available
      if (this.kvNamespace) {
        await this.kvNamespace.put(
          KV_KEY_ENV_CONFIG, 
          JSON.stringify(validatedConfig), 
          { metadata: configMetadata }
        );
        
        // Update L1 cache directly
        this.envConfigCache.set(validatedConfig);
        
        // Update refresh interval if it changed
        this.configRefreshInterval = validatedConfig.configRefreshInterval * 1000;
        
        const saveTime = performance.now() - saveStartTime;
        logger.info('Saved environment config to KV', {
          saveTimeMs: saveTime.toFixed(2),
          environment: validatedConfig.environment,
          configSize: JSON.stringify(validatedConfig).length,
          cacheUpdated: true,
          operation: 'save',
          configVersion: configMetadata.version,
          configMetadata: JSON.stringify(configMetadata)
        });
        
        return true;
      } else {
        logger.warn('No KV namespace available for saving environment config', {
          operation: 'save-failed',
          reason: 'no-namespace'
        });
        return false;
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error('Invalid environment config, not saved', {
          errors: error.errors,
          operation: 'save-failed',
          reason: 'validation-error'
        });
      } else {
        logger.error('Failed to save environment config to KV', {
          error: error instanceof Error ? error.message : String(error),
          operation: 'save-failed',
          reason: 'kv-error',
          saveAttemptTimeMs: (performance.now() - saveStartTime).toFixed(2)
        });
      }
      return false;
    }
  }

  /**
   * Get all asset configurations
   * Loads from KV if available, falls back to defaults, and caches the result
   * @param forceRefresh Whether to force a refresh from KV
   * @returns Map of asset type to configuration
   */
  async getAssetConfigs(forceRefresh = false): Promise<AssetConfigMap> {
    // Use the two-tier cache to fetch the asset configs
    const assetConfigsMap = await this.assetConfigCache.get(async () => {
      // This runs only when L1 cache misses or force refresh requested
      const fetchStartTime = performance.now();
      logger.debug('Fetching asset configs (L1 cache miss)', {
        forceRefresh,
        kvNamespaceAvailable: !!this.kvNamespace,
        fetchSource: this.kvNamespace ? 'KV' : 'default'
      });
      
      // Create a new Map for asset configs
      const assetConfigs = new Map<string, AssetConfig>();
      
      // Try to load from KV if available
      if (this.kvNamespace) {
        try {
          // Get the configuration with metadata
          const { value: kvConfigs, metadata } = await this.kvNamespace.getWithMetadata(KV_KEY_ASSET_CONFIGS, 'json');
          
          if (kvConfigs) {
            // Validate the KV configurations
            logger.debug('Received KV asset configs, validating', {
              kvConfigsAssetCount: Object.keys(kvConfigs).length,
              assetTypes: Object.keys(kvConfigs).join(', '),
              configSize: JSON.stringify(kvConfigs).length,
              metadata: metadata ? JSON.stringify(metadata) : 'none',
              configVersion: metadata?.version || 'unknown'
            });
            
            // Parse and validate the configurations
            const parsedConfigs = assetConfigMapSchema.parse(kvConfigs);
            
            // Convert stored configs to runtime configs with RegExp
            for (const [assetType, config] of Object.entries(parsedConfigs)) {
              assetConfigs.set(assetType, parseAssetConfig(config));
            }
            
            const fetchTime = performance.now() - fetchStartTime;
            logger.info('Successfully loaded asset configs from KV', {
              count: assetConfigs.size,
              assetTypes: Array.from(assetConfigs.keys()).join(', '),
              fetchTimeMs: fetchTime.toFixed(2),
              source: 'KV',
              configVersion: metadata?.version || 'unversioned'
            });
            
            return assetConfigs;
          } else {
            logger.warn('KV asset configs not found, using defaults', {
              key: KV_KEY_ASSET_CONFIGS,
              source: 'default'
            });
          }
        } catch (error) {
          if (error instanceof z.ZodError) {
            logger.warn('Invalid asset configs in KV, using defaults', {
              errors: error.errors,
              source: 'default-validation-error'
            });
          } else {
            logger.error('Failed to load asset configs from KV', {
              error: error instanceof Error ? error.message : String(error),
              source: 'default-fetch-error'
            });
          }
        }
      }
      
      // Fall back to default configurations
      for (const [assetType, config] of Object.entries(this.defaultAssetConfigs)) {
        assetConfigs.set(assetType, config);
      }
      
      logger.debug('Using default asset configs', {
        count: assetConfigs.size,
        assetTypes: Array.from(assetConfigs.keys()).join(', '),
        source: 'default'
      });
      
      return assetConfigs;
    }, forceRefresh);
    
    // Convert the Map to an object for compatibility
    return Object.fromEntries(assetConfigsMap.entries());
  }

  /**
   * Get a specific asset configuration by type
   * @param assetType The asset type to get configuration for
   * @param forceRefresh Whether to force a refresh from KV
   * @returns The asset configuration or null if not found
   */
  async getAssetConfig(assetType: string, forceRefresh = false): Promise<AssetConfig | null> {
    // Get all configurations
    const allConfigs = await this.getAssetConfigs(forceRefresh);
    
    // Return the specific asset config
    const config = allConfigs[assetType];
    
    // Log the result
    logger.debug(`Asset config lookup for '${assetType}'`, {
      assetType,
      found: !!config,
      forceRefresh,
      operation: 'get-asset-config'
    });
    
    return config || null;
  }

  /**
   * Save an asset configuration to KV
   * @param assetType The asset type to save
   * @param config The asset configuration to save
   * @param metadata Optional metadata to store with the configuration
   * @returns True if saved successfully
   */
  async saveAssetConfig(
    assetType: string, 
    config: AssetConfig,
    metadata?: { version?: string; createdAt?: string; createdBy?: string; description?: string; }
  ): Promise<boolean> {
    const saveStartTime = performance.now();
    
    try {
      // Handle RegExp serialization - ensure it has the right structure for serialization
      const configWithRegex = config as unknown as { regex: RegExp, [key: string]: unknown };
      const serializedConfig = serializeAssetConfig(configWithRegex);
      
      // Validate configuration
      const validatedConfig = assetConfigSchema.parse(serializedConfig);
      
      // Get existing configs to merge with
      const allConfigs = await this.getAssetConfigs();
      
      // Update the specific asset type
      const updatedConfigs = {
        ...allConfigs,
        [assetType]: parseAssetConfig(validatedConfig),
      };
      
      // Asset-specific metadata
      const assetMetadata = {
        ...metadata,
        assetType,
        lastUpdated: new Date().toISOString(),
      };
      
      // Save all configs to KV with metadata
      const success = await this.saveAssetConfigs(updatedConfigs, assetMetadata);
      
      const saveTime = performance.now() - saveStartTime;
      logger.info(`${success ? 'Successfully saved' : 'Failed to save'} asset config for '${assetType}'`, {
        assetType,
        saveTimeMs: saveTime.toFixed(2),
        operation: 'save-asset-config',
        success,
        metadata: JSON.stringify(assetMetadata)
      });
      
      return success;
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error('Invalid asset config, not saved', {
          assetType,
          errors: error.errors,
          operation: 'save-asset-config-failed',
          reason: 'validation-error'
        });
      } else {
        logger.error('Failed to save asset config to KV', {
          assetType,
          error: error instanceof Error ? error.message : String(error),
          operation: 'save-asset-config-failed',
          reason: 'unknown-error',
          saveAttemptTimeMs: (performance.now() - saveStartTime).toFixed(2)
        });
      }
      return false;
    }
  }

  /**
   * Save all asset configurations to KV
   * @param configs Map of asset type to configuration
   * @param metadata Optional metadata to store with the configuration
   * @returns True if saved successfully
   */
  async saveAssetConfigs(
    configs: AssetConfigMap,
    metadata?: { version?: string; createdAt?: string; createdBy?: string; description?: string; }
  ): Promise<boolean> {
    const saveStartTime = performance.now();
    
    try {
      // Create serialized version of configs for storage
      const serializedConfigs: Record<string, z.infer<typeof assetConfigSchema>> = {};
      
      for (const [assetType, config] of Object.entries(configs)) {
        // Cast to the expected format for serialization
        const configWithRegex = config as unknown as { regex: RegExp, [key: string]: unknown };
        serializedConfigs[assetType] = serializeAssetConfig(configWithRegex);
      }
      
      // Validate all configurations
      const validatedConfigs = assetConfigMapSchema.parse(serializedConfigs);
      
      // Get current environment config for version info
      const envConfig = await this.getEnvironmentConfig();
      
      // Prepare metadata with version from environment config
      const configMetadata = {
        version: envConfig.version || '1.0.0',
        environment: envConfig.environment,
        createdAt: new Date().toISOString(),
        assetTypesCount: Object.keys(validatedConfigs).length,
        ...metadata
      };
      
      // Save to KV if available
      if (this.kvNamespace) {
        await this.kvNamespace.put(
          KV_KEY_ASSET_CONFIGS, 
          JSON.stringify(validatedConfigs),
          { metadata: configMetadata }
        );
        
        // Create a new Map for asset configs and populate it
        const assetConfigs = new Map<string, AssetConfig>();
        
        // Convert stored configs back to runtime configs with RegExp
        for (const [assetType, config] of Object.entries(validatedConfigs)) {
          assetConfigs.set(assetType, parseAssetConfig(config));
        }
        
        // Update L1 cache directly
        this.assetConfigCache.set(assetConfigs);
        
        const saveTime = performance.now() - saveStartTime;
        logger.info('Saved asset configs to KV', {
          count: Object.keys(validatedConfigs).length,
          assetTypes: Object.keys(validatedConfigs).join(', '),
          saveTimeMs: saveTime.toFixed(2),
          configSize: JSON.stringify(validatedConfigs).length,
          operation: 'save-asset-configs',
          cacheUpdated: true,
          configVersion: configMetadata.version,
          configMetadata: JSON.stringify(configMetadata)
        });
        
        return true;
      } else {
        logger.warn('No KV namespace available for saving asset configs', {
          operation: 'save-asset-configs-failed',
          reason: 'no-namespace'
        });
        return false;
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error('Invalid asset configs, not saved', {
          errors: error.errors,
          operation: 'save-asset-configs-failed',
          reason: 'validation-error'
        });
      } else {
        logger.error('Failed to save asset configs to KV', {
          error: error instanceof Error ? error.message : String(error),
          operation: 'save-asset-configs-failed',
          reason: 'unknown-error',
          saveAttemptTimeMs: (performance.now() - saveStartTime).toFixed(2)
        });
      }
      return false;
    }
  }

  /**
   * Delete an asset configuration from KV
   * @param assetType The asset type to delete
   * @param metadata Optional metadata about the deletion
   * @returns True if deleted successfully
   */
  async deleteAssetConfig(
    assetType: string,
    metadata?: { deletedBy?: string; reason?: string; }
  ): Promise<boolean> {
    const deleteStartTime = performance.now();
    
    try {
      // Get existing configs
      const allConfigs = await this.getAssetConfigs();
      
      // Check if the asset type exists
      if (!allConfigs[assetType]) {
        logger.warn('Asset config does not exist, nothing to delete', {
          assetType,
          operation: 'delete-asset-config-skipped',
          reason: 'not-found'
        });
        return false;
      }
      
      // Remove the asset type
      const updatedConfigs: AssetConfigMap = { ...allConfigs };
      delete updatedConfigs[assetType];
      
      // Deletion metadata
      const deletionMetadata = {
        ...metadata,
        assetType,
        operationType: 'deletion',
        deletedAt: new Date().toISOString(),
      };
      
      // Save updated configs with deletion metadata
      const success = await this.saveAssetConfigs(updatedConfigs, deletionMetadata);
      
      const deleteTime = performance.now() - deleteStartTime;
      logger.info(`${success ? 'Successfully deleted' : 'Failed to delete'} asset config for '${assetType}'`, {
        assetType,
        deleteTimeMs: deleteTime.toFixed(2),
        operation: 'delete-asset-config',
        success,
        metadata: JSON.stringify(deletionMetadata)
      });
      
      return success;
    } catch (error) {
      logger.error('Failed to delete asset config from KV', {
        assetType,
        error: error instanceof Error ? error.message : String(error),
        operation: 'delete-asset-config-failed',
        reason: 'unknown-error',
        deleteAttemptTimeMs: (performance.now() - deleteStartTime).toFixed(2)
      });
      return false;
    }
  }
}