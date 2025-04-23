import { AssetConfig, AssetTypeConfig, CfCacheOptions } from '../types/cache-config';
import { EnvironmentConfig } from '../types/environment-config';

/**
 * Service for managing application configuration
 */
export interface ConfigService {
  /**
   * Get the current configuration
   */
  getConfig(): EnvironmentConfig;
}

/**
 * Service for detecting asset type from request
 */
export interface AssetTypeService {
  /**
   * Get configuration for a specific request
   */
  getConfigForRequest(request: Request): AssetTypeConfig;
}

/**
 * Service for generating cache keys
 */
export interface CacheKeyService {
  /**
   * Generate a cache key for the given request and config
   */
  getCacheKey(request: Request, config: AssetConfig): string;
}

/**
 * Service for managing cache headers
 */
export interface CacheHeaderService {
  /**
   * Generate Cache-Control header based on response status and config
   * Optionally uses the response Age header for dynamic TTL calculation
   */
  getCacheControlHeader(status: number, config: AssetConfig, response?: Response): string;
  
  /**
   * Apply cache headers to a response
   */
  applyCacheHeaders(response: Response, request: Request, config: AssetConfig): Response;
}

/**
 * Service for generating cache tags
 */
export interface CacheTagService {
  /**
   * Generate cache tags for the given request and asset type
   */
  generateTags(request: Request, assetType: string): string[];
  
  /**
   * Validate a cache tag to ensure it meets Cloudflare requirements
   */
  validateTag(tag: string): boolean;
  
  /**
   * Format a list of cache tags for inclusion in a header
   */
  formatTagsForHeader(tags: string[]): string;
}

/**
 * Service for generating CloudFlare cache options
 */
export interface CfOptionsService {
  /**
   * Generate CloudFlare-specific cache options
   */
  getCfOptions(request: Request, config: AssetConfig): CfCacheOptions;
}

/**
 * Service for request processing and preparation
 * 
 * The RequestProcessingService centralizes the handling of requests
 * through the caching system. It coordinates:
 * 
 * - Content type detection and mapping
 * - Strategy selection based on content
 * - Origin fetching with appropriate cache directives
 * - Response transformation with cache headers
 * - Operation tracking for telemetry
 * 
 * This service was added to improve separation of concerns and
 * remove complex processing logic from the command layer.
 */
export interface RequestProcessingService {
  /**
   * Analyze and prepare a request for caching
   * 
   * Performs initial request analysis to determine how it should
   * be cached. Creates a processing context with tracking information
   * and selects the appropriate caching strategy based on content type.
   * 
   * @param request The incoming client request
   * @returns Structured result with strategy, options, and context
   */
  prepareRequest(request: Request): Promise<RequestProcessingResult>;
  
  /**
   * Fetch from origin with appropriate caching options
   * 
   * Handles the actual network request to the origin, applying
   * Cloudflare-specific caching directives through the cf object.
   * Provides consistent error handling for network failures.
   * 
   * @param request The request to send to origin
   * @param cfOptions Cloudflare-specific caching options
   * @returns Origin response
   */
  fetchWithCaching(request: Request, cfOptions: CfCacheOptions): Promise<Response>;
  
  /**
   * Apply cache headers and other modifications to the response
   * 
   * Uses the selected strategy to apply content-specific caching
   * rules to the origin response. This may include setting Cache-Control,
   * adding cache tags, or applying other content-specific headers.
   * 
   * @param response The original response from origin
   * @param request The original client request
   * @param context Processing context with content type information
   * @returns Modified response with appropriate cache headers
   */
  processResponse(response: Response, request: Request, context: RequestProcessingContext): Promise<Response>;
}

/**
 * Result of request processing preparation
 * 
 * Contains all the necessary information derived from analyzing
 * a request, including content type, chosen strategy, caching options,
 * and tracking context.
 */
export interface RequestProcessingResult {
  /** The detected asset type configuration for this request */
  config: AssetTypeConfig;
  
  /** The specific content type derived from asset type and request */
  contentType: string;
  
  /** The name of the selected caching strategy */
  strategyName: string;
  
  /** Cloudflare-specific caching options to apply */
  cfOptions: CfCacheOptions;
  
  /** Request context for tracking and telemetry */
  context: RequestProcessingContext;
}

/**
 * Context for request processing
 * 
 * Provides tracking and telemetry information for a request
 * as it passes through the caching system. Used to correlate
 * logs and metrics across different processing stages.
 */
export interface RequestProcessingContext {
  /** Unique ID for tracking this operation across services */
  operationId: string;
  
  /** The asset type category (e.g., 'image', 'video', 'api') */
  assetType: string;
  
  /** The specific content type for strategy selection */
  contentType: string;
  
  /** The name of the caching strategy being used */
  strategyName: string;
  
  /** Performance timestamp for latency tracking */
  startTime: number;
}