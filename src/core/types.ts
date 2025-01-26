import { AxiosRequestConfig } from "axios";

export interface AxlyRequestConfig extends AxiosRequestConfig {
  contentType?: string;
  customHeaders?: Record<string, string>;
  onUploadProgress?: (progress: number) => void;
  onDownloadProgress?: (progress: number) => void;
}

export interface AxlyResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: any;
  config: AxlyRequestConfig;
}

export interface AxlyError<T = any> extends Error {
  config: AxlyRequestConfig;
  code?: string;
  status?: number;
  response?: AxlyResponse<T>;
  isAxiosError: boolean;
}

export type AxlyMiddleware = {
  onRequest?: (
    config: AxlyRequestConfig,
  ) => AxlyRequestConfig | Promise<AxlyRequestConfig>;
  onResponse?: <T>(
    response: AxlyResponse<T>,
  ) => AxlyResponse<T> | Promise<AxlyResponse<T>>;
  onError?: <T>(error: AxlyError<T>) => AxlyError<T> | Promise<AxlyError<T>>;
};
