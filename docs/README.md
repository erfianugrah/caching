# Caching Service Documentation

This directory contains the documentation for the Cloudflare Caching Service project.

## Documentation Structure

The documentation is organized into two main categories:

### Public Documentation

Located in the `/docs/public` directory, this documentation is intended for users of the caching service:

- [Getting Started](./public/getting-started.md) - How to install and use the caching service
- [Configuration Guide](./public/configuration.md) - Detailed configuration options
- [API Reference](./public/api-reference.md) - API endpoints and usage
- [Deployment Guide](./public/deployment.md) - How to deploy to production

### Internal Documentation

Located in the `/docs/internal` directory, this documentation is intended for developers working on the caching service:

- [Architecture Overview](./internal/architecture.md) - High-level architecture and design patterns
- [Command System](./internal/commands.md) - Details on the command pattern implementation
- [Services](./internal/services.md) - Core services and their responsibilities
- [Caching Strategies](./internal/strategies.md) - Content-specific caching strategies
- [KV Configuration](./internal/kv-configuration.md) - KV-based configuration management
- [Telemetry System](./internal/telemetry.md) - Performance monitoring and analytics
- [Testing Guide](./internal/testing.md) - Test patterns and guidelines

## Quick Links

- [Project README](../README.md) - Main project overview
- [Configuration Manager](../scripts/README.md) - CLI tool for configuration management
- [Admin UI](./internal/admin-ui.md) - Admin interface documentation