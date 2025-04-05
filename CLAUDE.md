# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Deploy Commands
- **Start development server**: `wrangler dev`
- **Deploy to staging**: `wrangler deploy --env staging`
- **Deploy to production**: `wrangler deploy --env prod`

## Code Style Guidelines
- **Imports**: Use ES modules (`import/export`) syntax
- **Formatting**: 2-space indentation, proper spacing around operators
- **Variables**: Use `const` by default, `let` when necessary (avoid `var`)
- **Naming**: camelCase for variables/functions, PascalCase for classes/objects
- **Cache Config**: Define asset-specific cache rules with proper TTLs in the configuration object
- **Error Handling**: Use try/catch blocks for error handling
- **Headers**: Add cache-related headers consistently in responses
- **Documentation**: Add descriptive comments for complex logic
- **Tags**: Use the TagGenerator utility for standardized cache tag creation
- **Debug Mode**: Include debug information only when requested with debug header

## Architectural Patterns
- Configuration-driven asset type detection
- TTL management by status code ranges
- Centralized cache key generation
- Structured cache tag system