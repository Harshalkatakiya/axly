import type { AxiosResponse } from 'axios';

interface CacheEntry {
  response: AxiosResponse;
  expiresAt: number;
  staleUntil: number;
}

export type CacheLookup<T = unknown> =
  | { status: 'fresh'; response: AxiosResponse<T> }
  | { status: 'stale'; response: AxiosResponse<T> }
  | { status: 'miss' };

export class CacheStore {
  private entries: Map<string, CacheEntry> = new Map();
  private refreshingKeys: Set<string> = new Set();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(sweepIntervalMs = 60_000) {
    this.timer = setInterval(() => this.sweep(), sweepIntervalMs);
    const t = this.timer as unknown as { unref?: () => void };
    if (typeof t.unref === 'function') t.unref();
  }

  get<T = unknown>(key: string): CacheLookup<T> {
    const entry = this.entries.get(key);
    if (!entry) return { status: 'miss' };
    const now = Date.now();
    if (now < entry.expiresAt) {
      return { status: 'fresh', response: entry.response as AxiosResponse<T> };
    }
    if (now < entry.staleUntil) {
      return { status: 'stale', response: entry.response as AxiosResponse<T> };
    }
    this.entries.delete(key);
    return { status: 'miss' };
  }

  set(
    key: string,
    response: AxiosResponse,
    ttlMs: number,
    swrMs: number
  ): void {
    const now = Date.now();
    this.entries.set(key, {
      response,
      expiresAt: now + ttlMs,
      staleUntil: now + ttlMs + swrMs
    });
  }

  /** Returns true if this caller should perform the background refresh, false if one is already in-flight. */
  markRefreshing(key: string): boolean {
    if (this.refreshingKeys.has(key)) return false;
    this.refreshingKeys.add(key);
    return true;
  }

  clearRefreshing(key: string): void {
    this.refreshingKeys.delete(key);
  }

  invalidate(predicate?: (key: string) => boolean): void {
    if (!predicate) {
      this.entries.clear();
      return;
    }
    for (const key of this.entries.keys()) {
      if (predicate(key)) this.entries.delete(key);
    }
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.staleUntil <= now) this.entries.delete(key);
    }
  }

  destroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.entries.clear();
    this.refreshingKeys.clear();
  }
}
