import { CancelTokenSource, InternalAxiosRequestConfig } from "axios";

export const requestInterceptor = (
  token: string | null,
  cancelable: boolean,
  cancelTokenSource: CancelTokenSource,
) => {
  return async (config: InternalAxiosRequestConfig) => {
    if (token && config.headers) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    if (cancelable) {
      config.cancelToken = cancelTokenSource.token;
    }
    return config;
  };
};
