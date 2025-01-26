import { useEffect, useState } from "react";
import { AxlyClient } from "../core/AxlyClient";
import { AxlyError, AxlyRequestConfig } from "../core/types";

export function useAxly<T = any>(
  client: AxlyClient,
  config: AxlyRequestConfig,
) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AxlyError | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchData = async () => {
      try {
        const response = await client.request<T>({
          ...config,
          signal: abortController.signal,
          onUploadProgress: (progress: number) => setUploadProgress(progress),
          onDownloadProgress: (progress: number) =>
            setDownloadProgress(progress),
        });
        setData(response.data);
      } catch (err) {
        if (!abortController.signal.aborted) {
          setError(err as AxlyError);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      abortController.abort();
    };
  }, [client, config]);

  return { data, isLoading, error, uploadProgress, downloadProgress };
}
