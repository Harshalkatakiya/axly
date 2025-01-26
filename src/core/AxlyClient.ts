import axios, {
  AxiosInstance,
  AxiosProgressEvent,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { setupProgress } from "./progress";
import {
  AxlyError,
  AxlyMiddleware,
  AxlyRequestConfig,
  AxlyResponse,
} from "./types";

export class AxlyClient {
  private instance: AxiosInstance;
  private middlewares: AxlyMiddleware[] = [];
  constructor(baseConfig: AxlyRequestConfig = {}) {
    const axiosConfig = this.convertToAxiosConfig(baseConfig);
    this.instance = axios.create(axiosConfig);
  }

  private convertToAxiosConfig(
    config: AxlyRequestConfig,
  ): InternalAxiosRequestConfig {
    const {
      headers: AxiosHeaders = {},
      onUploadProgress,
      onDownloadProgress,
      ...restConfig
    } = config;

    return {
      ...restConfig,
      headers,
      onUploadProgress: onUploadProgress
        ? (progressEvent: AxiosProgressEvent) => {
            const percent = Math.round(
              (progressEvent.loaded * 100) / (progressEvent.total || 1),
            );
            onUploadProgress(percent);
          }
        : undefined,
      onDownloadProgress: onDownloadProgress
        ? (progressEvent: AxiosProgressEvent) => {
            const percent = Math.round(
              (progressEvent.loaded * 100) / (progressEvent.total || 1),
            );
            onDownloadProgress(percent);
          }
        : undefined,
    };
  }

  public addMiddleware(middleware: AxlyMiddleware): void {
    this.middlewares.push(middleware);
  }

  public async request<T>(config: AxlyRequestConfig): Promise<AxlyResponse<T>> {
    try {
      let processedConfig = await this.processRequestConfig(config);
      processedConfig = this.mergeContentType(processedConfig);

      if (
        processedConfig.onUploadProgress ||
        processedConfig.onDownloadProgress
      ) {
        setupProgress(processedConfig);
      }

      const axiosConfig = this.convertToAxiosConfig(processedConfig);
      const response = await this.instance.request<T>(axiosConfig);
      return this.processResponse<T>(response);
    } catch (error) {
      return this.handleError<T>(error as AxlyError<T>);
    }
  }

  public get<T>(
    url: string,
    config?: AxlyRequestConfig,
  ): Promise<AxlyResponse<T>> {
    return this.request<T>({ ...config, method: "GET", url });
  }

  public post<T>(
    url: string,
    data?: any,
    config?: AxlyRequestConfig,
  ): Promise<AxlyResponse<T>> {
    return this.request<T>({ ...config, method: "POST", url, data });
  }

  public put<T>(
    url: string,
    data?: any,
    config?: AxlyRequestConfig,
  ): Promise<AxlyResponse<T>> {
    return this.request<T>({ ...config, method: "PUT", url, data });
  }

  public delete<T>(
    url: string,
    config?: AxlyRequestConfig,
  ): Promise<AxlyResponse<T>> {
    return this.request<T>({ ...config, method: "DELETE", url });
  }

  public patch<T>(
    url: string,
    data?: any,
    config?: AxlyRequestConfig,
  ): Promise<AxlyResponse<T>> {
    return this.request<T>({ ...config, method: "PATCH", url, data });
  }

  private async processRequestConfig(
    config: AxlyRequestConfig,
  ): Promise<AxlyRequestConfig> {
    let processedConfig = { ...config };
    for (const middleware of this.middlewares) {
      if (middleware.onRequest) {
        processedConfig = await middleware.onRequest(processedConfig);
      }
    }
    return processedConfig;
  }

  private async processResponse<T>(
    response: AxiosResponse<T>,
  ): Promise<AxlyResponse<T>> {
    let processedResponse: AxlyResponse<T> = {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string>,
      config: response.config as AxlyRequestConfig,
    };

    for (const middleware of this.middlewares) {
      if (middleware.onResponse) {
        processedResponse = await middleware.onResponse(processedResponse);
      }
    }
    return processedResponse;
  }

  private async handleError<T>(error: AxlyError<T>): Promise<never> {
    let processedError = error;
    for (const middleware of this.middlewares) {
      if (middleware.onError) {
        processedError = (await middleware.onError(
          processedError,
        )) as AxlyError<T>;
      }
    }
    throw processedError;
  }

  private mergeContentType(config: AxlyRequestConfig): AxlyRequestConfig {
    if (config.contentType) {
      return {
        ...config,
        headers: {
          ...config.headers,
          "Content-Type": config.contentType,
        },
      };
    }
    return config;
  }

  public get axiosInstance(): AxiosInstance {
    return this.instance;
  }
}
