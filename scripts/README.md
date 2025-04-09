# Caching Service Scripts

This directory contains utility scripts for managing the Caching Service.

## Configuration Manager

The `config-manager.ts` script provides a unified interface for managing configuration data in the Cloudflare Workers KV store. It supports uploading, downloading, and listing configuration data with schema validation.

### Setup

The script has its own TypeScript configuration:

```bash
# Install dependencies
npm install zod typescript ts-node

# Navigate to scripts directory
cd scripts

# Compile TypeScript (if needed)
npx tsc -p tsconfig.json
```

### Usage

```bash
# Basic usage
npm run config -- <command> [options]

# List all configuration keys in KV
npm run config:list

# Upload configuration
npm run config:upload                # Default environment
npm run config:upload:dev            # Development environment
npm run config:upload:staging        # Staging environment
npm run config:upload:prod           # Production environment

# Download configuration
npm run config:download              # Default environment
npm run config:download:dev          # Development environment
npm run config:download:staging      # Staging environment
npm run config:download:prod         # Production environment

# Manual execution with custom parameters
ts-node scripts/config-manager.ts upload --namespace-id <KV_NAMESPACE_ID> --config-file <PATH_TO_CONFIG> --env <ENVIRONMENT>
ts-node scripts/config-manager.ts download --namespace-id <KV_NAMESPACE_ID> --output-file <PATH_TO_OUTPUT>
ts-node scripts/config-manager.ts list --namespace-id <KV_NAMESPACE_ID>

# Dry run to see what commands would be executed without actually running them
ts-node scripts/config-manager.ts upload --dry-run
```

### Commands

- `upload`: Upload configuration from a file to KV store
- `download`: Download configuration from KV store to a file
- `list`: List keys in the KV store without downloading contents

### Options

- `--namespace-id`: KV namespace ID (defaults to the CACHE_CONFIGURATION_STORE ID in wrangler.jsonc)
- `--config-file`: Path to config file for upload (defaults to `../config.json`)
- `--output-file`: Path to output file for download (defaults to `../config-downloaded.json`)
- `--env`: Environment to use (defaults to `dev`)
- `--dry-run`: Print commands without executing them (upload only)
- `--skip-validation`: Skip schema validation before upload
- `--help`, `-h`: Show help message

### Schema Validation

The configuration manager includes Zod schema validation to ensure configuration data is valid before uploading to KV. This validation:

1. Checks that all required fields are present
2. Validates data types for all fields
3. Ensures configurations follow the expected structure
4. Provides detailed error messages when validation fails

You can skip validation with the `--skip-validation` flag if needed.

### Configuration File Format

The configuration manager works with JSON files having the following structure:

```json
{
  "environment-config": {
    // Environment configuration settings
    "environment": "production",
    "logLevel": "INFO",
    "debugMode": false,
    "maxCacheTags": 1000,
    "cacheTagNamespace": "cf",
    "version": "1.0.0",
    "configRefreshInterval": 600,
    // ... other environment settings
  },
  "asset-configs": {
    // Asset-specific caching configurations
    "video": {
      "regexPattern": "...",
      "useQueryInCacheKey": false,
      "ttl": {
        "ok": 31556952,
        "redirects": 30,
        "clientError": 10,
        "serverError": 0
      },
      // ... other video-specific settings
    },
    // ... configurations for other asset types
  }
}
```

Each top-level key becomes a separate entry in the KV store.

## KV Namespace Management

The caching service uses the `CACHE_CONFIGURATION_STORE` KV namespace for storing configuration data. You can manage this namespace using Wrangler:

```bash
# List KV namespaces
wrangler kv namespace list

# List keys in a namespace
wrangler kv key list --namespace-id <NAMESPACE_ID> --remote

# Get a specific key's value
wrangler kv key get --namespace-id <NAMESPACE_ID> --remote <KEY>

# Delete a key
wrangler kv key delete --namespace-id <NAMESPACE_ID> <KEY>
```

## Architecture Compliance

This configuration manager follows the project's architectural principles:

1. **Service-Oriented Architecture**: The script is focused on a single responsibility - configuration management
2. **TypeScript Type Safety**: Uses proper TypeScript interfaces for command-line arguments and data structures
3. **ES Modules**: Follows the ES module pattern used throughout the codebase
4. **Error Handling**: Provides robust error handling with appropriate error messages
5. **Configuration Management**: Facilitates the configuration layer described in the architecture document
6. **Schema Validation**: Uses Zod to enforce type safety and schema validation
7. **Environment-Specific Settings**: Supports different environments as per the architectural requirements