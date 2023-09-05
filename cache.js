export default {
    async fetch(request) {

        // Instantiate new URL to make it mutable
        const newRequest = new URL(request.url)
        // const subRequest = new Request(request.headers)
        // subRequest.headers.set("Authorization", "Test")
        // Set const to be used in the array later on
        const customCacheKey = `${newRequest.hostname}${newRequest.pathname}`
        const queryCacheKey = `${newRequest.hostname}${newRequest.pathname}${newRequest.search}`

        // Here we set all variables needed to manipulate Cloudflare's cache using the fetch API in the cf object, we'll be passing these variables in the objects down
        const cacheAssets = [
            { asset: 'video', key: customCacheKey, regex: /(.*\/Video)|(.*\.(m4s|mp4|ts|avi|mpeg|mpg|mkv|bin|webm|vob|flv|m2ts|mts|3gp|m4v|wmv|qt))/, info: 0, ok: 31556952, redirects: 30, clientError: 10, serverError: 0, cacheTag: 'signed-video' },
            { asset: 'image', key: queryCacheKey, regex: /(.*\/Images)|(.*\.(jpg|jpeg|png|bmp|pict|tif|tiff|webp|gif|heif|exif|bat|bpg|ppm|pgn|pbm|pnm))/, info: 0, ok: 3600, redirects: 30, clientError: 10, serverError: 0, cacheTag: 'signed-image' },
            { asset: 'frontEnd', key: queryCacheKey, regex: /^.*\.(css|js)/, info: 0, ok: 3600, redirects: 30, clientError: 10, serverError: 0, cacheTag: 'signed-frontEnd' },
            { asset: 'audio', key: customCacheKey, regex: /(.*\/Audio)|(.*\.(flac|aac|mp3|alac|aiff|wav|ogg|aiff|opus|ape|wma|3gp))/, info: 0, ok: 31556952, redirects: 30, clientError: 10, serverError: 0, cacheTag: 'signed-audio' },
            { asset: 'directPlay', key: customCacheKey, regex: /.*(\/Download)/, info: 0, ok: 31556952, redirects: 30, clientError: 10, serverError: 0, cacheTag: 'signed-directPlay' },
            { asset: 'manifest', key: customCacheKey, regex: /^.*\.(m3u8|mpd)/, info: 0, ok: 3, redirects: 2, clientError: 1, serverError: 0, cacheTag: 'signed-manifest' }
        ]

        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find we'll be using the regex to match on file extensions for caching
        const { asset, regex, ...cache } = cacheAssets.find(({ regex }) => newRequest.pathname.match(regex)) ?? {}

        const newResponse = await fetch(request,
            {
                cf:
                {
                    cacheKey: cache.key,
                    polish: false,
                    cacheEverything: true,
                    cacheTtlByStatus: {
                        '100-199': cache.info,
                        '200-299': cache.ok,
                        '300-399': cache.redirects,
                        '400-499': cache.clientError,
                        '500-599': cache.serverError
                    },
                    cacheTags: [
                        cache.cacheTag
                    ]
                },

            })

        const response = new Response(newResponse.body, newResponse)
        let cacheControl = '';

        // Find the matching asset in the cacheAssets array
        let matchedAsset = cacheAssets.find(asset => asset.regex.test(newRequest));

        if (matchedAsset) {
            // Set the cache-control header based on the asset type
            if (response.status >= 200 && response.status < 300) {
                cacheControl = `public, max-age=${matchedAsset.ok}`;
            } else if (response.status >= 300 && response.status < 400) {
                cacheControl = `public, max-age=${matchedAsset.redirects}`;
            } else if (response.status >= 400 && response.status < 500) {
                cacheControl = `public, max-age=${matchedAsset.clientError}`;
            } else if (response.status >= 500 && response.status < 600) {
                cacheControl = `public, max-age=${matchedAsset.serverError}`;
            }
        }

        // Set the cache-control header on the response
        response.headers.set('Cache-Control', cacheControl);

        // For debugging purposes
        response.headers.set('debug', JSON.stringify(cache))
        return response
    }
}