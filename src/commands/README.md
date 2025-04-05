# Caching Commands

This directory contains the implementation of the Command pattern for the caching system.

## Overview

The Command pattern encapsulates operations as objects, allowing for better separation of concerns, undo/redo functionality, and more structured error handling.

## Command Architecture

- `command.ts` - Base command interface and abstract class
- `command-factory.ts` - Factory for creating and executing commands
- Specialized command implementations for specific operations

## Available Commands

| Command | File | Description |
|---------|------|-------------|
| Base Command | `command.ts` | Abstract base class for all commands |
| Cache Request Command | `cache-request-command.ts` | Handles request caching |

## Command Pattern Implementation

Each command follows this pattern:

```typescript
// Define a command
class SomeCommand extends BaseCommand<ResultType> {
  constructor(private params: any) {
    super();
  }
  
  async execute(): Promise<ResultType> {
    // Command implementation
    // Use services, apply business logic
    return result;
  }
}

// Use the command
const command = new SomeCommand(params);
const result = await command.execute();
```

## Benefits of the Command Pattern

1. **Separation of Concerns** - Each command encapsulates a specific operation
2. **Reusability** - Commands can be composed and reused
3. **Testability** - Commands are easy to test in isolation
4. **Error Handling** - Centralized error handling in the command base class
5. **Logging** - Consistent logging across all operations

## Adding New Commands

To add a new command:

1. Create a new class extending `BaseCommand<T>`
2. Implement the `execute()` method
3. Add any necessary validation logic
4. Register the command in `command-factory.ts` if needed
5. Add the command export to `index.ts`