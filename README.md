# Caching Service

A TypeScript-based Cloudflare Worker for intelligent content-aware caching.

## Features

- Asset-specific caching rules based on file patterns
- Optimized cache TTLs for different content types
- Automatic cache tag generation for granular cache purging
- Cloudflare-specific optimizations (image polish, CSS minification)
- Comprehensive error handling and logging
- TypeScript for type safety and better DX

## Architecture

The service uses a service-oriented architecture with the following components:

- **Asset Type Service**: Detects content type from URL patterns
- **Cache Key Service**: Generates cache keys with query parameter handling
- **Cache Tag Service**: Creates hierarchical cache tags for each request
- **Cache Header Service**: Manages response headers for optimal caching
- **CF Options Service**: Generates Cloudflare-specific caching options

## Development

### Prerequisites

- Node.js 16+
- Wrangler CLI for Cloudflare Workers

### Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start development server:
   ```bash
   npm run dev
   ```

### Configuration File

This project uses `wrangler.jsonc` instead of the traditional `wrangler.toml` for enhanced configuration capabilities:

- JSON with comments allows for better structured data
- Environment-specific configurations
- Build configuration with TypeScript support
- Environment variables for runtime configuration

To use a specific environment configuration:

```bash
# Development (default)
npm run dev

# Staging
npm run dev -- --env staging

# Production
npm run dev -- --env prod
```

### Testing

Run tests using Vitest:

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run a specific test
npm test -- -t "test name"
```

### Building and Deployment

```bash
# Build the project
npm run build

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:prod
```

## Configuration

### Asset Type Configuration

Caching rules are defined in the `asset-type-service.ts` file. Each asset type has its own configuration including:

- URL pattern matching with regex
- TTL values for different status codes
- Query parameter handling
- Image and CSS optimization settings

### Environment Variables

The following environment variables can be configured in the `wrangler.jsonc` file:

| Variable | Description | Default |
|----------|-------------|---------|
| `ENVIRONMENT` | Environment name (development, staging, production) | `development` |
| `LOG_LEVEL` | Logging level (DEBUG, INFO, WARN, ERROR) | `INFO` |
| `DEBUG_MODE` | Enable/disable debug mode | `false` |
| `MAX_CACHE_TAGS` | Maximum number of cache tags to generate per request | `10` |
| `CACHE_TAG_NAMESPACE` | Namespace prefix for cache tags | `cf` |

These can be set globally or per environment:

```jsonc
{
  "vars": {
    "LOG_LEVEL": "INFO" // Global setting
  },
  "env": {
    "prod": {
      "vars": {
        "LOG_LEVEL": "WARN" // Override for production
      }
    }
  }
}
```

## Cache Tag Purging

This service supports Cloudflare's cache tag purging feature, which allows for granular and efficient cache purging based on tags. Cache tags are automatically generated based on:

- Host names
- Asset types
- File extensions
- URL path hierarchies

### Tag Format and Limitations

The service follows Cloudflare's requirements for cache tags:
- Maximum 16KB total header length (approximately 1000 tags)
- Maximum 1024 characters per tag for purge API calls
- Only printable ASCII characters allowed
- No spaces within tags
- Case insensitive matching

### Purging by Tag

To purge content by tag:

1. Log in to your Cloudflare dashboard
2. Select Caching > Configuration
3. Under Purge Cache, select Custom Purge
4. Select "Tag" under Purge by
5. Enter the tags to purge, separated by commas (e.g., `cf:host:example.com,cf:type:image,cf:ext:jpg`)
6. Click Purge

Alternatively, you can use the Cloudflare API to purge by tag programmatically:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
     -H "Authorization: Bearer {api_token}" \
     -H "Content-Type: application/json" \
     --data '{"tags":["cf:host:example.com","cf:type:image"]}'
```

### Common Tag Patterns

Here are some common tag patterns that can be useful for cache purging:

| Tag Pattern | Example | Use Case |
|-------------|---------|----------|
| `cf:host:{hostname}` | `cf:host:example.com` | Purge all content for a specific host |
| `cf:type:{asset_type}` | `cf:type:image` | Purge all assets of a specific type |
| `cf:ext:{extension}` | `cf:ext:jpg` | Purge all files with a specific extension |
| `cf:prefix:{path}` | `cf:prefix:/blog` | Purge all content under a path prefix |
| `cf:path:{full_path}` | `cf:path:/blog/post1.html` | Purge a specific path |

For more targeted purging, you can combine multiple tags in a single purge request.