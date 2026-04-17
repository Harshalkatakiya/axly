/* global AbortController, FormData */
import axios, {
  AxiosHeaders,
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
  InvalidateOptions,
  RequestOptions,
  StateData,
  ToastHandler,
  UploadOptions
} from './types/index.js';
import {
  hasMessageInResponse,
  isBrowser,
  sanitizeToastMessage
} from './utils/index.js';
import { AuthError, CancelledError, RequestError } from './utils/errors.js';
import { Emitter } from './internal/emitter.js';
import { TokenManager } from './internal/tokenManager.js';
import { CacheStore } from './internal/cache.js';
import { InflightMap } from './internal/deduper.js';
import { buildRequestKey } from './internal/requestKey.js';
import { executeRequest } from './internal/executor.js';

interface ResponseWithData {
  message: string;
}

interface ConfigRuntime {
  config: AxlyConfig;
  instance: AxiosInstance;
  tokenManager: TokenManager;
  applyAccessToken: (token: string | null) => void;
  setDefaultHeader: (
    name: string,
    value: string | number | boolean | null
  ) => void;
}

const isAxlyConfig = (input: unknown): input is AxlyConfig =>
  typeof input === 'object' &&
  input !== null &&
  'baseURL' in input &&
  typeof (input as Record<string, unknown>)['baseURL'] === 'string';

const normalizeConfigs = <CM extends Record<string, AxlyConfig>>(
  configInput: CM | AxlyConfig
): CM =>
  isAxlyConfig(configInput) ?
    ({ default: configInput as AxlyConfig } as unknown as CM)
  : (configInput as CM);

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

const formatAuthHeaderValue = (
  token: string,
  scheme: string | null | undefined
): string => {
  if (scheme == null || scheme === '') return token;
  return `${scheme} ${token}`;
};

export const createAxlyClient = <
  CM extends Record<string, AxlyConfig> = { default: AxlyConfig }
