import { BaseCommand } from './command';
import { ServiceFactory } from '../services/service-factory';
import { logger } from '../utils/logger';
import { 
  CacheError, 
  ServiceError,
  createErrorResponse 
} from '../errors/cache-errors';
import { 
  telemetry, 
  cacheAnalytics 
} from '../telemetry';

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
    // Create a command execution timestamp for timing
    const commandStartTime = performance.now();
    
    try {
      // Validate input
      this.validate();
      
      // Get the request processing service
      const requestProcessor = ServiceFactory.getRequestProcessingService();
        
      // Prepare the request for caching, getting content type, strategy, etc.
      const processingResult = await requestProcessor.prepareRequest(this.request);
      const { contentType, strategyName, cfOptions, context } = processingResult;
      const { operationId, assetType, startTime } = context;
      
      // Start telemetry tracking
      telemetry.startOperation(
        operationId,
        strategyName,
        contentType,
        assetType
      );
      
      // Fetch with cache configuration
      const originalResponse = await requestProcessor.fetchWithCaching(this.request, cfOptions);
      
      // Create more detailed response logging
      const cacheStatus = originalResponse.headers.get('CF-Cache-Status');
      // Use commandStartTime to calculate duration (startTime might be from a previous execution)
      const timeTaken = performance.now() - commandStartTime;
      const cacheHit = cacheStatus === 'HIT';
      
      // Extract request ID for correlation
      const requestId = this.request.headers.get('x-request-id') || 'command-unknown';
      
      logger.logResponse(originalResponse, this.request, {
        requestId,
        assetType,
        strategyName,
        contentType,
        duration: timeTaken,
        commandTime: true,
        cacheStatus,
        cached: cacheHit,
        cfOptions: JSON.stringify(cfOptions)
      });
      
      try {
        // Process the response using the appropriate strategy
        const response = await requestProcessor.processResponse(
          originalResponse,
          this.request,
          context
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
      // Handle all errors consistently
      return this.handleError(error);
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