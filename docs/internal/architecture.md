# Architecture Overview

This document provides a comprehensive overview of the Cloudflare Caching Service architecture.

## High-Level Architecture

The caching service follows a modern architecture with these patterns:

- **Service-Oriented Architecture**: Core functionality in specialized services
- **Dependency Injection**: Services provided through a factory pattern
- **Command Pattern**: Operations encapsulated as executable commands
- **Strategy Pattern**: Content-specific caching strategies
- **ES Modules**: Modern JavaScript module system

## System Overview

```mermaid
flowchart TD
    Client([Client]) --> Worker[Main Worker Handler]
    Worker --> Command[Command Layer]
    Command --> Services[Service Layer]
    Command --> Strategies[Strategy Layer]
    Services --> CF[(Cloudflare Cache)]
    Strategies --> CF
    Command --> Telemetry[Telemetry System]
    
    subgraph Services
        AssetTypeService[Asset Type Service]
        CacheKeyService[Cache Key Service]
        CacheTagService[Cache Tag Service] 
        CacheHeaderService[Cache Header Service]
        CfOptionsService[CF Options Service]
    end
    
    subgraph Strategies
        Video[Video Strategy]
        Image[Image Strategy]
        Frontend[Frontend Strategy]
        API[API Strategy]
        Default[Default Strategy]
    end
```

The core components of the system are:

1. **Main Worker Handler**: Entry point for all requests
2. **Command Layer**: Encapsulates operations as executable commands
3. **Service Layer**: Provides core functionality through specialized services
4. **Strategy Layer**: Implements content-specific caching behaviors
5. **Telemetry System**: Monitors and reports on system performance

## Request Flow

```mermaid
sequenceDiagram
    participant Client as Client
    participant Worker as Worker Handler
    participant Command as CacheRequestCommand
    participant AssetService as AssetTypeService
    participant StrategyFactory as StrategyFactory
    participant Strategy as CachingStrategy
    participant CF as Cloudflare Cache
    participant Telemetry as Telemetry System
    
    Client->>Worker: HTTP Request
    Worker->>Command: executeCache(request)
    Command->>AssetService: getConfigForRequest(request)
    AssetService-->>Command: AssetConfig
    Command->>StrategyFactory: getStrategyForContentType(contentType)
    StrategyFactory-->>Command: CachingStrategy
    Command->>Strategy: getCacheOptions(request, config)
    Strategy-->>Command: CfCacheOptions
    Command->>CF: fetch(request, cfOptions)
    CF-->>Command: Response
    Command->>Strategy: applyCaching(response, request, config)
    Strategy-->>Command: Response with cache headers
    Command->>Telemetry: trackOperation(...)
    Command-->>Worker: Return cached response
    Worker-->>Client: HTTP Response
```

1. Request enters the worker
2. Asset type is determined based on URL pattern
3. Appropriate caching strategy is selected based on content type
4. Strategy generates Cloudflare-specific cache options
5. Request is fetched with these options
6. Response is processed by the strategy to apply appropriate headers
7. Telemetry data is captured
8. Response is returned to the client

## Component Architecture

### Command Layer

The command layer follows the Command pattern and is responsible for coordinating the execution of operations:

```mermaid
classDiagram
    class BaseCommand {
        <<abstract>>
        +execute() Promise~T~
        #validate() boolean
    }
    
    class CacheRequestCommand {
        -request: Request
        +constructor(request: Request)
        +execute() Promise~Response~
        -fetchWithCaching(cfOptions) Promise~Response~
        -getContentTypeFromRequest(assetType) string
        #validate() boolean
        -handleError(error) Response
    }
    
    class CommandFactory {
        +executeCache(request) Promise~Response~
    }
    
    BaseCommand <|-- CacheRequestCommand
    CommandFactory ..> CacheRequestCommand : creates
```

- `BaseCommand`: Abstract class defining the command interface
- `CacheRequestCommand`: Handles request caching operations
- `CommandFactory`: Creates and executes commands

### Service Layer

The service layer follows a service-oriented architecture and provides core functionality:

