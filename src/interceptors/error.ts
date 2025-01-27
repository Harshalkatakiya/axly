import { AxiosError } from "axios";
import { ApiResponse, AxlyError } from "types";

export const errorInterceptor = (
  errorToast: boolean = false,
  customErrorToastMessage?: string,
  customToastMessageType: "error" | "warning" = "error",
  toastHandler?: (
    message: string,
    type: "success" | "error" | "warning",
  ) => void,
) => {
  return (error: AxiosError<ApiResponse>) => {
    if (errorToast && toastHandler) {
      const message =
        customErrorToastMessage ||
        error.response?.data?.message ||
        "An error occurred";
      toastHandler(message, customToastMessageType);
    }
    throw new AxlyError(
      error.response?.data?.message || "An error occurred",
      error.response?.status?.toString() || "UNKNOWN_ERROR",
      error.response?.data,
    );
  };
};
