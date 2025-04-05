import { BaseCommand } from './command';
import { ServiceFactory } from '../services/service-factory';
import { logger } from '../utils/logger';
import { 
  CacheError, 
  FetchError, 
  ServiceError,
  createErrorResponse 
} from '../errors/cache-errors';
import { StrategyFactory } from '../strategies/strategy-factory';
import { randomUUID } from 'node:crypto';
import { 
  telemetry, 
  cacheAnalytics 
} from '../telemetry';
import { CfCacheOptions } from '../types/cache-config';
import type { RequestInitCfProperties } from '@cloudflare/workers-types';

/**
 * Command to handle caching a request and applying cache configuration
 */
export class CacheRequestCommand extends BaseCommand<Response> {
  private request: Request;
  
  /**
   * Create a new CacheRequestCommand
   * @param request The request to handle
   */
  constructor(request: Request) {
    super();
    this.request = request;
  }
  
  /**
   * Execute the cache request command
   * @returns The cached response
   */
  async execute(): Promise<Response> {
    // Create a unique operation ID for tracking this request
    const operationId = randomUUID();
    let assetType = 'unknown';
    let contentType = '';
    let strategyName = 'unknown';
    const startTime = performance.now();
    
    try {
      // Validate input
      this.validate();
      
      // Get configuration for this request
      let config;
      try {
        const assetTypeService = ServiceFactory.getAssetTypeService();
        config = assetTypeService.getConfigForRequest(this.request);
        assetType = config.assetType;
        logger.debug('Asset type detected', { type: assetType });
      } catch (error) {
        throw new ServiceError('Failed to get asset type configuration', {
          url: this.request.url,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Select appropriate caching strategy based on asset type
      contentType = this.getContentTypeFromRequest(assetType);
      const strategy = StrategyFactory.getStrategyForContentType(contentType);
      strategyName = strategy.constructor.name;
      
      // Start telemetry tracking
      telemetry.startOperation(
        operationId,
        strategyName,
        contentType,
        assetType
      );
      
      logger.debug('Selected caching strategy', { 
        contentType, 
        strategy: strategyName
      });
      
      // Get Cloudflare-specific options using the selected strategy
      let cfOptions;
      try {
        cfOptions = strategy.getCacheOptions(this.request, config);
        logger.debug('Generated cache options with strategy', { 
          strategy: strategyName,
          cfOptions 
        });
      } catch (error) {
        throw new ServiceError('Failed to generate cache options', {
          url: this.request.url,
          assetType,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Fetch with cache configuration
      const originalResponse = await this.fetchWithCaching(cfOptions);
      logger.info('Fetched response', { 
        status: originalResponse.status, 
        url: this.request.url 
      });
      
      // Check cache status
      const cacheStatus = originalResponse.headers.get('CF-Cache-Status');
      const cacheHit = cacheStatus === 'HIT';
      
      // Apply cache headers using the selected strategy
      try {
        const response = strategy.applyCaching(
          originalResponse,
          this.request,
          config
        );
        
        // Track cache operation
        cacheAnalytics.trackFromResponse(
          response, 
          assetType, 
          performance.now() - startTime
        );
        
        // End telemetry tracking
        telemetry.endOperation(
          operationId,
          strategyName,
          contentType,
          assetType,
          response.status,
          cacheHit,
          false
        );
        
        return response;
      } catch (error) {
        throw new ServiceError('Failed to apply cache headers', {
          url: this.request.url,
          status: originalResponse.status,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } catch (error) {
      // End telemetry tracking with error
      telemetry.endOperation(
        operationId,
        strategyName,
        contentType,
        assetType,
        500, // Assume error status
        false, // Not cache hit
        true   // Error occurred
      );
      
      return this.handleError(error);
    }
  }
  
  /**
   * Map asset type to content type for strategy selection
   * @param assetType The asset type from configuration
   * @returns A content type string for strategy selection
   */
  private getContentTypeFromRequest(assetType: string): string {
    // Map asset types to content types for strategy selection
    const url = new URL(this.request.url);
    const ext = url.pathname.split('.').pop()?.toLowerCase();
    
    switch (assetType) {
      case 'video':
        return 'video/mp4';
        
      case 'image':
        // Handle different image types
        if (ext === 'jpg' || ext === 'jpeg') {
          return 'image/jpeg';
        } else if (ext === 'png') {
          return 'image/png';
        } else if (ext === 'webp') {
          return 'image/webp';
        } else if (ext === 'gif') {
          return 'image/gif';
        } else if (ext === 'svg') {
          return 'image/svg+xml';
        } else {
          return 'image/jpeg'; // Default image type
        }
        
      case 'frontEnd':
        // Handle frontend assets (CSS, JS)
        if (ext === 'js') {
          return 'application/javascript';
        } else if (ext === 'css') {
          return 'text/css';
        } else {
          return 'text/css'; // Default
        }
        
      case 'audio':
        // Handle audio files
        if (ext === 'mp3') {
          return 'audio/mpeg';
        } else if (ext === 'wav') {
          return 'audio/wav';
        } else if (ext === 'ogg') {
          return 'audio/ogg';
        } else if (ext === 'flac') {
          return 'audio/flac';
        } else if (ext === 'aac') {
          return 'audio/aac';
        } else {
          return 'audio/mpeg'; // Default audio type
        }
        
      case 'manifest':
        // Handle media manifests
        if (ext === 'm3u8') {
          return 'application/vnd.apple.mpegurl';
        } else if (ext === 'mpd') {
          return 'application/dash+xml';
        } else {
          return 'application/vnd.apple.mpegurl'; // Default manifest type
        }
        
      case 'directPlay':
        // Direct play is handled by URL pattern, not content type
        // Return a common media type that will be handled by the appropriate strategy
        if (url.pathname.toLowerCase().includes('/download')) {
          return 'application/octet-stream';
        } else {
          return 'video/mp4'; // Default to video for direct play
        }
        
      case 'api':
        // Handle API endpoints
        // Check if this appears to be a JSON API
        if (url.pathname.toLowerCase().includes('/api/')) {
          return 'application/json';
        } else {
          return 'application/json'; // Default API type
        }
        
      default:
        logger.debug('No specific content type for asset type, using empty string', { assetType });
        return '';
    }
  }
  
  /**
   * Validate the request
   * @returns true if validation passes, otherwise throws
   */
  protected validate(): boolean {
    if (!this.request || !(this.request instanceof Request)) {
      throw new CacheError('Invalid request object', {
        requestType: typeof this.request
      });
    }
    return true;
  }
  
  /**
   * Fetch with Cloudflare caching options
   * @param cfOptions Cloudflare cache options
   * @returns The response from the origin
   */
  private async fetchWithCaching(cfOptions: CfCacheOptions): Promise<Response> {
    try {
      // Use Cloudflare worker fetch with caching options
      return await fetch(this.request, { 
        cf: cfOptions as unknown as RequestInitCfProperties
      });
    } catch (fetchError) {
      const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      logger.error('Error fetching from origin', {
        url: this.request.url,
        error: errorMsg
      });
      
      throw new FetchError('Failed to fetch from origin', {
        url: this.request.url,
        error: errorMsg
      });
    }
  }
  
  /**
   * Handle errors during command execution
   * @param error The error that occurred
   * @returns An error response
   */
  private handleError(error: unknown): Response {
    // Log error and create an appropriate error response
    if (error instanceof CacheError) {
      logger.error(`${error.name}: ${error.message}`, { 
        url: this.request.url,
        ...error.metadata
      });
    } else {
      logger.error('Unexpected error processing request', { 
        url: this.request.url, 
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    return createErrorResponse(error, this.request);
  }
}