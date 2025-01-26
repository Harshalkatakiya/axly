import { useEffect, useState } from "react";
import { AxlyClient, AxlyError } from "../core/AxlyClient";
import { AxlyRequestConfig } from "core/types";

export function useAxly<T = any>(
  client: AxlyClient,
  config: AxlyRequestConfig,
) {
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
