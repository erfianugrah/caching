# Testing Approach

This directory contains test files for the caching system using Vitest.

## Overview

The test suite follows these principles:
- Unit tests for individual components
- Integration tests for component interactions
- Mocking of external dependencies
- Comprehensive coverage of edge cases

## Test Structure

Tests are organized to mirror the source code structure:

```
tests/
  ├── services/            # Service tests
  │   ├── asset-type-service.test.ts
  │   ├── cache-header-service.test.ts
  │   └── ...
  ├── strategies/          # Strategy tests
  │   ├── default-caching-strategy.test.ts
  │   ├── image-caching-strategy.test.ts
  │   └── ...
  └── commands/            # Command tests
      └── cache-request-command.test.ts
```

## Running Tests

```bash
# Run all tests
npm test

# Run specific test
vitest -t "test name"

# Run tests in watch mode
vitest --watch

# Run tests with coverage
vitest --coverage
```

## Mocking

Tests use Vitest mocking capabilities:

```typescript
// Mock dependencies
vi.mock('../services/service-factory', () => ({
  ServiceFactory: {
    getSomeService: vi.fn(() => ({
      someMethod: vi.fn(() => 'mocked result')
    }))
  }
}));
```

## Test Pattern

Each test file follows this pattern:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentToTest } from '../path/to/component';

describe('ComponentName', () => {
  let instance: ComponentToTest;
  
  beforeEach(() => {
    vi.clearAllMocks();
    instance = new ComponentToTest();
  });
  
  describe('methodName', () => {
    it('should do something specific', () => {
      // Setup
      const input = 'example';
      
      // Execute
      const result = instance.methodName(input);
      
      // Verify
      expect(result).toBe('expected output');
    });
  });
});
```

## Test Coverage Goals

- **Services**: 95%+ coverage
- **Strategies**: 90%+ coverage
- **Commands**: 90%+ coverage
- **Utils**: 85%+ coverage

## Adding New Tests

When adding tests:
1. Create a test file matching the component name (e.g., `component-name.test.ts`)
2. Follow the established test pattern
3. Mock external dependencies
4. Test both success cases and error handling
5. Include edge cases and typical usage patterns