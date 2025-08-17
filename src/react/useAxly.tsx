import type { AxiosResponse } from 'axios';
import { useEffect, useRef, useState } from 'react';
import type { RequestOptions, StateData } from '../types';

export const useAxly = (
  client: ReturnType<typeof import('../client').createAxlyClient>
) => {
  const mountedRef = useRef(true);
  const [state, setState] = useState<StateData>({
    isLoading: false,
    uploadProgress: 0,
    downloadProgress: 0,
    abortController: null
  });
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const request = async <T = unknown, D = unknown>(
    options: RequestOptions<D>
  ): Promise<AxiosResponse<T>> => {
    const wrappedUpdater = (
      update: Partial<StateData> | ((prev: StateData) => StateData)
    ) => {
      if (!mountedRef.current) return;
      if (typeof update === 'function') {
        setState((prev) => (update as (prev: StateData) => StateData)(prev));
      } else {
        setState((prev) => ({ ...prev, ...update }));
      }
    };
    return client.request<T, D>(options, wrappedUpdater);
  };
  const cancel = () => {
    if (state.abortController) {
      state.abortController.abort();
      setState((prev) => ({ ...prev, abortController: null }));
    }
  };
  return { request, cancelRequest: cancel, ...state };
};
