import axios, {
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  CancelTokenSource,
  InternalAxiosRequestConfig,
} from "axios";
import { Dispatch, SetStateAction, useState } from "react";

interface ApiResponse<T = any> {
  message: string;
  data?: T;
}

interface ToastHandler {
  (message: string, type: "success" | "error" | "warning"): void;
}

interface RequestOptions {
  method: AxiosRequestConfig["method"];
  data?: any;
  url: string;
  contentType?: string;
  customHeaders?: Record<string, string>;
  responseType?: AxiosRequestConfig["responseType"];
  params?: Record<string, any>;
  baseURL?: string;
  toastHandler?: ToastHandler;
  successToast?: boolean;
  errorToast?: boolean;
  customToastMessage?: string;
  customToastMessageType?: "success" | "error" | "warning";
  customErrorToastMessage?: string;
  customErrorToastMessageType?: "error" | "warning";
  onUploadProgress?: (progress: number) => void;
  onDownloadProgress?: (progress: number) => void;
  timeout?: number;
  retry?: number;
  cancelable?: boolean;
  onCancel?: () => void;
}

interface AxlyConfig {
  token: string | null;
  apiUrl: string;
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

let globalConfig: AxlyConfig | null = null;

const setAxlyConfig = (config: AxlyConfig) => {
  globalConfig = config;
};

const createAxiosInstance = (
  config: AxlyConfig,
  customBaseURL?: string,
  customHeaders?: Record<string, string>,
  contentType?: string,
) => {
  const instance = axios.create({
    baseURL: customBaseURL || config.apiUrl,
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
  setState: Dispatch<
    SetStateAction<{
      isLoading: boolean;
      uploadProgress: number;
      downloadProgress: number;
    }>
  >,
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
    toastHandler,
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
  const cancelTokenSource: CancelTokenSource = axios.CancelToken.source();
  axiosInstance.interceptors.request.use(
    async (reqConfig: InternalAxiosRequestConfig) => {
      if (reqConfig.headers) {
        reqConfig.headers["Authorization"] = `Bearer ${config.token}`;
      }
      reqConfig.timeout = timeout;
      if (cancelable) {
        reqConfig.cancelToken = cancelTokenSource.token;
      }
      return reqConfig;
    },
    (error) => Promise.reject(error),
  );
  axiosInstance.interceptors.response.use(
    (response: AxiosResponse<ApiResponse<T>>) => {
      setState({ isLoading: false, uploadProgress: 0, downloadProgress: 0 });
      if (successToast && toastHandler) {
        const message = customToastMessage || response.data.message;
        if (message) {
          toastHandler(message, customToastMessageType);
        }
      }
      return response;
    },
    async (error: AxiosError<ApiResponse<T>>) => {
      setState({ isLoading: false, uploadProgress: 0, downloadProgress: 0 });
      if (retryCount < retry) {
        return AxlyClient<T>(config, options, setState, retryCount + 1);
      }
      if (axios.isCancel(error)) {
        if (onCancel) onCancel();
        return Promise.reject({ canceled: true });
      }
      if (errorToast && toastHandler) {
        const errorMessage =
          customErrorToastMessage ||
          (error as AxiosError<ApiResponse<T>>).response?.data?.message ||
          "An error occurred";
        toastHandler(errorMessage, customErrorToastMessageType);
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
  const [state, setState] = useState<{
    isLoading: boolean;
    uploadProgress: number;
    downloadProgress: number;
  }>({
    isLoading: false,
    uploadProgress: 0,
    downloadProgress: 0,
  });
  const retryCount = 0;
  const useAxly = async <T = object>(options: RequestOptions) => {
    if (!globalConfig)
      throw new Error(
        "AxlyConfig is not set. Please call setAxlyConfig first.",
      );
    return AxlyClient<T>(globalConfig, options, setState, retryCount);
  };
  return { useAxly, ...state };
};

const AxlyNode = () => {
  const state = {
    isLoading: false,
    uploadProgress: 0,
    downloadProgress: 0,
  };
  const retryCount = 0;
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
      retryCount,
    );
  };
  return { useAxly, ...state };
};

export { Axly, AxlyNode, setAxlyConfig };
