import { AxionMiddleware } from '../core/types';

/**
 * Automatically retries failed requests
 */
export const retryMiddleware: AxionMiddleware = {
  onError: async (error) => {
    const { config } = error;

    if (!config || config.retries === 0) return error;

    const retries = config.retries || 3;
    const retryDelay = config.retryDelay || 1000;

    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      return { ...config, retries: retries - 1 };
    }

    return error;
  }
};
