import { useCallback, useEffect, useState } from "react";
import { client } from "../AxlyClient.js";
import { AxlyError, RequestOptions } from "../types/index.js";

const useAxly = <T = any>(options: RequestOptions) => {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<AxlyError | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setUploadProgress(null);
    setDownloadProgress(null);

    try {
      const response = await client.request<T>({
        ...options,
        onUploadProgress: (percentCompleted) => {
          setUploadProgress(percentCompleted);
        },
        onDownloadProgress: (percentCompleted) => {
          setDownloadProgress(percentCompleted);
        },
      });

      setData(response.data?.data ?? null);
    } catch (err) {
      if (err instanceof AxlyError) {
        setError(err);
      } else {
        setError(
          new AxlyError("An unexpected error occurred", "UNKNOWN_ERROR"),
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const cancelRequest = useCallback(() => {
    client.cancelRequest();
  }, []);

  return {
    data,
    isLoading,
    error,
    uploadProgress,
    downloadProgress,
    cancelRequest,
  };
};

export default useAxly;
