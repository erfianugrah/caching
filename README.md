# Cloudflare Caching Service

A modern, service-oriented TypeScript implementation for intelligent content-aware caching with Cloudflare Workers.

## Features

- Asset-specific caching rules based on file patterns
- Content-specific optimization strategies
- Cache tag support for efficient invalidation
- Comprehensive error handling and logging
- Telemetry and performance monitoring
- Real-time debug dashboard
- Strong TypeScript typing with ESM modules

## Architecture

This project follows a modern architecture with these patterns:

- **Service-Oriented Architecture**: Core functionality in specialized services
- **Dependency Injection**: Services provided through a factory pattern
- **Command Pattern**: Operations encapsulated as executable commands
- **Strategy Pattern**: Content-specific caching strategies
- **ES Modules**: Modern JavaScript module system

For detailed architecture overview, see [Architecture Documentation](./docs/internal/architecture.md).

## Getting Started

### Prerequisites

- Node.js 16+
- npm 8+

### Installation

```bash
npm install
```

### Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Run specific test
vitest -t "test name"

# Type check
npm run typecheck

# Lint
npm run lint
```

### Deployment

```bash
# Production
npm run deploy:prod

# Staging
npm run deploy:staging
```

## Configuration

Configuration is managed through two systems:

1. Environment variables in `wrangler.jsonc` for basic settings
2. Dynamic configuration via Cloudflare KV for asset-specific rules

### Environment Variables

The following environment variables are defined in `wrangler.jsonc`:

| Variable | Description | Default |
|----------|-------------|---------|
| `ENVIRONMENT` | Environment name (development, staging, production) | `development` |
| `LOG_LEVEL` | Logging level (DEBUG, INFO, WARN, ERROR) | `INFO` |
| `DEBUG_MODE` | Enable/disable debug mode | `false` |
| `MAX_CACHE_TAGS` | Maximum number of cache tags per request | `10` |
| `CACHE_TAG_NAMESPACE` | Namespace prefix for cache tags | `cf` |
| `CONFIG_KV_NAMESPACE` | KV namespace binding for configuration storage | `CACHE_CONFIGURATION_STORE` |
| `CONFIG_REFRESH_INTERVAL` | KV configuration refresh interval in seconds | `300` |
| `ADMIN_API_SECRET` | Authentication secret for admin API (set as a secret) | - |

### KV-based Configuration

The service uses Cloudflare KV for dynamic configuration storage, allowing:

- Updates without redeployment
- Environment-specific configurations
- Detailed asset-type rules with regex patterns
- Admin API for configuration management

#### Initializing KV Configuration

To initialize or update KV configuration from the `config-init.json` file:

```bash
# Initialize for default environment
npm run init-kv

# Initialize for specific environment
npm run init-kv:dev
npm run init-kv:staging
npm run init-kv:prod
```

#### Configuration Structure

The KV configuration consists of two main keys:

1. `environment-config`: Global environment settings
2. `asset-configs`: Asset-specific caching rules

### Asset Type Configuration

Caching rules are defined per asset type with the following properties:

- URL pattern matching with regex
- TTL values for different status codes (ok, redirects, clientError, serverError)
- Query parameter handling (include/exclude parameters, sorting, normalization)
- Cache variants based on client hints and headers
- Content optimization settings (minification, compression)
- Cache directives (immutable, stale-while-revalidate, etc.)

## Services

The caching service includes these core services:

- **Asset Type Service**: Detects content type from URL patterns
- **Cache Key Service**: Generates cache keys with query parameter handling
- **Cache Tag Service**: Creates hierarchical cache tags for each request
- **Cache Header Service**: Manages response headers for optimal caching
- **CF Options Service**: Generates Cloudflare-specific caching options

## Strategies

Content-specific caching strategies include:

- **Image Strategy**: Optimized for image content (compression, polish)
- **Video Strategy**: Optimized for video content (streaming, segments)
- **Frontend Strategy**: Optimized for CSS and JavaScript (minification)
- **Audio Strategy**: Optimized for audio content (streaming)
- **Direct Play Strategy**: Optimized for downloads (content disposition)
- **Manifest Strategy**: Optimized for HLS/DASH manifests (short TTL, CORS)
- **API Strategy**: Optimized for JSON/XML responses (headers, security)
- **Default Strategy**: General purpose fallback caching

See [Strategies Documentation](./docs/internal/strategies.md) for detailed information on each strategy.

## Project Structure

```
├── src/
│   ├── commands/          # Command pattern implementations
│   ├── errors/            # Custom error types
│   ├── services/          # Core service implementations
│   ├── strategies/        # Content-specific strategies
│   │   ├── api-caching-strategy.ts        # API responses strategy
│   │   ├── audio-caching-strategy.ts      # Audio files strategy
│   │   ├── caching-strategy.ts            # Base strategy abstract class
│   │   ├── default-caching-strategy.ts    # Default fallback strategy
│   │   ├── direct-play-caching-strategy.ts # Direct download strategy
│   │   ├── frontend-caching-strategy.ts   # CSS/JS strategy
│   │   ├── image-caching-strategy.ts      # Image strategy
│   │   ├── manifest-caching-strategy.ts   # HLS/DASH manifest strategy
│   │   ├── strategy-factory.ts            # Strategy creation/selection
│   │   └── video-caching-strategy.ts      # Video strategy
│   ├── tests/             # Test files
│   ├── types/             # TypeScript interfaces
│   ├── utils/             # Utility functions
│   └── cache.ts           # Main entry point
├── docs/                 # Documentation directory
│   ├── internal/         # Internal documentation for developers
│   └── public/           # Public documentation for users
├── CLAUDE.md              # Guidelines for Claude AI assistance
└── README.md              # This file
```

## Cache Tag Purging

This service supports Cloudflare's cache tag purging feature for granular cache invalidation:

### Common Tag Patterns

| Tag Pattern | Example | Use Case |
|-------------|---------|----------|
| `cf:host:{hostname}` | `cf:host:example.com` | Purge all content for a specific host |
| `cf:type:{asset_type}` | `cf:type:image` | Purge all assets of a specific type |
| `cf:ext:{extension}` | `cf:ext:jpg` | Purge all files with a specific extension |
| `cf:prefix:{path}` | `cf:prefix:/blog` | Purge all content under a path prefix |
| `cf:path:{full_path}` | `cf:path:/blog/post1.html` | Purge a specific path |

## License

ISC © Erfi Anugrah