# Caching Services

This directory contains the implementation of core services for the caching system.

## Overview

The services in this directory follow a service-oriented architecture pattern and provide the core functionality for the caching system.

## Service Architecture

- `interfaces.ts` - Service interfaces and contracts
- `service-factory.ts` - Factory for creating and accessing services
- Specialized service implementations for specific responsibilities

## Available Services

| Service | File | Description |
|---------|------|-------------|
| Asset Type Service | `asset-type-service.ts` | Detects content type from URL patterns |
| Cache Key Service | `cache-key-service.ts` | Generates cache keys with query handling |
| Cache Tag Service | `cache-tag-service.ts` | Creates hierarchical cache tags |
| Cache Header Service | `cache-header-service.ts` | Manages response headers |
| CF Options Service | `cf-options-service.ts` | Generates Cloudflare-specific options |

## Service Factory Pattern

Services are accessed through the `ServiceFactory` to allow for easier testing and dependency injection:

```typescript
// Get an instance of the service
const assetTypeService = ServiceFactory.getAssetTypeService();

// Use the service
const config = assetTypeService.getConfigForRequest(request);
```

## Service Interfaces

Each service implements an interface defined in `interfaces.ts`, which allows for:

- Mock implementations in tests
- Alternative implementations for different environments
- Clear contracts between services

## Adding New Services

To add a new service:

1. Define the service interface in `interfaces.ts`
2. Create a service implementation class
3. Add a getter method to `ServiceFactory`
4. Update the service initialization in the factory
5. Add the service export to `index.ts`