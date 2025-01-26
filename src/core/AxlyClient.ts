import axios, {
  AxiosHeaders,
  AxiosInstance,
  AxiosProgressEvent,
  AxiosResponse,
} from "axios";
import {
  AxlyError,
  AxlyMiddleware,
  AxlyRequestConfig,
  AxlyResponse,
} from "./types";

export class AxlyClient {
  private instance: AxiosInstance;
  private middlewares: AxlyMiddleware[] = [];
  private headers: AxiosHeaders = new AxiosHeaders();
  private uploadProgressPercentage: number = 0;
  private downloadProgressPercentage: number = 0;
  constructor(baseConfig: AxlyRequestConfig = {}) {
    const axiosConfig = this.convertToAxiosConfig(baseConfig);
    this.instance = axios.create(axiosConfig);
  }
  public get uploadProgress(): number {
    return this.uploadProgressPercentage;
  }

  public get downloadProgress(): number {
    return this.downloadProgressPercentage;
  }
  private calculateProgress(progressEvent: AxiosProgressEvent): number {
    if (!progressEvent.total) {
      return 0; // Avoid division by zero
    }
    return Math.round((progressEvent.loaded * 100) / progressEvent.total);
  }

  public addMiddleware(middleware: AxlyMiddleware): void {
    this.middlewares.push(middleware);
  }

  public async request<T>(config: AxlyRequestConfig): Promise<AxlyResponse<T>> {
    try {
      const { onUploadProgress, onDownloadProgress, ...axiosConfig } = config;
      if (onUploadProgress) {
        axiosConfig.onUploadProgress = (progressEvent: AxiosProgressEvent) => {
          this.uploadProgressPercentage = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1),
          );
          onUploadProgress(this.uploadProgressPercentage);
        };
      }
      if (onDownloadProgress) {
        axiosConfig.onDownloadProgress = (
          progressEvent: AxiosProgressEvent,
        ) => {
          this.downloadProgressPercentage = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1),
          );
          onDownloadProgress(this.downloadProgressPercentage);
        };
      }

      const response: AxiosResponse<T> =
        await this.instance.request<T>(axiosConfig);
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
