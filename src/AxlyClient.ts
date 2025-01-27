import axios, { AxiosError, AxiosResponse, CancelTokenSource } from "axios";
import {
  errorInterceptor,
  requestInterceptor,
  responseInterceptor,
} from "./interceptors/index.js";
import { ApiResponse, AxlyError, RequestOptions } from "./types/index.js";
import { isEmpty } from "./utils/index.js";

class AxlyClient {
  private token: string | null = null;
  private cancelTokenSource: CancelTokenSource = axios.CancelToken.source();
  private baseURL: string;
  private concurrentRequests: number = 0;
  private maxConcurrentRequests: number = 10;
  private toastHandler?: (
    message: string,
    type: "success" | "error" | "warning",
  ) => void;
  constructor(baseURL: string = "") {
    this.baseURL = baseURL;
  }
  setToken(token: string): void {
    this.token = token;
  }
  setMaxConcurrentRequests(max: number): void {
    this.maxConcurrentRequests = max;
  }
  setToastHandler(
    toastHandler: (
      message: string,
      type: "success" | "error" | "warning",
    ) => void,
  ): void {
    this.toastHandler = toastHandler;
  }
  async request<T = any>(
    options: RequestOptions,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    if (this.concurrentRequests >= this.maxConcurrentRequests) {
      throw new AxlyError("Too many concurrent requests", "CONCURRENCY_LIMIT");
    }
    this.concurrentRequests++;
    const {
      method = "GET",
      data,
      url,
      contentType,
      customHeaders,
      responseType,
      params,
      baseURL,
      toastHandler: requestToastHandler,
      successToast = false,
      errorToast = false,
      customToastMessage,
      customErrorToastMessage,
      customToastMessageType = "success",
      customErrorToastMessageType = "error",
      onUploadProgress,
      onDownloadProgress,
      timeout = 100000,
      retry = 0,
      cancelable = false,
      onCancel,
    } = options;
    const instance = axios.create({
      baseURL: baseURL || this.baseURL,
      headers: {
        "Content-Type": isEmpty(contentType) ? "application/json" : contentType,
        ...customHeaders,
      },
    });
    instance.interceptors.request.use(
      requestInterceptor(
        this.token,
        this.cancelTokenSource,
        timeout,
        cancelable,
      ),
    );
    instance.interceptors.response.use(
      responseInterceptor(
        successToast,
        customToastMessage,
        customToastMessageType,
        requestToastHandler || this.toastHandler,
      ),
      errorInterceptor(
        errorToast,
        customErrorToastMessage,
        customErrorToastMessageType,
        requestToastHandler || this.toastHandler,
      ),
    );
    try {
      const response = await instance({
        method,
        data,
        url,
        params,
        responseType: responseType || "json",
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1),
          );
          if (onUploadProgress) onUploadProgress(percentCompleted);
        },
        onDownloadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1),
          );
          if (onDownloadProgress) onDownloadProgress(percentCompleted);
        },
      });
      this.concurrentRequests--;
      return response;
    } catch (error) {
      this.concurrentRequests--;
      if (retry > 0) {
        return this.request({ ...options, retry: retry - 1 });
      }
      const axiosError = error as AxiosError<ApiResponse<T>>;
      if (axios.isCancel(error)) {
        if (onCancel) onCancel();
        throw new AxlyError("Request canceled", "CANCELED");
      }
      throw new AxlyError(
        axiosError.response?.data?.message || "An error occurred",
        axiosError.response?.status?.toString() || "UNKNOWN_ERROR",
        axiosError.response?.data,
      );
    }
  }
  cancelRequest(message: string = "Request canceled by the user"): void {
    this.cancelTokenSource.cancel(message);
    this.cancelTokenSource = axios.CancelToken.source();
  }
}

export default AxlyClient;
