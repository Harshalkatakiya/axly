import { AxiosResponse } from "axios";
import { DependencyList, useCallback, useEffect, useState } from "react";
import { client } from "../AxlyClient.js";
import {
  ApiResponse,
  AxlyError,
  RequestOptions,
  UseAxlyResult,
} from "../types/index.js";

const useAxly = async <T = unknown>(
  options: RequestOptions,
  deps: DependencyList = [],
): Promise<UseAxlyResult<T>> => {
  const [data, setData] = useState<AxiosResponse<ApiResponse<T>> | undefined>(
    undefined,
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<AxlyError | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await client.request({
        ...options,
        onUploadProgress: setUploadProgress,
        onDownloadProgress: setDownloadProgress,
      });
      setData(response as AxiosResponse<ApiResponse<T>>);
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
  return {
    data,
    isLoading,
    error,
    uploadProgress,
    downloadProgress,
    refetch: fetchData,
    cancelRequest,
  };
};

export default useAxly;
