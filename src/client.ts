/* global AbortController */
import {
  AxlyClient,
  AxlyConfig,
  ContentType,
  RefreshTokens,
  RequestOptions,
  StateData,
  ToastHandler,
  UploadOptions
} from '@/types';
import {
  delay,
  exponentialBackoffWithJitter,
  hasMessageInResponse,
  isBrowser
} from '@/utils';
import { AuthError, CancelledError, RequestError } from '@/utils/errors';
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosProgressEvent,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig
} from 'axios';

type EventHandler = (...args: unknown[]) => void;

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

export const createAxlyClient = (config: AxlyConfig): AxlyClient => {
  const emitter = new Emitter();
  let axiosInstance: AxiosInstance | null = null;
  const ensureAxios = () => {
    if (axiosInstance) return;
    axiosInstance = axios.create({ baseURL: config.baseURL });
    config.requestInterceptors?.forEach((interceptor) =>
      axiosInstance!.interceptors.request.use(
        interceptor as (
          c: InternalAxiosRequestConfig
        ) => InternalAxiosRequestConfig
      )
    );
    config.responseInterceptors?.forEach((interceptor) =>
      axiosInstance!.interceptors.response.use(
        interceptor as (r: AxiosResponse) => AxiosResponse
      )
    );
  };
  const applyAccessTokenToInstance = (token: string | null) => {
    ensureAxios();
    const defaults = axiosInstance!.defaults;
    defaults.headers = defaults.headers ?? {};
    if (token) defaults.headers['Authorization'] = `Bearer ${token}`;
    else delete (defaults.headers as Record<string, unknown>)['Authorization'];
  };
  const setDefaultHeaderOnInstance = (
    name: string,
    value: string | number | boolean | null
  ) => {
    ensureAxios();
    const defaults = axiosInstance!.defaults;
    defaults.headers = defaults.headers ?? {};
    if (value == null)
      delete (defaults.headers as Record<string, unknown>)[name];
    else (defaults.headers as Record<string, unknown>)[name] = String(value);
  };
  const tokenManager = new TokenManager(
    config,
    () => {
      ensureAxios();
      return axiosInstance!;
    },
    (tok) => applyAccessTokenToInstance(tok)
  );
  ensureAxios();
  const initialToken =
    config.multiToken ?
      (config.tokenCallbacks?.getAccessToken?.() ?? config.accessToken ?? null)
    : (config.token ?? null);
  applyAccessTokenToInstance(initialToken);
  const getAccessToken = (): string | null => {
    return (
      config.tokenCallbacks?.getAccessToken?.() ?? config.accessToken ?? null
    );
  };
  const attachAuthHeader = (reqConfig: AxiosRequestConfig) => {
    const token = config.multiToken ? getAccessToken() : (config.token ?? null);
    if (token) {
      reqConfig.headers = reqConfig.headers ?? {};
      reqConfig.headers['Authorization'] = `Bearer ${token}`;
    }
    return reqConfig;
  };
  const performRequest = async <T>(
    cfg: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> => {
    ensureAxios();
    return axiosInstance!.request<T>(cfg);
  };
  const request = async <T = unknown, D = unknown>(
    options: RequestOptions<D>,
    stateUpdater?: (
      update: Partial<StateData> | ((prev: StateData) => StateData)
    ) => void
  ): Promise<AxiosResponse<T>> => {
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
    if (baseURL) requestConfig.baseURL = baseURL;
    if (cancelable && abortController)
      requestConfig.signal = abortController.signal;
    attachAuthHeader(requestConfig);
    let lastError: AxiosError<T> | null = null;
    for (let attempt = 0; attempt <= retry; attempt++) {
      try {
        const response = await performRequest<T>(requestConfig);
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
            const tokens = await tokenManager.refreshTokens();
            applyAccessTokenToInstance(tokens.accessToken);
            attachAuthHeader(requestConfig);
            const retryResp = await performRequest<T>(requestConfig);
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
          // fallthrough
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
    opts?: UploadOptions
  ): Promise<AxiosResponse<T>> => {
    ensureAxios();
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
      onUploadProgress: (ev: AxiosProgressEvent) => {
        const percent = Math.round((ev.loaded * 100) / (ev.total || 1));
        onUploadProgress?.(percent);
      },
      onDownloadProgress: (ev: AxiosProgressEvent) => {
        const percent = Math.round((ev.loaded * 100) / (ev.total || 1));
        onDownloadProgress?.(percent);
      }
    };
    if (baseURL) requestConfig.baseURL = baseURL;
    if (cancelable && abortController)
      requestConfig.signal = abortController.signal;
    attachAuthHeader(requestConfig);
    try {
      return await axiosInstance!.request<T>(requestConfig);
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
    tokenManager.clear();
    axiosInstance = null;
    emitter.emit('destroy');
  };

  const on = (event: string, fn: EventHandler) => emitter.on(event, fn);

  const setAccessToken = (token: string | null) => {
    if (config.tokenCallbacks?.setAccessToken)
      config.tokenCallbacks.setAccessToken(token);
    else config.accessToken = token;
    applyAccessTokenToInstance(token);
  };

  const setRefreshToken = (token: string | null) => {
    if (config.tokenCallbacks?.setRefreshToken)
      config.tokenCallbacks.setRefreshToken(token);
    else config.refreshToken = token;
  };

  const setAuthorizationHeader = (token: string | null) => {
    applyAccessTokenToInstance(token);
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

  const setDefaultHeader = (name: string, value: string | number | boolean) => {
    setDefaultHeaderOnInstance(name, value);
  };

  const clearDefaultHeader = (name: string) => {
    setDefaultHeaderOnInstance(name, null);
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
  };
};

export const createAxlyNodeClient = (cfg: AxlyConfig) => {
  const nodeConfig = { ...cfg, toastHandler: undefined };
  return createAxlyClient(nodeConfig);
};
