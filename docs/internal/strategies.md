# Caching Strategies

This document provides details on the caching strategies implemented in the caching service.

## Strategy Architecture

The caching service follows the Strategy pattern, allowing different caching behaviors to be applied based on the type of content being served.

```mermaid
classDiagram
    class CachingStrategy {
        <<interface>>
        +canHandle(contentType: string) boolean
        +applyCaching(response: Response, request: Request, config: AssetConfig) Response
        +getCacheOptions(request: Request, config: AssetConfig) CfCacheOptions
    }
    
    class BaseCachingStrategy {
        <<abstract>>
        +canHandle(contentType: string)* boolean
        +applyCaching(response: Response, request: Request, config: AssetConfig)* Response
        +getCacheOptions(request: Request, config: AssetConfig)* CfCacheOptions
        #generateCacheTtlByStatus(config: AssetConfig) Record~string, number~
    }
    
    CachingStrategy <|.. BaseCachingStrategy
    BaseCachingStrategy <|-- VideoCachingStrategy
    BaseCachingStrategy <|-- ImageCachingStrategy
    BaseCachingStrategy <|-- FrontendCachingStrategy
    BaseCachingStrategy <|-- AudioCachingStrategy
    BaseCachingStrategy <|-- DirectPlayCachingStrategy
    BaseCachingStrategy <|-- ManifestCachingStrategy
    BaseCachingStrategy <|-- ApiCachingStrategy
    BaseCachingStrategy <|-- DefaultCachingStrategy
```

Each strategy implements:

1. **Content type detection** - Determining if the strategy can handle a given content type
2. **Cache header application** - Adding appropriate Cache-Control, Vary, and other headers
3. **Cache tag generation** - Adding cache tags for efficient purging
4. **Cloudflare option generation** - Setting Cloudflare-specific caching options

## Strategy Selection Process

```mermaid
flowchart TD
    Client[Client Request] --> Worker[Worker Handler]
    Worker --> Command[Cache Request Command]
    Command --> AssetType[Determine Asset Type]
    AssetType --> ContentType[Map to Content Type]
    ContentType --> Factory[Strategy Factory]
    Factory --> Strategies[Strategy Selection]
    
    Strategies --> Video[Video Strategy]
    Strategies --> Image[Image Strategy]
    Strategies --> Frontend[Frontend Strategy]
    Strategies --> Audio[Audio Strategy]
    Strategies --> DirectPlay[Direct Play Strategy]
    Strategies --> Manifest[Manifest Strategy]
    Strategies --> API[API Strategy]
    Strategies --> Default[Default Strategy]
```

The strategy selection process:

1. The `CacheRequestCommand` determines the asset type from URL patterns
2. It maps the asset type to a specific content type
3. The `StrategyFactory` selects the appropriate strategy for that content type
4. If no strategy matches, the default strategy is used

## Available Strategies

### 1. Video Caching Strategy

Handles video content such as MP4, WebM, and other video formats.

```mermaid
flowchart LR
    subgraph Video Strategy
        contentCheck["Content Type Check
        video/mp4, video/webm, etc"]
        
        cacheOpts["Cache Options
        • Long TTL (1 year)
        • Polish: off
        • Mirage: off
        • Cache Everything: true"]
        
        headers["Cache Headers
        • Cache-Control: max-age=31536000
        • Vary: Accept-Encoding
        • Cache-Tag: cf:host, cf:type:video"]
    end
    
    Request --> contentCheck
    contentCheck -- "is video" --> cacheOpts
    cacheOpts --> headers
    headers --> Response
```

**Features:**
- Long-term caching (1 year)
- No query parameter caching (except for segments)
- Optimized for streaming content
- Video-specific cache tags

**Implementation:**

```typescript
export class VideoCachingStrategy extends BaseCachingStrategy {
  private supportedTypes = [
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'
  ];

  canHandle(contentType: string): boolean {
    return this.supportedTypes.some(type => 
      contentType === type || contentType.startsWith(`${type};`)
    );
  }

  applyCaching(response: Response, request: Request, config: AssetConfig): Response {
    // Implementation...
  }

  getCacheOptions(request: Request, config: AssetConfig): CfCacheOptions {
    // Implementation...
  }
}
```

