import type { AxiosResponse } from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AxlyClient,
  AxlyQueryOptions,
  AxlyQueryResult,
  RequestOptions,
  RequestStatus
} from '../types/index.js';

const useAxlyQuery = <T = unknown, D = unknown, C extends string = 'default'>(
  options: AxlyQueryOptions<T, D, C>
): AxlyQueryResult<T> => {
  const {
    client,
    request,
    enabled = true,
    refetchOnMount = true,
    refetchInterval = false,
    onSuccess,
    onError
  } = options;

  const [data, setData] = useState<AxiosResponse<T> | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState<RequestStatus>('idle');
  const [isFetching, setIsFetching] = useState(false);

  const mountedRef = useRef(true);
  const requestRef = useRef<RequestOptions<D, C>>(request);
  requestRef.current = request;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const fetch = useCallback(async () => {
    if (!mountedRef.current) return;
    setIsFetching(true);
    setStatus('loading');
    try {
      const response = await (client as AxlyClient<C>).request<T, D>(
        requestRef.current
      );
      if (!mountedRef.current) return;
      setData(response);
      setError(null);
      setStatus('success');
      onSuccessRef.current?.(response);
    } catch (err) {
      if (!mountedRef.current) return;
      const normalizedError =
        err instanceof Error ? err : new Error(String(err));
      setError(normalizedError);
      setStatus('error');
      onErrorRef.current?.(normalizedError);
    } finally {
      if (mountedRef.current) setIsFetching(false);
    }
  }, [client]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (refetchOnMount) fetch();
  }, [enabled, refetchOnMount, fetch]);

  useEffect(() => {
    if (!enabled || !refetchInterval) return;
    const id = setInterval(() => {
      fetch();
    }, refetchInterval);
    return () => clearInterval(id);
  }, [enabled, refetchInterval, fetch]);

  const refetch = useCallback(async () => {
    await fetch();
  }, [fetch]);

  return {
    data,
    error,
    status,
    isLoading: status === 'loading',
    isFetching,
    refetch
  };
};

export default useAxlyQuery;
