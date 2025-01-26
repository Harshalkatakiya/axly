import { Manager } from 'socket.io-client';
export class SocketIO {
  config;
  manager;
  socket;
  middlewares = [];
  connectionPromise;
  constructor(config) {
    this.config = config;
    this.manager = new Manager(config.url, config.options);
    this.socket = this.manager.socket(config.namespace || '/');
    this.setupDefaultListeners();
  }
  setupDefaultListeners() {
    this.socket.on('connect', () => {
      this.config.onConnect?.();
      this.emitStatus('connected');
    });
    this.socket.on('disconnect', (reason) => {
      this.config.onDisconnect?.(reason);
      this.emitStatus('disconnected');
    });
    this.socket.on('error', (error) => {
      this.config.onError?.(error);
      this.emitStatus('error');
    });
    this.socket.on('reconnect_attempt', (attempt) => {
      this.config.onReconnect?.(attempt);
      this.emitStatus('reconnecting');
    });
  }
  emitStatus(status) {
    this.config.onStatusChange?.(status);
  }
  async processMiddlewares(event, args) {
    for (const middleware of this.middlewares) {
      if (middleware[event]) {
        args = await middleware[event](...args);
      }
    }
    return args;
  }
  connect() {
    if (!this.connectionPromise) {
      this.connectionPromise = new Promise((resolve, reject) => {
        if (this.socket.connected) return resolve();
        const timeout = setTimeout(
          () => reject(new Error('Connection timeout')),
          this.config.timeout || 5000
        );
        this.socket.once('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
        this.socket.once('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
        this.socket.connect();
      });
    }
    return this.connectionPromise;
  }
  disconnect() {
    this.socket.disconnect();
    this.connectionPromise = undefined;
  }
  on(event, callback) {
    this.socket.on(event, async (...args) => {
      try {
        const processedArgs = await this.processMiddlewares(event, args);
        callback(...processedArgs);
      } catch (error) {
        this.config.onError?.(error);
      }
    });
  }
  off(event) {
    this.socket.off(event);
  }
  async emit(event, ...args) {
    return new Promise((resolve, reject) => {
      this.socket.emit(event, ...args, (response) => {
        if (response instanceof Error) {
          reject(response);
        } else {
          resolve(response);
        }
      });
    });
  }
  addMiddleware(middleware) {
    this.middlewares.push(middleware);
  }
  getSocket() {
    return this.socket;
  }
  getNamespace() {
    return this.socket.nsp;
  }
  getStatus() {
    return (
      this.socket.connected ? 'connected'
      : this.socket.active ? 'connecting'
      : 'disconnected'
    );
  }
}
