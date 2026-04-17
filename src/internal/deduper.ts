import type { AxiosResponse } from 'axios';

export class InflightMap {
  private inflight: Map<string, Promise<AxiosResponse>> = new Map();

  get<T = unknown>(key: string): Promise<AxiosResponse<T>> | undefined {
    return this.inflight.get(key) as Promise<AxiosResponse<T>> | undefined;
  }

  register<T>(
    key: string,
    promise: Promise<AxiosResponse<T>>
  ): Promise<AxiosResponse<T>> {
    const wrapped = promise.finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, wrapped as Promise<AxiosResponse>);
    return wrapped;
  }

  invalidate(predicate?: (key: string) => boolean): void {
    if (!predicate) {
      this.inflight.clear();
      return;
    }
    for (const key of this.inflight.keys()) {
      if (predicate(key)) this.inflight.delete(key);
    }
  }

  clear(): void {
    this.inflight.clear();
  }
}
