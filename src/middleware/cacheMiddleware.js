/**
 * Implements request caching
 */
export const cacheMiddleware = {
  onRequest: (config) => {
    if (config.cache && config.cacheKey) {
      const cachedResponse = cache.get(config.cacheKey);
      if (cachedResponse) {
        return { ...config, adapter: () => Promise.resolve(cachedResponse) };
      }
    }
    return config;
  },
  onResponse: (response) => {
    if (response.config.cache && response.config.cacheKey) {
      cache.set(response.config.cacheKey, response);
    }
    return response;
  }
};
// Simple in-memory cache (replace with Redis/other storage in production)
const cache = new Map();
