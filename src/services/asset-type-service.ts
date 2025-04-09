import { AssetConfigMap, AssetTypeConfig } from '../types/cache-config';
import { AssetTypeService } from './interfaces';
import { logger } from '../utils/logger';
import { ConfigService } from './config-service';

/**
 * Default configurations for common asset types
 */
export const defaultAssetConfigs: AssetConfigMap = {
  video: {
    regex:
      /(.*\/Video)|(.*\.(m4s|mp4|ts|avi|mpeg|mpg|mkv|bin|webm|vob|flv|m2ts|mts|3gp|m4v|wmv|qt))$/,
    useQueryInCacheKey: false,
    // Enhanced query parameter handling for videos
    queryParams: {
      include: false,
    },
    ttl: {
      ok: 31556952, // 1 year
      redirects: 30,
      clientError: 10,
      serverError: 0,
    },
  },
  image: {
    regex:
      /(.*\/Images)|(.*\.(jpg|jpeg|png|bmp|pict|tif|tiff|webp|gif|heif|exif|bat|bpg|ppm|pgn|pbm|pnm))$/,
    useQueryInCacheKey: true,
    // Enhanced query parameter handling for images
    queryParams: {
      include: true,
      // Include dimension and format params, exclude timestamps and user-specific params
      includeParams: ['width', 'height', 'format', 'quality', 'fit'],
      excludeParams: ['t', 'timestamp', 'user', 'session'],
      sortParams: true,
      normalizeValues: true,
    },
    // Variants for responsive images
    variants: {
      useAcceptHeader: true, // Different formats based on Accept header
      clientHints: ['DPR', 'Width'], // Responsive images based on device pixel ratio and width
      useUserAgent: true, // Different sizes for mobile vs desktop
    },
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
    // Enhanced query parameter handling for frontend assets
    queryParams: {
      include: true,
      // Include version params, exclude tracking params
      includeParams: ['v', 'version', 'build'],
      excludeParams: ['_', 'cb', 't'],
      sortParams: true,
    },
    minifyCss: true,
    ttl: {
      ok: 3600, // 1 hour
      redirects: 30,
      clientError: 10,
      serverError: 0,
    },
  },
  audio: {
    regex:
      /(.*\/Audio)|(.*\.(flac|aac|mp3|alac|aiff|wav|ogg|aiff|opus|ape|wma|3gp))$/,
    useQueryInCacheKey: false,
    // Enhanced query parameter handling for audio
    queryParams: {
      include: false,
    },
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
    // Enhanced query parameter handling for direct play
    queryParams: {
      include: false,
    },
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
    // Enhanced query parameter handling for manifests
    queryParams: {
      include: true,
      // Only include quality and format params
      includeParams: ['quality', 'format'],
      sortParams: true,
    },
    ttl: {
      ok: 3, // 3 seconds
      redirects: 2,
      clientError: 1,
      serverError: 0,
    },
  },
  api: {
    regex: /^.*\/api\/.*/,
    useQueryInCacheKey: true,
    // Enhanced query parameter handling for API requests
    queryParams: {
      include: true,
      // Exclude common non-cacheable parameters
      excludeParams: ['token', 'auth', 'key', 'signature', 'timestamp', 't'],
      sortParams: true,
      normalizeValues: true,
    },
    // API endpoint variants
    variants: {
      useAcceptHeader: true, // Different responses for JSON vs XML
      headers: ['Accept-Language'], // Language-specific responses
      cookies: ['preferredLanguage'], // User language preference
    },
    ttl: {
      ok: 60, // 1 minute
      redirects: 30,
      clientError: 10,
      serverError: 0,
    },
  },
};

/**
 * Implementation of AssetTypeService for detecting asset types in requests
 * 
 * This service supports both local/default configurations and dynamic
 * configurations loaded from KV storage via the ConfigService.
 */
export class AssetTypeServiceImpl implements AssetTypeService {
  private assetConfigs: AssetConfigMap;
  private configService: ConfigService | null = null;
  private useKvConfigs = false;
  
