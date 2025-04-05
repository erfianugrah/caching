import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../cache';
import { CommandFactory } from '../commands/command-factory';
import { AssetTypeConfig } from '../types/cache-config';
import { ServiceFactory } from '../services/service-factory';

// Mock fetch global
const mockFetch = vi.fn(() => Promise.resolve(new Response('Test response', { status: 200 })));
global.fetch = mockFetch;

// Mock the command factory
vi.mock('../commands/command-factory', () => {
  return {
    CommandFactory: {
      initialize: vi.fn(),
      executeCache: vi.fn().mockImplementation(async (request) => {
        // Check if we want to simulate an error
        if (request.url.includes('/error')) {
          return new Response('Cache service error', { 
            status: 500,
            headers: {
              'Content-Type': 'text/plain',
              'Cache-Control': 'no-store'
            }
          });
        }
        
        // Return successful response
        const response = new Response('Test response', { status: 200 });
        response.headers.set('x-cache-applied', 'true');
        response.headers.set('cache-control', 'public, max-age=3600');
        return response;
      }),
    },
  };
});

// Use the CommandFactory type but cast vi.mocked to help TypeScript
const mockedCommandFactory = vi.mocked(CommandFactory);

// Mock logger to prevent console output in tests
vi.mock('../utils/logger', () => {
  return {
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

describe('Worker Handler', () => {
  // Reset mocks between tests
  beforeEach(() => {
    vi.resetAllMocks();
    // Setup default mock response
    mockFetch.mockImplementation(() => Promise.resolve(new Response('Test response', { status: 200 })));
    
    // Setup global environment variables for testing
    (globalThis as any).CACHE_TAG_NAMESPACE = 'test';
    (globalThis as any).MAX_CACHE_TAGS = '10';
    (globalThis as any).ENVIRONMENT = 'test';
    (globalThis as any).LOG_LEVEL = 'DEBUG';
    (globalThis as any).DEBUG_MODE = 'true';
    (globalThis as any).VERSION = 'test-version';
    (globalThis as any).name = 'test-worker';
  });

  it('should handle requests successfully', async () => {
    // Setup
    const request = new Request('https://example.com/test.jpg');
    
    // Execute
    const response = await worker.fetch(request);
    
    // Verify command factory was called
    expect(CommandFactory.executeCache).toHaveBeenCalledWith(request);
  });

  it('should handle fetch errors', async () => {
    // Setup
    const request = new Request('https://example.com/error');
    
    // Execute
    const response = await worker.fetch(request);
    
    // Verify command factory was called
    expect(CommandFactory.executeCache).toHaveBeenCalledWith(request);
  });

  // We should test initialize is called, but this happens
  // during module loading and is harder to test in isolation.
  it('should use the command factory', () => {
    // Just use this test to verify the mock is working
    expect(CommandFactory.executeCache).toBeDefined();
  });
});