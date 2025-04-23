/* global setTimeout, AbortController */
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosProgressEvent,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig
} from 'axios';
import { Dispatch, SetStateAction, useState } from 'react';

export type CustomToastMessageType =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'custom'
  | string;

export interface ToastHandler {
  (
    message: string,
    type: CustomToastMessageType,
    options?: Record<string, unknown>
  ): void;
}

export interface AxlyConfig {
  token?: string | null;
  baseURL: string;
  requestInterceptors?: ((
    config: InternalAxiosRequestConfig
  ) => InternalAxiosRequestConfig)[];
  responseInterceptors?: ((
    response: AxiosResponse<unknown>
  ) => AxiosResponse<unknown>)[];
  errorHandler?: (
    error: AxiosError<unknown>
  ) => Promise<AxiosResponse<unknown> | PromiseLike<AxiosResponse<unknown>>>;
  toastHandler?: ToastHandler;
}

export type ContentType =
  | 'text/html'
  | 'text/plain'
  | 'multipart/form-data'
  | 'application/json'
  | 'application/x-www-form-urlencoded'
  | 'application/octet-stream'
  | string;

export interface RequestOptions<D = unknown> {
  method: AxiosRequestConfig['method'];
  data?: D;
  url: string;
  contentType?: ContentType;
  customHeaders?: Record<string, string>;
  responseType?: AxiosRequestConfig['responseType'];
  params?: Record<string, string | number | boolean>;
  baseURL?: string;
  toastHandler?: ToastHandler;
  successToast?: boolean;
  errorToast?: boolean;
  customToastMessage?: string;
  customToastMessageType?: CustomToastMessageType;
  customErrorToastMessage?: string;
  customErrorToastMessageType?: 'error' | 'warning' | 'custom' | string;
  onUploadProgress?: (progress: number) => void;
  onDownloadProgress?: (progress: number) => void;
  timeout?: number;
  retry?: number;
  cancelable?: boolean;
  onCancel?: () => void;
}

type StateData = {
  isLoading: boolean;
  uploadProgress: number;
  downloadProgress: number;
  abortController?: AbortController | null;
  data: unknown | null;
  error: Error | AxiosError | null;
};

let globalConfig: AxlyConfig | null = null;

const setAxlyConfig = (config: AxlyConfig): void => {
  globalConfig = config;
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const createAxiosInstance = (
  config: AxlyConfig,
  customBaseURL?: string,
  customHeaders?: Record<string, string>,
  contentType?: ContentType
): AxiosInstance => {
  const instance = axios.create({
    baseURL: customBaseURL || config.baseURL,
    headers: {
      'Content-Type': contentType || 'application/json',
      ...customHeaders
    }
  });
  config.requestInterceptors?.forEach((interceptor) =>
    instance.interceptors.request.use(interceptor)
  );
  config.responseInterceptors?.forEach((interceptor) =>
    instance.interceptors.response.use(interceptor)
  );
  return instance;
};

const hasMessageInResponse = (
  data: unknown
): data is Record<string, unknown> & { message?: string } => {
  return typeof data === 'object' && data !== null && 'message' in data;
};

const AxlyClient = async <T = unknown, D = unknown>(
  config: AxlyConfig,
  options: RequestOptions<D>,
  setState: Dispatch<SetStateAction<StateData>>,
  retryCount: number
): Promise<AxiosResponse<T>> => {
  const {
    method,
    data,
    url,
    contentType,
    customHeaders,
    responseType,
    params,
    baseURL,
    toastHandler: optionsToastHandler,
    successToast = false,
    errorToast = false,
    customToastMessage,
    customToastMessageType = 'success',
    customErrorToastMessage,
    customErrorToastMessageType = 'error',
    onUploadProgress,
    onDownloadProgress,
    timeout = 100000,
    retry = 0,
    cancelable = false,
    onCancel
  } = options;
  setState({
    isLoading: true,
    uploadProgress: 0,
    downloadProgress: 0,
    data: null,
    error: null
  });
  const axiosInstance = createAxiosInstance(
    config,
    baseURL,
    customHeaders,
    contentType
  );
  const effectiveToastHandler = optionsToastHandler || config.toastHandler;
  const abortController = cancelable ? new AbortController() : undefined;
  if (abortController) {
    setState((prevState) => ({
      ...prevState,
      abortController
    }));
  }
  axiosInstance.interceptors.request.use(
    async (reqConfig: InternalAxiosRequestConfig) => {
      if (reqConfig.headers && config.token) {
        reqConfig.headers['Authorization'] = `Bearer ${config.token}`;
      }
      reqConfig.timeout = timeout;
      if (cancelable && abortController) {
        reqConfig.signal = abortController.signal;
      }
      return reqConfig;
    },
    (error) => Promise.reject(error)
  );
  axiosInstance.interceptors.response.use(
    (response: AxiosResponse<T>) => {
      setState({
        isLoading: false,
        uploadProgress: 0,
        downloadProgress: 0,
        abortController: null,
        data: response.data,
        error: null
      });
      if (successToast && effectiveToastHandler) {
        const message =
          customToastMessage ||
          (hasMessageInResponse(response.data) ?
            response.data.message
          : undefined);
        if (message) {
          effectiveToastHandler(message, customToastMessageType);
        }
      }
      return response;
    },
    async (error: AxiosError<T>) => {
      setState({
        isLoading: false,
        uploadProgress: 0,
        downloadProgress: 0,
        abortController: null,
        data: null,
        error: error
      });
      if (retryCount < retry) {
        const delayMs = (retryCount + 1) * 500;
        await delay(delayMs);
        return AxlyClient<T, D>(config, options, setState, retryCount + 1);
      }
      if (
        (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') &&
        cancelable
      ) {
        if (onCancel) onCancel();
        return Promise.reject({ canceled: true });
      }
      if (errorToast && effectiveToastHandler) {
        const errorMessage =
          customErrorToastMessage ||
          (hasMessageInResponse(error.response?.data) ?
            error.response?.data?.message
          : undefined) ||
          'An error occurred';
        effectiveToastHandler(errorMessage, customErrorToastMessageType);
      }
      if (config.errorHandler) {
        return config.errorHandler(error) as Promise<AxiosResponse<T>>;
      }
      return Promise.reject(error.response?.data || error);
    }
  );
  try {
    const response = await axiosInstance({
      method,
      data,
      url,
      params,
      responseType: responseType || 'json',
      onUploadProgress: (progressEvent: AxiosProgressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total || 1)
        );
        setState((prevState) => ({
          ...prevState,
          uploadProgress: percentCompleted
        }));
        if (onUploadProgress) onUploadProgress(percentCompleted);
      },
      onDownloadProgress: (progressEvent: AxiosProgressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total || 1)
        );
        setState((prevState) => ({
          ...prevState,
          downloadProgress: percentCompleted
        }));
        if (onDownloadProgress) onDownloadProgress(percentCompleted);
      }
    });
    return response as AxiosResponse<T>;
  } catch (error) {
    const axiosError = error as AxiosError<T>;
    return Promise.reject(axiosError.response?.data || axiosError);
  }
};

