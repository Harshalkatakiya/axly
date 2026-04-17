import type {
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig
} from 'axios';

export type CustomToastMessageType =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'custom'
  | string;

export type ToastOptions =
  | Record<string, string | number | boolean | undefined>
  | string
  | number
  | undefined;

export type ToastHandler = (
  message: string,
  type?: CustomToastMessageType,
  options?: ToastOptions
) => void;

export interface TokenCallbacks {
  getAccessToken?: () => string | null | undefined;
  setAccessToken?: (token: string | null) => void;
  getRefreshToken?: () => string | null | undefined;
  setRefreshToken?: (token: string | null) => void;
}

export interface RefreshTokens {
  accessToken: string;
  refreshToken: string;
}

export type EventHandler = (...args: unknown[]) => void;

export type RequestStatus = 'idle' | 'loading' | 'success' | 'error';

export type ShouldRetry = (error: AxiosError, attempt: number) => boolean;

export interface CacheOptions {
  ttl?: number;
  /** Additional window (in ms) during which a stale cached response is served while a background refresh runs. */
  staleWhileRevalidate?: number;
}

export interface AxlyConfig {
  multiToken?: boolean;
  token?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  refreshEndpoint?: string;
  baseURL: string;
  /** Auth scheme prefix in the Authorization header. Default `'Bearer'`. Pass `null` or `''` to send the token raw. */
  authScheme?: string | null;
  requestInterceptors?: Array<
    (
      config: InternalAxiosRequestConfig
    ) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>
  >;
  responseInterceptors?: Array<
    (response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>
  >;
  errorHandler?: (err: AxiosError) => Promise<AxiosResponse> | AxiosResponse;
  toastHandler?: ToastHandler;
  tokenCallbacks?: TokenCallbacks;
  refreshTimeout?: number;
  onRefresh?: (tokens: RefreshTokens) => void;
  onRefreshFail?: (err: Error) => void;
  dedupeRequests?: boolean;
  /** Predicate that decides whether to retry a given error. Default: network errors + 5xx + 408 + 429. */
  shouldRetry?: ShouldRetry;
}

export type ContentType =
  | 'text/html'
  | 'text/plain'
  | 'multipart/form-data'
  | 'application/json'
  | 'application/x-www-form-urlencoded'
  | 'application/octet-stream'
  | string;

export interface RequestOptions<D = unknown, C extends string = 'default'> {
  method: AxiosRequestConfig['method'];
  data?: D;
  url: string;
  contentType?: ContentType;
  customHeaders?: Record<string, string>;
  responseType?: AxiosRequestConfig['responseType'];
  params?: Record<string, string | number | boolean>;
  baseURL?: string;
  toastHandler?: ToastHandler;
  successToast?: boolean;
  errorToast?: boolean;
  customToastMessage?: string;
  customToastMessageType?: CustomToastMessageType;
  customErrorToastMessage?: string;
  customErrorToastMessageType?: CustomToastMessageType;
  onUploadProgress?: (progress: number) => void;
  onDownloadProgress?: (progress: number) => void;
  timeout?: number;
  retry?: number;
  cancelable?: boolean;
  onCancel?: () => void;
  configId?: C;
  dedupe?: boolean;
  cache?: boolean | CacheOptions;
  /** Per-request override of the retry predicate. Takes precedence over the config-level `shouldRetry`. */
  shouldRetry?: ShouldRetry;
}

export type StateData = {
  isLoading: boolean;
  status: RequestStatus;
  uploadProgress: number;
  downloadProgress: number;
  abortController?: AbortController | null;
};

export interface UploadOptions<C extends string = 'default'> {
  headers?: Record<string, string>;
  timeout?: number;
  onUploadProgress?: (percent: number) => void;
  onDownloadProgress?: (percent: number) => void;
  baseURL?: string;
  cancelable?: boolean;
  onCancel?: () => void;
  configId?: C;
  retry?: number;
  shouldRetry?: ShouldRetry;
  toastHandler?: ToastHandler;
  successToast?: boolean;
  errorToast?: boolean;
  customToastMessage?: string;
  customToastMessageType?: CustomToastMessageType;
  customErrorToastMessage?: string;
  customErrorToastMessageType?: CustomToastMessageType;
}

export interface InvalidateOptions<C extends string = 'default'> {
  configId?: C;
  url?: string | RegExp;
  predicate?: (key: string) => boolean;
}

export interface AxlyClient<C extends string = 'default'> {
  request<T = unknown, D = unknown>(
    options: RequestOptions<D, C>,
    stateUpdater?: (
      update: Partial<StateData> | ((prev: StateData) => StateData)
    ) => void
  ): Promise<AxiosResponse<T>>;
  upload<T = unknown>(
    url: string,
    formData: FormData,
    opts?: UploadOptions<C>
  ): Promise<AxiosResponse<T>>;
  setAccessToken(token: string | null, configId?: C): void;
  setRefreshToken(token: string | null, configId?: C): void;
  setDefaultHeader(
    name: string,
    value: string | number | boolean,
    configId?: C
  ): void;
  clearDefaultHeader(name: string, configId?: C): void;
  cancelRequest(controller?: AbortController | null): void;
  invalidate(options?: InvalidateOptions<C>): void;
  destroy(): void;
  on(event: string, handler: (...args: unknown[]) => void): () => void;
}

export interface AxlyQueryOptions<
  T = unknown,
  D = unknown,
  C extends string = 'default'
> {
  client: AxlyClient<C>;
  request: RequestOptions<D, C>;
  enabled?: boolean;
  refetchOnMount?: boolean;
  refetchInterval?: number | false;
  onSuccess?: (data: AxiosResponse<T>) => void;
  onError?: (error: Error) => void;
}

export interface AxlyQueryResult<T = unknown> {
  data: AxiosResponse<T> | null;
  error: Error | null;
  status: RequestStatus;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => Promise<void>;
}

export interface AxlyMutationOptions<
  T = unknown,
  C extends string = 'default'
> {
  client: AxlyClient<C>;
  onSuccess?: (data: AxiosResponse<T>) => void;
  onError?: (error: Error) => void;
  onSettled?: (data: AxiosResponse<T> | null, error: Error | null) => void;
}

export interface AxlyMutationResult<
  T = unknown,
  D = unknown,
  C extends string = 'default'
> {
  mutate: (options: RequestOptions<D, C>) => void;
  mutateAsync: (options: RequestOptions<D, C>) => Promise<AxiosResponse<T>>;
  isPending: boolean;
  data: AxiosResponse<T> | null;
  error: Error | null;
  status: RequestStatus;
  reset: () => void;
}
