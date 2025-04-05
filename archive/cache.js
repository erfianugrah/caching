import { TagGenerator } from "./cache-tags.js";

// Cache configuration with dynamic tag generation
const CacheConfig = {
  // Configuration by asset type
  assetConfigs: {
    video: {
      regex:
        /(.*\/Video)|(.*\.(m4s|mp4|ts|avi|mpeg|mpg|mkv|bin|webm|vob|flv|m2ts|mts|3gp|m4v|wmv|qt))$/,
      useQueryInCacheKey: false,
      ttl: {
        ok: 31556952, // 1 year
        redirects: 30,
        clientError: 10,
        serverError: 0,
      },
    },
    image: {
      regex:
        /(.*\/Images)|(.*\.(jpg|jpeg|png|bmp|pict|tif|tiff|webp|gif|heif|exif|bat|bpg|ppm|pgn|pbm|pnm))$/,
      useQueryInCacheKey: true,
      imageOptimization: true,
      ttl: {
        ok: 3600, // 1 hour
        redirects: 30,
        clientError: 10,
        serverError: 0,
      },
    },
    frontEnd: {
      regex: /^.*\.(css|js)$/,
      useQueryInCacheKey: true,
      minifyCss: true,
      ttl: {
        ok: 3600, // 1 hour
        redirects: 30,
        clientError: 10,
        serverError: 0,
      },
    },
    audio: {
      regex:
        /(.*\/Audio)|(.*\.(flac|aac|mp3|alac|aiff|wav|ogg|aiff|opus|ape|wma|3gp))$/,
      useQueryInCacheKey: false,
      ttl: {
        ok: 31556952, // 1 year
        redirects: 30,
        clientError: 10,
        serverError: 0,
      },
    },
    directPlay: {
      regex: /.*(\/Download)/,
      useQueryInCacheKey: false,
      ttl: {
        ok: 31556952, // 1 year
        redirects: 30,
        clientError: 10,
        serverError: 0,
      },
    },
    manifest: {
      regex: /^.*\.(m3u8|mpd)$/,
      useQueryInCacheKey: false,
      ttl: {
        ok: 3, // 3 seconds
        redirects: 2,
        clientError: 1,
        serverError: 0,
      },
    },
  },

  // Find the matching configuration for a URL
  getConfigForRequest(request) {
    const url = new URL(request.url);

    // Find matching asset type based on regex
    for (const [assetType, config] of Object.entries(this.assetConfigs)) {
      if (config.regex.test(url.pathname)) {
        return {
          assetType,
          ...config,
        };
      }
    }

    // Default config for unmatched assets
    return {
      assetType: "default",
      useQueryInCacheKey: true,
      ttl: {
        ok: 0, // Don't cache by default
        redirects: 0,
        clientError: 0,
        serverError: 0,
      },
    };
  },

  // Generate cache key based on request and config
  getCacheKey(request, config) {
    const url = new URL(request.url);
    return config.useQueryInCacheKey
      ? `${url.hostname}${url.pathname}${url.search}`
      : `${url.hostname}${url.pathname}`;
  },

  // Get CloudFlare cache settings
  getCfOptions(request, config) {
    // Generate dynamic cache tags based on request and asset type
    const cacheTags = TagGenerator.generateTags(request, config.assetType);

    return {
      cacheKey: this.getCacheKey(request, config),
      polish: config.imageOptimization ? "lossy" : "off",
      minify: {
        javascript: false,
        css: config.minifyCss || false,
        html: false,
      },
      mirage: config.imageOptimization || false,
      cacheEverything: true,
      cacheTtlByStatus: {
        "100-199": config.ttl?.info || 0,
        "200-299": config.ttl?.ok || 0,
        "300-399": config.ttl?.redirects || 0,
        "400-499": config.ttl?.clientError || 0,
        "500-599": config.ttl?.serverError || 0,
      },
      cacheTags: cacheTags,
    };
  },

  // Calculate Cache-Control header based on response status and config
  getCacheControlHeader(status, config) {
    if (!config.ttl) return "";

    // Map status code to appropriate TTL
    let ttl = 0;
    if (status >= 200 && status < 300) ttl = config.ttl.ok;
    else if (status >= 300 && status < 400) ttl = config.ttl.redirects;
    else if (status >= 400 && status < 500) ttl = config.ttl.clientError;
    else if (status >= 500 && status < 600) ttl = config.ttl.serverError;

    return ttl > 0 ? `public, max-age=${ttl}` : "";
  },
};

export default {
  async fetch(request) {
    // Get configuration for this request
    const config = CacheConfig.getConfigForRequest(request);

    // Get Cloudflare-specific options with dynamically generated cache tags
    const cfOptions = CacheConfig.getCfOptions(request, config);

    // Fetch with cache configuration
    const originalResponse = await fetch(request, { cf: cfOptions });

    // Create new response with modified headers
    const response = new Response(originalResponse.body, originalResponse);

    // Set Cache-Control header based on response status
    const cacheControl = CacheConfig.getCacheControlHeader(
      response.status,
      config,
    );
    if (cacheControl) {
      response.headers.set("Cache-Control", cacheControl);
    }

    // Add debug header if needed
    if (request.headers.get("debug") === "true") {
      response.headers.set(
        "x-cache-debug",
        JSON.stringify({
          assetType: config.assetType,
          cacheKey: cfOptions.cacheKey,
          ttl: config.ttl,
          cacheTags: cfOptions.cacheTags,
        }),
      );
    }

    // Set Cache-Tag header for debugging and external systems
    if (cfOptions.cacheTags && cfOptions.cacheTags.length > 0) {
      response.headers.set("Cache-Tag", cfOptions.cacheTags.join(","));
    }

    return response;
  },
};
