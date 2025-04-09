import { CommandFactory } from './commands/command-factory';
import { logger } from './utils/logger';
import { initializeTelemetry } from './telemetry';
import { ServiceFactory } from './services/service-factory';
import { initializeKvNamespace } from './config/kv-namespace-provider';
import { handleConfigApiRequest } from './admin/config-api';
import { ConfigService } from './services/config-service';

/**
 * Caching Service for Cloudflare Workers
 * 
 * This module provides an intelligent caching layer that optimizes content delivery 
 * through Cloudflare's edge network. It implements a service-oriented architecture
 * with content-specific caching strategies for different asset types.
 * 
 * Key features:
 * - Content-aware caching strategies (video, image, audio, API, etc.)
 * - Granular TTL control based on asset type and response status
 * - Cache tag support for targeted cache purging
 * - Debug tools and telemetry for monitoring and diagnostics
 * - Command pattern for request processing with robust error handling
 * - Dynamic configuration via Cloudflare KV with Zod validation
 * - Admin API for configuration management
 */

// Initialize all services on startup to avoid cold-start latency
CommandFactory.initialize();
initializeTelemetry();

logger.info('Caching service starting up with telemetry enabled');

/**
 * Main worker handler for the caching service
 * 
 * This is the primary entry point for the Cloudflare Worker.
 * It routes requests to:
 * - Debug service for diagnostic requests
 * - Admin API for configuration management
 * - Command processor for normal caching requests
 */
export default {
  /**
   * Handle fetch events from the Cloudflare Worker runtime
   * 
   * The workflow is:
   * 1. Initialize KV namespace if available
   * 2. Route the request based on path:
   *    - Debug requests to the debug service
   *    - Admin API requests to the admin handler
   *    - Normal requests to the command processor
   * 
   * @param request The incoming request from the client
   * @param env Cloudflare Worker environment with bindings
   * @returns A response, either from cache or origin, with appropriate headers
   */
  async fetch(
    request: Request, 
    env: { [key: string]: any } = {}
  ): Promise<Response> {
    // Create a performance timer for the entire request
    const perfTimer = logger.performance('request-handler');
    perfTimer.start();
    
    // Create a request-specific logger with request context
    const requestLogger = logger.logRequest(request, { 
      worker: 'caching',
      entrypoint: 'main'
    });
    
    try {
      // Initialize KV namespace if available through bindings
      // Get the KV binding name from environment or use the default
      const kvBindingName = (env.CONFIG_KV_NAMESPACE || 'CACHE_CONFIGURATION_STORE') as string;
      
      // Record request receipt time
      const requestReceiveTime = new Date().toISOString();
      
      // Log KV namespace status
      requestLogger.debug('Checking for KV namespace', {
        kvBindingName,
        hasBinding: !!env[kvBindingName],
        envKeys: Object.keys(env).filter(key => !key.includes('secret') && !key.includes('key')).join(', '),
        requestId: request.headers.get('x-request-id') || 'none',
        requestReceiveTime,
        requestUrl: request.url,
      });
      
      if (env[kvBindingName]) {
        // Log before attempting to initialize
        requestLogger.debug('About to initialize KV namespace', {
          kvBindingName,
          kvBindingType: typeof env[kvBindingName],
          kvBindingInfo: env[kvBindingName] ? env[kvBindingName].toString() : 'null',
          requestId: request.headers.get('x-request-id') || 'none',
          workerInstanceLifecycleEvent: 'pre-kv-init',
        });
        
        // Try to initialize the KV namespace and time the operation
        const kvInitStart = performance.now();
        const isFirstInit = initializeKvNamespace(env[kvBindingName]);
        const kvInitDuration = performance.now() - kvInitStart;
        
        // Log the initialization result with detailed timing
        if (isFirstInit) {
          requestLogger.info('KV namespace initialized for the first time in this worker instance', {
            kvBindingName,
            initializationDuration: kvInitDuration,
            requestReceiveTime,
            requestId: request.headers.get('x-request-id') || 'none',
            workerInstanceLifecycleEvent: 'first-kv-init',
          });
        } else {
          requestLogger.debug('KV namespace already initialized, reusing existing reference', {
            kvBindingName,
            initializationDuration: kvInitDuration,
            requestReceiveTime,
            requestId: request.headers.get('x-request-id') || 'none',
            workerInstanceLifecycleEvent: 'reuse-kv-init',
          });
        }
      } else {
        requestLogger.warn('KV namespace binding not found, using defaults', {
          kvBindingName,
          fallbackMode: true,
          requestReceiveTime,
          requestId: request.headers.get('x-request-id') || 'none',
          workerInstanceLifecycleEvent: 'no-kv-binding',
        });
      }
      
      // Parse request URL
      const url = new URL(request.url);
      
      // Handle debug requests
      if (url.pathname === '/__debug') {
        requestLogger.info('Debug request received');
        const debugService = ServiceFactory.getDebugService();
        const response = await debugService.handleDebugRequest(request);
        
        // Log response and return
        logger.logResponse(response, request, {
          duration: performance.now() - perfTimer.startTime,
          handler: 'debug',
        });
        
        return response;
      }
      
      // Handle admin API requests
      if (url.pathname.startsWith('/admin/config')) {
        requestLogger.info('Admin API request received', { path: url.pathname });
        const configService = new ConfigService();
        // handleConfigApiRequest already returns a Promise<Response>, no need for await
        const responsePromise = handleConfigApiRequest(request, configService);
        // Ensure we're dealing with a Promise<Response>
        const response = await responsePromise;
        
        // Log response and return
        logger.logResponse(response, request, {
          duration: performance.now() - perfTimer.startTime,
          handler: 'admin-api',
        });
        
        return response;
      }
      
      // Normal request processing through the command pattern
      // Safe to use crypto.randomUUID here as it's inside a function handler
      const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
      
      // Add request ID to the request object for correlation
      const requestWithId = new Request(request);
      requestWithId.headers.set('x-request-id', requestId);
      
      requestLogger.debug('Processing with cache command', { requestId });
      const response = await CommandFactory.executeCache(requestWithId);
      
      // Log response and return
      const cacheStatus = response.headers.get('CF-Cache-Status');
      // Use the request logger to ensure request ID is maintained
      requestLogger.logResponse(response, requestWithId, {
        duration: performance.now() - perfTimer.startTime,
        handler: 'cache-command',
        cacheStatus,
        cached: cacheStatus === 'HIT',
      });
      
      return response;
    } catch (error) {
      // Log any unhandled errors
      requestLogger.error('Unhandled error in main handler', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      // Create and log error response
      const errorResponse = new Response('Internal Server Error', { status: 500 });
      logger.logResponse(errorResponse, request, {
        duration: performance.now() - perfTimer.startTime,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
      
      return errorResponse;
    }
  },
};