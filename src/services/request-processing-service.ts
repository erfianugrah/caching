import { randomUUID } from 'node:crypto';
import { 
  RequestProcessingService, 
  RequestProcessingResult, 
  RequestProcessingContext 
} from './interfaces';
import { logger } from '../utils/logger';
import { ServiceFactory } from './service-factory';
import { CfCacheOptions } from '../types/cache-config';
import { StrategyFactory } from '../strategies/strategy-factory';
import { FetchError } from '../errors/cache-errors';
import type { RequestInitCfProperties } from '@cloudflare/workers-types';

/**
 * Implementation of the RequestProcessingService
 * 
 * This service is responsible for handling the core request processing flow:
 * - Analyzing incoming requests to determine content types
 * - Selecting appropriate caching strategies based on content
 * - Generating Cloudflare-specific caching options
 * - Fetching from origin with proper caching directives
 * - Applying content-specific caching rules to responses
 * 
 * It centralizes request processing logic that was previously scattered,
 * providing a more maintainable and extensible architecture.
 * 
 * Key responsibilities:
 * - Content type detection and mapping
 * - Strategy selection and coordination
 * - Context tracking for telemetry and debugging
 * - Error handling during fetch operations
 */
export class DefaultRequestProcessingService implements RequestProcessingService {
  /**
   * Analyze and prepare a request for caching
   * 
   * This method performs the initial analysis of an incoming request:
   * 1. Generates a unique operation ID for tracing
   * 2. Determines the asset type using AssetTypeService
   * 3. Maps the asset type to a specific content type
   * 4. Selects an appropriate caching strategy
   * 5. Creates a processing context for tracking
   * 6. Generates Cloudflare-specific caching options
   * 
   * The result contains all necessary context and configuration
   * for the subsequent processing steps.
   * 
   * @param request The incoming client request to analyze
   * @returns A processing result with strategy, options, and context
   */
  async prepareRequest(request: Request): Promise<RequestProcessingResult> {
    // Create a unique operation ID for tracking this request
    const operationId = randomUUID();
    const startTime = performance.now();
    
    // Get asset type configuration
    const assetTypeService = ServiceFactory.getAssetTypeService();
    const config = assetTypeService.getConfigForRequest(request);
    const assetType = config.assetType;
    
    logger.debug('Asset type detected', { type: assetType });
    
    // Map asset type to content type for strategy selection
    const contentType = this.getContentTypeFromRequest(request, assetType);
    
    // Select appropriate caching strategy based on content type
    const strategy = StrategyFactory.getStrategyForContentType(contentType);
    const strategyName = strategy.constructor.name;
    
    logger.debug('Selected caching strategy', { 
      contentType, 
      strategy: strategyName
    });
    
    // Create context for tracking this operation
    const context: RequestProcessingContext = {
      operationId,
      assetType,
      contentType,
      strategyName,
      startTime
    };
    
    // Get Cloudflare-specific options using the selected strategy
    const cfOptions = strategy.getCacheOptions(request, config);
    
    logger.debug('Generated cache options with strategy', { 
      strategy: strategyName,
      cfOptions 
    });
    
    // Use Promise.resolve to satisfy TypeScript's await requirement
    return await Promise.resolve({
      config,
      contentType,
      strategyName,
      cfOptions,
      context
    });
  }
  
  /**
   * Fetch from origin with appropriate caching options
   * 
   * This method handles the actual network request to the origin server,
   * applying Cloudflare-specific caching directives through the cf object.
   * It also provides consistent error handling for network failures.
   * 
   * The cf property controls how Cloudflare interacts with the request:
   * - Cache key generation
   * - Image optimization settings (polish, mirage)
   * - Minification options
   * - TTL values for different status code ranges
   * - Cache tag association for purging
   * 
   * @param request The request to send to the origin
   * @param cfOptions Cloudflare-specific caching options to apply
   * @returns The response from the origin server
   * @throws FetchError if the network request fails
   */
  async fetchWithCaching(request: Request, cfOptions: CfCacheOptions): Promise<Response> {
    try {
      // Use Cloudflare worker fetch with caching options
      return await fetch(request, { 
        cf: cfOptions as unknown as RequestInitCfProperties
      });
    } catch (fetchError) {
      const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      logger.error('Error fetching from origin', {
        url: request.url,
        error: errorMsg
      });
      
      throw new FetchError('Failed to fetch from origin', {
        url: request.url,
        error: errorMsg
      });
    }
  }
  
