import {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { AxlyError } from "./types";

export class InterceptorManager {
  private requestInterceptors: number[] = [];
  private responseInterceptors: number[] = [];

  constructor(private axiosInstance: AxiosInstance) {}

  addRequestInterceptor(
    onFulfilled?: (
      config: InternalAxiosRequestConfig,
    ) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>,
    onRejected?: (error: AxlyError) => any,
  ): number {
    const id = this.axiosInstance.interceptors.request.use(
      onFulfilled,
      onRejected,
    );
    this.requestInterceptors.push(id);
    return id;
  }

  addResponseInterceptor(
    onFulfilled?: (
      response: AxiosResponse,
    ) => AxiosResponse | Promise<AxiosResponse>,
    onRejected?: (error: AxlyError) => any,
  ): number {
    const id = this.axiosInstance.interceptors.response.use(
      onFulfilled,
      onRejected,
    );
    this.responseInterceptors.push(id);
    return id;
  }

  removeRequestInterceptor(id: number): void {
    this.axiosInstance.interceptors.request.eject(id);
    this.requestInterceptors = this.requestInterceptors.filter((i) => i !== id);
  }

  removeResponseInterceptor(id: number): void {
    this.axiosInstance.interceptors.response.eject(id);
    this.responseInterceptors = this.responseInterceptors.filter(
      (i) => i !== id,
    );
  }

  clearAllInterceptors(): void {
    this.requestInterceptors.forEach((id) => this.removeRequestInterceptor(id));
    this.responseInterceptors.forEach((id) =>
      this.removeResponseInterceptor(id),
    );
  }

  // Common interceptor presets
  static addContentTypeInterceptor(
    instance: AxiosInstance,
    contentType = "application/json",
  ): void {
    instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      config.headers = config.headers || {};
      config.headers["Content-Type"] = contentType;
      return config;
    });
  }

  static addAuthRefreshInterceptor(
    instance: AxiosInstance,
    refreshTokenCallback: () => Promise<string>,
    headerName = "Authorization",
  ): void {
    let isRefreshing = false;
    let failedQueue: Array<{
      resolve: (value: string | null) => void;
      reject: (reason?: any) => void;
    }> = [];

    const processQueue = (token: string | null, error?: AxlyError) => {
      failedQueue.forEach((prom) => {
        if (error) {
          prom.reject(error);
        } else {
          prom.resolve(token!);
        }
      });
      failedQueue = [];
    };

    instance.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: AxlyError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & {
          _retry?: boolean;
        };

        if (error.response?.status === 401 && !originalRequest._retry) {
          if (isRefreshing) {
            return new Promise<string>((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            })
              .then((token) => {
                if (typeof token === "string") {
                  originalRequest.headers = originalRequest.headers || {};
                  originalRequest.headers[headerName] = `Bearer ${token}`;
                  return instance(originalRequest);
                }
                return Promise.reject(new Error("Invalid token type"));
              })
              .catch((err) => Promise.reject(err));
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
