# KV-Based Configuration Management

This document describes the Cloudflare KV-based configuration system for the caching service.

## Overview

The caching service uses a two-tier configuration approach:

1. **Environment Variables**: Basic configuration supplied through Cloudflare environment variables 
2. **KV Storage**: Dynamic, environment-specific configuration stored in Cloudflare KV

The KV configuration system provides:
- Dynamic configuration updates without redeployment
- Environment-specific configurations (dev, staging, production)
- Cached access to reduce KV reads
- Validation with Zod schemas
- Default fallbacks if KV is unavailable or invalid
- Configuration source tracking and visibility
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

## Configuration Management Tools

### Configuration Manager CLI

The project includes a unified CLI tool for managing KV configuration:

```bash
# From project root
npm run config:list            # List current KV configuration
npm run config:upload          # Upload configuration from config.json
npm run config:download        # Download configuration to config-downloaded.json
```

The tool supports environment-specific operations:

```bash
npm run config:upload:dev      # Upload for dev environment
npm run config:upload:staging  # Upload for staging environment
npm run config:upload:prod     # Upload for production environment
```

#### Advanced Usage

The configuration manager supports additional flags for advanced use cases:

```bash
# Dry run to see what would be uploaded without making changes
npm run config -- upload --dry-run

# Specify a custom configuration file
npm run config -- upload --config-file ./custom-config.json

# Download to a custom file
npm run config -- download --output-file ./my-config.json

# Skip schema validation during upload
npm run config -- upload --skip-validation
```

### Source Code

The configuration manager is implemented in TypeScript:

- **Main script**: `scripts/config-manager.ts`
- **Type definitions**: `scripts/config-manager.d.ts`
- **TypeScript config**: `scripts/tsconfig.json`
- **Documentation**: `scripts/README.md`

### Prerequisites

- You must be logged in with Wrangler before running the script:
  ```bash
  npx wrangler login
  ```

### Process

The configuration manager performs these steps:
1. Reads the configuration file (default: `config.json`)
2. Validates against Zod schemas
3. Creates metadata with timestamp and environment information
4. Uses wrangler's KV commands to upload configurations
5. Handles proper formatting and escaping of JSON data

### Schema Validation

The configuration manager validates all configuration against Zod schemas before uploading to KV. This ensures:

1. All required fields are present
2. Data types are correct
3. Values fall within expected ranges
4. Configuration structure matches the codebase's expectations

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

## Runtime Configuration Detection

The caching service has built-in mechanisms to detect and report the source of configuration:

### 1. Enhanced Logging

Logs clearly indicate the source of configuration:

- ✅ `KV_CONFIG`: Configuration loaded from KV
- ⚠️ `DEFAULT_CONFIG`: Using default configuration (KV failed or not found)

Example log:
```
[INFO] ✅ Successfully loaded environment config from KV: { environment: "production", source: "KV_CONFIG" }
```

### 2. Debug API

The service includes a debug endpoint to check configuration source:

```
/__debug?config=true
```

Response:
```json
{
  "timestamp": "2025-04-09T16:55:23.456Z",
  "environment": {
    "source": "KV_CONFIG",
    "lastUpdated": "2025-04-09T16:45:56.884Z",
    "environment": "production"
  },
  "assetConfigs": {
    "source": "KV_CONFIG",
    "lastUpdated": "2025-04-09T16:45:56.884Z",
    "count": 9
  }
}
```

### 3. Debug UI

The debug UI at `/__debug` includes a "Check Config Status" button that displays the current configuration source and status:

- Environment Config Source (`KV_CONFIG` or `DEFAULT_CONFIG`)
- Asset Configs Source (`KV_CONFIG` or `DEFAULT_CONFIG`)
- Current Environment Name
- Number of Asset Types

## Configuration Metadata

All configurations stored in KV include metadata:

```json
{
  "configVersion": "1.0.0",
  "description": "Asset-specific caching configurations",
  "lastUpdated": "2025-04-09T16:45:56.884Z",
  "updatedBy": "config-manager",
  "environment": "prod"
}
```

This metadata is useful for:
- Tracking who made changes
- When changes were made
- Which environment the configuration is for
- Version tracking for schema evolution

## Best Practices

When working with KV configuration:

1. **Always use the config manager tool**: Ensures validation and proper metadata
2. **Check configuration source in logs**: Verify the service is using KV config
3. **Use environment-specific uploads**: Upload to the correct environment
4. **Version control your configuration**: Track changes to configuration in git
5. **Test configurations**: Use --dry-run to validate before applying changes

## Future Enhancements

Possible improvements to the configuration system:

1. **Versioning**: Track configuration versions with automatic rollback
2. **UI Dashboard**: Web interface for configuration management
3. **Validation Improvements**: More comprehensive schema validation
4. **Bulk Operations**: Batch updates for multiple asset types
5. **Audit Logging**: Track configuration changes
6. **Configuration Presets**: Predefined configuration templates
7. **Diff View**: Compare configuration changes between versions