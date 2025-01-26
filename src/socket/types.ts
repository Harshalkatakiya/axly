import { ManagerOptions, SocketOptions } from 'socket.io-client';

export interface SocketConfig {
  url: string;
  namespace?: string;
  options?: Partial<ManagerOptions & SocketOptions>;
  timeout?: number;
  autoConnect?: boolean;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
  onReconnect?: (attempt: number) => void;
  onStatusChange?: (
    status:
      | 'connecting'
      | 'connected'
      | 'disconnected'
      | 'error'
      | 'reconnecting'
  ) => void;
}

export type SocketEventCallback<T = any> = (...args: T[]) => void;

export interface SocketMiddleware {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onEvent?: <T>(event: string, ...args: T[]) => Promise<T[]>;
  onEmit?: <T>(event: string, ...args: T[]) => Promise<T[]>;
}
