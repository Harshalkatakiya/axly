import { AxiosResponse } from 'axios';
import { useCallback, useState } from 'react';
import {
  makeRequest as coreMakeRequest,
  RequestOptions
} from './makeRequest.js';
import { ApiResponse } from './types/types.js';

/**
 * Hook to make Axios requests with loading and progress state.
 * @returns An object containing the makeRequest function and state variables.
 */
export const useAxios = () => {
  const [state, setState] = useState({
    isLoading: false,
    uploadProgress: 0,
    downloadProgress: 0
  });

  const makeRequest = useCallback(
    async <T = any>(
      options: RequestOptions
    ): Promise<AxiosResponse<ApiResponse<T>>> => {
      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        const response = await coreMakeRequest<T>({
          ...options,
          onUploadProgress: (progress: number) => {
            options.onUploadProgress?.(progress);
            setState((prev) => ({
              ...prev,
              uploadProgress: progress
            }));
          },
          onDownloadProgress: (progress: number) => {
            options.onDownloadProgress?.(progress);
            setState((prev) => ({
              ...prev,
              downloadProgress: progress
            }));
          }
        });
        setState((prev) => ({ ...prev, isLoading: false }));
        return response;
      } catch (error) {
        setState((prev) => ({ ...prev, isLoading: false }));
        throw error;
      }
    },
    []
  );

  return { makeRequest, ...state };
};
