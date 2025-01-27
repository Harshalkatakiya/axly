import { AxiosResponse } from "axios";
import { ApiResponse } from "../types/index.js";

export const responseInterceptor = (
  successToast: boolean,
  customToastMessage?: string,
  customToastMessageType?: string,
) => {
  return (response: AxiosResponse<ApiResponse>) => {
    if (successToast) {
      if (customToastMessage) {
        // Toast(customToastMessage, customToastMessageType);
      } else if (response.data.message) {
        // Toast(response.data.message, 'success');
      }
    }
    return response;
  };
};
