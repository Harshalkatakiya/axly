/**
 * Logs request lifecycle events
 */
export const loggingMiddleware = {
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
