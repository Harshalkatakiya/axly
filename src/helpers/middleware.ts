import {
  AxlyError,
  AxlyMiddleware,
  AxlyRequestConfig,
  AxlyResponse,
} from "../core/types";

export const MiddlewareHelpers = {
  createLoggerMiddleware: (
    options = { logRequests: true, logResponses: true, logErrors: true },
  ) => {
    return {
      onRequest: async (config: AxlyRequestConfig) => {
        if (options.logRequests) {
          console.log(
            `Request: ${config.method?.toUpperCase()} ${config.url}`,
            {
              baseURL: config.baseURL,
              params: config.params,
              data: config.data,
            },
          );
        }
        return config;
      },
      onResponse: async <T>(response: AxlyResponse<T>) => {
        if (options.logResponses) {
          console.log(`Response: ${response.status} ${response.config.url}`, {
            data: response.data,
            headers: response.headers,
          });
        }
        return response;
      },
      onError: async <T>(error: AxlyError<T>) => {
        if (options.logErrors) {
          console.error(
            `Error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
            {
              status: error.status,
              code: error.code,
              message: error.message,
            },
          );
        }
        return error;
      },
    } as AxlyMiddleware;
  },

  createAuthMiddleware: (
    getToken: () => Promise<string>,
    headerName = "Authorization",
  ) => {
    return {
      onRequest: async (config: AxlyRequestConfig) => {
        const token = await getToken();
        return {
          ...config,
          headers: {
            ...config.headers,
            [headerName]: `Bearer ${token}`,
          },
        };
      },
    } as AxlyMiddleware;
  },

  createErrorHandlerMiddleware: () => {
    return {
      onError: async <T>(error: AxlyError<T>) => {
        const enhancedError = {
          ...error,
          timestamp: new Date().toISOString(),
          isNetworkError: !error.status,
        };
        return enhancedError;
      },
    } as AxlyMiddleware;
  },

  createTransformMiddleware: (
    requestTransformer?: (data: any) => any,
    responseTransformer?: (data: any) => any,
  ) => {
    return {
      onRequest: async (config: AxlyRequestConfig) => {
        if (requestTransformer && config.data) {
          return { ...config, data: requestTransformer(config.data) };
        }
        return config;
      },
      onResponse: async <T>(response: AxlyResponse<T>) => {
        if (responseTransformer && response.data) {
          return { ...response, data: responseTransformer(response.data) };
        }
        return response;
      },
    } as AxlyMiddleware;
  },
};
