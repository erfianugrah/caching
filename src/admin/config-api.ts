/**
 * Admin API for configuration management
 * 
 * This module provides HTTP endpoints for reading and updating
 * caching service configurations via Cloudflare Workers.
 */

import { ConfigService } from '../services/config-service';
import { logger } from '../utils/logger';
import { assetConfigSchema, environmentConfigSchema, parseAssetConfig } from '../config/schemas';
import { z } from 'zod';

// Secret for admin API authentication
const ADMIN_API_SECRET = (globalThis as any).ADMIN_API_SECRET || 'development-secret';

/**
 * Check if a request is authenticated
 * @param request The incoming request
 * @returns Whether the request is authenticated
 */
function isAuthenticated(request: Request): boolean {
  // Check for auth header
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader) {
    return false;
  }
  
  // Parse bearer token
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  
  if (!match || !match[1]) {
    return false;
  }
  
  // Validate token
  return match[1] === ADMIN_API_SECRET;
}

/**
 * Create an error response
 * @param message Error message
 * @param status HTTP status code
 * @returns JSON error response
 */
function errorResponse(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Handle admin API requests
 * @param request The incoming request
 * @param configService The configuration service
 * @returns API response
 */
export async function handleConfigApiRequest(
  request: Request,
  configService: ConfigService
): Promise<Response> {
  // Check authentication
  if (!isAuthenticated(request)) {
    return errorResponse('Unauthorized', 401);
  }
  
  // Parse request URL
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/admin\/config\/?/, '');
  
  // Handle different API endpoints
  switch (path) {
    case 'environment':
      return await handleEnvironmentConfig(request, configService);
      
    case 'assets':
      return await handleAssetConfigs(request, configService);
      
    case 'assets/refresh':
      return await handleRefreshAssets(configService);
      
    default:
      // Check if it's a specific asset type
      if (path.startsWith('assets/')) {
        const assetType = path.replace('assets/', '');
        return await handleAssetConfig(request, configService, assetType);
      }
      
      // Return API documentation for root path
      if (path === '' || path === '/') {
        return new Response(
          JSON.stringify({
            endpoints: [
              { path: '/admin/config/environment', methods: ['GET', 'PUT'] },
              { path: '/admin/config/assets', methods: ['GET'] },
              { path: '/admin/config/assets/{assetType}', methods: ['GET', 'PUT', 'DELETE'] },
              { path: '/admin/config/assets/refresh', methods: ['POST'] },
            ],
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }
      
      return errorResponse('Endpoint not found', 404);
  }
}

/**
 * Handle environment configuration requests
 * @param request The incoming request
 * @param configService The configuration service
 * @returns API response
 */
async function handleEnvironmentConfig(
  request: Request,
  configService: ConfigService
): Promise<Response> {
  // Handle GET request
  if (request.method === 'GET') {
    const config = await configService.getConfig();
    
    return new Response(
      JSON.stringify(config),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
  
  // Handle PUT request
  if (request.method === 'PUT') {
    try {
      // Parse request body
      const body = await request.json();
      
      // Validate against schema
      const validatedConfig = environmentConfigSchema.parse(body);
      
      // Save configuration
      const success = await configService.saveConfig(validatedConfig);
      
      if (success) {
        return new Response(
          JSON.stringify({ message: 'Environment configuration updated' }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      } else {
        return errorResponse('Failed to save environment configuration');
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return errorResponse(`Validation error: ${JSON.stringify(error.errors)}`);
      }
      
      logger.error('Error updating environment config', {
        error: error instanceof Error ? error.message : String(error),
      });
      
      return errorResponse('Failed to update environment configuration');
    }
  }
  
  // Handle unsupported methods
  return errorResponse('Method not allowed', 405);
}

/**
 * Handle asset configurations requests
 * @param request The incoming request
 * @param configService The configuration service
 * @returns API response
 */
async function handleAssetConfigs(
  request: Request,
  configService: ConfigService
): Promise<Response> {
  // Only support GET method
  if (request.method !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }
  
  // Get all asset configurations
  const configs = await configService.getAssetConfigs();
  
  return new Response(
    JSON.stringify(configs),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Handle specific asset configuration requests
 * @param request The incoming request
 * @param configService The configuration service
 * @param assetType The asset type to handle
 * @returns API response
 */
async function handleAssetConfig(
  request: Request,
  configService: ConfigService,
  assetType: string
): Promise<Response> {
  // Handle GET request
  if (request.method === 'GET') {
    const config = await configService.getAssetConfig(assetType);
    
    if (!config) {
      return errorResponse(`Asset type '${assetType}' not found`, 404);
    }
    
    return new Response(
      JSON.stringify(config),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
  
  // Handle PUT request
  if (request.method === 'PUT') {
    try {
      // Parse request body
      const body = await request.json();
      
      // Validate against schema
      const validatedConfig = assetConfigSchema.parse(body);
      
      // Convert the validated schema config to a runtime config with RegExp
      const parsedConfig = parseAssetConfig(validatedConfig);
      
      // Save configuration
      const success = await configService.saveAssetConfig(assetType, parsedConfig);
      
      if (success) {
        return new Response(
          JSON.stringify({ message: `Asset configuration for '${assetType}' updated` }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      } else {
        return errorResponse(`Failed to save asset configuration for '${assetType}'`);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return errorResponse(`Validation error: ${JSON.stringify(error.errors)}`);
      }
      
      logger.error('Error updating asset config', {
        assetType,
        error: error instanceof Error ? error.message : String(error),
      });
      
      return errorResponse(`Failed to update asset configuration for '${assetType}'`);
    }
  }
  
  // Handle DELETE request
  if (request.method === 'DELETE') {
    // Check if asset type exists
    const config = await configService.getAssetConfig(assetType);
    
    if (!config) {
      return errorResponse(`Asset type '${assetType}' not found`, 404);
    }
    
    // Delete configuration
    const success = await configService.deleteAssetConfig(assetType);
    
    if (success) {
      return new Response(
        JSON.stringify({ message: `Asset configuration for '${assetType}' deleted` }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    } else {
      return errorResponse(`Failed to delete asset configuration for '${assetType}'`);
    }
  }
  
  // Handle unsupported methods
  return errorResponse('Method not allowed', 405);
}

/**
 * Handle asset configuration refresh
 * @param configService The configuration service
 * @returns API response
 */
async function handleRefreshAssets(
  configService: ConfigService
): Promise<Response> {
  // Refresh all asset configurations
  await configService.getAssetConfigs(true);
  
  return new Response(
    JSON.stringify({ message: 'Asset configurations refreshed' }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}