### 2. Image Caching Strategy

Handles image content such as JPEG, PNG, WebP, and other image formats.

```mermaid
flowchart LR
    subgraph Image Strategy
        contentCheck["Content Type Check
        image/jpeg, image/png, etc"]
        
        cacheOpts["Cache Options
        • Medium TTL (1 hour)
        • Polish: lossy
        • Mirage: true
        • Cache Everything: true"]
        
        headers["Cache Headers
        • Cache-Control: max-age=3600
        • Vary: Accept, Accept-Encoding
        • Cache-Tag: cf:host, cf:type:image"]
    end
    
    Request --> contentCheck
    contentCheck -- "is image" --> cacheOpts
    cacheOpts --> headers
    headers --> Response
```

**Features:**
- Medium-term caching (1 hour)
- Query parameter handling for dimensions and format
- Image optimization options (Polish, Mirage)
- Client-hint respecting for responsive images
- Image-specific cache tags

### 3. Frontend Caching Strategy

Handles CSS and JavaScript files.

```mermaid
flowchart LR
    subgraph Frontend Strategy
        contentCheck["Content Type Check
        text/css, application/javascript"]
        
        cacheOpts["Cache Options
        • Medium TTL (1 hour)
        • Minify: CSS/JS
        • Cache Everything: true"]
        
        headers["Cache Headers
        • Cache-Control: max-age=3600
        • Vary: Accept-Encoding
        • Cache-Tag: cf:host, cf:type:frontEnd"]
    end
    
    Request --> contentCheck
    contentCheck -- "is CSS/JS" --> cacheOpts
    cacheOpts --> headers
    headers --> Response
```

**Features:**
- Medium-term caching (1 hour)
- CSS and JS minification
- Version parameter handling
- Frontend-specific cache tags

### 4. Audio Caching Strategy

Handles audio files such as MP3, AAC, FLAC, and other audio formats.

```mermaid
flowchart LR
    subgraph Audio Strategy
        contentCheck["Content Type Check
        audio/mpeg, audio/aac, etc"]
        
        cacheOpts["Cache Options
        • Long TTL (1 year)
        • Cache Everything: true"]
        
        headers["Cache Headers
        • Cache-Control: max-age=31536000
        • Content-Disposition: inline
        • Cache-Tag: cf:host, cf:type:audio"]
    end
    
    Request --> contentCheck
    contentCheck -- "is audio" --> cacheOpts
    cacheOpts --> headers
    headers --> Response
```

**Features:**
- Long-term caching (1 year)
- Content-Disposition for playback
- No query parameter caching
- Audio-specific cache tags

### 5. Direct Play Caching Strategy

Handles direct download/streaming files.

```mermaid
flowchart LR
    subgraph DirectPlay Strategy
        contentCheck["URL Pattern Check
        /download/, /direct/"]
        
        cacheOpts["Cache Options
        • Long TTL (1 year)
        • Cache Everything: true"]
        
        headers["Cache Headers
        • Cache-Control: max-age=31536000
        • Content-Disposition: attachment
        • Cache-Tag: cf:host, cf:type:directPlay"]
    end
    
    Request --> contentCheck
    contentCheck -- "is download" --> cacheOpts
    cacheOpts --> headers
    headers --> Response
```

**Features:**
- Long-term caching (1 year)
- Attachment Content-Disposition for downloads
- No query parameter caching
- Download-specific cache tags

### 6. Manifest Caching Strategy

Handles HLS and DASH manifest files (m3u8, mpd).

