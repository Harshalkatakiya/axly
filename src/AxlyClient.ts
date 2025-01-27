import axios, { AxiosError, AxiosResponse } from "axios";
import {
  requestInterceptor,
  responseInterceptor,
} from "./interceptors/index.js";
import { ApiResponse, RequestOptions } from "./types/index.js";
import { isEmpty } from "./utils/index.js";

class AxlyClient {
  private token: string | null = null;
  private cancelTokenSource = axios.CancelToken.source();

  constructor(private baseURL?: string) {}

  setToken(token: string) {
    this.token = token;
  }

  async request<T = any>(
    options: RequestOptions,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    const {
      method,
      data,
      url,
      contentType,
      customHeaders,
      responseType,
      params,
      baseURL,
      successToast = false,
      errorToast = false,
      customToastMessage,
      customErrorToastMessage,
      customToastMessageType = "success",
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
      ),
      responseInterceptor(errorToast, customErrorToastMessage, "error"),
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
      return response;
    } catch (error) {
      const axiosError = error as AxiosError<ApiResponse<T>>;
      if (axios.isCancel(error)) {
        if (onCancel) onCancel();
        throw { canceled: true };
      }
      throw axiosError.response?.data || axiosError;
    }
  }
}

export default AxlyClient;
