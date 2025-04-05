/**
 * Main worker handler for the caching service
 */
declare const _default: {
    /**
     * Handle fetch requests
     * @param request The request to handle
     * @returns The cached response
     */
    fetch(request: Request): Promise<Response>;
};
export default _default;
