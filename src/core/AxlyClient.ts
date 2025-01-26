import axios, { AxiosInstance } from "axios";
import {
  AxlyRequestConfig,
  AxlyResponse,
  AxlyError,
  AxlyMiddleware,
} from "./types";
import { setupProgress } from "./progress";

export class AxlyClient {
  private instance: AxiosInstance;
  private middlewares: AxlyMiddleware[] = [];

  constructor(baseConfig: AxlyRequestConfig = {}) {
    this.instance = axios.create(baseConfig);
  }

  public addMiddleware(middleware: AxlyMiddleware): void {
    this.middlewares.push(middleware);
  }

  public async request<T = any>(
    config: AxlyRequestConfig,
  ): Promise<AxlyResponse<T>> {
    try {
      let processedConfig = await this.processRequestConfig(config);
      processedConfig = this.mergeContentType(processedConfig);

      if (
        processedConfig.onUploadProgress ||
        processedConfig.onDownloadProgress
      ) {
        setupProgress(processedConfig);
      }

      const response = await this.instance.request<T>(processedConfig);
      return await this.processResponse<T>(response);
    } catch (error) {
      return this.handleError<T>(error as AxlyError<T>);
    }
  }

  // Shorthand methods
  public get<T = any>(url: string, config?: AxlyRequestConfig) {
    return this.request<T>({ ...config, method: "GET", url });
  }

  public post<T = any>(url: string, data?: any, config?: AxlyRequestConfig) {
    return this.request<T>({ ...config, method: "POST", url, data });
  }

  // Add other HTTP methods (put, delete, etc)

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
    response: AxlyResponse<T>,
  ): Promise<AxlyResponse<T>> {
    let processedResponse = response;
    for (const middleware of this.middlewares) {
      if (middleware.onResponse) {
        processedResponse = await middleware.onResponse(processedResponse);
      }
    }
    return processedResponse;
  }

  private handleError<T>(error: AxlyError<T>): never {
    let processedError = error;
    for (const middleware of this.middlewares) {
      if (middleware.onError) {
        processedError = middleware.onError(processedError) as AxlyError<T>;
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
}
