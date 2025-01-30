import { InternalAxiosRequestConfig } from "axios";

export const requestInterceptor = (token: string | null) => {
  return async (config: InternalAxiosRequestConfig) => {
    if (token && config.headers) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  };
};
