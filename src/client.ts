/* global AbortController */
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosProgressEvent,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig
} from 'axios';
import {
  AxlyClient,
  AxlyConfig,
  ContentType,
  EventHandler,
  RefreshTokens,
  RequestOptions,
  StateData,
  ToastHandler,
  UploadOptions
} from './types/index.js';
import {
  delay,
  exponentialBackoffWithJitter,
  hasMessageInResponse,
  isBrowser,
  sanitizeToastMessage
} from './utils/index.js';
import { AuthError, CancelledError, RequestError } from './utils/errors.js';
import { Emitter } from './internal/emitter.js';

interface ResponseWithData {
  message: string;
}

interface RefreshResponseData {
  accessToken?: string;
  refreshToken?: string;
}

interface CacheEntry<T> {
  response: AxiosResponse<T>;
  expiresAt: number;
}

class TokenManager {
  private refreshPromise: Promise<RefreshTokens> | null = null;
  constructor(
    private config: AxlyConfig,
    private axiosFactory: () => AxiosInstance,
    private onAccessTokenSet?: (token: string | null) => void
  ) {}
  async refreshTokens(): Promise<RefreshTokens> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.performRefresh();
    try {
      const tokens = await this.refreshPromise;
      return tokens;
    } finally {
      this.refreshPromise = null;
    }
  }
  private async performRefresh(): Promise<RefreshTokens> {
    if (!this.config.refreshEndpoint) {
      throw new AuthError('Refresh endpoint is missing.');
    }
    const refreshToken =
      this.config.tokenCallbacks?.getRefreshToken?.() ??
      this.config.refreshToken;
    if (!refreshToken) {
      throw new AuthError('Refresh token is missing.');
    }
    const instance = this.axiosFactory();
    const resp = await instance.post<RefreshResponseData>(
      this.config.refreshEndpoint,
      { refreshToken },
      { timeout: this.config.refreshTimeout ?? 10000 }
    );
    const { accessToken, refreshToken: newRefreshTokenFromResp } = resp.data;
    const newRefreshToken = newRefreshTokenFromResp ?? refreshToken;
    if (!accessToken)
      throw new AuthError('Refresh response missing access token');
    if (this.config.tokenCallbacks?.setAccessToken) {
      this.config.tokenCallbacks.setAccessToken(accessToken);
    } else {
      this.config.accessToken = accessToken;
    }
    if (this.config.tokenCallbacks?.setRefreshToken) {
      this.config.tokenCallbacks.setRefreshToken(newRefreshToken);
    } else {
      this.config.refreshToken = newRefreshToken;
    }
    this.onAccessTokenSet?.(accessToken);
    this.config.onRefresh?.({ accessToken, refreshToken: newRefreshToken });
    return { accessToken, refreshToken: newRefreshToken };
  }
  clear() {
    this.refreshPromise = null;
  }
}

const isAxlyConfig = (input: unknown): input is AxlyConfig =>
  typeof input === 'object' &&
  input !== null &&
  'baseURL' in input &&
  typeof (input as Record<string, unknown>)['baseURL'] === 'string';

const buildRequestKey = (
  method: string | undefined,
  url: string,
  params: Record<string, string | number | boolean> | undefined,
  configId: string,
  customHeaders?: Record<string, string>
) =>
  `${method?.toUpperCase() ?? 'GET'}:${configId}:${url}:${JSON.stringify(params ?? {})}:${JSON.stringify(customHeaders ?? {})}`;

const resetState: StateData = {
  isLoading: false,
  status: 'idle',
  uploadProgress: 0,
  downloadProgress: 0,
  abortController: null
};

const successState: StateData = {
  isLoading: false,
  status: 'success',
  uploadProgress: 100,
  downloadProgress: 100,
  abortController: null
};

export const createAxlyClient = <
  CM extends Record<string, AxlyConfig> = { default: AxlyConfig }
