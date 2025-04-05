import { AssetTypeData } from "../../../src/lib/api-types";

export interface Env {
  // KV namespace for storing configuration
  CACHE_CONFIG: KVNamespace;
}

// Mock data for development
const mockAssetTypes: Record<string, AssetTypeData> = {
  "1": {
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
  "2": {
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
  "3": {
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
};

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
  const method = request.method;
  const id = params.id as string;
  
  // GET /api/asset-types/[id] - Get an asset type by ID
  if (method === "GET") {
    try {
      // In production, we would fetch from KV
      // const data = await env.CACHE_CONFIG.get(`assetType:${id}`, { type: "json" });
      // if (!data) {
      //   return createJsonResponse({
      //     success: false,
      //     error: "Asset type not found"
      //   }, 404);
      // }
      
      // For now, use mock data
      const assetType = mockAssetTypes[id];
      if (!assetType) {
        return createJsonResponse({
          success: false,
          error: "Asset type not found"
        }, 404);
      }
      
      return createJsonResponse({
        success: true,
        data: assetType
      });
    } catch (error) {
      return createJsonResponse({
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch asset type"
      }, 500);
    }
  }
  
  // PUT /api/asset-types/[id] - Update an asset type
  if (method === "PUT") {
    try {
      // In production, we would fetch from KV first
      // let existing = await env.CACHE_CONFIG.get(`assetType:${id}`, { type: "json" });
      // if (!existing) {
      //   return createJsonResponse({
      //     success: false,
      //     error: "Asset type not found"
      //   }, 404);
      // }
      
      // For mock data
      const existing = mockAssetTypes[id];
      if (!existing) {
        return createJsonResponse({
          success: false,
          error: "Asset type not found"
        }, 404);
      }
      
      const updates = await request.json() as Partial<AssetTypeData>;
      
      // Create the updated asset type
      const updatedAssetType: AssetTypeData = {
        ...existing,
        ...updates,
        id, // Ensure ID doesn't change
        updatedAt: new Date().toISOString()
      };
      
      // In production, we would update in KV
      // await env.CACHE_CONFIG.put(`assetType:${id}`, JSON.stringify(updatedAssetType));
      
      return createJsonResponse({
        success: true,
        data: updatedAssetType
      });
    } catch (error) {
      return createJsonResponse({
        success: false,
        error: error instanceof Error ? error.message : "Failed to update asset type"
      }, 500);
    }
  }
  
  // DELETE /api/asset-types/[id] - Delete an asset type
  if (method === "DELETE") {
    try {
      // In production, check if it exists first
      // const existing = await env.CACHE_CONFIG.get(`assetType:${id}`);
      // if (!existing) {
      //   return createJsonResponse({
      //     success: false,
      //     error: "Asset type not found"
      //   }, 404);
      // }
      
      // For mock data
      if (!mockAssetTypes[id]) {
        return createJsonResponse({
          success: false,
          error: "Asset type not found"
        }, 404);
      }
      
      // In production, we would delete from KV
      // await env.CACHE_CONFIG.delete(`assetType:${id}`);
      
      return createJsonResponse({
        success: true
      }, 200);
    } catch (error) {
      return createJsonResponse({
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete asset type"
      }, 500);
    }
  }
  
  // Method not allowed for other methods
  return createJsonResponse({
    success: false,
    error: "Method not allowed"
  }, 405);
};