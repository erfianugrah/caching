// Tag generation utility for Cloudflare Workers
export const TagGenerator = {
  namespace: "cf",

  createTag(type, value) {
    return `${this.namespace}:${type}:${value}`;
  },

  generateTags(request, assetType) {
    const url = new URL(request.url);
    const tags = [];

    // Host tag
    tags.push(this.createTag("host", url.hostname));

    // Asset type tag
    if (assetType && assetType !== "default") {
      tags.push(this.createTag("type", assetType));
    }

    // Path tags
    const pathSegments = url.pathname.split("/").filter(Boolean);
    if (pathSegments.length > 0) {
      // Full path
      tags.push(this.createTag("path", url.pathname));

      // Hierarchical paths
      let currentPath = "";
      for (const segment of pathSegments) {
        currentPath += "/" + segment;
        tags.push(this.createTag("prefix", currentPath));
      }
    } else {
      tags.push(this.createTag("page", "home"));
    }

    // Extension tag
    const extension = url.pathname.split(".").pop()?.toLowerCase();
    if (extension) {
      tags.push(this.createTag("ext", extension));
    }

    return [...new Set(tags)]; // Remove duplicates
  },
};

// Export default to allow direct import
export default TagGenerator;