>(
  configInput: CM | AxlyConfig
): AxlyClient<keyof CM & string> => {
  const configs: CM =
    isAxlyConfig(configInput) ?
      ({ default: configInput as AxlyConfig } as unknown as CM)
    : (configInput as CM);

  type CMKey = keyof CM & string;
  const emitter = new Emitter();
  const axiosInstances: Map<CMKey, AxiosInstance> = new Map();
  const tokenManagers: Map<CMKey, TokenManager> = new Map();
  const applyAccessTokenFunctions: Map<CMKey, (token: string | null) => void> =
    new Map();
  const setDefaultHeaderFunctions: Map<
    CMKey,
    (name: string, value: string | number | boolean | null) => void
  > = new Map();

  // Deduplication: in-flight request promises keyed by dedupe key
  const inflightRequests: Map<string, Promise<AxiosResponse>> = new Map();

  // Cache: stores responses with expiry
  const responseCache: Map<string, CacheEntry<unknown>> = new Map();

  // Periodic cache sweep to evict expired entries
  const cacheSweepInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of responseCache) {
      if ((entry as CacheEntry<unknown>).expiresAt <= now) {
        responseCache.delete(key);
      }
    }
  }, 60_000);

  Object.entries(configs).forEach(([cfgId, config]) => {
    const configId = cfgId as CMKey;
    const axiosInstance = axios.create({ baseURL: config.baseURL });
    config.requestInterceptors?.forEach((interceptor) =>
      axiosInstance.interceptors.request.use(
        interceptor as (
          c: InternalAxiosRequestConfig
        ) => InternalAxiosRequestConfig
      )
    );
    config.responseInterceptors?.forEach((interceptor) =>
      axiosInstance.interceptors.response.use(
        interceptor as (r: AxiosResponse) => AxiosResponse
      )
    );
    axiosInstances.set(configId, axiosInstance);

    const applyAccessToken = (token: string | null) => {
      const defaults = axiosInstance.defaults;
      defaults.headers = defaults.headers ?? {};
      if (token) defaults.headers['Authorization'] = `Bearer ${token}`;
      else
        delete (defaults.headers as Record<string, unknown>)['Authorization'];
    };
    applyAccessTokenFunctions.set(configId, applyAccessToken);

    const tokenManager = new TokenManager(
      config,
      () => axiosInstance,
      applyAccessToken
    );
    tokenManagers.set(configId, tokenManager);

    const setDefaultHeader = (
      name: string,
      value: string | number | boolean | null
    ) => {
      const defaults = axiosInstance.defaults;
      defaults.headers = defaults.headers ?? {};
      if (value == null)
        delete (defaults.headers as Record<string, unknown>)[name];
      else (defaults.headers as Record<string, unknown>)[name] = String(value);
    };
    setDefaultHeaderFunctions.set(configId, setDefaultHeader);

    const initialToken =
      config.multiToken ?
        (config.tokenCallbacks?.getAccessToken?.() ??
        config.accessToken ??
        null)
      : (config.token ?? null);
    applyAccessToken(initialToken);
  });

  const getAccessToken = (
    configId: CMKey = 'default' as CMKey
  ): string | null => {
    const config = configs[configId];
    if (!config) throw new Error(`Config ${configId} not found`);
    return config.multiToken ?
        (config.tokenCallbacks?.getAccessToken?.() ??
          config.accessToken ??
          null)
      : (config.token ?? null);
  };

  const attachAuthHeader = (
    reqConfig: AxiosRequestConfig,
    configId: CMKey = 'default' as CMKey
  ) => {
    const config = configs[configId];
    if (!config) throw new Error(`Config ${configId} not found`);
    const token =
      config.multiToken ? getAccessToken(configId) : (config.token ?? null);
    if (token) {
      reqConfig.headers = reqConfig.headers ?? {};
      reqConfig.headers['Authorization'] = `Bearer ${token}`;
    }
    return reqConfig;
  };

  const performRequest = async <T>(
    cfg: AxiosRequestConfig,
    configId: CMKey = 'default' as CMKey
  ): Promise<AxiosResponse<T>> => {
    const instance = axiosInstances.get(configId);
    if (!instance) throw new Error(`Axios instance for ${configId} not found`);
    return instance.request<T>(cfg);
  };

  const applyStateReset = (
    stateUpdater:
      | ((
          update: Partial<StateData> | ((prev: StateData) => StateData)
        ) => void)
      | undefined,
    status: StateData['status']
  ) => {
    stateUpdater?.(
      status === 'success' ? successState : { ...resetState, status }
    );
  };

  const request = async <T = unknown, D = unknown>(
    options: RequestOptions<D, CMKey>,
    stateUpdater?: (
      update: Partial<StateData> | ((prev: StateData) => StateData)
    ) => void
  ): Promise<AxiosResponse<T>> => {
    const configId = (options.configId ?? ('default' as CMKey)) as CMKey;
    const config = configs[configId];
    if (!config) throw new Error(`Config ${configId} not found`);
    const {
      method,
      data,
      url,
      contentType = 'application/json',
      customHeaders,
      responseType = 'json',
      params,
      baseURL,
      toastHandler: optionsToastHandler,
      successToast = false,
      errorToast = false,
      customToastMessage,
      customToastMessageType = 'success',
      customErrorToastMessage,
      customErrorToastMessageType = 'error',
      onUploadProgress,
      onDownloadProgress,
      timeout = 100000,
      retry = 0,
      cancelable = false,
      onCancel,
      dedupe = false,
      cache = false
    } = options;

    const effectiveToastHandler: ToastHandler | undefined =
      (isBrowser ? (optionsToastHandler ?? config.toastHandler) : undefined) ??
      undefined;

    // Cache lookup (GET-only)
    const isGetMethod = (method ?? 'GET').toUpperCase() === 'GET';
    if (cache && isGetMethod) {
      const cacheKey = buildRequestKey(
        method,
        url,
        params,
        configId,
        customHeaders
      );
      const entry = responseCache.get(cacheKey) as CacheEntry<T> | undefined;
      if (entry) {
        if (entry.expiresAt > Date.now()) {
          return entry.response;
        }
        responseCache.delete(cacheKey);
      }
    }

    // Deduplication: if an identical request is already in-flight, share it
    const shouldDedupe = dedupe || config.dedupeRequests;
    if (shouldDedupe && isGetMethod) {
      const dedupeKey = buildRequestKey(
        method,
        url,
        params,
        configId,
        customHeaders
      );
      const inflight = inflightRequests.get(dedupeKey) as
        | Promise<AxiosResponse<T>>
        | undefined;
      if (inflight) return inflight;
    }

    const abortController = cancelable ? new AbortController() : undefined;
    if (stateUpdater) {
      stateUpdater({
        isLoading: true,
        status: 'loading',
        uploadProgress: 0,
        downloadProgress: 0,
        abortController
      });
    }
    const requestConfig: AxiosRequestConfig = {
      method,
      url,
      data,
      params,
      responseType,
      timeout,
      baseURL,
      headers: {
        'Content-Type': contentType as ContentType,
        ...customHeaders
      },
      onUploadProgress: (progressEvent: AxiosProgressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total || 1)
        );
        if (stateUpdater)
          stateUpdater((prev) => ({
            ...prev,
            uploadProgress: percentCompleted
          }));
        onUploadProgress?.(percentCompleted);
      },
      onDownloadProgress: (progressEvent: AxiosProgressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total || 1)
        );
        if (stateUpdater)
          stateUpdater((prev) => ({
            ...prev,
            downloadProgress: percentCompleted
          }));
        onDownloadProgress?.(percentCompleted);
      }
    };
    if (cancelable && abortController)
      requestConfig.signal = abortController.signal;
    attachAuthHeader(requestConfig, configId);

    const handleSuccess = (response: AxiosResponse<T>) => {
      applyStateReset(stateUpdater, 'success');
      if (successToast && effectiveToastHandler) {
        const msg =
          customToastMessage ??
          (hasMessageInResponse(response.data) ?
            (response.data as ResponseWithData).message
          : undefined);
        if (msg)
          effectiveToastHandler(
            sanitizeToastMessage(msg),
            customToastMessageType
          );
      }
      // Store in cache if requested
      if (cache && isGetMethod) {
        const cacheKey = buildRequestKey(
          method,
          url,
          params,
          configId,
          customHeaders
        );
        const ttl =
          typeof cache === 'object' && cache.ttl != null ? cache.ttl : 300_000; // 5 minutes default
        responseCache.set(cacheKey, {
          response,
          expiresAt: Date.now() + ttl
        } as CacheEntry<unknown>);
      }
      return response;
    };

    const executeWithRetry = async (): Promise<AxiosResponse<T>> => {
      let lastError: AxiosError<T> | null = null;
      for (let attempt = 0; attempt <= retry; attempt++) {
        try {
          const response = await performRequest<T>(requestConfig, configId);
          return handleSuccess(response);
        } catch (err) {
          lastError = err as AxiosError<T>;
          if (axios.isCancel(err)) {
            applyStateReset(stateUpdater, 'idle');
            onCancel?.();
            throw new CancelledError();
          }
          if (attempt < retry) {
            const backoff = exponentialBackoffWithJitter(attempt);
            await delay(backoff);
            continue;
          }
        }
      }
      applyStateReset(stateUpdater, 'error');
      if (lastError) {
        if (errorToast && effectiveToastHandler) {
          const responseData = lastError.response?.data;
          const errorMessage =
            customErrorToastMessage ??
            (hasMessageInResponse(responseData) ?
              (responseData as ResponseWithData).message
            : undefined) ??
            'An error occurred';
          effectiveToastHandler(
            sanitizeToastMessage(errorMessage),
            customErrorToastMessageType
          );
        }
        if (config.errorHandler) {
          try {
            const handled = await config.errorHandler(lastError as AxiosError);
            return handled as AxiosResponse<T>;
          } catch {
            // Ignore errors from the error handler
          }
        }
        throw new RequestError(
          lastError.message || 'Request failed',
          lastError,
          lastError.response ?? null,
          lastError.code ?? null
        );
      }
      throw new RequestError('Request failed');
    };

    const executeRequest = async (): Promise<AxiosResponse<T>> => {
      try {
        return await executeWithRetry();
      } catch (err) {
        // Handle 401 with token refresh — only once, outside the retry loop
        if (
          axios.isAxiosError(err) &&
          err.response?.status === 401 &&
          config.multiToken &&
          config.refreshEndpoint
        ) {
          try {
            const tokenManager = tokenManagers.get(configId);
            if (!tokenManager)
              throw new Error(`Token manager for ${configId} not found`, {
                cause: err
              });
            const tokens = await tokenManager.refreshTokens();
            const applyAccessToken = applyAccessTokenFunctions.get(configId);
            if (!applyAccessToken)
              throw new Error(
                `Apply access token function for ${configId} not found`,
                { cause: err }
              );
            applyAccessToken(tokens.accessToken);
            attachAuthHeader(requestConfig, configId);
            return await executeWithRetry();
          } catch (refreshErr) {
            if (refreshErr instanceof CancelledError) throw refreshErr;
            if (refreshErr instanceof RequestError) throw refreshErr;
            config.onRefreshFail?.(
              refreshErr instanceof Error ? refreshErr : (
                new Error('Refresh failed')
              )
            );
            applyStateReset(stateUpdater, 'error');
            throw new AuthError('Refresh failed; authentication required');
          }
        }
        throw err;
      }
    };

    // Register dedupe promise
    if (shouldDedupe && isGetMethod) {
      const dedupeKey = buildRequestKey(
        method,
        url,
        params,
        configId,
        customHeaders
      );
      const promise = executeRequest().finally(() => {
        inflightRequests.delete(dedupeKey);
      });
      inflightRequests.set(dedupeKey, promise as Promise<AxiosResponse>);
      return promise;
    }

    return executeRequest();
  };

  const upload = async <T = unknown>(
    url: string,
    formData: FormData,
    opts?: UploadOptions<CMKey>
  ): Promise<AxiosResponse<T>> => {
    const configId = (opts?.configId ?? ('default' as CMKey)) as CMKey;
    const instance = axiosInstances.get(configId);
    if (!instance) throw new Error(`Axios instance for ${configId} not found`);
    const {
      headers = {},
      timeout = 120_000,
      onUploadProgress,
      onDownloadProgress,
      baseURL,
      cancelable = false,
      onCancel
    } = opts ?? {};
    const abortController = cancelable ? new AbortController() : undefined;
    const requestConfig: AxiosRequestConfig = {
      method: 'post',
      url,
      data: formData,
      headers: {
        ...headers
      },
      timeout,
      baseURL,
      onUploadProgress: (ev: AxiosProgressEvent) => {
        const percent = Math.round((ev.loaded * 100) / (ev.total || 1));
        onUploadProgress?.(percent);
      },
      onDownloadProgress: (ev: AxiosProgressEvent) => {
        const percent = Math.round((ev.loaded * 100) / (ev.total || 1));
        onDownloadProgress?.(percent);
      }
    };
    if (cancelable && abortController)
      requestConfig.signal = abortController.signal;
    attachAuthHeader(requestConfig, configId);
    const config = configs[configId];
    const performUpload = async (): Promise<AxiosResponse<T>> => {
      try {
        return await instance.request<T>(requestConfig);
      } catch (err) {
        if (axios.isCancel(err)) {
          onCancel?.();
          throw new CancelledError();
        }
        throw err;
      }
    };

    try {
      return await performUpload();
    } catch (err) {
      // Handle 401 with token refresh — one attempt
      if (
        config &&
        axios.isAxiosError(err) &&
        err.response?.status === 401 &&
        config.multiToken &&
        config.refreshEndpoint
      ) {
        try {
          const tokenManager = tokenManagers.get(configId);
          if (!tokenManager) throw err;
          const tokens = await tokenManager.refreshTokens();
          const applyAccessToken = applyAccessTokenFunctions.get(configId);
          if (applyAccessToken) applyAccessToken(tokens.accessToken);
          attachAuthHeader(requestConfig, configId);
          return await performUpload();
        } catch (refreshErr) {
          if (refreshErr instanceof CancelledError) throw refreshErr;
          config.onRefreshFail?.(
            refreshErr instanceof Error ? refreshErr : (
              new Error('Refresh failed')
            )
          );
          throw new AuthError('Refresh failed; authentication required');
        }
      }
      throw err;
    }
  };

  const cancelRequest = (controller?: AbortController | null) => {
    if (controller) controller.abort();
  };

  const clearCache = (configId?: CMKey) => {
    if (configId) {
      const suffix = `:${configId}:`;
      for (const key of responseCache.keys()) {
        if (key.includes(suffix)) responseCache.delete(key);
      }
      for (const key of inflightRequests.keys()) {
        if (key.includes(suffix)) inflightRequests.delete(key);
      }
    } else {
      responseCache.clear();
      inflightRequests.clear();
    }
  };

  const destroy = () => {
    clearInterval(cacheSweepInterval);
    tokenManagers.forEach((tm) => tm.clear());
    axiosInstances.clear();
    tokenManagers.clear();
    applyAccessTokenFunctions.clear();
    setDefaultHeaderFunctions.clear();
    inflightRequests.clear();
    responseCache.clear();
    emitter.emit('destroy');
  };

  const on = (event: string, fn: EventHandler) => emitter.on(event, fn);

  const setAccessToken = (
    token: string | null,
    configId: CMKey = 'default' as CMKey
  ) => {
    const config = configs[configId];
    if (!config) throw new Error(`Config ${configId} not found`);
    if (config.tokenCallbacks?.setAccessToken) {
      config.tokenCallbacks.setAccessToken(token);
    } else {
      config.accessToken = token;
    }
    const applyAccessToken = applyAccessTokenFunctions.get(configId);
    if (applyAccessToken) applyAccessToken(token);
  };

  const setRefreshToken = (
    token: string | null,
    configId: CMKey = 'default' as CMKey
  ) => {
    const config = configs[configId];
    if (!config) throw new Error(`Config ${configId} not found`);
    if (config.tokenCallbacks?.setRefreshToken) {
      config.tokenCallbacks.setRefreshToken(token);
    } else {
      config.refreshToken = token;
    }
  };

  const setAuthorizationHeader = (
    token: string | null,
    configId: CMKey = 'default' as CMKey
  ) => {
    const config = configs[configId];
    if (!config) throw new Error(`Config ${configId} not found`);
    const applyAccessToken = applyAccessTokenFunctions.get(configId);
    if (!applyAccessToken)
      throw new Error(`Apply access token function for ${configId} not found`);
    applyAccessToken(token);
    if (token != null) {
      if (config.multiToken) {
        if (config.tokenCallbacks?.setAccessToken)
          config.tokenCallbacks.setAccessToken(token);
        else config.accessToken = token;
      } else {
        config.token = token;
      }
    } else {
      if (config.multiToken) {
        if (config.tokenCallbacks?.setAccessToken)
          config.tokenCallbacks.setAccessToken(null);
        else config.accessToken = null;
      } else {
        config.token = null;
      }
    }
  };

  const setDefaultHeader = (
    name: string,
    value: string | number | boolean,
    configId: CMKey = 'default' as CMKey
  ) => {
    const fn = setDefaultHeaderFunctions.get(configId);
    if (fn) fn(name, value);
  };

  const clearDefaultHeader = (
    name: string,
    configId: CMKey = 'default' as CMKey
  ) => {
    const fn = setDefaultHeaderFunctions.get(configId);
    if (fn) fn(name, null);
  };

  const client: AxlyClient<CMKey> = {
    request,
    upload,
    setAccessToken,
    setRefreshToken,
    setAuthorizationHeader,
    setDefaultHeader,
    clearDefaultHeader,
    cancelRequest,
    clearCache,
    destroy,
    on
  };
  return client;
};

export const createAxlyNodeClient = <
  CM extends Record<string, AxlyConfig> = { default: AxlyConfig }
>(
  configInput: CM | AxlyConfig
) => {
  const configs =
    isAxlyConfig(configInput) ?
      ({ default: configInput as AxlyConfig } as unknown as CM)
    : (configInput as CM);
  const nodeConfigs: CM = Object.fromEntries(
    Object.entries(configs).map(([k, v]) => [
      k,
      { ...(v as AxlyConfig), toastHandler: undefined }
    ])
  ) as unknown as CM;
  return createAxlyClient<CM>(nodeConfigs);
};