```mermaid
flowchart LR
    subgraph Manifest Strategy
        contentCheck["Content Type Check
        application/vnd.apple.mpegurl
        application/dash+xml"]
        
        cacheOpts["Cache Options
        • Very short TTL (3 seconds)
        • Cache Everything: true"]
        
        headers["Cache Headers
        • Cache-Control: max-age=3
        • Access-Control-Allow-Origin: *
        • Cache-Tag: cf:host, cf:type:manifest"]
    end
    
    Request --> contentCheck
    contentCheck -- "is manifest" --> cacheOpts
    cacheOpts --> headers
    headers --> Response
```

**Features:**
- Very short-term caching (3 seconds)
- Content-type correction for manifests
- CORS headers for cross-domain playback
- Query parameter handling for format and quality
- Manifest-specific cache tags

### 7. API Caching Strategy

Handles API responses like JSON and XML.

```mermaid
flowchart LR
    subgraph API Strategy
        contentCheck["Content Type Check
        application/json, application/xml"]
        
        cacheOpts["Cache Options
        • Short TTL (1 minute)
        • Cache Everything: true"]
        
        headers["Cache Headers
        • Cache-Control: max-age=60
        • Vary: Accept, Accept-Encoding
        • Cache-Tag: cf:host, cf:type:api"]
    end
    
    Request --> contentCheck
    contentCheck -- "is API response" --> cacheOpts
    cacheOpts --> headers
    headers --> Response
```

**Features:**
- Short-term caching (1 minute)
- Security headers for API responses
- Query parameter handling with exclusion of sensitive parameters
- Content negotiation via Vary headers
- API-specific cache tags

### 8. Default Caching Strategy

Fallback strategy for unrecognized content types.

```mermaid
flowchart LR
    subgraph Default Strategy
        contentCheck["Content Type Check
        Any unmatched type"]
        
        cacheOpts["Cache Options
        • Conservative TTL (5 minutes)
        • Cache Everything: true"]
        
        headers["Cache Headers
        • Cache-Control: max-age=300
        • Cache-Tag: cf:host"]
    end
    
    Request --> contentCheck
    contentCheck -- "no specific strategy" --> cacheOpts
    cacheOpts --> headers
    headers --> Response
```

**Features:**
- Conservative caching (default to 5 minutes)
- Basic security headers
- Simple cache key generation

## Strategy Selection Algorithm

The strategy selection process is handled by the `StrategyFactory`:

```mermaid
flowchart TD
    Start(["Request with Content-Type"]) --> Init{Strategies initialized?}
    Init -- No --> RegisterStrats[Register all strategies]
    Init -- Yes --> Loop[Check each strategy]
    RegisterStrats --> Loop
    
    Loop --> Check{Strategy can handle content-type?}
    Check -- Yes --> Return["Return matching strategy"]
    Check -- No --> NextStrategy[Try next strategy]
    NextStrategy --> Check
    
    Check -- All checked, none match --> Default{Default strategy exists?}
    Default -- Yes --> ReturnDefault[Return default strategy]
    Default -- No --> Error[Throw Error]
    
    Return --> End(["Strategy for Request"])
    ReturnDefault --> End
```

## Implementation Details

Each strategy extends the `BaseCachingStrategy` abstract class and implements:

```typescript
canHandle(contentType: string): boolean
applyCaching(response: Response, request: Request, config: AssetConfig): Response
getCacheOptions(request: Request, config: AssetConfig): CfCacheOptions
```

The strategy selection process:

1. The `CacheRequestCommand` determines the asset type from the request
2. It maps the asset type to a content type
3. The `StrategyFactory` selects the appropriate strategy based on content type
4. The strategy applies caching behavior to the response

## Base Strategy

The `BaseCachingStrategy` abstract class provides common functionality for all strategies:

```typescript
export abstract class BaseCachingStrategy implements CachingStrategy {
  abstract canHandle(contentType: string): boolean;
  abstract applyCaching(response: Response, request: Request, config: AssetConfig): Response;
  abstract getCacheOptions(request: Request, config: AssetConfig): CfCacheOptions;
  
  protected generateCacheTtlByStatus(config: AssetConfig): Record<string, number> {
    return {
      '200-299': config.ttl.ok, // OK responses
      '301-302': config.ttl.redirects, // Redirects
      '400-499': config.ttl.clientError, // Client errors
      '500-599': config.ttl.serverError, // Server errors
    };
  }
}
```