```mermaid
classDiagram
    class ServiceFactory {
        -static configService: ConfigService
        -static assetTypeService: AssetTypeService
        -static cacheKeyService: CacheKeyService
        -static cacheTagService: CacheTagService
        -static cacheHeaderService: CacheHeaderService
        -static cfOptionsService: CfOptionsService
        +static getAssetTypeService() AssetTypeService
        +static getCacheKeyService() CacheKeyService
        +static getCacheTagService() CacheTagService
        +static getCacheHeaderService() CacheHeaderService
        +static getCfOptionsService() CfOptionsService
    }
    
    class AssetTypeService {
        <<interface>>
        +getConfigForRequest(request: Request) AssetConfig
    }
    
    class CacheKeyService {
        <<interface>>
        +getCacheKey(request: Request, config: AssetConfig) string
    }
    
    class CacheTagService {
        <<interface>>
        +generateTags(request: Request, assetType: string) string[]
        +formatTagsForHeader(tags: string[]) string
    }
    
    class CacheHeaderService {
        <<interface>>
        +getCacheControlHeader(status: number, config: AssetConfig) string
        +applyCacheHeaders(response: Response, request: Request, config: AssetConfig) Response
    }
    
    class CfOptionsService {
        <<interface>>
        +getCfOptions(request: Request, config: AssetConfig) CfCacheOptions
    }
    
    ServiceFactory ..> AssetTypeService : creates
    ServiceFactory ..> CacheKeyService : creates
    ServiceFactory ..> CacheTagService : creates
    ServiceFactory ..> CacheHeaderService : creates
    ServiceFactory ..> CfOptionsService : creates
```

- `AssetTypeService`: Detects content type from URL patterns
- `CacheKeyService`: Generates cache keys with query parameter handling
- `CacheTagService`: Creates hierarchical cache tags for each request
- `CacheHeaderService`: Manages response headers for optimal caching
- `CfOptionsService`: Generates Cloudflare-specific caching options
- `ServiceFactory`: Creates and provides access to services

### Strategy Layer

The strategy layer implements the Strategy pattern for content-specific caching behaviors:

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
    
    class VideoCachingStrategy {
        -supportedTypes: string[]
        +canHandle(contentType: string) boolean
        +applyCaching(response: Response, request: Request, config: AssetConfig) Response
        +getCacheOptions(request: Request, config: AssetConfig) CfCacheOptions
    }
    
    class ImageCachingStrategy {
        -supportedTypes: string[]
        +canHandle(contentType: string) boolean
        +applyCaching(response: Response, request: Request, config: AssetConfig) Response
        +getCacheOptions(request: Request, config: AssetConfig) CfCacheOptions
    }
    
    class DefaultCachingStrategy {
        +canHandle(contentType: string) boolean
        +applyCaching(response: Response, request: Request, config: AssetConfig) Response
        +getCacheOptions(request: Request, config: AssetConfig) CfCacheOptions
    }
    
    class StrategyFactory {
        -static strategies: CachingStrategy[]
        -static defaultStrategy: CachingStrategy
        +static initialize() void
        +static registerStrategy(strategy: CachingStrategy) void
        +static setDefaultStrategy(strategy: CachingStrategy) void
        +static getStrategyForContentType(contentType: string) CachingStrategy
    }
    
    CachingStrategy <|.. BaseCachingStrategy
    BaseCachingStrategy <|-- VideoCachingStrategy
    BaseCachingStrategy <|-- ImageCachingStrategy
    BaseCachingStrategy <|-- DefaultCachingStrategy
    StrategyFactory ..> CachingStrategy : manages
```

- `BaseCachingStrategy`: Abstract class defining the strategy interface
- Content-specific strategies for different asset types
- `StrategyFactory`: Selects the appropriate strategy for a content type

### Telemetry System

The telemetry system monitors and reports on system performance:

```mermaid
classDiagram
    class TelemetryService {
        -static instance: TelemetryService
        -operations: Map~string, OperationRecord~
        -constructor()
        +static getInstance() TelemetryService
        +startOperation(operationId, strategy, contentType, assetType) void
        +endOperation(operationId, strategy, contentType, assetType, status, cacheHit, error) void
        +getMetrics() PerformanceMetrics
    }
    
    class CacheAnalyticsService {
        -static instance: CacheAnalyticsService
        -cacheHits: number
        -cacheMisses: number
        -constructor()
        +static getInstance() CacheAnalyticsService
        +trackFromResponse(response, assetType, duration) void
        +getMetrics() CacheMetrics
    }
    
    class ReportingService {
        -static instance: ReportingService
        -constructor()
        +static getInstance() ReportingService
        +generateReport() Report
        +resetAll() void
    }
    
    class PerformanceTracker {
        -operationId: string
        -startTime: number
        -strategy: string
        -contentType: string
        -assetType: string
        -telemetry: TelemetryService
        +constructor(strategy, contentType, assetType)
        +end(status, cacheHit, error) void
        +static measure~T~(strategy, contentType, assetType, fn) Promise~T~
    }
    
    TelemetryService -- ReportingService
    CacheAnalyticsService -- ReportingService
    PerformanceTracker --> TelemetryService : uses
