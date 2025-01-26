import axios, { AxiosInstance, AxiosResponse, CancelTokenSource } from 'axios';
import EventEmitter from 'events';
import { SocketConfig } from 'socket';
import { SocketIO } from '../socket/SocketIO';
import { CacheStorage } from '../utils/cache';
import { AxionError } from './AxionError';
import {
  AxionAuthConfig,
  AxionFetchResult,
  AxionMiddleware,
  AxionPollingConfig,
  AxionRateLimitConfig,
  AxionRequestConfig
} from './types';

export class Axion extends EventEmitter {
  private instance: AxiosInstance;
  private cancelTokenSource: CancelTokenSource;
  private middlewares: AxionMiddleware[];
  private authConfig?: AxionAuthConfig;
  private rateLimitConfig?: AxionRateLimitConfig;
  private requestQueue: (() => void)[];
  private cache: CacheStorage;
  private pendingRequests: Map<string, Promise<AxiosResponse>>;
  private isRefreshingToken: boolean;
  private concurrency: number;
  private activeRequests: number;
  private socketIO?: SocketIO;

  constructor(baseURL?: string, concurrency: number = 10) {
    super();
    this.instance = axios.create({ baseURL });
    this.cancelTokenSource = axios.CancelToken.source();
    this.middlewares = [];
    this.requestQueue = [];
    this.cache = new CacheStorage();
    this.pendingRequests = new Map();
    this.isRefreshingToken = false;
    this.concurrency = concurrency;
    this.activeRequests = 0;

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request Interceptor
    this.instance.interceptors.request.use(
      async (config) => {
        this.emit('request-start', config);
        for (const middleware of this.middlewares) {
          if (middleware.onRequest) {
            config = await middleware.onRequest(config as AxionRequestConfig);
          }
        }
        if (this.authConfig?.token) {
          config.headers = config.headers || {};
          config.headers[this.authConfig.tokenHeader || 'Authorization'] =
            `Bearer ${this.authConfig.token}`;
        }
        return config;
      },
      (error) => {
        this.emit('error', error);
        for (const middleware of this.middlewares) {
          if (middleware.onError) middleware.onError(error);
        }
        return Promise.reject(error);
      }
    );

    // Response Interceptor
    this.instance.interceptors.response.use(
      async (response) => {
        this.emit('request-end', response);
        for (const middleware of this.middlewares) {
          if (middleware.onResponse) {
            response = await middleware.onResponse(response);
          }
        }
        return response;
      },
      async (error) => {
        this.emit('error', error);
        if (
          error.response?.status === 401 &&
          this.authConfig?.refreshTokenUrl
        ) {
          return this.handleTokenRefresh(error);
        }
        for (const middleware of this.middlewares) {
          if (middleware.onError) error = await middleware.onError(error);
        }
        return Promise.reject(
          new AxionError(
            error.message,
            error.code,
            error.response?.status,
            error.config,
            error.response
          )
        );
      }
    );
  }

  private async handleTokenRefresh(error: {
    config: AxionRequestConfig;
    response?: AxiosResponse;
  }): Promise<AxiosResponse> {
    if (this.isRefreshingToken) {
      return new Promise((resolve, reject) => {
        this.requestQueue.push(() => {
          this.instance(error.config).then(resolve).catch(reject);
        });
      });
    }

    this.isRefreshingToken = true;
    try {
      const response = await this.instance.post(
        this.authConfig!.refreshTokenUrl!,
        { refreshToken: this.authConfig!.refreshToken }
      );

      this.authConfig!.token = response.data.token;
      this.authConfig!.onTokenRefresh?.(response.data.token);
      this.isRefreshingToken = false;
      this.processRequestQueue();

      return this.instance(error.config);
    } catch (refreshError) {
      this.isRefreshingToken = false;
      this.requestQueue = [];
      throw refreshError;
    }
  }

  private processRequestQueue(): void {
    while (
      this.requestQueue.length > 0 &&
      this.activeRequests < this.concurrency
    ) {
      const request = this.requestQueue.shift();
      request?.();
    }
  }

