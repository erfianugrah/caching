# KV-Based Configuration System

This document describes the Cloudflare KV-based configuration system for the caching service.

## Overview

The KV configuration system provides:
- Dynamic configuration updates without redeployment
- Environment-specific configurations
- Cached access to reduce KV reads
- Validation with Zod schemas
- Default fallbacks if KV is unavailable or invalid
- Integrated admin API for remote management

## Components

### 1. KV Namespace Provider

The `KVNamespaceProvider` handles:
- Resolving the KV namespace binding
- Providing a global reference to the KV namespace
- Validating namespace availability

**Source:** `src/config/kv-namespace-provider.ts`

### 2. KV Config Service

The `KVConfigService` manages:
- Reading and writing configurations to/from KV
- Caching to reduce KV operations
- Validation using Zod schemas
- Serialization of complex objects (like RegExp)
- Fallback to default values

**Source:** `src/config/kv-config-service.ts`

### 3. Config Service

The enhanced `ConfigService` now:
- Integrates with KV storage
- Maintains backward compatibility
- Handles async operations
- Provides both static and dynamic configuration access

**Source:** `src/services/config-service.ts`

### 4. Admin API

The `ConfigAdminAPI` enables:
- RESTful management of configurations
- Secure authentication
- Environment configuration updates
- Asset-specific configuration management

**Source:** `src/admin/config-api.ts`

### 5. Configuration Schema

The Zod schemas define:
- Type-safe configuration structures
- Validation rules
- Default values
- Serialization/deserialization helpers for complex types

**Source:** `src/config/schemas.ts`

## KV Configuration Structure

The KV store contains two main keys:

### `environment-config`

Global environment settings:

```typescript
{
  environment: string;         // "development", "staging", "production"
  logLevel: string;            // "DEBUG", "INFO", "WARN", "ERROR"
  debugMode: boolean;          // Enable/disable debug mode
  maxCacheTags: number;        // Maximum number of cache tags per request
  cacheTagNamespace: string;   // Namespace prefix for cache tags
  version: string;             // Configuration version
  configRefreshInterval: number; // Refresh interval in seconds
}
```

### `asset-configs`

Asset-specific caching rules:

```typescript
{
  [assetType: string]: {
    regexPattern: string;      // Regex pattern to match URLs
    useQueryInCacheKey: boolean; // Include query parameters in cache key
    queryParams?: {           // Query parameter handling
      include: boolean;       // Include all query params by default
      includeParams?: string[]; // Only include specific params
      excludeParams?: string[]; // Exclude specific params
      sortParams?: boolean;   // Sort parameters for consistency
      normalizeValues?: boolean; // Normalize parameter values
    };
    variants?: {              // Cache variants
      useAcceptHeader?: boolean; // Vary on Accept header
      clientHints?: string[]; // Vary on client hints
      useUserAgent?: boolean; // Vary on User-Agent
      headers?: string[];     // Additional headers to vary on
      cookies?: string[];     // Cookies to vary on
    };
    ttl: {                    // Time-to-live values
      ok: number;             // 200-299 responses
      redirects: number;      // 300-399 responses
      clientError: number;    // 400-499 responses
      serverError: number;    // 500-599 responses
    };
    // Optional asset-specific settings
    minifyCss?: boolean;      // Minify CSS content
    imageOptimization?: boolean; // Enable image optimization
    cacheDirectives?: {       // Additional cache directives
      immutable?: boolean;    // Mark as immutable
      staleWhileRevalidate?: number; // Allow stale content while revalidating
      staleIfError?: number;  // Allow stale content on error
    };
  }
}
```

## Initializing KV Configuration

The `init-kv-config.js` script uploads the configuration from `config-init.json` to Cloudflare KV:

```bash
# Initialize for default environment
npm run init-kv

# Initialize for specific environment
npm run init-kv:dev
npm run init-kv:staging
npm run init-kv:prod
```

### Prerequisites

- You must be logged in with Wrangler before running the script:
  ```bash
  npx wrangler login
  ```

### Process

The script performs these steps:
1. Reads the config-init.json file
2. Creates metadata with timestamp and version information
3. Uses wrangler's KV commands to upload configurations
4. Handles proper formatting and escaping of JSON data

### How It Works

The script uses the official Wrangler CLI to interact with Cloudflare KV:

```javascript
// Command to put environment config in KV
const envConfigCmd = `npx wrangler kv key put --binding=${KV_BINDING} ${KV_KEY_ENV_CONFIG} '${envConfigContent}' --metadata='${envMetadataStr}' --remote`;
```

## Admin API Endpoints

The configuration admin API provides these endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/config/environment` | GET | Get environment configuration |
| `/admin/config/environment` | PUT | Update environment configuration |
| `/admin/config/assets` | GET | List all asset configurations |
| `/admin/config/assets/{assetType}` | GET | Get specific asset configuration |
| `/admin/config/assets/{assetType}` | PUT | Update specific asset configuration |
| `/admin/config/assets/{assetType}` | DELETE | Delete specific asset configuration |
| `/admin/config/assets/refresh` | POST | Force refresh of cached configurations |

### Authentication

Admin API requests require an `Authorization` header with Bearer token:

```
Authorization: Bearer YOUR_ADMIN_API_SECRET
```

The secret is defined as `ADMIN_API_SECRET` in wrangler.jsonc or as a secret.

## Code Examples

### Reading Configuration

```typescript
// Get configuration service
const configService = serviceFactory.getConfigService();

// Get environment configuration
const envConfig = await configService.getConfig();

// Get asset configuration for a specific type
const videoConfig = await configService.getAssetConfig('video');

// Force refresh from KV (ignore cache)
const freshConfig = await configService.getConfig(true);
```

### Updating Configuration

```typescript
// Update environment config
const newEnvConfig = {
  ...existingConfig,
  logLevel: 'DEBUG',
  debugMode: true
};
await configService.saveConfig(newEnvConfig);

// Update asset config
const newVideoConfig = {
  ...existingVideoConfig,
  ttl: {
    ok: 86400,
    redirects: 60,
    clientError: 30,
    serverError: 0
  }
};
await configService.saveAssetConfig('video', newVideoConfig);
```

## Future Enhancements

Possible improvements to the configuration system:

1. **Versioning**: Track configuration versions with automatic rollback
2. **UI Dashboard**: Web interface for configuration management
3. **Validation Improvements**: More comprehensive schema validation
4. **Bulk Operations**: Batch updates for multiple asset types
5. **Audit Logging**: Track configuration changes
6. **Configuration Presets**: Predefined configuration templates