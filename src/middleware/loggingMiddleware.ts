import { AxionMiddleware } from '../core/types';

/**
 * Logs request lifecycle events
 */
export const loggingMiddleware: AxionMiddleware = {
  onRequest: (config) => {
    console.log(`[Request] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  onResponse: (response) => {
    console.log(`[Response] ${response.status} ${response.config.url}`);
    return response;
  },
  onError: (error) => {
    console.error(`[Error] ${error.message}`, error.config);
    return error;
  }
};
