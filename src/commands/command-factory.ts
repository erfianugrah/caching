import { Command } from './command';
import { CacheRequestCommand } from './cache-request-command';
import { StrategyFactory } from '../strategies/strategy-factory';
import { DefaultCachingStrategy } from '../strategies/default-caching-strategy';

/**
 * Factory for creating and executing commands
 */
export class CommandFactory {
  private static initialized = false;
  
  /**
   * Initialize the factory
   * This must be called once at startup
   */
  static initialize(): void {
    if (this.initialized) {
      return;
    }
    
    // ServiceFactory is now eagerly initialized, no need to call initialization
    
    // Initialize strategies
    StrategyFactory.initialize();
    StrategyFactory.setDefaultStrategy(new DefaultCachingStrategy());
    
    this.initialized = true;
  }
  
  /**
   * Create a command to handle caching a request
   * @param request The request to process
   * @returns CacheRequestCommand instance
   */
  static createCacheRequestCommand(request: Request): Command<Response> {
    // Ensure initialization
    if (!this.initialized) {
      this.initialize();
    }
    
    return new CacheRequestCommand(request);
  }
  
  /**
   * Execute a command to handle caching a request
   * @param request The request to process
   * @returns Promise with the response
   */
  static async executeCache(request: Request): Promise<Response> {
    // Ensure initialization
    if (!this.initialized) {
      this.initialize();
    }
    
    const command = this.createCacheRequestCommand(request);
    return command.execute();
  }
}