>(
  configInput: CM | AxlyConfig
): AxlyClient<keyof CM & string> => {
  const configs: CM = normalizeConfigs<CM>(configInput);
  type CMKey = keyof CM & string;

  const emitter = new Emitter();
  const cache = new CacheStore();
  const deduper = new InflightMap();
  const runtimes: Map<CMKey, ConfigRuntime> = new Map();

  Object.entries(configs).forEach(([cfgId, config]) => {
    const configId = cfgId as CMKey;
    const instance = axios.create({ baseURL: config.baseURL });

    config.requestInterceptors?.forEach((interceptor) =>
      instance.interceptors.request.use(
        interceptor as (
          c: InternalAxiosRequestConfig
        ) => InternalAxiosRequestConfig
      )
    );
    config.responseInterceptors?.forEach((interceptor) =>
      instance.interceptors.response.use(
        interceptor as (r: AxiosResponse) => AxiosResponse
      )
    );

    const commonHeaders = new AxiosHeaders(
      instance.defaults.headers.common as Record<string, string>
    );
    instance.defaults.headers.common =
      commonHeaders as typeof instance.defaults.headers.common;

    const applyAccessToken = (token: string | null): void => {
      if (token) {
        commonHeaders.set(
          'Authorization',
          formatAuthHeaderValue(token, config.authScheme)
        );
      } else {
        commonHeaders.delete('Authorization');
      }
    };

    const setDefaultHeader = (
      name: string,
      value: string | number | boolean | null
    ): void => {
      if (value == null) commonHeaders.delete(name);
      else commonHeaders.set(name, String(value));
    };

    const tokenManager = new TokenManager(
      config,
      () => instance,
      applyAccessToken
    );

    runtimes.set(configId, {
      config,
      instance,
      tokenManager,
      applyAccessToken,
      setDefaultHeader
    });

    const initialToken =
      config.multiToken ?
        (config.tokenCallbacks?.getAccessToken?.() ??
        config.accessToken ??
        null)
      : (config.token ?? null);
    applyAccessToken(initialToken);
  });

  const requireRuntime = (configId: CMKey): ConfigRuntime => {
    const rt = runtimes.get(configId);
    if (!rt) throw new Error(`Config ${configId} not found`);
    return rt;
  };

  const getAccessToken = (
    configId: CMKey = 'default' as CMKey
  ): string | null => {
    const { config } = requireRuntime(configId);
    return config.multiToken ?
        (config.tokenCallbacks?.getAccessToken?.() ??
          config.accessToken ??
          null)
      : (config.token ?? null);
  };

  const attachAuthHeader = (
    reqConfig: AxiosRequestConfig,
    configId: CMKey
  ): AxiosRequestConfig => {
    const { config } = requireRuntime(configId);
    const token = getAccessToken(configId);
    if (token) {
      reqConfig.headers = reqConfig.headers ?? {};
      (reqConfig.headers as Record<string, string>)['Authorization'] =
        formatAuthHeaderValue(token, config.authScheme);
    }
    return reqConfig;
  };

  const applyStateReset = (
    stateUpdater:
      | ((
          update: Partial<StateData> | ((prev: StateData) => StateData)
        ) => void)
      | undefined,
    status: StateData['status']
  ): void => {
    if (!stateUpdater) return;
    stateUpdater(
      status === 'success' ? successState : { ...resetState, status }
    );
  };

  const buildRequestConfig = <D>(
    options: RequestOptions<D, CMKey>,
    stateUpdater:
      | ((
          update: Partial<StateData> | ((prev: StateData) => StateData)
        ) => void)
      | undefined,
    abortController: AbortController | undefined
  ): AxiosRequestConfig => {
    const {
      method,
      data,
      url,
      contentType: rawContentType,
      customHeaders,
      responseType = 'json',
      params,
      baseURL,
      onUploadProgress,
      onDownloadProgress,
      timeout = 100_000
    } = options;

    const isFormData =
      typeof FormData !== 'undefined' && data instanceof FormData;
    const contentType =
      rawContentType ?? (isFormData ? undefined : 'application/json');

    const headers: Record<string, string> = { ...(customHeaders ?? {}) };
    if (contentType) headers['Content-Type'] = contentType as ContentType;

    const cfg: AxiosRequestConfig = {
      method,
      url,
      data,
      params,
      responseType,
      timeout,
      baseURL,
      headers,
      onUploadProgress: (progressEvent: AxiosProgressEvent) => {
        const percent = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total || 1)
        );
        stateUpdater?.((prev) => ({ ...prev, uploadProgress: percent }));
        onUploadProgress?.(percent);
      },
      onDownloadProgress: (progressEvent: AxiosProgressEvent) => {
        const percent = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total || 1)
        );
        stateUpdater?.((prev) => ({ ...prev, downloadProgress: percent }));
        onDownloadProgress?.(percent);
      }
    };
    if (abortController) cfg.signal = abortController.signal;
    return cfg;
  };

  const request = async <T = unknown, D = unknown>(
    options: RequestOptions<D, CMKey>,
    stateUpdater?: (
      update: Partial<StateData> | ((prev: StateData) => StateData)
    ) => void
  ): Promise<AxiosResponse<T>> => {
    const configId = (options.configId ?? ('default' as CMKey)) as CMKey;
    const rt = requireRuntime(configId);
    const { config, instance, tokenManager, applyAccessToken } = rt;

    const {
      method,
      url,
      params,
      customHeaders,
      toastHandler: optionsToastHandler,
      successToast = false,
      errorToast = false,
      customToastMessage,
      customToastMessageType = 'success',
      customErrorToastMessage,
      customErrorToastMessageType = 'error',
      retry = 0,
      cancelable = false,
      onCancel,
      dedupe = false,
      cache: cacheOpt = false,
      shouldRetry
    } = options;

    const effectiveToastHandler: ToastHandler | undefined =
      isBrowser ? (optionsToastHandler ?? config.toastHandler) : undefined;

    const resolvedShouldRetry = shouldRetry ?? config.shouldRetry;

    const isGetMethod = (method ?? 'GET').toUpperCase() === 'GET';
    const cacheEnabled = cacheOpt !== false && isGetMethod;
    const ttlMs =
      typeof cacheOpt === 'object' && cacheOpt.ttl != null ?
        cacheOpt.ttl
      : 300_000;
    const swrMs =
      typeof cacheOpt === 'object' && cacheOpt.staleWhileRevalidate != null ?
        cacheOpt.staleWhileRevalidate
      : 0;

    const cacheKey = buildRequestKey(
      method,
      url,
      params,
      configId,
      customHeaders
    );

    // Cache lookup
    if (cacheEnabled) {
      const lookup = cache.get<T>(cacheKey);
      if (lookup.status === 'fresh') {
        return lookup.response;
      }
      if (lookup.status === 'stale') {
        if (cache.markRefreshing(cacheKey)) {
          void (async () => {
            try {
              const bgRequestConfig = buildRequestConfig(
                { ...options, successToast: false, errorToast: false },
                undefined,
                undefined
              );
              attachAuthHeader(bgRequestConfig, configId);
              const fresh = await executeRequest<T>({
                instance,
                requestConfig: bgRequestConfig,
                config,
                retry,
                tokenManager,
                applyAccessToken,
                reapplyAuthHeader: () =>
                  attachAuthHeader(bgRequestConfig, configId),
                shouldRetry: resolvedShouldRetry
              });
              cache.set(cacheKey, fresh, ttlMs, swrMs);
            } catch {
              // Background refresh errors are swallowed by design
            } finally {
              cache.clearRefreshing(cacheKey);
            }
          })();
        }
        return lookup.response;
      }
    }

    // Deduplication
    const shouldDedupe = (dedupe || config.dedupeRequests) && isGetMethod;
    if (shouldDedupe) {
      const inflight = deduper.get<T>(cacheKey);
      if (inflight) return inflight;
    }

    const abortController = cancelable ? new AbortController() : undefined;
    stateUpdater?.({
      isLoading: true,
      status: 'loading',
      uploadProgress: 0,
      downloadProgress: 0,
      abortController: abortController ?? null
    });

    const requestConfig = buildRequestConfig(
      options,
      stateUpdater,
      abortController
    );
    attachAuthHeader(requestConfig, configId);

    const handleSuccess = (response: AxiosResponse<T>): AxiosResponse<T> => {
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
      if (cacheEnabled) {
        cache.set(cacheKey, response, ttlMs, swrMs);
      }
      return response;
    };

    const handleError = async (err: unknown): Promise<AxiosResponse<T>> => {
      applyStateReset(stateUpdater, 'error');
      // Pass through our own error classes unchanged — they already carry the right context.
      if (err instanceof CancelledError) throw err;
      if (err instanceof AuthError) throw err;
      if (err instanceof RequestError) throw err;
      if (axios.isAxiosError(err)) {
        if (errorToast && effectiveToastHandler) {
          const responseData = err.response?.data;
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
            const handled = await config.errorHandler(err);
            return handled as AxiosResponse<T>;
          } catch {
            // Fall through to throwing RequestError
          }
        }
        throw new RequestError(
          err.message || 'Request failed',
          err,
          err.response ?? null,
          err.code ?? null
        );
      }
      if (err instanceof Error) {
        throw new RequestError(err.message, err);
      }
      throw new RequestError('Request failed', err);
    };

    const run = async (): Promise<AxiosResponse<T>> => {
      try {
        const response = await executeRequest<T>({
          instance,
          requestConfig,
          config,
          retry,
          tokenManager,
          applyAccessToken,
          reapplyAuthHeader: () => attachAuthHeader(requestConfig, configId),
          shouldRetry: resolvedShouldRetry,
          onCancel
        });
        return handleSuccess(response);
      } catch (err) {
        return handleError(err);
      }
    };

    if (shouldDedupe) {
      return deduper.register(cacheKey, run());
    }
    return run();
  };

  const upload = async <T = unknown>(
    url: string,
    formData: FormData,
    opts?: UploadOptions<CMKey>
  ): Promise<AxiosResponse<T>> => {
    const {
      headers,
      timeout = 120_000,
      onUploadProgress,
      onDownloadProgress,
      baseURL,
      cancelable = false,
      onCancel,
      configId,
      retry,
      shouldRetry,
      toastHandler,
      successToast,
      errorToast,
      customToastMessage,
      customToastMessageType,
      customErrorToastMessage,
      customErrorToastMessageType
    } = opts ?? {};

    return request<T, FormData>({
      method: 'POST',
      url,
      data: formData,
      customHeaders: headers,
      timeout,
      baseURL,
      cancelable,
      onCancel,
      configId,
      retry,
      shouldRetry,
      onUploadProgress,
      onDownloadProgress,
      toastHandler,
      successToast,
      errorToast,
      customToastMessage,
      customToastMessageType,
      customErrorToastMessage,
      customErrorToastMessageType
    });
  };

  const cancelRequest = (controller?: AbortController | null): void => {
    if (controller) controller.abort();
  };

  const invalidate = (options?: InvalidateOptions<CMKey>): void => {
    if (!options) {
      cache.invalidate();
      deduper.clear();
      return;
    }
    const { configId, url, predicate } = options;
    const matchers: Array<(key: string) => boolean> = [];
    if (configId) {
      const suffix = `:${configId}:`;
      matchers.push((k) => k.includes(suffix));
    }
    if (url instanceof RegExp) {
      matchers.push((k) => url.test(k));
    } else if (typeof url === 'string') {
      matchers.push((k) => k.includes(`:${url}:`) || k.includes(`:${url}`));
    }
    if (predicate) matchers.push(predicate);
    const finalPredicate =
      matchers.length === 0 ?
        undefined
      : (k: string) => matchers.every((m) => m(k));
    cache.invalidate(finalPredicate);
    deduper.invalidate(finalPredicate);
  };

  const destroy = (): void => {
    cache.destroy();
    deduper.clear();
    runtimes.forEach((rt) => rt.tokenManager.clear());
    runtimes.clear();
    emitter.emit('destroy');
  };

  const on = (event: string, fn: EventHandler): (() => void) =>
    emitter.on(event, fn);

  const setAccessToken = (
    token: string | null,
    configId: CMKey = 'default' as CMKey
  ): void => {
    const { config, applyAccessToken } = requireRuntime(configId);
    if (config.multiToken) {
      if (config.tokenCallbacks?.setAccessToken) {
        config.tokenCallbacks.setAccessToken(token);
      } else {
        config.accessToken = token;
      }
    } else {
      config.token = token;
    }
    applyAccessToken(token);
  };

  const setRefreshToken = (
    token: string | null,
    configId: CMKey = 'default' as CMKey
  ): void => {
    const { config } = requireRuntime(configId);
    if (config.tokenCallbacks?.setRefreshToken) {
      config.tokenCallbacks.setRefreshToken(token);
    } else {
      config.refreshToken = token;
    }
  };

  const setDefaultHeader = (
    name: string,
    value: string | number | boolean,
    configId: CMKey = 'default' as CMKey
  ): void => {
    const { setDefaultHeader: fn } = requireRuntime(configId);
    fn(name, value);
  };

  const clearDefaultHeader = (
    name: string,
    configId: CMKey = 'default' as CMKey
  ): void => {
    const { setDefaultHeader: fn } = requireRuntime(configId);
    fn(name, null);
  };

  return {
    request,
    upload,
    setAccessToken,
    setRefreshToken,
    setDefaultHeader,
    clearDefaultHeader,
    cancelRequest,
    invalidate,
    destroy,
    on
  };
};

export const createAxlyNodeClient = <
  CM extends Record<string, AxlyConfig> = { default: AxlyConfig }
>(
  configInput: CM | AxlyConfig
) => {
  const configs = normalizeConfigs<CM>(configInput);
  const nodeConfigs: CM = Object.fromEntries(
    Object.entries(configs).map(([k, v]) => [
      k,
      { ...(v as AxlyConfig), toastHandler: undefined }
    ])
  ) as unknown as CM;
  return createAxlyClient<CM>(nodeConfigs);
};
