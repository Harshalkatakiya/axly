import { SocketIO } from './SocketIO';
import { SocketConfig } from './types';

export class SocketManager {
  private instances: Map<string, SocketIO> = new Map();

  constructor(private defaultConfig?: SocketConfig) {}

  public create(name: string, config?: SocketConfig): SocketIO {
    const mergedConfig = { ...this.defaultConfig, ...config };
    const instance = new SocketIO(mergedConfig);
    this.instances.set(name, instance);
    return instance;
  }

  public get(name: string): SocketIO | undefined {
    return this.instances.get(name);
  }

  public remove(name: string): void {
    const instance = this.instances.get(name);
    instance?.disconnect();
    this.instances.delete(name);
  }

  public connectAll(): Promise<void[]> {
    return Promise.all(
      Array.from(this.instances.values()).map((instance) => instance.connect())
    );
  }

  public disconnectAll(): void {
    this.instances.forEach((instance) => instance.disconnect());
  }
}
