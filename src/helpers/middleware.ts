import {
  AxlyError,
  AxlyMiddleware,
  AxlyRequestConfig,
  AxlyResponse,
} from "../core/types";

export const MiddlewareHelpers = {
  createLoggerMiddleware: (
    options = { logRequests: true, logResponses: true, logErrors: true },
  ): AxlyMiddleware => {
    return {
      onRequest: async (
        config: AxlyRequestConfig,
      ): Promise<AxlyRequestConfig> => {
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

      onResponse: async <T>(
        response: AxlyResponse<T>,
      ): Promise<AxlyResponse<T>> => {
        if (options.logResponses) {
          console.log(`Response: ${response.status} ${response.config.url}`, {
            data: response.data,
            headers: response.headers,
          });
        }
        return response;
      },

      onError: async <T>(error: AxlyError<T>): Promise<AxlyError<T>> => {
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
    };
  },

  createAuthMiddleware: (
    getToken: () => Promise<string>,
    headerName = "Authorization",
  ): AxlyMiddleware => {
    return {
      onRequest: async (
        config: AxlyRequestConfig,
      ): Promise<AxlyRequestConfig> => {
        const token = await getToken();
        return {
          ...config,
          headers: {
            ...config.headers,
            [headerName]: `Bearer ${token}`,
          },
        };
      },
    };
  },

  createErrorHandlerMiddleware: (): AxlyMiddleware => {
    return {
      onError: async <T>(error: AxlyError<T>): Promise<AxlyError<T>> => {
        const enhancedError = {
          ...error,
          timestamp: new Date().toISOString(),
          isNetworkError: !error.status,
        };
        return enhancedError;
      },
    };
  },

  createTransformMiddleware: (
    requestTransformer?: (data: any) => any,
    responseTransformer?: (data: any) => any,
  ): AxlyMiddleware => {
    return {
      onRequest: async (
        config: AxlyRequestConfig,
      ): Promise<AxlyRequestConfig> => {
        if (requestTransformer && config.data) {
          return { ...config, data: requestTransformer(config.data) };
        }
        return config;
      },

      onResponse: async <T>(
        response: AxlyResponse<T>,
      ): Promise<AxlyResponse<T>> => {
        if (responseTransformer && response.data) {
          return { ...response, data: responseTransformer(response.data) };
        }
        return response;
      },
    };
  },
};
