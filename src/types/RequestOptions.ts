import { AxiosRequestConfig } from "axios";

export interface RequestOptions {
  method: AxiosRequestConfig["method"];
  data?: any;
  url: string;
  contentType?: string;
  customHeaders?: Record<string, string>;
  responseType?: AxiosRequestConfig["responseType"];
  params?: Record<string, unknown>;
  baseURL?: string;
  toastHandler?: (
    message: string,
    type: "success" | "error" | "warning",
  ) => void;
  successToast?: boolean;
  errorToast?: boolean;
  customToastMessage?: string;
  customErrorToastMessage?: string;
  customToastMessageType?: "success" | "error" | "warning";
  customErrorToastMessageType?: "error" | "warning";
  onUploadProgress?: (progress: number) => void;
  onDownloadProgress?: (progress: number) => void;
  cancelable?: boolean;
  onCancel?: () => void;
}
