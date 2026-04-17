import type {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse
} from 'axios';
import axios from 'axios';
import type { AxlyConfig } from '../types/index.js';
import { AuthError, CancelledError, RequestError } from '../utils/errors.js';
import { delay, exponentialBackoffWithJitter } from '../utils/index.js';
import type { TokenManager } from './tokenManager.js';

export interface ExecuteParams {
  instance: AxiosInstance;
  requestConfig: AxiosRequestConfig;
  config: AxlyConfig;
  retry: number;
  tokenManager: TokenManager | null;
  applyAccessToken: ((token: string | null) => void) | null;
  /** Re-attach the Authorization header to `requestConfig` after a token refresh. */
  reapplyAuthHeader: () => void;
  shouldRetry?: (err: AxiosError, attempt: number) => boolean;
  onCancel?: () => void;
}

const defaultShouldRetry = (err: AxiosError): boolean => {
  if (
    err.code === 'ERR_NETWORK' ||
    err.code === 'ECONNABORTED' ||
    err.code === 'ETIMEDOUT'
  )
    return true;
  const status = err.response?.status;
  if (status == null) return true;
  if (status >= 500 && status < 600) return true;
  if (status === 408 || status === 429) return true;
  return false;
};

export const executeRequest = async <T>(
  params: ExecuteParams
): Promise<AxiosResponse<T>> => {
  const {
    instance,
    requestConfig,
    config,
    retry,
    tokenManager,
    applyAccessToken,
    reapplyAuthHeader,
    shouldRetry,
    onCancel
  } = params;

  const predicate = shouldRetry ?? defaultShouldRetry;
  let refreshAttempted = false;
  let lastError: AxiosError<T> | null = null;

  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      return await instance.request<T>(requestConfig);
    } catch (err) {
      if (axios.isCancel(err)) {
        onCancel?.();
        throw new CancelledError();
      }
      const axiosErr = err as AxiosError<T>;
      lastError = axiosErr;

      const is401 = axios.isAxiosError(err) && err.response?.status === 401;
      if (
        is401 &&
        !refreshAttempted &&
        config.multiToken &&
        config.refreshEndpoint &&
        tokenManager &&
        applyAccessToken
      ) {
        refreshAttempted = true;
        try {
          const tokens = await tokenManager.refreshTokens();
          applyAccessToken(tokens.accessToken);
          reapplyAuthHeader();
          attempt = -1;
          continue;
        } catch (refreshErr) {
          if (refreshErr instanceof CancelledError) throw refreshErr;
          if (refreshErr instanceof AuthError) {
            config.onRefreshFail?.(refreshErr);
            throw refreshErr;
          }
          if (refreshErr instanceof RequestError) throw refreshErr;
          config.onRefreshFail?.(
            refreshErr instanceof Error ? refreshErr : (
              new Error('Refresh failed')
            )
          );
          throw new AuthError('Refresh failed; authentication required');
        }
      }

      if (attempt < retry && predicate(axiosErr, attempt)) {
        await delay(exponentialBackoffWithJitter(attempt));
        continue;
      }
      break;
    }
  }

  if (lastError) throw lastError;
  throw new RequestError('Request failed');
};