const useAxly = () => {
  const [state, setState] = useState<StateData>({
    isLoading: false,
    uploadProgress: 0,
    downloadProgress: 0,
    abortController: null,
    data: null,
    error: null
  });
  const cancelRequest = () => {
    if (state.abortController) {
      state.abortController.abort();
      setState((prev) => ({
        ...prev,
        abortController: null
      }));
    }
  };
  const request = async <T = unknown, D = unknown>(
    options: RequestOptions<D>,
    overrideConfig?: AxlyConfig
  ): Promise<AxiosResponse<T>> => {
    const effectiveConfig = overrideConfig || globalConfig;
    if (!effectiveConfig)
      throw new Error(
        'AxlyConfig is not set. Please call setAxlyConfig first or pass a setAxlyConfig parameter to the request function.'
      );
    setState((prev) => ({ ...prev, isLoading: true, error: null, data: null }));
    try {
      const response = await AxlyClient<T, D>(
        effectiveConfig,
        options,
        setState,
        0
      );
      setState((prev) => ({ ...prev, data: response.data, error: null }));
      return response;
    } catch (error) {
      const axiosError = error as AxiosError;
      setState((prev) => ({ ...prev, error: axiosError, data: null }));
      throw error;
    }
  };
  return {
    request,
    cancelRequest,
    data: state.data,
    error: state.error,
    isLoading: state.isLoading,
    uploadProgress: state.uploadProgress,
    downloadProgress: state.downloadProgress
  };
};

const axlyNode = () => {
  const state: StateData = {
    isLoading: false,
    uploadProgress: 0,
    downloadProgress: 0,
    abortController: null,
    data: null,
    error: null
  };
  const cancelRequest = (): void => {
    if (state.abortController) {
      state.abortController.abort();
      state.abortController = null;
    }
  };
  const request = async <T = unknown, D = unknown>(
    options: RequestOptions<D>,
    overrideConfig?: AxlyConfig
  ): Promise<AxiosResponse<T>> => {
    const effectiveConfig = overrideConfig || globalConfig;
    if (!effectiveConfig)
      throw new Error(
        'AxlyConfig is not set. Please call setAxlyConfig first or pass a setAxlyConfig parameter to the request function.'
      );
    Object.assign(state, { isLoading: true, error: null, data: null });
    try {
      const response = await AxlyClient<T, D>(
        effectiveConfig,
        options,
        (newState) => Object.assign(state, newState),
        0
      );
      Object.assign(state, { data: response.data, error: null });
      return response;
    } catch (error) {
      const axiosError = error as AxiosError;
      Object.assign(state, { error: axiosError, data: null });
      throw error;
    }
  };
  return {
    request,
    cancelRequest,
    data: state.data,
    error: state.error,
    isLoading: state.isLoading,
    uploadProgress: state.uploadProgress,
    downloadProgress: state.downloadProgress
  };
};

export { axlyNode, setAxlyConfig };
export default useAxly;