  /**
   * Apply cache headers and other modifications to the response
   * 
   * This method applies content-specific cache headers and transformations
   * to the origin response using the selected caching strategy. It:
   * 
   * 1. Retrieves the appropriate strategy based on content type
   * 2. Gets the asset configuration for this request
   * 3. Delegates to the strategy to apply content-specific caching
   * 
   * The strategy may modify the response by:
   * - Setting proper Cache-Control headers
   * - Adding content-specific headers (e.g., Accept-Ranges for video)
   * - Adding Cache-Tag headers for later purging
   * - Applying compression or optimization directives
   * 
   * @param response The original response from origin
   * @param request The original client request
   * @param context The processing context with content type and tracking info
   * @returns A modified response with appropriate cache headers
   */
  async processResponse(
    response: Response, 
    request: Request, 
    context: RequestProcessingContext
  ): Promise<Response> {
    const { contentType } = context;
    
    // Get the strategy to use for processing this response
    const strategy = StrategyFactory.getStrategyForContentType(contentType);
    
    // Get the configuration for this asset type
    const assetTypeService = ServiceFactory.getAssetTypeService();
    const config = assetTypeService.getConfigForRequest(request);
    
    // Apply caching using the selected strategy
    return await Promise.resolve(strategy.applyCaching(response, request, config));
  }
  
  /**
   * Map asset type to content type for strategy selection
   * 
   * This method determines the appropriate content type based on:
   * 1. The asset type from configuration
   * 2. File extension from the URL
   * 3. Accept header preferences (content negotiation)
   * 
   * It supports a wide range of media types including:
   * - Images (jpeg, png, webp, svg, etc.)
   * - Videos (mp4, webm, etc.)
   * - Audio (mp3, wav, ogg, etc.)
   * - Frontend assets (js, css, html)
   * - Streaming manifests (HLS, DASH)
   * - API responses
   * 
   * Content negotiation via Accept headers allows the service
   * to respect client format preferences when the asset type
   * permits multiple formats.
   * 
   * @param request The original request with URL and headers
   * @param assetType The asset type from configuration
   * @returns A specific content type string for strategy selection
   */
  private getContentTypeFromRequest(request: Request, assetType: string): string {
    // Map asset types to content types for strategy selection
    const url = new URL(request.url);
    const ext = url.pathname.split('.').pop()?.toLowerCase();
    
    // Check Accept header for client preference
    const acceptHeader = request.headers.get('Accept') || '';
    
    switch (assetType) {
      case 'video':
        // Check for HLS/DASH manifests first
        if (ext === 'm3u8') {
          return 'application/vnd.apple.mpegurl';
        } else if (ext === 'mpd') {
          return 'application/dash+xml';
        }
        
        // Check Accept header for video preferences
        if (acceptHeader.includes('video/webm')) {
          return 'video/webm';
        } else if (acceptHeader.includes('video/mp4')) {
          return 'video/mp4';
        } else {
          return 'video/mp4'; // Default video type
        }
        
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
        } else if (ext === 'avif') {
          return 'image/avif';
        } else {
          // Check Accept header for image format preferences
          if (acceptHeader.includes('image/webp')) {
            return 'image/webp';
          } else if (acceptHeader.includes('image/avif')) {
            return 'image/avif';
          } else {
            return 'image/jpeg'; // Default image type
          }
        }
        
      case 'frontEnd':
        // Handle frontend assets (CSS, JS)
        if (ext === 'js' || ext === 'mjs') {
          return 'application/javascript';
        } else if (ext === 'css') {
          return 'text/css';
        } else if (ext === 'html' || ext === 'htm') {
          return 'text/html';
        } else if (ext === 'json') {
          return 'application/json';
        } else if (ext === 'woff2') {
          return 'font/woff2';
        } else if (ext === 'woff') {
          return 'font/woff';
        } else if (ext === 'ttf') {
          return 'font/ttf';
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
}