interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl?: number;
}

export class CacheStorage<T = any> {
  private storage: Map<string, CacheEntry<T>>;

  constructor() {
    this.storage = new Map();
  }

  get(key: string): T | null {
    const entry = this.storage.get(key);
    if (!entry) return null;

    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    this.storage.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });
  }

  delete(key: string): void {
    this.storage.delete(key);
  }

  clear(): void {
    this.storage.clear();
  }

  has(key: string): boolean {
    return this.storage.has(key);
  }

  keys(): string[] {
    return Array.from(this.storage.keys());
  }
}