  public async request<T = any>(
    config: AxionRequestConfig
  ): Promise<AxiosResponse<T>> {
    const {
      retries = 3,
      retryDelay = 1000,
      cache = false,
      cacheKey,
      deduplicate = false,
      ...axiosConfig
    } = config;

    if (cache && cacheKey && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    if (deduplicate && cacheKey && this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey)!;
    }

    const retryRequest = async (attempt: number): Promise<AxiosResponse<T>> => {
      try {
        const requestPromise = this.instance.request<T>({
          ...axiosConfig,
          cancelToken: this.cancelTokenSource.token
        });

        if (deduplicate && cacheKey) {
          this.pendingRequests.set(cacheKey, requestPromise);
        }

        this.activeRequests++;
        const response = await requestPromise;
        this.activeRequests--;

        if (cache && cacheKey) {
          this.cache.set(cacheKey, response);
        }

        if (deduplicate && cacheKey) {
          this.pendingRequests.delete(cacheKey);
        }

        this.processRequestQueue();
        return response;
      } catch (error) {
        this.activeRequests--;
        if (attempt < retries && !axios.isCancel(error)) {
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelay * (attempt + 1))
          );
          return retryRequest(attempt + 1);
        }
        throw error;
      }
    };

    return retryRequest(0);
  }

  public async fetch<T = any>(
    config: AxionRequestConfig
  ): Promise<AxionFetchResult<T>> {
    const result: AxionFetchResult<T> = {
      data: null,
      isLoading: true,
      error: null,
      response: null
    };

    try {
      const response = await this.request<T>(config);
      result.data = response.data;
      result.response = response;
    } catch (error) {
      result.error = error as Error;
    } finally {
      result.isLoading = false;
    }

    return result;
  }

  // Additional methods (batchRequests, poll, etc.)
  public async batchRequests<T = any>(
    requests: AxionRequestConfig[]
  ): Promise<AxiosResponse<T>[]> {
    const responses: AxiosResponse<T>[] = [];
    for (const req of requests) {
      const response = await this.request<T>(req);
      responses.push(response);
    }
    return responses;
  }

  public async poll<T = any>(
    url: string,
    config: AxionPollingConfig
  ): Promise<AxiosResponse<T>> {
    let attempts = 0;
    while (true) {
      const response = await this.request<T>({ url, ...config });
      attempts++;
      if (config.until?.(response)) return response;
      if (config.maxAttempts && attempts >= config.maxAttempts) {
        throw new AxionError(
          'Max polling attempts reached',
          'POLLING_MAX_ATTEMPTS'
        );
      }
      await new Promise((resolve) => setTimeout(resolve, config.interval));
    }
  }

  // Configuration methods
  public setBaseURL(baseURL: string): void {
    this.instance.defaults.baseURL = baseURL;
  }

  public setHeader(name: string, value: string): void {
    this.instance.defaults.headers.common[name] = value;
  }

  public removeHeader(name: string): void {
    delete this.instance.defaults.headers.common[name];
  }

  public addMiddleware(middleware: AxionMiddleware): void {
    this.middlewares.push(middleware);
  }

  public removeMiddleware(middleware: AxionMiddleware): void {
    this.middlewares = this.middlewares.filter((m) => m !== middleware);
  }

  public setTimeout(timeout: number): void {
    this.instance.defaults.timeout = timeout;
  }

  public setAuthConfig(authConfig: AxionAuthConfig): void {
    this.authConfig = authConfig;
  }

  public setRateLimitConfig(rateLimitConfig: AxionRateLimitConfig): void {
    this.rateLimitConfig = rateLimitConfig;
  }

  // File handling methods
  public async uploadFile<T = any>(
    url: string,
    file: File,
    config?: AxionRequestConfig
  ): Promise<AxiosResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<T>({
      url,
      method: 'POST',
      data: formData,
      headers: { 'Content-Type': 'multipart/form-data' },
      ...config
    });
  }

  public async downloadFile(
    url: string,
    config?: AxionRequestConfig
  ): Promise<AxiosResponse<Blob>> {
    return this.request<Blob>({
      url,
      method: 'GET',
      responseType: 'blob',
      ...config
    });
  }

  // Socket.IO methods
  public connectSocketIO(url: string, options?: Partial<SocketConfig>): void {
    this.socketIO = new SocketIO({ url, options });
    this.socketIO.connect();
  }

  public disconnectSocketIO(): void {
    this.socketIO?.disconnect();
  }

  public onSocketEvent<T = any>(
    event: string,
    listener: (data: T) => void
  ): void {
    this.socketIO?.on(event, listener);
  }

  public emitSocketEvent<T = any>(event: string, data: T): void {
    this.socketIO?.emit(event, data);
  }

  // Cleanup
  public cancelRequest(message?: string): void {
    this.cancelTokenSource.cancel(message);
  }
}
