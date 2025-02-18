/* global setTimeout, AbortController */

import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { Dispatch, SetStateAction, useState } from "react";

export type CustomToastMessageType =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "custom"
  | string;

export interface ToastHandler {
  (
    message: string,
    type: CustomToastMessageType,
    options?: Record<string, any>,
  ): void;
}

export interface AxlyConfig {
  token: string | null;
  baseURL: string;
  requestInterceptors?: ((
    config: InternalAxiosRequestConfig,
  ) => InternalAxiosRequestConfig)[];
  responseInterceptors?: ((
    response: AxiosResponse<ApiResponse<any>>,
  ) => AxiosResponse<ApiResponse<any>>)[];
  errorHandler?: (
    error: AxiosError<ApiResponse<any>>,
  ) => Promise<
    | AxiosResponse<ApiResponse<any>>
    | PromiseLike<AxiosResponse<ApiResponse<any>>>
  >;
  toastHandler?: ToastHandler;
}

export interface ApiResponse<T = any> {
  message: string;
  data?: T;
}

export type ContentType =
  | "text/html"
  | "text/plain"
  | "multipart/form-data"
  | "application/json"
  | "application/x-www-form-urlencoded"
  | "application/octet-stream"
  | string;

export interface RequestOptions {
  method: AxiosRequestConfig["method"];
  data?: any;
  url: string;
  contentType?: ContentType;
  customHeaders?: Record<string, string>;
  responseType?: AxiosRequestConfig["responseType"];
  params?: Record<string, any>;
  baseURL?: string;
  toastHandler?: ToastHandler;
  successToast?: boolean;
  errorToast?: boolean;
  customToastMessage?: string;
  customToastMessageType?: CustomToastMessageType;
  customErrorToastMessage?: string;
  customErrorToastMessageType?: "error" | "warning" | "custom" | string;
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
};

let globalConfig: AxlyConfig | null = null;