```

- `TelemetryService`: Tracks operations and performance
- `CacheAnalyticsService`: Tracks cache hit/miss rates
- `ReportingService`: Generates comprehensive reports
- `PerformanceTracker`: Utility for measuring operation durations

## Integration Points

The caching service integrates with the following Cloudflare systems:

```mermaid
flowchart LR
    CachingService[Caching Service] --> CFCache[Cloudflare Cache]
    CachingService --> CFCacheTags[Cloudflare Cache Tags]
    CachingService --> CFKV[Cloudflare Workers KV]
    
    subgraph Cloudflare Edge
        CFCache
        CFCacheTags
        CFKV
    end
```

1. **Cloudflare Cache**: Via cache options and headers
2. **Cloudflare Workers KV**: For persistent configuration (upcoming)
3. **Cloudflare Cache Tags**: For granular cache invalidation

## Code Organization

```
├── src/
│   ├── commands/          # Command pattern implementations
│   ├── errors/            # Custom error types
│   ├── services/          # Core service implementations
│   ├── strategies/        # Content-specific strategies
│   ├── telemetry/         # Performance monitoring
│   ├── tests/             # Test files
│   ├── types/             # TypeScript interfaces
│   ├── utils/             # Utility functions
│   └── cache.ts           # Main entry point
├── admin-ui/              # Admin interface
```

## Dependency Management

The system uses dependency injection through the ServiceFactory and StrategyFactory patterns, which provides:

```mermaid
flowchart TD
    Command[Command Layer] --> ServiceFactory[ServiceFactory]
    Command --> StrategyFactory[StrategyFactory]
    ServiceFactory --> Services[Service Implementations]
    StrategyFactory --> Strategies[Strategy Implementations]
    
    subgraph Dependency Injection
        ServiceFactory
        StrategyFactory
    end
```

1. Centralized service creation
2. Simplified testing through mock injection
3. Clear separation of concerns
4. Singleton management for services

## Error Handling

The error handling strategy follows these principles:

```mermaid
flowchart TD
    Error[Error] --> CustomError[Custom Error Types]
    CustomError --> Command[Command Layer]
    Command --> ErrorResponse[Error Response]
    Command --> Telemetry[Telemetry]
    
    subgraph Error Types
        CacheError[CacheError]
        FetchError[FetchError]
        ServiceError[ServiceError]
        ConfigError[ConfigurationError]
    end
    
    CacheError --> CustomError
    FetchError --> CustomError
    ServiceError --> CustomError
    ConfigError --> CustomError
```

1. Custom error types for different error categories
2. Centralized error handling in the command layer
3. Detailed error metadata for debugging
4. Graceful degradation in error conditions
5. Telemetry tracking of errors for monitoring

## Future Architecture Improvements

```mermaid
gantt
    title Architecture Roadmap
    dateFormat  YYYY-MM-DD
    
    section Configuration
    Configuration Service      :config, 2025-05-01, 2m
    Feature Flags              :flags, after config, 1m
    
    section Performance
    Enhanced Telemetry         :telemetry, 2025-05-01, 1m
    Cache Warming              :warming, after telemetry, 1m
    
    section Architecture
    Worker Isolation           :isolation, 2025-06-01, 2m
    A/B Testing                :testing, after isolation, 1m
```

1. **Configuration Service**: Centralized configuration management
2. **Feature Flags**: Dynamic feature enablement
3. **Enhanced Telemetry**: More detailed performance monitoring
4. **Worker Isolation**: Breaking functionality into separate workers
5. **Cache Warming**: Proactive cache population
6. **A/B Testing**: Testing different caching strategies