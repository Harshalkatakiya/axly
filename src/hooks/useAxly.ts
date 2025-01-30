import {
  DependencyList,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { client } from "../AxlyClient.js";
import { ApiResponse, AxlyError, RequestOptions } from "../types/index.js";

const useAxly = <T = any>(
  options: RequestOptions,
  deps: DependencyList = [],
) => {
  const [data, setData] = useState<ApiResponse<T> | undefined>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<AxlyError | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await client.request<T>({
        ...options,
        onUploadProgress: setUploadProgress,
        onDownloadProgress: setDownloadProgress,
      });
      setData(response.data);
    } catch (err) {
      setError(
        err instanceof AxlyError
          ? err
          : new AxlyError("An unexpected error occurred", "UNKNOWN_ERROR"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [options]);
  useEffect(() => {
    fetchData();
  }, [fetchData, ...deps]);
  const cancelRequest = useCallback(() => {
    client.cancelRequest();
  }, []);
  return useMemo(
    () => ({
      data,
      isLoading,
      error,
      uploadProgress,
      downloadProgress,
      refetch: fetchData,
      cancelRequest,
    }),
    [data, isLoading, error, uploadProgress, downloadProgress, fetchData],
  );
};

export default useAxly;
