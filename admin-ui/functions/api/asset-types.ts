import { AssetTypeData } from "../../src/lib/api-types";

export interface Env {
  // KV namespace for storing configuration
  CACHE_CONFIG: KVNamespace;
}

// Mock data for development
const mockAssetTypes: AssetTypeData[] = [
  {
    id: "1",
    name: "JavaScript Files",
    pattern: ".*\\.js$",
    useQueryInCacheKey: true,
    ttl: {
      ok: 86400,
      redirects: 300,
      clientError: 60,
      serverError: 0
    },
    queryParams: {
      include: true,
      sortParams: true,
      normalizeValues: true,
      excluded: ["utm_source", "utm_medium", "utm_campaign"]
    },
    cacheDirectives: {
      staleWhileRevalidate: 3600,
      staleIfError: 86400,
      immutable: true
    },
    minification: true,
    optimization: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "2", 
    name: "CSS Files",
    pattern: ".*\\.css$",
    useQueryInCacheKey: true,
    ttl: {
      ok: 86400,
      redirects: 300,
      clientError: 60,
      serverError: 0
    },
    queryParams: {
      include: true,
      sortParams: true,
      normalizeValues: true
    },
    cacheDirectives: {
      staleWhileRevalidate: 3600,
      immutable: true
    },
    minification: true,
    optimization: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "3",
    name: "Images",
    pattern: ".*\\.(jpg|jpeg|png|gif|webp)$",
    useQueryInCacheKey: true,
    ttl: {
      ok: 2592000, // 30 days
      redirects: 300,
      clientError: 60,
      serverError: 0
    },
    queryParams: {
      include: true,
      sortParams: false,
      normalizeValues: false
    },
    optimization: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Helper to create consistent responses
function createJsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache"
    }
  });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  // Extract information from the request
  const { request, env, params } = context;
  const url = new URL(request.url);
  const method = request.method;
  
  // GET /api/asset-types - List all asset types
  if (method === "GET" && !url.pathname.split("/").filter(Boolean)[2]) {
    try {
      // In production, we would fetch from KV
      // const keys = await env.CACHE_CONFIG.list({ prefix: "assetType:" });
      // const assetTypes: AssetTypeData[] = [];
      
      // for (const key of keys.keys) {
      //   const data = await env.CACHE_CONFIG.get(key.name, { type: "json" });
      //   if (data) assetTypes.push(data as AssetTypeData);
      // }
      
      // For now, use mock data
      return createJsonResponse({
        success: true,
        data: mockAssetTypes
      });
    } catch (error) {
      return createJsonResponse({
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch asset types"
      }, 500);
    }
  }
  
  // POST /api/asset-types - Create a new asset type
  if (method === "POST" && !url.pathname.split("/").filter(Boolean)[2]) {
    try {
      const data = await request.json() as Omit<AssetTypeData, "id">;
      
      // Validate required fields
      if (!data.name || !data.pattern) {
        return createJsonResponse({
          success: false,
          error: "Name and pattern are required"
        }, 400);
      }
      
      // In production, we would store in KV
      // const id = crypto.randomUUID();
      // const assetType: AssetTypeData = {
      //   ...data,
      //   id,
      //   createdAt: new Date().toISOString(),
      //   updatedAt: new Date().toISOString()
      // };
      // await env.CACHE_CONFIG.put(`assetType:${id}`, JSON.stringify(assetType));
      
      // Mock the creation with a new ID
      const id = crypto.randomUUID();
      const assetType: AssetTypeData = {
        ...data,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      return createJsonResponse({
        success: true,
        data: assetType
      }, 201);
    } catch (error) {
      return createJsonResponse({
        success: false,
        error: error instanceof Error ? error.message : "Failed to create asset type"
      }, 500);
    }
  }
  
  // Not found for any other path
  return createJsonResponse({
    success: false,
    error: "Not found"
  }, 404);
};