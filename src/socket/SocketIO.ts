import { Manager, Socket } from 'socket.io-client';
import { SocketConfig, SocketEventCallback, SocketMiddleware } from './types';

export class SocketIO {
  private manager: Manager;
  private socket: Socket;
  private middlewares: SocketMiddleware[] = [];
  private connectionPromise?: Promise<void>;

  constructor(private config: SocketConfig) {
    this.manager = new Manager(config.url, config.options);
    this.socket = this.manager.socket(config.namespace || '/');
    this.setupDefaultListeners();
  }

  private setupDefaultListeners() {
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

  private emitStatus(
    status:
      | 'connecting'
      | 'connected'
      | 'disconnected'
      | 'error'
      | 'reconnecting'
  ) {
    this.config.onStatusChange?.(status);
  }

  private async processMiddlewares(event: string, args: any[]) {
    for (const middleware of this.middlewares) {
      if (middleware[event]) {
        args = await middleware[event]!(...args);
      }
    }
    return args;
  }

  public connect(): Promise<void> {
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

  public disconnect() {
    this.socket.disconnect();
    this.connectionPromise = undefined;
  }

  public on<T = any>(event: string, callback: SocketEventCallback<T>) {
    this.socket.on(event, async (...args: any[]) => {
      try {
        const processedArgs = await this.processMiddlewares(event, args);
        callback(...processedArgs);
      } catch (error) {
        this.config.onError?.(error);
      }
    });
  }

  public off(event: string) {
    this.socket.off(event);
  }

  public async emit<T = any>(event: string, ...args: any[]): Promise<T> {
    return new Promise((resolve, reject) => {
      this.socket.emit(event, ...args, (response: T | Error) => {
        if (response instanceof Error) {
          reject(response);
        } else {
          resolve(response);
        }
      });
    });
  }

  public addMiddleware(middleware: SocketMiddleware) {
    this.middlewares.push(middleware);
  }

  public getSocket(): Socket {
    return this.socket;
  }

  public getNamespace(): string {
    return this.socket.nsp;
  }

  public getStatus(): 'connected' | 'disconnected' | 'connecting' {
    return (
      this.socket.connected ? 'connected'
      : this.socket.active ? 'connecting'
      : 'disconnected'
    );
  }
}
