import { CacheTagService } from './interfaces';
/**
 * Implementation of CacheTagService for generating cache tags
 *
 * Follows Cloudflare requirements:
 * - Maximum 16KB total header length (approx 1000 tags)
 * - Maximum 1024 characters per tag for purge API calls
 * - Only printable ASCII characters
 * - No spaces within tags
 * - Case insensitive
 */
export declare class DefaultCacheTagService implements CacheTagService {
    private namespace;
    private maxTags;
    private maxTagLength;
    private maxHeaderLength;
    /**
     * Create a new CacheTagService
     * @param namespace The namespace to use for tags
     * @param maxTags Maximum number of tags to generate (defaults to 10)
     */
    constructor(namespace?: string, maxTags?: number);
    /**
     * Create a namespaced tag
     * @param type The tag type
     * @param value The tag value
     * @returns A formatted tag string
     */
    private createTag;
    /**
     * Validate a cache tag to ensure it meets Cloudflare requirements
     * @param tag The tag to validate
     * @returns True if the tag is valid
     */
    validateTag(tag: string): boolean;
    /**
     * Format a list of cache tags for inclusion in a header
     * @param tags The list of tags to format
     * @returns A properly formatted string for the Cache-Tag header
     */
    formatTagsForHeader(tags: string[]): string;
    /**
     * Generate cache tags for a request and asset type
     * @param request The request to generate tags for
     * @param assetType The asset type
     * @returns An array of cache tags, prioritized and limited to maxTags
     */
    generateTags(request: Request, assetType: string): string[];
}
export declare const TagGenerator: DefaultCacheTagService;
