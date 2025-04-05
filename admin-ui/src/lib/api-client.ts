import type { AssetTypeData, AssetTypeResponse, AssetTypesResponse } from './api-types';

const API_BASE = '/api';

/**
 * API client for interacting with the asset type endpoints
 */
export const assetTypeApi = {
  /**
   * Get all asset types
   */
  async getAll(): Promise<AssetTypesResponse> {
    try {
      const response = await fetch(`${API_BASE}/asset-types`);
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }
      
      return await response.json();
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },

  /**
   * Get a single asset type by ID
   */
  async getById(id: string): Promise<AssetTypeResponse> {
    try {
      const response = await fetch(`${API_BASE}/asset-types/${id}`);
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }
      
      return await response.json();
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },

  /**
   * Create a new asset type
   */
  async create(data: Omit<AssetTypeData, 'id'>): Promise<AssetTypeResponse> {
    try {
      const response = await fetch(`${API_BASE}/asset-types`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }
      
      return await response.json();
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },

  /**
   * Update an existing asset type
   */
  async update(id: string, data: Partial<AssetTypeData>): Promise<AssetTypeResponse> {
    try {
      const response = await fetch(`${API_BASE}/asset-types/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }
      
      return await response.json();
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },

  /**
   * Delete an asset type
   */
  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${API_BASE}/asset-types/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },
};