## Strategy Factory

The `StrategyFactory` selects the appropriate strategy based on content type:

```typescript
export class StrategyFactory {
  private static strategies: CachingStrategy[] = [];
  private static defaultStrategy: CachingStrategy | null = null;
  
  static initialize(): void {
    if (this.strategies.length > 0) {
      return; // Already initialized
    }
    
    // Register strategies
    this.registerStrategy(new VideoCachingStrategy());
    this.registerStrategy(new ImageCachingStrategy());
    this.registerStrategy(new FrontendCachingStrategy());
    this.registerStrategy(new AudioCachingStrategy());
    this.registerStrategy(new ManifestCachingStrategy());
    this.registerStrategy(new ApiCachingStrategy());
  }
  
  static registerStrategy(strategy: CachingStrategy): void {
    this.strategies.push(strategy);
  }
  
  static setDefaultStrategy(strategy: CachingStrategy): void {
    this.defaultStrategy = strategy;
  }
  
  static getStrategyForContentType(contentType: string): CachingStrategy {
    // Initialize if not done yet
    if (this.strategies.length === 0) {
      this.initialize();
    }
    
    // Find a strategy that can handle this content type
    for (const strategy of this.strategies) {
      if (strategy.canHandle(contentType)) {
        return strategy;
      }
    }
    
    // If no strategy is found, use default
    if (this.defaultStrategy) {
      return this.defaultStrategy;
    }
    
    throw new Error(`No strategy found for content type: ${contentType}`);
  }
}
```

## Integration Points

The caching strategies integrate with the following services:

```mermaid
flowchart TD
    Strategy[Caching Strategy] --> AssetTypeService[Asset Type Service]
    Strategy --> CacheKeyService[Cache Key Service]
    Strategy --> CacheTagService[Cache Tag Service]
    Strategy --> CacheHeaderService[Cache Header Service]
    
    CacheTagService --> Tags[(Cache Tags)]
    CacheKeyService --> Keys[(Cache Keys)]
    CacheHeaderService --> Headers[(Response Headers)]
    AssetTypeService --> Config[(Asset Config)]
```

## Adding New Strategies

To add a new strategy:

1. Create a new class extending `BaseCachingStrategy`
2. Implement the required methods:
   - `canHandle(contentType: string): boolean`
   - `applyCaching(response: Response, request: Request, config: AssetConfig): Response`
   - `getCacheOptions(request: Request, config: AssetConfig): CfCacheOptions`
3. Register the strategy in `strategy-factory.ts`
4. Add the strategy export to `index.ts`
5. Update content type mapping in `cache-request-command.ts`

## Performance Considerations

Strategies are designed with performance in mind:

```mermaid
graph TD
    subgraph "Strategy Performance"
        A[Early Type Detection] --> B[Content-Type Based Dispatch]
        B --> C[Minimal Content Inspection]
        C --> D[Optimized Header Manipulation]
        D --> E[Efficient Cache Key Generation]
    end
```

## Future Improvements

Potential improvements to the strategy system:

```mermaid
gantt
    title Strategy Roadmap
    dateFormat  YYYY-MM-DD
    
    section Content Types
    Fonts Strategy      :a1, 2025-05-01, 15d
    HTML Strategy       :a2, after a1, 15d
    
    section Features
    Advanced Image Transformations    :b1, 2025-05-01, 30d
    A/B Testing Framework             :b2, after b1, 30d
    
    section Monitoring
    Enhanced Telemetry    :c1, 2025-06-01, 30d
    Performance Metrics   :c2, after c1, 15d
```

1. Fonts caching strategy
2. HTML caching strategy
3. Advanced image transformation options
4. A/B testing capabilities for caching strategies
5. Improved telemetry and monitoring
6. Support for more content types and file formats