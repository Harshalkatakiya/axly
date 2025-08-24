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
} from './types';
import {
  delay,
  exponentialBackoffWithJitter,
  hasMessageInResponse,
  isBrowser
} from './utils';
import { AuthError, CancelledError, RequestError } from './utils/errors';

class Emitter {
  private handlers = new Map<string, EventHandler[]>();
  on(event: string, fn: EventHandler) {
    const list = this.handlers.get(event) ?? [];
    list.push(fn);
    this.handlers.set(event, list);
    return () => this.off(event, fn);
  }
  off(event: string, fn?: EventHandler) {
    if (!fn) {
      this.handlers.delete(event);
      return;
    }
    const list = (this.handlers.get(event) ?? []).filter((h) => h !== fn);
    if (list.length) this.handlers.set(event, list);
    else this.handlers.delete(event);
  }
  emit(event: string, ...args: unknown[]) {
    (this.handlers.get(event) ?? []).forEach((h) => {
      try {
        h(...args);
      } catch {
        // swallow
      }
    });
  }
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
    const resp = await instance.post(
      this.config.refreshEndpoint,
      { refreshToken },
      { timeout: this.config.refreshTimeout ?? 10000 }
    );
    const data = resp.data as { accessToken?: string; refreshToken?: string };
    const accessToken = data.accessToken;
    const newRefreshToken = data.refreshToken ?? refreshToken;
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

export const createAxlyClient = <
  CM extends Record<string, AxlyConfig> = { default: AxlyConfig }
>(
  configInput: CM | AxlyConfig
): AxlyClient<keyof CM & string> => {
  const configs: CM =
    (
      typeof configInput === 'object' &&
      configInput !== null &&
      'baseURL' in configInput &&
      typeof (configInput as any).baseURL === 'string'
    ) ?
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
      onCancel
    } = options;
    const effectiveToastHandler: ToastHandler | undefined =
      (isBrowser ? (optionsToastHandler ?? config.toastHandler) : undefined) ??
      undefined;
    const abortController = cancelable ? new AbortController() : undefined;
    if (stateUpdater) {
      stateUpdater({
        isLoading: true,
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
    let lastError: AxiosError<T> | null = null;
    for (let attempt = 0; attempt <= retry; attempt++) {
      try {
        const response = await performRequest<T>(requestConfig, configId);
        if (stateUpdater) {
          stateUpdater({
            isLoading: false,
            uploadProgress: 0,
            downloadProgress: 0,
            abortController: null
          });
        }
        if (successToast && effectiveToastHandler) {
          const message =
            customToastMessage ??
            (hasMessageInResponse(response.data) ?
              response.data.message
            : undefined);
          if (message) effectiveToastHandler(message, customToastMessageType);
        }
        return response;
      } catch (err) {
        lastError = err as AxiosError<T>;
        if (axios.isCancel(err)) {
          if (stateUpdater)
            stateUpdater({
              isLoading: false,
              uploadProgress: 0,
              downloadProgress: 0,
              abortController: null
            });
          onCancel?.();
          throw new CancelledError();
        }
        if (
          axios.isAxiosError(err) &&
          err.response?.status === 401 &&
          config.multiToken &&
          config.refreshEndpoint
        ) {
          try {
            const tokenManager = tokenManagers.get(configId);
            if (!tokenManager)
              throw new Error(`Token manager for ${configId} not found`);
            const tokens = await tokenManager.refreshTokens();
            const applyAccessToken = applyAccessTokenFunctions.get(configId);
            if (!applyAccessToken)
              throw new Error(
                `Apply access token function for ${configId} not found`
              );
            applyAccessToken(tokens.accessToken);
            attachAuthHeader(requestConfig, configId);
            const retryResp = await performRequest<T>(requestConfig, configId);
            if (stateUpdater) {
              stateUpdater({
                isLoading: false,
                uploadProgress: 0,
                downloadProgress: 0,
                abortController: null
              });
            }
            if (successToast && effectiveToastHandler) {
              const message =
                customToastMessage ??
                (hasMessageInResponse(retryResp.data) ?
                  retryResp.data.message
                : undefined);
              if (message)
                effectiveToastHandler(message, customToastMessageType);
            }
            return retryResp;
          } catch (refreshErr) {
            config.onRefreshFail?.(
              refreshErr instanceof Error ? refreshErr : (
                new Error('Refresh failed')
              )
            );
            if (stateUpdater)
              stateUpdater({
                isLoading: false,
                uploadProgress: 0,
                downloadProgress: 0,
                abortController: null
              });
            throw new AuthError('Refresh failed; authentication required');
          }
        }
        if (attempt < retry) {
          const backoff = exponentialBackoffWithJitter(attempt);
          await delay(backoff);
          continue;
        }
      }
    }
    if (stateUpdater)
      stateUpdater({
        isLoading: false,
        uploadProgress: 0,
        downloadProgress: 0,
        abortController: null
      });
    if (lastError) {
      if (errorToast && effectiveToastHandler) {
        const errorMessage =
          customErrorToastMessage ??
          (hasMessageInResponse(lastError.response?.data) ?
            (lastError.response?.data as any).message
          : undefined) ??
          'An error occurred';
        effectiveToastHandler(errorMessage, customErrorToastMessageType);
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

  const cancelRequest = (controller?: AbortController | null) => {
    if (controller) controller.abort();
  };

  const destroy = () => {
    tokenManagers.forEach((tm) => tm.clear());
    axiosInstances.clear();
    tokenManagers.clear();
    applyAccessTokenFunctions.clear();
    setDefaultHeaderFunctions.clear();
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
    const setDefaultHeader = setDefaultHeaderFunctions.get(configId);
    if (setDefaultHeader) setDefaultHeader(name, value);
  };

  const clearDefaultHeader = (
    name: string,
    configId: CMKey = 'default' as CMKey
  ) => {
    const setDefaultHeader = setDefaultHeaderFunctions.get(configId);
    if (setDefaultHeader) setDefaultHeader(name, null);
  };

  return {
    request,
    upload,
    setAccessToken,
    setRefreshToken,
    setAuthorizationHeader,
    setDefaultHeader,
    clearDefaultHeader,
    cancelRequest,
    destroy,
    on
  } as unknown as AxlyClient<CMKey>;
};

export const createAxlyNodeClient = <
  CM extends Record<string, AxlyConfig> = { default: AxlyConfig }
>(
  configInput: CM | AxlyConfig
) => {
  const configs =
    (
      typeof configInput === 'object' &&
      configInput !== null &&
      'baseURL' in configInput &&
      typeof (configInput as any).baseURL === 'string'
    ) ?
      ({ default: configInput as AxlyConfig } as unknown as CM)
    : (configInput as CM);
  const nodeConfigs: AxlyConfig | CM = Object.fromEntries(
    Object.entries(configs).map(([k, v]) => [
      k,
      { ...v, toastHandler: undefined }
    ])
  ) as unknown as CM;
  return createAxlyClient<CM>(nodeConfigs);
};
