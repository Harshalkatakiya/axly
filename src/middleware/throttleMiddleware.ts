import { AxionMiddleware, AxionRateLimitConfig } from '../core/types';

/**
 * Enforces rate limiting on requests
 */
export const createThrottleMiddleware = (
  rateLimitConfig: AxionRateLimitConfig
): AxionMiddleware => {
  const requestTimestamps: number[] = [];

  return {
    onRequest: async (config) => {
      const now = Date.now();
      const windowStart = now - rateLimitConfig.perMilliseconds;

      // Clean up old requests
      while (requestTimestamps[0] < windowStart) {
        requestTimestamps.shift();
      }

      if (requestTimestamps.length >= rateLimitConfig.maxRequests) {
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            rateLimitConfig.perMilliseconds - (now - requestTimestamps[0])
          )
        );
        return this.onRequest(config);
      }

      requestTimestamps.push(now);
      return config;
    }
  };
};