const setAxlyConfig = (config: AxlyConfig) => {
  globalConfig = config;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createAxiosInstance = (
  config: AxlyConfig,
  customBaseURL?: string,
  customHeaders?: Record<string, string>,
  contentType?: ContentType,
): AxiosInstance => {
  const instance = axios.create({
    baseURL: customBaseURL || config.baseURL,
    headers: {
      "Content-Type": contentType || "application/json",
      ...customHeaders,
    },
  });
  config.requestInterceptors?.forEach((interceptor) =>
    instance.interceptors.request.use(interceptor),
  );
  config.responseInterceptors?.forEach((interceptor) =>
    instance.interceptors.response.use(interceptor),
  );
  return instance;
};

const AxlyClient = async <T = object>(
  config: AxlyConfig,
  options: RequestOptions,
  setState: Dispatch<SetStateAction<StateData>>,
  retryCount: number,
): Promise<AxiosResponse<ApiResponse<T>>> => {
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
    customToastMessageType = "success",
    customErrorToastMessage,
    customErrorToastMessageType = "error",
    onUploadProgress,
    onDownloadProgress,
    timeout = 100000,
    retry = 0,
    cancelable = false,
    onCancel,
  } = options;
  setState({ isLoading: true, uploadProgress: 0, downloadProgress: 0 });
  const axiosInstance = createAxiosInstance(
    config,
    baseURL,
    customHeaders,
    contentType,
  );
  const effectiveToastHandler = optionsToastHandler || config.toastHandler;
  const abortController = cancelable ? new AbortController() : undefined;
  if (abortController) {
    setState((prevState) => ({
      ...prevState,
      abortController,
    }));
  }
  axiosInstance.interceptors.request.use(
    async (reqConfig: InternalAxiosRequestConfig) => {
      if (reqConfig.headers && config.token) {
        reqConfig.headers["Authorization"] = `Bearer ${config.token}`;
      }
      reqConfig.timeout = timeout;
      if (cancelable && abortController) {
        reqConfig.signal = abortController.signal;
      }
      return reqConfig;
    },
    (error) => Promise.reject(error),
  );
  axiosInstance.interceptors.response.use(
    (response: AxiosResponse<ApiResponse<T>>) => {
      setState({
        isLoading: false,
        uploadProgress: 0,
        downloadProgress: 0,
        abortController: null,
      });
      if (successToast && effectiveToastHandler) {
        const message = customToastMessage || response.data.message;
        if (message) {
          effectiveToastHandler(message, customToastMessageType);
        }
      }
      return response;
    },
    async (error: AxiosError<ApiResponse<T>>) => {
      setState({
        isLoading: false,
        uploadProgress: 0,
        downloadProgress: 0,
        abortController: null,
      });
      if (retryCount < retry) {
        const delayMs = (retryCount + 1) * 500;
        await delay(delayMs);
        return AxlyClient<T>(config, options, setState, retryCount + 1);
      }
      if (
        (error.name === "CanceledError" || error.code === "ERR_CANCELED") &&
        cancelable
      ) {
        if (onCancel) onCancel();
        return Promise.reject({ canceled: true });
      }
      if (errorToast && effectiveToastHandler) {
        const errorMessage =
          customErrorToastMessage ||
          (error as AxiosError<ApiResponse<T>>).response?.data?.message ||
          "An error occurred";
        effectiveToastHandler(errorMessage, customErrorToastMessageType);
      }
      if (config.errorHandler) {
        return config.errorHandler(error);
      }
      return Promise.reject(
        (error as AxiosError<ApiResponse<T>>).response?.data || error,
      );
    },
  );
  try {
    const response = await axiosInstance({
      method,
      data,
      url,
      params,
      responseType: responseType || "json",
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total || 1),
        );
        setState((prevState) => ({
          ...prevState,
          uploadProgress: percentCompleted,
        }));
        if (onUploadProgress) onUploadProgress(percentCompleted);
      },
      onDownloadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total || 1),
        );
        setState((prevState) => ({
          ...prevState,
          downloadProgress: percentCompleted,
        }));
        if (onDownloadProgress) onDownloadProgress(percentCompleted);
      },
    });
    return response;
  } catch (error) {
    setState({ isLoading: false, uploadProgress: 0, downloadProgress: 0 });
    const axiosError = error as AxiosError<ApiResponse<T>>;
    return Promise.reject(axiosError.response?.data || axiosError);
  }
};

const Axly = () => {
  const [state, setState] = useState<StateData>({
    isLoading: false,
    uploadProgress: 0,
    downloadProgress: 0,
    abortController: null,
  });
  const cancelRequest = () => {
    if (state.abortController) {
      state.abortController.abort();
      setState((prev) => ({
        ...prev,
        abortController: null,
      }));
    }
  };
  const useAxly = async <T = object>(options: RequestOptions) => {
    if (!globalConfig)
      throw new Error(
        "AxlyConfig is not set. Please call setAxlyConfig first.",
      );
    return AxlyClient<T>(globalConfig, options, setState, 0);
  };
  return { useAxly, cancelRequest, ...state };
};

const AxlyNode = () => {
  const state: StateData = {
    isLoading: false,
    uploadProgress: 0,
    downloadProgress: 0,
    abortController: null,
  };
  const cancelRequest = () => {
    if (state.abortController) {
      state.abortController.abort();
      state.abortController = null;
    }
  };
  const useAxly = async <T = object>(options: RequestOptions) => {
    if (!globalConfig)
      throw new Error(
        "AxlyConfig is not set. Please call setAxlyConfig first.",
      );
    return AxlyClient<T>(
      globalConfig,
      options,
      (newState) => {
        Object.assign(state, newState);
      },
      0,
    );
  };
  return { useAxly, cancelRequest, ...state };
};

export { Axly, AxlyNode, setAxlyConfig };
