import { InternalAxiosRequestConfig } from "axios";
import { isEmpty, isString } from "../utils/index.js";

export const requestInterceptor = (
  token: string | null,
  cancelTokenSource: any,
  timeout: number,
  cancelable: boolean,
) => {
  return async (config: InternalAxiosRequestConfig) => {
    if (isString(token) && !isEmpty(token)) {
      if (config.headers) {
        config.headers["Authorization"] = `Bearer ${token}`;
      }
    }
    config.timeout = timeout;
    if (cancelable) {
      config.cancelToken = cancelTokenSource.token;
    }
    return config;
  };
};
