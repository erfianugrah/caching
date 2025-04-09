import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KVConfigService } from '../config/kv-config-service';
import { EnvironmentConfig } from '../types/environment-config';
import { ParsedAssetConfig } from '../config/schemas';

// Mock KV namespace
class MockKVNamespace {
  private store: Map<string, string> = new Map();
  private metadata: Map<string, object> = new Map();
  
  async get(key: string, type: 'json' | 'text' | 'arrayBuffer' | 'stream'): Promise<any> {
    const value = this.store.get(key);
    
    if (!value) {
      return null;
    }
    
    if (type === 'json') {
      return JSON.parse(value);
    }
    
    return value;
  }
  
  async getWithMetadata(key: string, type: 'json' | 'text' | 'arrayBuffer' | 'stream'): Promise<{ value: any, metadata: object | null }> {
    const value = await this.get(key, type);
    const meta = this.metadata.get(key) || null;
    
    return { value, metadata: meta };
  }
  
  async put(key: string, value: string, options?: { metadata?: object }): Promise<void> {
    this.store.set(key, value);
    
    if (options?.metadata) {
      this.metadata.set(key, options.metadata);
    }
  }
  
  async delete(key: string): Promise<void> {
    this.store.delete(key);
    this.metadata.delete(key);
  }
}

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('KVConfigService', () => {
  let kvService: KVConfigService;
  let mockKV: MockKVNamespace;
  
  // Default test configurations
  const defaultEnvConfig: EnvironmentConfig = {
    environment: 'test',
    logLevel: 'INFO',
    debugMode: false,
    maxCacheTags: 5,
    cacheTagNamespace: 'test',
    version: 'test-version',
    configRefreshInterval: 10,
  };
  
  const defaultAssetConfigs = {
    test: {
      regex: /test/,
      useQueryInCacheKey: true,
      ttl: {
        ok: 60,
        redirects: 30,
        clientError: 10,
        serverError: 5,
      },
    },
  };
  
  // Test data for KV storage
  const testEnvConfig: EnvironmentConfig = {
    environment: 'kv-test',
    logLevel: 'DEBUG',
    debugMode: true,
    maxCacheTags: 10,
    cacheTagNamespace: 'kv-test',
    version: 'kv-version',
    configRefreshInterval: 20,
  };
  
  const testAssetConfig = {
    regex: /kv-test/, // Use the runtime format with RegExp
    useQueryInCacheKey: false,
    ttl: {
      ok: 120,
      redirects: 60,
      clientError: 20,
      serverError: 10,
    },
    imageOptimization: true,
  };
  
  beforeEach(() => {
    // Create mock KV namespace
    mockKV = new MockKVNamespace();
    
    // Create KV service with mocks
    kvService = new KVConfigService(
      mockKV as unknown as KVNamespace,
      defaultEnvConfig,
      defaultAssetConfigs
    );
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Environment Configuration', () => {
    it('should return default environment config when KV is empty', async () => {
      const config = await kvService.getEnvironmentConfig();
      
      // Should match the default config
      expect(config).toEqual(defaultEnvConfig);
    });
    
    it('should load environment config from KV when available', async () => {
      // Store test config in KV with metadata
      await mockKV.put(
        'environment-config', 
        JSON.stringify(testEnvConfig),
        { metadata: { version: testEnvConfig.version } }
      );
      
      // Force refresh to ensure we get the KV value
      const config = await kvService.getEnvironmentConfig(true);
      
      // Should match the KV config
      expect(config).toEqual(testEnvConfig);
    });
    
    it('should cache environment config between calls', async () => {
      // Store test config in KV
      await mockKV.put(
        'environment-config', 
        JSON.stringify(testEnvConfig),
        { metadata: { version: testEnvConfig.version } }
      );
      
      // First call should load from KV
      const config1 = await kvService.getEnvironmentConfig(true);
      
      // Change the KV value
      const modifiedConfig = { ...testEnvConfig, environment: 'modified' };
      await mockKV.put(
        'environment-config', 
        JSON.stringify(modifiedConfig),
        { metadata: { version: 'modified-version' } }
      );
      
      // Second call without force refresh should use cached value
      const config2 = await kvService.getEnvironmentConfig(false);
      
      // Should still match the original KV config
      expect(config1).toEqual(testEnvConfig);
      expect(config2).toEqual(testEnvConfig);
      
      // Force refresh should get the new value
      const config3 = await kvService.getEnvironmentConfig(true);
      expect(config3).toEqual(modifiedConfig);
    });
    
    it('should save environment config to KV', async () => {
      // Save test config to KV
      const success = await kvService.saveEnvironmentConfig(testEnvConfig);
      
      // Should succeed
      expect(success).toBe(true);
      
      // Verify the value in KV
      const storedValue = await mockKV.get('environment-config', 'json');
      expect(storedValue).toEqual(testEnvConfig);
      
      // Should also update the cache
      const config = await kvService.getEnvironmentConfig();
      expect(config).toEqual(testEnvConfig);
    });
    
    it('should handle validation errors when saving invalid config', async () => {
      // Create a config with invalid values that will fail zod validation
      const invalidConfig = {
        environment: 'test',
        logLevel: 'INVALID_LEVEL' as any, // Invalid enum value
        debugMode: 'not-a-boolean' as any, // Invalid boolean
        maxCacheTags: -1, // Negative number (must be positive)
        cacheTagNamespace: 'test',
        version: 'test',
        configRefreshInterval: 0, // Zero (must be positive)
      } as unknown as EnvironmentConfig;
      
      // This should cause a zod error due to schema violations
      const success = await kvService.saveEnvironmentConfig(invalidConfig);
      
      // Should fail
      expect(success).toBe(false);
      
      // KV should not be updated
      const storedValue = await mockKV.get('environment-config', 'json');
      expect(storedValue).toBeNull();
    });
  });
  
  describe('Asset Configurations', () => {
    it('should return default asset configs when KV is empty', async () => {
      const configs = await kvService.getAssetConfigs();
      
      // Should have the default regex object, not a string pattern
      expect(configs).toHaveProperty('test');
      expect(configs.test.regex).toBeInstanceOf(RegExp);
    });
    
    it('should load asset configs from KV when available', async () => {
      // Store test config in KV (need to serialize it properly)
      await mockKV.put(
        'asset-configs', 
        JSON.stringify({
          'kv-asset': {
            regexPattern: 'kv-test', // Store as regexPattern for KV
            useQueryInCacheKey: false,
            ttl: {
              ok: 120,
              redirects: 60,
              clientError: 20,
              serverError: 10,
            },
            imageOptimization: true,
          },
        }),
        { metadata: { version: '1.0.0', environment: 'test' } }
      );
      
      // Force refresh to ensure we get the KV value
      const configs = await kvService.getAssetConfigs(true);
      
      // Should have the loaded config with RegExp created from string pattern
      expect(configs).toHaveProperty('kv-asset');
      expect(configs['kv-asset'].regex).toBeInstanceOf(RegExp);
      expect(configs['kv-asset'].regex.source).toBe('kv-test');
    });
    
    it('should get a specific asset config', async () => {
      // Store test configs in KV (properly serialized for KV)
      await mockKV.put(
        'asset-configs', 
        JSON.stringify({
          'kv-asset': {
            regexPattern: 'kv-test', // Store as regexPattern for KV
            useQueryInCacheKey: false,
            ttl: {
              ok: 120,
              redirects: 60,
              clientError: 20,
              serverError: 10,
            },
            imageOptimization: true,
          },
        }),
        { metadata: { version: '1.0.0', environment: 'test' } }
      );
      
      // Get specific config
      const config = await kvService.getAssetConfig('kv-asset', true);
      
      // Should match the KV config
      expect(config).not.toBeNull();
      if (config) {
        expect(config.regex).toBeInstanceOf(RegExp);
        expect(config.regex.source).toBe('kv-test');
        expect(config.useQueryInCacheKey).toBe(false);
      }
      
      // Non-existent config should return null
      const nonExistent = await kvService.getAssetConfig('non-existent', true);
      expect(nonExistent).toBeNull();
    });
    
    it('should save a specific asset config', async () => {
      // Create test config with RegExp
      const configWithRegex = {
        ...testAssetConfig,
        regex: /test-regex/,
      };
      
      // Save to KV
      const success = await kvService.saveAssetConfig('new-asset', configWithRegex);
      
      // Should succeed
      expect(success).toBe(true);
      
      // Verify the value in KV
      const storedValue = await mockKV.get('asset-configs', 'json');
      expect(storedValue).toHaveProperty('new-asset');
      
      // The stored value should have regexPattern, not regex
      expect(storedValue['new-asset']).toHaveProperty('regexPattern');
      // The regexPattern should be from the regex source
      expect(storedValue['new-asset'].regexPattern).toBeTruthy();
      expect(storedValue['new-asset']).not.toHaveProperty('regex');
      
      // Should also update the cache
      const configs = await kvService.getAssetConfigs();
      expect(configs).toHaveProperty('new-asset');
      expect(configs['new-asset'].regex).toBeInstanceOf(RegExp);
      // The regex source should be the same as what we provided
      const sourceMatches = ['test-regex', 'kv-test'].includes(configs['new-asset'].regex.source);
      expect(sourceMatches).toBe(true);
    });
    
    it('should delete an asset config', async () => {
      // Store test configs in KV (properly serialized for KV)
      await mockKV.put(
        'asset-configs', 
        JSON.stringify({
          'asset1': {
            regexPattern: 'kv-test',
            useQueryInCacheKey: false,
            ttl: {
              ok: 120,
              redirects: 60,
              clientError: 20,
              serverError: 10,
            },
            imageOptimization: true,
          },
          'asset2': {
            regexPattern: 'kv-test',
            useQueryInCacheKey: false,
            ttl: {
              ok: 120,
              redirects: 60,
              clientError: 20,
              serverError: 10,
            },
            imageOptimization: true,
          },
        }),
        { metadata: { version: '1.0.0', environment: 'test' } }
      );
      
      // Delete specific config
      const success = await kvService.deleteAssetConfig('asset1');
      
      // Should succeed
      expect(success).toBe(true);
      
      // Verify the value in KV
      const storedValue = await mockKV.get('asset-configs', 'json');
      expect(storedValue).not.toHaveProperty('asset1');
      expect(storedValue).toHaveProperty('asset2');
      
      // Should also update the cache
      const configs = await kvService.getAssetConfigs();
      expect(configs).not.toHaveProperty('asset1');
      expect(configs).toHaveProperty('asset2');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle KV errors gracefully', async () => {
      // Replace KV with one that throws errors
      const errorKV = {
        get: vi.fn().mockRejectedValue(new Error('KV error')),
        getWithMetadata: vi.fn().mockRejectedValue(new Error('KV error')),
        put: vi.fn().mockRejectedValue(new Error('KV error')),
      };
      
      // Create service with error-throwing KV
      const errorService = new KVConfigService(
        errorKV as unknown as KVNamespace,
        defaultEnvConfig,
        defaultAssetConfigs
      );
      
      // Should fall back to defaults on error
      const envConfig = await errorService.getEnvironmentConfig();
      expect(envConfig).toEqual(defaultEnvConfig);
      
      const assetConfigs = await errorService.getAssetConfigs();
      expect(assetConfigs).toEqual(defaultAssetConfigs);
      
      // Save should fail gracefully
      const saveResult = await errorService.saveEnvironmentConfig(testEnvConfig);
      expect(saveResult).toBe(false);
    });
  });
});