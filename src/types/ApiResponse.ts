import { AxlyError } from "./index.js";

export interface ApiResponse<T = unknown> {
  message: string;
  data?: T;
  statusCode?: number;
  success?: boolean;
}

export interface UseAxlyResult<T> {
  data: ApiResponse<T> | undefined;
  isLoading: boolean;
  error: AxlyError | null;
  uploadProgress: number | null;
  downloadProgress: number | null;
  refetch: () => void;
  cancelRequest: () => void;
}
