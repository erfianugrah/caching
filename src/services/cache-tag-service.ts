import { CacheTagService } from './interfaces';
import { logger } from '../utils/logger';

/**
 * Tag type with associated priority
 */
interface TagWithPriority {
  tag: string;
  priority: number;
}

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
export class DefaultCacheTagService implements CacheTagService {
  private namespace: string;
  private maxTags: number;
  private maxTagLength: number = 1024; // Cloudflare limit for purge API
  private maxHeaderLength: number = 16 * 1024; // Cloudflare 16KB limit
  
  /**
   * Create a new CacheTagService
   * @param namespace The namespace to use for tags
   * @param maxTags Maximum number of tags to generate (defaults to 10)
   */
  constructor(
    namespace: string = (globalThis as any).CACHE_TAG_NAMESPACE || 'cf',
    maxTags: number = parseInt((globalThis as any).MAX_CACHE_TAGS || '10', 10)
  ) {
    this.namespace = namespace;
    this.maxTags = maxTags;
    logger.debug('CacheTagService initialized', { namespace, maxTags });
  }
  
  /**
   * Create a namespaced tag
   * @param type The tag type
   * @param value The tag value
   * @returns A formatted tag string
   */
  private createTag(type: string, value: string): string {
    // Create the tag
    const tag = `${this.namespace}:${type}:${value}`;
    
    // Validate and potentially truncate the tag
    if (tag.length > this.maxTagLength) {
      logger.warn(`Tag exceeds maximum length and will be truncated: ${tag}`);
      return tag.substring(0, this.maxTagLength);
    }
    
    return tag;
  }
  
  /**
   * Validate a cache tag to ensure it meets Cloudflare requirements
   * @param tag The tag to validate
   * @returns True if the tag is valid
   */
  public validateTag(tag: string): boolean {
    // Check length (minimum 1 byte)
    if (tag.length < 1) {
      return false;
    }
    
    // Check for maximum length
    if (tag.length > this.maxTagLength) {
      return false;
    }
    
    // Check for spaces
    if (tag.includes(' ')) {
      return false;
    }
    
    // Check for ASCII printable characters only
    // ASCII printable range is 32-126, but we exclude space (32)
    if (![...tag].every(char => {
      const code = char.charCodeAt(0);
      return code > 32 && code < 127;
    })) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Format a list of cache tags for inclusion in a header
   * @param tags The list of tags to format
   * @returns A properly formatted string for the Cache-Tag header
   */
  public formatTagsForHeader(tags: string[]): string {
    // Filter out invalid tags
    const validTags = tags.filter(tag => this.validateTag(tag));
    
    // Join with commas
    const headerValue = validTags.join(',');
    
    // Check total length and truncate if needed
    if (headerValue.length > this.maxHeaderLength) {
      logger.warn(`Cache-Tag header exceeds maximum length (${headerValue.length} > ${this.maxHeaderLength})`);
      
      // Find how many tags we can include within the limit
      let totalLength = 0;
      let includedTags = 0;
      
      for (let i = 0; i < validTags.length; i++) {
        // Add tag length plus comma
        const newLength = totalLength + validTags[i].length + (i > 0 ? 1 : 0);
        
        if (newLength <= this.maxHeaderLength) {
          totalLength = newLength;
          includedTags++;
        } else {
          break;
        }
      }
      
      // Return only the tags that fit
      return validTags.slice(0, includedTags).join(',');
    }
    
    return headerValue;
  }
  
  /**
   * Generate cache tags for a request and asset type
   * @param request The request to generate tags for
   * @param assetType The asset type
   * @returns An array of cache tags, prioritized and limited to maxTags
   */
  public generateTags(request: Request, assetType: string): string[] {
    const url = new URL(request.url);
    const tagsWithPriority: TagWithPriority[] = [];

    // Host tag (highest priority)
    tagsWithPriority.push({ 
      tag: this.createTag('host', url.hostname),
      priority: 100
    });

    // Asset type tag (high priority)
    if (assetType && assetType !== 'default') {
      tagsWithPriority.push({ 
        tag: this.createTag('type', assetType),
        priority: 90
      });
    }

    // Extension tag (high priority)
    const extension = url.pathname.split('.').pop()?.toLowerCase();
    if (extension) {
      tagsWithPriority.push({ 
        tag: this.createTag('ext', extension),
        priority: 85
      });
    }

    // Path tags (medium to low priority depending on depth)
    const pathSegments = url.pathname.split('/').filter(Boolean);
    if (pathSegments.length > 0) {
      // Full path (medium priority)
      tagsWithPriority.push({ 
        tag: this.createTag('path', url.pathname),
        priority: 80
      });

      // Hierarchical paths (priority decreases with depth)
      // For deep paths, prioritize the first and last few levels
      let currentPath = '';
      let segmentPriority = 70;
      
      // Short-circuit if there are too many segments
      const relevantSegments = pathSegments.length <= 8 
        ? pathSegments 
        : [
            // First 3 segments
            ...pathSegments.slice(0, 3),
            // Last 3 segments
            ...pathSegments.slice(-3)
          ];
      
      for (const segment of relevantSegments) {
        currentPath += '/' + segment;
        tagsWithPriority.push({ 
          tag: this.createTag('prefix', currentPath),
          priority: segmentPriority
        });
        // Decrease priority for deeper segments
        segmentPriority = Math.max(30, segmentPriority - 10);
      }
    } else {
      // Home page tag
      tagsWithPriority.push({ 
        tag: this.createTag('page', 'home'),
        priority: 80
      });
    }

    // Sort by priority (highest first), take max tags, and filter invalid tags
    const generatedTags = [...new Set(
      tagsWithPriority
        .sort((a, b) => b.priority - a.priority)
        .slice(0, this.maxTags)
        .map(item => item.tag)
        .filter(tag => this.validateTag(tag))
    )];
    
    // Warn if tags were removed due to validation
    if (generatedTags.length < Math.min(tagsWithPriority.length, this.maxTags)) {
      logger.warn(`Some cache tags were removed due to validation rules`);
    }
    
    return generatedTags;
  }
}

// Export default implementation
export const TagGenerator = new DefaultCacheTagService();