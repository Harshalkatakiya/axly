import type { AxiosResponse } from 'axios';
import { useEffect, useRef, useState } from 'react';
import type { AxlyClient, RequestOptions, StateData } from '../types';

const useAxly = <C extends string = 'default'>(client: AxlyClient<C>) => {
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
    options: RequestOptions<D, C>
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

export default useAxly;