  /**
   * Create a new AssetTypeService
   * @param customConfigs Optional custom asset configurations to override defaults
   * @param configService Optional configuration service for dynamic configs
   * @param useKvConfigs Whether to use KV configs (if false, uses only local configs)
   */
  constructor(
    customConfigs?: AssetConfigMap,
    configService?: ConfigService,
    useKvConfigs = true
  ) {
    // Initialize with provided configs or defaults
    this.assetConfigs = customConfigs || defaultAssetConfigs;
    
    // Set up dynamic configuration if provided
    this.configService = configService || null;
    this.useKvConfigs = useKvConfigs && !!this.configService;
    
    logger.debug('AssetTypeService initialized', { 
      configCount: Object.keys(this.assetConfigs).length,
      useKvConfigs: this.useKvConfigs
    });
  }
  
  /**
   * Get the configuration for a request
   * This method is kept synchronous for backward compatibility.
   * It uses the local configs by default, ignoring KV configs.
   * 
   * @param request The request to get configuration for
   * @returns The matched asset configuration with type information
   */
  public getConfigForRequest(request: Request): AssetTypeConfig {
    return this.getConfigForRequestSync(request);
  }
  
  /**
   * Get the configuration for a request asynchronously
   * This method will try to load configurations from KV if enabled
   * 
   * @param request The request to get configuration for
   * @returns Promise resolving to the matched asset configuration with type information
   */
  public async getConfigForRequestAsync(request: Request): Promise<AssetTypeConfig> {
    let configs = this.assetConfigs;
    
    // Try to load configs from KV if enabled
    if (this.useKvConfigs && this.configService) {
      try {
        configs = await this.configService.getAssetConfigs();
      } catch (error) {
        logger.warn('Failed to load asset configs from KV, using defaults', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    
    const url = new URL(request.url);
    
    // Find matching asset type based on regex
    for (const [assetType, config] of Object.entries(configs)) {
      if (config.regex.test(url.pathname)) {
        logger.debug('Asset type matched', { assetType, path: url.pathname });
        return {
          assetType,
          ...config,
        };
      }
    }
    
    // Default config for unmatched assets
    logger.debug('No asset type matched, using default', { path: url.pathname });
    return {
      assetType: 'default',
      useQueryInCacheKey: true,
      // Safe query parameter handling for unknown assets
      queryParams: {
        include: true,
        // Exclude common sensitive or dynamic parameters
        excludeParams: [
          'token', 'auth', 'key', 'signature', 'timestamp', 't',
          'user', 'session', 'login', 'password', 'secret'
        ],
        sortParams: true,
      },
      regex: /.*/,
      ttl: {
        ok: 0, // Don't cache by default
        redirects: 0,
        clientError: 0,
        serverError: 0,
      },
    };
  }
  
  /**
   * Synchronous version of getConfigForRequest that uses only the local configs
   * @param request The request to get configuration for
   * @returns The matched asset configuration with type information
   */
  private getConfigForRequestSync(request: Request): AssetTypeConfig {
    const url = new URL(request.url);
    
    // Find matching asset type based on regex
    for (const [assetType, config] of Object.entries(this.assetConfigs)) {
      if (config.regex.test(url.pathname)) {
        logger.debug('Asset type matched (sync)', { assetType, path: url.pathname });
        return {
          assetType,
          ...config,
        };
      }
    }
    
    // Default config for unmatched assets
    logger.debug('No asset type matched, using default (sync)', { path: url.pathname });
    return {
      assetType: 'default',
      useQueryInCacheKey: true,
      // Safe query parameter handling for unknown assets
      queryParams: {
        include: true,
        // Exclude common sensitive or dynamic parameters
        excludeParams: [
          'token', 'auth', 'key', 'signature', 'timestamp', 't',
          'user', 'session', 'login', 'password', 'secret'
        ],
        sortParams: true,
      },
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

/**
 * For backwards compatibility during refactoring
 * @deprecated Use AssetTypeServiceImpl instead
 */
export class DefaultAssetTypeService extends AssetTypeServiceImpl {}