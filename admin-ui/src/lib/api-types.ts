import type { TtlConfig, CacheDirectivesConfig } from '../../src/types/cache-config';

export interface AssetTypeData {
  id: string;
  name: string;
  pattern: string;
  useQueryInCacheKey: boolean;
  ttl: TtlConfig;
  queryParams?: {
    include: boolean;
    sortParams: boolean;
    normalizeValues: boolean;
    excluded?: string[];
  };
  cacheDirectives?: CacheDirectivesConfig;
  minification?: boolean;
  optimization?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export type AssetTypeResponse = ApiResponse<AssetTypeData>;
export type AssetTypesResponse = ApiResponse<AssetTypeData[]>;