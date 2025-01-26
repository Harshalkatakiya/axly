import { AxlyError, AxlyRequestConfig } from "core/types";
import { useEffect, useState } from "react";
import { AxlyClient } from "../core/AxlyClient";

export function useAxly<T = any>(
  client: AxlyClient,
  config: AxlyRequestConfig,
): {
  data: T | null;
  isLoading: boolean;
  error: AxlyError | null;
} {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AxlyError | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchData = async () => {
      try {
        const response = await client.request<T>({
          ...config,
          signal: abortController.signal,
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

  return { data, isLoading, error };
}
