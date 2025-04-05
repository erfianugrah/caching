import { CommandFactory } from './commands/command-factory';
import { logger } from './utils/logger';
import { initializeTelemetry } from './telemetry';
import { ServiceFactory } from './services/service-factory';

// Initialize services on startup
CommandFactory.initialize();
initializeTelemetry();

logger.info('Caching service starting up with telemetry enabled');

/**
 * Main worker handler for the caching service
 */
export default {
  /**
   * Handle fetch requests using the command pattern
   * @param request The request to handle
   * @returns The cached response
   */
  async fetch(request: Request): Promise<Response> {
    // Check if this is a debug request
    const url = new URL(request.url);
    if (url.pathname === '/__debug') {
      const debugService = ServiceFactory.getDebugService();
      return debugService.handleDebugRequest(request);
    }
    
    // Normal request processing
    return CommandFactory.executeCache(request);
  },
};