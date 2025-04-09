/**
 * Provider for Cloudflare KV namespace
 * This module handles the resolution and validation of KV namespaces
 * for use in configuration services.
 */

import { logger } from '../utils/logger';

// Global reference to KV namespace
let configKvNamespace: KVNamespace | null = null;

// Track worker instance information
// Using safe methods to avoid global scope restrictions (crypto.randomUUID not allowed in global scope)
const WORKER_INSTANCE_ID = `worker-${Date.now().toString(36)}`;
const WORKER_START_TIME = Date.now();
let initializationCount = 0;

/**
 * Initialize the KV namespace provider with a specific namespace
 * @param namespace The KV namespace to use for configuration storage
 * @returns true if initialized for the first time, false if already initialized
 */
export function initializeKvNamespace(namespace: KVNamespace): boolean {
  // Increment initialization attempt counter
  initializationCount++;
  
  const workerUptime = Date.now() - WORKER_START_TIME;
  // Safe to use randomUUID here as we're in a function context
  const initCallId = crypto.randomUUID().slice(0, 8);
  
  // Check if we already have a namespace initialized
  if (configKvNamespace) {
    logger.debug('KV namespace already initialized, using existing reference', {
      reusingExisting: true,
      namespaceType: typeof namespace,
      // Get object type info without using toString directly
      namespaceInfo: typeof namespace === 'object' ? '[KVNamespace object]' : String(namespace),
      workerInstanceId: WORKER_INSTANCE_ID,
      workerUptime,
      initializationCount,
      initCallId,
      initializationTime: new Date().toISOString(),
      isReinitialization: true
    });
    return false;
  }
  
  // Store the KV namespace reference
  configKvNamespace = namespace;
  
  logger.info('KV namespace provider initialized for the first time', {
    namespaceType: typeof namespace,
    // Get object type info without using toString directly
    namespaceInfo: typeof namespace === 'object' ? '[KVNamespace object]' : String(namespace),
    workerInstanceId: WORKER_INSTANCE_ID,
    workerUptime,
    initializationCount,
    initCallId,
    initializationTime: new Date().toISOString(),
    isFirstInitialization: true
  });
  
  return true;
}

/**
 * Get the KV namespace for configuration storage
 * @param namespaceName Optional namespace name to resolve
 * @returns The KV namespace, or null if not available
 */
export function getConfigKvNamespace(namespaceName?: string): KVNamespace | null {
  const workerUptime = Date.now() - WORKER_START_TIME;
  // Safe to use randomUUID here as we're in a function context
  const accessId = crypto.randomUUID().slice(0, 8);
  
  // If we already have a namespace initialized, use it
  if (configKvNamespace) {
    logger.debug('Using existing KV namespace reference from previous initialization', {
      fromCache: true,
      namespaceType: typeof configKvNamespace,
      namespaceInfo: typeof configKvNamespace === 'object' ? '[KVNamespace object]' : String(configKvNamespace),
      workerInstanceId: WORKER_INSTANCE_ID,
      workerUptime,
      initializationCount,
      accessId,
      accessTime: new Date().toISOString()
    });
    return configKvNamespace;
  }

  // Try to resolve the namespace by name
  if (namespaceName) {
    try {
      // In a Cloudflare Worker environment, namespaces are bound to the global scope
      const resolved = (globalThis as unknown as Record<string, KVNamespace>)[namespaceName];
      
      if (resolved) {
        configKvNamespace = resolved;
        initializationCount++;
        
        logger.info('Successfully resolved and cached KV namespace by name', { 
          name: namespaceName,
          namespaceType: typeof resolved,
          namespaceInfo: typeof resolved === 'object' ? '[KVNamespace object]' : String(resolved),
          dynamicallyResolved: true,
          workerInstanceId: WORKER_INSTANCE_ID,
          workerUptime,
          initializationCount,
          accessId,
          resolutionTime: new Date().toISOString()
        });
        return configKvNamespace;
      } else {
        logger.warn('KV namespace name provided but not found in globals', { 
          name: namespaceName,
          availableGlobalKeys: Object.keys((globalThis as any)).filter(key => 
            typeof (globalThis as any)[key] === 'object' && 
            (globalThis as any)[key] !== null
          ).join(', '),
          dynamicallyResolved: false,
          workerInstanceId: WORKER_INSTANCE_ID,
          workerUptime,
          accessId
        });
      }
    } catch (error) {
      logger.warn('Failed to resolve KV namespace due to error', {
        name: namespaceName,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        dynamicallyResolved: false,
        workerInstanceId: WORKER_INSTANCE_ID,
        workerUptime,
        accessId
      });
    }
  } else {
    logger.warn('No KV namespace name provided for resolution', {
      namespaceName: 'undefined',
      dynamicallyResolved: false,
      workerInstanceId: WORKER_INSTANCE_ID,
      workerUptime,
      accessId
    });
  }

  // No namespace available
  logger.warn('No KV namespace available for configuration, using fallback defaults', {
    workerInstanceId: WORKER_INSTANCE_ID,
    workerUptime,
    initializationCount,
    accessId
  });
  return null;
}