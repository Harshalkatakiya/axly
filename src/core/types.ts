import { AxiosRequestConfig, AxiosRequestHeaders, AxiosResponse } from 'axios';
import { AxionError } from './AxionError';

export interface AxionRequestConfig extends AxiosRequestConfig {
  retries?: number;
  retryDelay?: number;
  cache?: boolean;
  cacheKey?: string;
  deduplicate?: boolean;
  priority?: number;
  headers?: AxiosRequestHeaders;
}

export interface AxionMiddleware {
  onRequest?: (
    config: AxionRequestConfig
  ) => AxionRequestConfig | Promise<AxionRequestConfig>;
  onResponse?: (
    response: AxiosResponse
  ) => AxiosResponse | Promise<AxiosResponse>;
  onError?: (error: AxionError) => any;
}

export interface AxionAuthConfig {
  token?: string;
  refreshToken?: string;
  tokenHeader?: string;
  refreshTokenUrl?: string;
  onTokenRefresh?: (token: string) => void;
}

export interface AxionRateLimitConfig {
  maxRequests?: number;
  perMilliseconds?: number;
}

export interface AxionPollingConfig {
  interval: number;
  maxAttempts?: number;
  until?: (response: AxiosResponse) => boolean;
}

export interface AxionFetchResult<T = unknown> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  response: AxiosResponse<T> | null;
}

export interface AxionSocketConfig {
  url: string;
  options?: unknown;
}
