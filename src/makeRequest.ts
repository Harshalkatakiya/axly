import { AxiosProgressEvent, AxiosRequestConfig, AxiosResponse } from 'axios';
import { getAxiosInstance } from './axiosInstance.js';
import { ApiResponse } from './types/types.js';

/**
 * Interface for request options.
 */
export interface RequestOptions
  extends Omit<
    AxiosRequestConfig,
    | 'method'
    | 'url'
    | 'data'
    | 'headers'
    | 'onUploadProgress'
    | 'onDownloadProgress'
    | 'signal'
  > {
  /** HTTP method (GET, POST, etc.). */
  method: AxiosRequestConfig['method'];
  /** Request data payload. */
  data?: any;
  /** Request URL. */
  url: string;
  /** Content-Type header value. */
  contentType?: string;
  /** Custom headers for the request. */
  customHeaders?: Record<string, string>;
  /** Indicates the type of data that the server will respond with. */
  responseType?: AxiosRequestConfig['responseType'];
  /** URL parameters to be sent with the request. */
  params?: Record<string, any>;
  /** Override the base URL for this request. */
  baseURL?: string;
  /** Whether the request is cancelable. */
  cancelable?: boolean;
  /** Callback when the request is canceled. */
  onCancel?: () => void;
  /** Callback for upload progress. */
  onUploadProgress?: (progress: number) => void;
  /** Callback for download progress. */
  onDownloadProgress?: (progress: number) => void;
  /** Number of retry attempts for the request. */
  retry?: number;
  /** Request timeout in milliseconds. */
  timeout?: number;
}

/**
 * Makes an HTTP request using Axios.
 * @template T - The expected response data type.
 * @param options - The request options.
 * @returns A promise that resolves to the Axios response.
 */
export const makeRequest = async <T = any>(
  options: RequestOptions
): Promise<AxiosResponse<ApiResponse<T>>> => {
  const instance = getAxiosInstance();
  const {
    retry = 0,
    method,
    data,
    url,
    contentType,
    customHeaders,
    responseType,
    params,
    baseURL,
    timeout,
    cancelable,
    onCancel,
    onUploadProgress,
    onDownloadProgress,
    ...restOptions
  } = options;

  const headers = {
    ...(instance.defaults.headers.common || {}),
    ...(customHeaders || {}),
    ...(contentType ? { 'Content-Type': contentType } : {})
  };

  let controller: AbortController | undefined;

  if (cancelable) {
    controller = new AbortController();
    if (onCancel) {
      controller.signal.addEventListener('abort', onCancel);
    }
  }

  const axiosOptions: AxiosRequestConfig = {
    method,
    url,
    data,
    params,
    baseURL,
    headers,
    responseType,
    timeout,
    signal: controller?.signal,
    onUploadProgress: (progressEvent: AxiosProgressEvent) => {
      const progress =
        progressEvent.progress ? progressEvent.progress * 100 : 0;
      onUploadProgress?.(progress);
    },
    onDownloadProgress: (progressEvent: AxiosProgressEvent) => {
      const progress =
        progressEvent.progress ? progressEvent.progress * 100 : 0;
      onDownloadProgress?.(progress);
    },
    ...restOptions // Include any additional Axios options
  };

  const executeRequest = async (
    attemptsLeft: number
  ): Promise<AxiosResponse<ApiResponse<T>>> => {
    try {
      const response = await instance.request<ApiResponse<T>>(axiosOptions);
      return response;
    } catch (error) {
      if (attemptsLeft > 0) return executeRequest(attemptsLeft - 1);
      throw error;
    }
  };

  return executeRequest(retry);
};
