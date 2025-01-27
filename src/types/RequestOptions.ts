import { AxiosRequestConfig } from "axios";

export interface RequestOptions {
  method: AxiosRequestConfig["method"];
  data?: any;
  url: string;
  contentType?: string;
  customHeaders?: Record<string, string>;
  responseType?: AxiosRequestConfig["responseType"];
  params?: Record<string, any>;
  baseURL?: string;
  successToast?: boolean;
  errorToast?: boolean;
  customToastMessage?: string;
  customErrorToastMessage?: string;
  customToastMessageType?: "success" | "error" | "warning";
  onUploadProgress?: (progress: number) => void;
  onDownloadProgress?: (progress: number) => void;
  timeout?: number;
  retry?: number;
  cancelable?: boolean;
  onCancel?: () => void;
}
