# Caching Strategies

This directory contains the implementation of content-specific caching strategies following the Strategy pattern.

## Overview

Each strategy is specialized for handling specific content types and provides optimized caching behavior.

## Strategy Architecture

- `caching-strategy.ts` - Base abstract class and interfaces
- `strategy-factory.ts` - Factory for creating and selecting strategies
- Content-specific implementations for each asset type

## Available Strategies

| Strategy | File | Description |
|----------|------|-------------|
| Base Strategy | `caching-strategy.ts` | Abstract base class for all strategies |
| Default Strategy | `default-caching-strategy.ts` | Fallback for unrecognized content |
| Video Strategy | `video-caching-strategy.ts` | Video files (mp4, webm, etc.) |
| Image Strategy | `image-caching-strategy.ts` | Image files (jpg, png, etc.) |
| Frontend Strategy | `frontend-caching-strategy.ts` | CSS and JavaScript files |
| Audio Strategy | `audio-caching-strategy.ts` | Audio files (mp3, aac, etc.) |
| Direct Play Strategy | `direct-play-caching-strategy.ts` | Direct downloads/streams |
| Manifest Strategy | `manifest-caching-strategy.ts` | HLS/DASH manifest files |
| API Strategy | `api-caching-strategy.ts` | API responses (JSON, XML) |

## Implementation Pattern

Each strategy implements:

1. `canHandle(contentType: string): boolean` - Determines if the strategy can handle a specific content type
2. `applyCaching(response: Response, request: Request, config: AssetConfig): Response` - Applies headers and caching rules
3. `getCacheOptions(request: Request, config: AssetConfig): CfCacheOptions` - Generates Cloudflare-specific options

## Strategy Selection Process

Strategies are selected through the `StrategyFactory`:

```typescript
// 1. Get the content type from the request
const contentType = this.getContentTypeFromRequest(config.assetType);

// 2. Select the appropriate strategy
const strategy = StrategyFactory.getStrategyForContentType(contentType);

// 3. Apply the strategy
const response = strategy.applyCaching(originalResponse, request, config);
```

## Adding New Strategies

To add a new strategy:

1. Create a new class extending `BaseCachingStrategy`
2. Implement the required methods
3. Register the strategy in `strategy-factory.ts`
4. Add the strategy export to `index.ts`
5. Update content type mapping in `cache-request-command.ts`