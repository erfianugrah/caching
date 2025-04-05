import { CachingStrategy } from './caching-strategy';
import { VideoCachingStrategy } from './video-caching-strategy';
import { ImageCachingStrategy } from './image-caching-strategy';
import { FrontEndCachingStrategy } from './frontend-caching-strategy';
import { AudioCachingStrategy } from './audio-caching-strategy';
import { DirectPlayCachingStrategy } from './direct-play-caching-strategy';
import { ManifestCachingStrategy } from './manifest-caching-strategy';
import { ApiCachingStrategy } from './api-caching-strategy';
import { DefaultCachingStrategy } from './default-caching-strategy';
import { CacheError } from '../errors/cache-errors';
import { logger } from '../utils/logger';

/**
 * Factory class for creating and selecting caching strategies
 */
export class StrategyFactory {
  private static strategies: CachingStrategy[] = [];
  private static defaultStrategy: CachingStrategy | null = null;
  
  /**
   * Initialize the strategy factory with all available strategies
   */
  static initialize(): void {
    // Register all strategies
    this.strategies = [
      new VideoCachingStrategy(),
      new ImageCachingStrategy(),
      new FrontEndCachingStrategy(),
      new AudioCachingStrategy(),
      new DirectPlayCachingStrategy(),
      new ManifestCachingStrategy(),
      new ApiCachingStrategy(),
      // Additional strategies can be added here
    ];
    
    // Set default fallback strategy
    this.defaultStrategy = new DefaultCachingStrategy();
    
    logger.debug('Strategy factory initialized', { 
      strategies: this.strategies.length,
      defaultStrategy: this.defaultStrategy ? this.defaultStrategy.constructor.name : 'none'
    });
  }
  
  /**
   * Set the default fallback strategy
   * @param strategy The default strategy to use
   */
  static setDefaultStrategy(strategy: CachingStrategy): void {
    this.defaultStrategy = strategy;
  }
  
  /**
   * Get an appropriate strategy for the given content type
   * @param contentType Content-Type of the response
   * @returns The best matching strategy
   * @throws If no strategy is found and no default is set
   */
  static getStrategyForContentType(contentType: string): CachingStrategy {
    // Skip processing if content type is missing
    if (!contentType) {
      logger.debug('No content type provided, using default strategy');
      return this.getDefaultStrategy();
    }
    
    // Find the first strategy that can handle this content type
    const strategy = this.strategies.find(s => s.canHandle(contentType));
    
    if (strategy) {
      logger.debug('Found matching strategy for content type', { contentType });
      return strategy;
    }
    
    // Fall back to default strategy
    logger.debug('No matching strategy found for content type, using default', { contentType });
    return this.getDefaultStrategy();
  }
  
  /**
   * Get the default strategy
   * @returns The default strategy
   * @throws If no default strategy is set
   */
  private static getDefaultStrategy(): CachingStrategy {
    if (!this.defaultStrategy) {
      throw new CacheError('No default caching strategy configured');
    }
    return this.defaultStrategy;
  }
  
  /**
   * Register a new strategy
   * @param strategy Strategy to register
   */
  static registerStrategy(strategy: CachingStrategy): void {
    this.strategies.push(strategy);
  }
}