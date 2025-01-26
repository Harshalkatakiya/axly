import axios from 'axios';
import EventEmitter from 'events';
import { SocketIO } from '../socket/SocketIO.js';
import { CacheStorage } from '../utils/cache.js';
import { AxlyError } from './axlyError.js';
export class Axly extends EventEmitter {
  instance;
  cancelTokenSource;
  middlewares;
  authConfig;
  rateLimitConfig;
  requestQueue;
  cache;
  pendingRequests;
  isRefreshingToken;
  concurrency;
  activeRequests;
  socketIO;
  constructor(baseURL, concurrency = 10) {
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
  setupInterceptors() {
    // Request Interceptor
    this.instance.interceptors.request.use(
      async (config) => {
        this.emit('request-start', config);
        for (const middleware of this.middlewares) {
          if (middleware.onRequest) {
            config = await middleware.onRequest(config);
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
          new AxlyError(
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
  async handleTokenRefresh(error) {
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
        this.authConfig.refreshTokenUrl,
        { refreshToken: this.authConfig.refreshToken }
      );
      this.authConfig.token = response.data.token;
      this.authConfig.onTokenRefresh?.(response.data.token);
      this.isRefreshingToken = false;
      this.processRequestQueue();
      return this.instance(error.config);
    } catch (refreshError) {
      this.isRefreshingToken = false;
      this.requestQueue = [];
      throw refreshError;
    }
  }
  processRequestQueue() {
    while (
      this.requestQueue.length > 0 &&
      this.activeRequests < this.concurrency
    ) {
      const request = this.requestQueue.shift();
      request?.();
    }
  }
  async request(config) {
    const {
      retries = 3,
      retryDelay = 1000,
      cache = false,
      cacheKey,
      deduplicate = false,
      ...axiosConfig
    } = config;
    if (cache && cacheKey && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    if (deduplicate && cacheKey && this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey);
    }
    const retryRequest = async (attempt) => {
      try {
        const requestPromise = this.instance.request({
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
  async fetch(config) {
    const result = {
      data: null,
      isLoading: true,
      error: null,
      response: null
    };
    try {
      const response = await this.request(config);
      result.data = response.data;
      result.response = response;
    } catch (error) {
      result.error = error;
    } finally {
      result.isLoading = false;
    }
    return result;
  }
  // Additional methods (batchRequests, poll, etc.)
  async batchRequests(requests) {
    const responses = [];
    for (const req of requests) {
      const response = await this.request(req);
      responses.push(response);
    }
    return responses;
  }
  async poll(url, config) {
    let attempts = 0;
    while (true) {
      const response = await this.request({ url, ...config });
      attempts++;
      if (config.until?.(response)) return response;
      if (config.maxAttempts && attempts >= config.maxAttempts) {
        throw new AxlyError(
          'Max polling attempts reached',
          'POLLING_MAX_ATTEMPTS'
        );
      }
      await new Promise((resolve) => setTimeout(resolve, config.interval));
    }
  }
  // Configuration methods
  setBaseURL(baseURL) {
    this.instance.defaults.baseURL = baseURL;
  }
  setHeader(name, value) {
    this.instance.defaults.headers.common[name] = value;
  }
  removeHeader(name) {
    delete this.instance.defaults.headers.common[name];
  }
  addMiddleware(middleware) {
    this.middlewares.push(middleware);
  }
  removeMiddleware(middleware) {
    this.middlewares = this.middlewares.filter((m) => m !== middleware);
  }
  setTimeout(timeout) {
    this.instance.defaults.timeout = timeout;
  }
  setAuthConfig(authConfig) {
    this.authConfig = authConfig;
  }
  setRateLimitConfig(rateLimitConfig) {
    this.rateLimitConfig = rateLimitConfig;
  }
  // File handling methods
  async uploadFile(url, file, config) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request({
      url,
      method: 'POST',
      data: formData,
      headers: { 'Content-Type': 'multipart/form-data' },
      ...config
    });
  }
  async downloadFile(url, config) {
    return this.request({
      url,
      method: 'GET',
      responseType: 'blob',
      ...config
    });
  }
  // Socket.IO methods
  connectSocketIO(url, options) {
    this.socketIO = new SocketIO({ url, options });
    this.socketIO.connect();
  }
  disconnectSocketIO() {
    this.socketIO?.disconnect();
  }
  onSocketEvent(event, listener) {
    this.socketIO?.on(event, listener);
  }
  emitSocketEvent(event, data) {
    this.socketIO?.emit(event, data);
  }
  // Cleanup
  cancelRequest(message) {
    this.cancelTokenSource.cancel(message);
  }
}
