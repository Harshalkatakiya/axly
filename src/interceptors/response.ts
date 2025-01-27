import { AxiosResponse } from "axios";
import { ApiResponse } from "../types/index.js";

export const responseInterceptor = (
  successToast: boolean = false,
  customToastMessage?: string,
  customToastMessageType: "success" | "error" | "warning" = "success",
  toastHandler?: (
    message: string,
    type: "success" | "error" | "warning",
  ) => void,
) => {
  return (response: AxiosResponse<ApiResponse>) => {
    if (successToast) {
      const message = customToastMessage || response.data.message;
      if (message && toastHandler) {
        toastHandler(message, customToastMessageType);
      }
    }
    return response;
  };
};
