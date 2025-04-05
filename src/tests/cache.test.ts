import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../cache';
import { Services } from '../services';
import { AssetTypeConfig } from '../types/cache-config';

// Mock fetch global
const mockFetch = vi.fn(() => Promise.resolve(new Response('Test response', { status: 200 })));
global.fetch = mockFetch;

// Mock services
vi.mock('../services', () => {
  return {
    Services: {
      assetType: {
        getConfigForRequest: vi.fn(() => ({
          assetType: 'test',
          regex: /.*/,
          useQueryInCacheKey: true,
          ttl: {
            ok: 3600,
            redirects: 300,
            clientError: 60,
            serverError: 0,
          },
        })),
      },
      cfOptions: {
        getCfOptions: vi.fn(() => ({
          cacheKey: 'example.com/test',
          polish: 'off',
          minify: { javascript: false, css: false, html: false },
          mirage: false,
          cacheEverything: true,
          cacheTtlByStatus: {
            '200-299': 3600,
            '300-399': 300,
            '400-499': 60,
            '500-599': 0,
          },
          cacheTags: ['tag1', 'tag2'],
        })),
      },
      cacheHeader: {
        applyCacheHeaders: vi.fn((resp) => {
          // Add a test header to verify this was called
          const newResp = new Response(resp.body, resp);
          newResp.headers.set('x-cache-applied', 'true');
          newResp.headers.set('cache-control', 'public, max-age=3600');
          return newResp;
        }),
      },
    },
  };
});

// Add proper types to mocked services
const mockedServices = Services as unknown as {
  assetType: {
    getConfigForRequest: ReturnType<typeof vi.fn<[Request], AssetTypeConfig>>;
  };
  cfOptions: {
    getCfOptions: ReturnType<typeof vi.fn>;
  };
  cacheHeader: {
    applyCacheHeaders: ReturnType<typeof vi.fn>;
  };
};

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
    
    // Verify
    expect(response.status).toBe(200);
    expect(response.headers.get('x-cache-applied')).toBe('true');
    expect(response.headers.get('cache-control')).toBe('public, max-age=3600');
    
    // Verify service calls
    expect(Services.assetType.getConfigForRequest).toHaveBeenCalledWith(request);
    expect(Services.cfOptions.getCfOptions).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith(request, { cf: expect.any(Object) });
    expect(Services.cacheHeader.applyCacheHeaders).toHaveBeenCalled();
  });

  it('should handle fetch errors', async () => {
    // Setup
    const request = new Request('https://example.com/error');
    mockFetch.mockRejectedValue(new Error('Network error'));
    
    // Execute
    const response = await worker.fetch(request);
    
    // Verify
    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Cache service error');
    expect(response.headers.get('Content-Type')).toBe('text/plain');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('should handle service errors', async () => {
    // Setup
    const request = new Request('https://example.com/bad-config');
    (Services.assetType.getConfigForRequest as any).mockImplementationOnce(() => {
      throw new Error('Configuration error');
    });
    
    // Execute
    const response = await worker.fetch(request);
    
    // Verify
    expect(response.status).toBe(500);
  });
});