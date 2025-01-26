import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { AxlyError, AxlyRequestConfig, AxlyResponse } from "./types";

export class InterceptorManager {
  private requestInterceptors: number[] = [];
  private responseInterceptors: number[] = [];

  constructor(private axiosInstance: AxiosInstance) {}

  addRequestInterceptor(
    onFulfilled?: (
      config: AxlyRequestConfig,
    ) => AxlyRequestConfig | Promise<AxlyRequestConfig>,
    onRejected?: (error: AxlyError) => any,
  ) {
    const id = this.axiosInstance.interceptors.request.use(
      onFulfilled as (
        config: AxiosRequestConfig,
      ) => AxiosRequestConfig | Promise<AxiosRequestConfig>,
      onRejected,
    );
    this.requestInterceptors.push(id);
    return id;
  }

  addResponseInterceptor(
    onFulfilled?: (
      response: AxlyResponse,
    ) => AxlyResponse | Promise<AxlyResponse>,
    onRejected?: (error: AxlyError) => any,
  ) {
    const id = this.axiosInstance.interceptors.response.use(
      onFulfilled as (
        response: AxiosResponse,
      ) => AxiosResponse | Promise<AxiosResponse>,
      onRejected,
    );
    this.responseInterceptors.push(id);
    return id;
  }

  removeRequestInterceptor(id: number) {
    this.axiosInstance.interceptors.request.eject(id);
    this.requestInterceptors = this.requestInterceptors.filter((i) => i !== id);
  }

  removeResponseInterceptor(id: number) {
    this.axiosInstance.interceptors.response.eject(id);
    this.responseInterceptors = this.responseInterceptors.filter(
      (i) => i !== id,
    );
  }

  clearAllInterceptors() {
    this.requestInterceptors.forEach((id) => this.removeRequestInterceptor(id));
    this.responseInterceptors.forEach((id) =>
      this.removeResponseInterceptor(id),
    );
  }

  // Common interceptor presets
  static addContentTypeInterceptor(
    instance: AxiosInstance,
    contentType = "application/json",
  ) {
    return instance.interceptors.request.use((config) => ({
      ...config,
      headers: {
        ...config.headers,
        "Content-Type": contentType,
      },
    }));
  }

  static addAuthRefreshInterceptor(
    instance: AxiosInstance,
    refreshTokenCallback: () => Promise<string>,
    headerName = "Authorization",
  ) {
    let isRefreshing = false;
    let failedQueue: ((token: string) => void)[] = [];

    const processQueue = (token: string | null, error?: AxlyError) => {
      failedQueue.forEach((prom) => {
        if (error) {
          prom.reject(error);
        } else {
          prom(token!);
        }
      });
      failedQueue = [];
    };

    return instance.interceptors.response.use(
      (response) => response,
      async (error: AxlyError) => {
        const originalRequest = error.config;

        if (error.status === 401 && !originalRequest._retry) {
          if (isRefreshing) {
            return new Promise((resolve, reject) => {
              failedQueue.push((token: string) => {
                originalRequest.headers[headerName] = `Bearer ${token}`;
                resolve(instance(originalRequest));
              });
            });
          }

          originalRequest._retry = true;
          isRefreshing = true;

          try {
            const newToken = await refreshTokenCallback();
            instance.defaults.headers.common[headerName] = `Bearer ${newToken}`;
            processQueue(newToken);
            return instance(originalRequest);
          } catch (err) {
            processQueue(null, err as AxlyError);
            return Promise.reject(err);
          } finally {
            isRefreshing = false;
          }
        }

        return Promise.reject(error);
      },
    );
  }
}
