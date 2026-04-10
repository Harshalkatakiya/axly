import type { AxiosResponse } from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AxlyMutationOptions,
  AxlyMutationResult,
  RequestOptions,
  RequestStatus
} from '../types/index.js';

const useAxlyMutation = <
  T = unknown,
  D = unknown,
  C extends string = 'default'
>(
  options: AxlyMutationOptions<T, D, C>
): AxlyMutationResult<T, D, C> => {
  const { client, onSuccess, onError, onSettled } = options;

  const [data, setData] = useState<AxiosResponse<T> | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState<RequestStatus>('idle');

  const mountedRef = useRef(true);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const mutateAsync = useCallback(
    async (requestOptions: RequestOptions<D, C>): Promise<AxiosResponse<T>> => {
      setStatus('loading');
      setError(null);
      try {
        const response = await client.request<T, D>(requestOptions);
        if (mountedRef.current) {
          setData(response);
          setStatus('success');
        }
        onSuccessRef.current?.(response);
        onSettledRef.current?.(response, null);
        return response;
      } catch (err) {
        const normalizedError =
          err instanceof Error ? err : new Error(String(err));
        if (mountedRef.current) {
          setError(normalizedError);
          setStatus('error');
        }
        onErrorRef.current?.(normalizedError);
        onSettledRef.current?.(null, normalizedError);
        throw normalizedError;
      }
    },
    [client]
  );

  const mutate = useCallback(
    (requestOptions: RequestOptions<D, C>) => {
      mutateAsync(requestOptions).catch(() => {
        // errors are stored in state; fire-and-forget is intentional
      });
    },
    [mutateAsync]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setStatus('idle');
  }, []);

  return {
    mutate,
    mutateAsync,
    isPending: status === 'loading',
    data,
    error,
    status,
    reset
  };
};

export default useAxlyMutation;
