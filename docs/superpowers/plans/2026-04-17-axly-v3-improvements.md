# Axly v3 Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship axly v3.0.0 with 4 bug fixes, 5 internal refactors, and 4 new features, via module decomposition of the 790-line `client.ts`.

**Architecture:** Extract subsystem logic (cache, dedupe, token refresh, retry/executor, emitter, request-key) from `client.ts` into focused `src/internal/*` files. Collapse 4 parallel config Maps into a single `runtimes` record. Add `authScheme`, `shouldRetry`, `staleWhileRevalidate`, `invalidate(pattern)`. Fix `.unref()` timer leak, 401-vs-retry interaction, cache key param-order, and `upload()` being a parallel inferior code path.

**Tech Stack:** TypeScript 6.x (strict, `nodenext`, no `any`), Axios 1.x, React 18+ hooks, Bun as package manager, `tsc` as bundler (no other build tooling). ESM-only. ESLint + Prettier + Husky pre-commit.

**Verification approach:** The package has no test suite (`CLAUDE.md` — "There is no test suite"), and the spec marks testing as out-of-scope. Each task is verified by:

1. `bun run build` — tsc type-check (strict)
2. `bun run lint` — ESLint (no-explicit-any, react-hooks, prettier)

If a task requires behavioral verification beyond type-checking, it's written into the task explicitly (e.g., a small ad-hoc script to run via `node --input-type=module -e '...'`).

**Reference spec:** [`docs/superpowers/specs/2026-04-17-axly-v3-improvements-design.md`](../specs/2026-04-17-axly-v3-improvements-design.md)

---

## Task 1: Extract `Emitter` into `src/internal/emitter.ts`

Pure move. No behavior change.

**Files:**

- Create: `src/internal/emitter.ts`
- Modify: `src/client.ts` (lines 44-70, import + remove inline class)

- [ ] **Step 1: Create `src/internal/emitter.ts`**

```ts
import type { EventHandler } from '../types/index.js';

export class Emitter {
  private handlers = new Map<string, EventHandler[]>();

  on(event: string, fn: EventHandler): () => void {
    const list = this.handlers.get(event) ?? [];
    list.push(fn);
    this.handlers.set(event, list);
    return () => this.off(event, fn);
  }

  off(event: string, fn?: EventHandler): void {
    if (!fn) {
      this.handlers.delete(event);
      return;
    }
    const list = (this.handlers.get(event) ?? []).filter((h) => h !== fn);
    if (list.length) this.handlers.set(event, list);
    else this.handlers.delete(event);
  }

  emit(event: string, ...args: unknown[]): void {
    (this.handlers.get(event) ?? []).forEach((h) => {
      try {
        h(...args);
      } catch {
        // swallow handler errors; one bad listener shouldn't break the others
      }
    });
  }
}
```

- [ ] **Step 2: Remove the inline `class Emitter {...}` block in `src/client.ts` (lines 44-70) and import from the new module**

Replace the block at the top of `src/client.ts`:

```ts
import { Emitter } from './internal/emitter.js';
```

The `const emitter = new Emitter();` instantiation inside `createAxlyClient` stays unchanged.

- [ ] **Step 3: Verify build + lint pass**

```bash
bun run build
bun run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/internal/emitter.ts src/client.ts
git commit -m "refactor: extract Emitter into internal/emitter.ts"
```

---

## Task 2: Extract `TokenManager` into `src/internal/tokenManager.ts`

Pure move. No behavior change.

**Files:**

- Create: `src/internal/tokenManager.ts`
- Modify: `src/client.ts` (lines 30-37 remove `RefreshResponseData` interface, lines 72-126 remove `class TokenManager`, add import)

- [ ] **Step 1: Create `src/internal/tokenManager.ts`**

```ts
import type { AxiosInstance } from 'axios';
import type { AxlyConfig, RefreshTokens } from '../types/index.js';
import { AuthError } from '../utils/errors.js';

interface RefreshResponseData {
  accessToken?: string;
  refreshToken?: string;
}

export class TokenManager {
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
      return await this.refreshPromise;
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
    const resp = await instance.post<RefreshResponseData>(
      this.config.refreshEndpoint,
      { refreshToken },
      { timeout: this.config.refreshTimeout ?? 10000 }
    );
    const { accessToken, refreshToken: newRefreshTokenFromResp } = resp.data;
    const newRefreshToken = newRefreshTokenFromResp ?? refreshToken;
    if (!accessToken) {
      throw new AuthError('Refresh response missing access token');
    }
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

  clear(): void {
    this.refreshPromise = null;
  }
}
```

- [ ] **Step 2: In `src/client.ts`, remove the inline `class TokenManager {...}` (lines 72-126) and the `interface RefreshResponseData` (lines 34-37). Add import**

```ts
import { TokenManager } from './internal/tokenManager.js';
```

- [ ] **Step 3: Verify build + lint pass**

```bash
bun run build
bun run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/internal/tokenManager.ts src/client.ts
git commit -m "refactor: extract TokenManager into internal/tokenManager.ts"
```

---

## Task 3: Create `src/internal/requestKey.ts` with canonical key

Fixes Bug 2.3 (cache/dedupe key depended on object key order).

**Files:**

- Create: `src/internal/requestKey.ts`
- Modify: `src/client.ts` (replace inline `buildRequestKey` function ~lines 134-141 with import)

- [ ] **Step 1: Create `src/internal/requestKey.ts`**

```ts
const canonicalStringify = (
  obj: Record<string, unknown> | undefined
): string => {
  if (!obj) return '{}';
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) sorted[key] = obj[key];
  return JSON.stringify(sorted);
};

export const buildRequestKey = (
  method: string | undefined,
  url: string,
  params: Record<string, string | number | boolean> | undefined,
  configId: string,
  customHeaders?: Record<string, string>
): string =>
  `${method?.toUpperCase() ?? 'GET'}:${configId}:${url}:${canonicalStringify(params)}:${canonicalStringify(customHeaders)}`;
```

- [ ] **Step 2: In `src/client.ts`, remove the inline `buildRequestKey` const (~lines 134-141) and add import**

```ts
import { buildRequestKey } from './internal/requestKey.js';
```

- [ ] **Step 3: Verify build + lint pass**

```bash
bun run build
bun run lint
```

- [ ] **Step 4: Ad-hoc behavior check — confirm canonical key works**

Run this in `bun` to confirm key normalization (should print identical keys):

```bash
bun -e "const { buildRequestKey } = await import('./dist/internal/requestKey.js'); const a = buildRequestKey('GET', '/users', {a:1,b:2}, 'default'); const b = buildRequestKey('GET', '/users', {b:2,a:1}, 'default'); console.log('match:', a === b, a);"
```

Expected: `match: true GET:default:/users:{"a":1,"b":2}:{}`

- [ ] **Step 5: Commit**

```bash
git add src/internal/requestKey.ts src/client.ts
git commit -m "fix: canonicalize request keys so reordered params share cache entries"
```

---

## Task 4: Create `src/internal/cache.ts` (CacheStore with SWR + `.unref()`)

Fixes Bug 2.1 (timer keeps Node alive). Implements Feature 4.3 (staleWhileRevalidate) and the cache half of Feature 4.4 (invalidate by predicate).

**Files:**

- Create: `src/internal/cache.ts`
- (No changes to `client.ts` in this task — wired up in Task 8.)

- [ ] **Step 1: Create `src/internal/cache.ts`**

```ts
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
```

- [ ] **Step 2: Verify build + lint pass**

```bash
bun run build
bun run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/internal/cache.ts
git commit -m "feat: add CacheStore with TTL + stale-while-revalidate + .unref() timer"
```

---

## Task 5: Create `src/internal/deduper.ts` (InflightMap)

**Files:**

- Create: `src/internal/deduper.ts`

- [ ] **Step 1: Create `src/internal/deduper.ts`**

```ts
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
```

- [ ] **Step 2: Verify build + lint pass**

```bash
bun run build
bun run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/internal/deduper.ts
git commit -m "feat: add InflightMap for request deduplication"
```

---

## Task 6: Create `src/internal/executor.ts` (smart retry + 401-aware refresh)

Fixes Bug 2.2 (retries no longer burn on stale token before refresh). Implements Feature 4.2 (`shouldRetry`).

**Files:**

- Create: `src/internal/executor.ts`

- [ ] **Step 1: Create `src/internal/executor.ts`**

```ts
import type {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse
} from 'axios';
import axios from 'axios';
import type { AxlyConfig } from '../types/index.js';
import { AuthError, CancelledError, RequestError } from '../utils/errors.js';
import { delay, exponentialBackoffWithJitter } from '../utils/index.js';
import type { TokenManager } from './tokenManager.js';

export interface ExecuteParams {
  instance: AxiosInstance;
  requestConfig: AxiosRequestConfig;
  config: AxlyConfig;
  retry: number;
  tokenManager: TokenManager | null;
  applyAccessToken: ((token: string | null) => void) | null;
  /** Re-attach the Authorization header to `requestConfig` after a token refresh. */
  reapplyAuthHeader: () => void;
  shouldRetry?: (err: AxiosError, attempt: number) => boolean;
  onCancel?: () => void;
}

const defaultShouldRetry = (err: AxiosError): boolean => {
  if (
    err.code === 'ERR_NETWORK' ||
    err.code === 'ECONNABORTED' ||
    err.code === 'ETIMEDOUT'
  )
    return true;
  const status = err.response?.status;
  if (status == null) return true; // no response = likely network-level failure
  if (status >= 500 && status < 600) return true;
  if (status === 408 || status === 429) return true;
  return false;
};

export const executeRequest = async <T>(
  params: ExecuteParams
): Promise<AxiosResponse<T>> => {
  const {
    instance,
    requestConfig,
    config,
    retry,
    tokenManager,
    applyAccessToken,
    reapplyAuthHeader,
    shouldRetry,
    onCancel
  } = params;

  const predicate = shouldRetry ?? config.shouldRetry ?? defaultShouldRetry;
  let refreshAttempted = false;
  let lastError: AxiosError<T> | null = null;

  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      return await instance.request<T>(requestConfig);
    } catch (err) {
      if (axios.isCancel(err)) {
        onCancel?.();
        throw new CancelledError();
      }
      const axiosErr = err as AxiosError<T>;
      lastError = axiosErr;

      // 401 refresh path — break out of the retry loop on the first 401,
      // refresh once, then restart the loop with a fresh token.
      const is401 = axios.isAxiosError(err) && err.response?.status === 401;
      if (
        is401 &&
        !refreshAttempted &&
        config.multiToken &&
        config.refreshEndpoint &&
        tokenManager &&
        applyAccessToken
      ) {
        refreshAttempted = true;
        try {
          const tokens = await tokenManager.refreshTokens();
          applyAccessToken(tokens.accessToken);
          reapplyAuthHeader();
          attempt = -1; // after ++ this becomes 0; full retry budget restored
          continue;
        } catch (refreshErr) {
          if (refreshErr instanceof CancelledError) throw refreshErr;
          if (refreshErr instanceof AuthError) {
            config.onRefreshFail?.(refreshErr);
            throw refreshErr;
          }
          if (refreshErr instanceof RequestError) throw refreshErr;
          config.onRefreshFail?.(
            refreshErr instanceof Error ? refreshErr : (
              new Error('Refresh failed')
            )
          );
          throw new AuthError('Refresh failed; authentication required');
        }
      }

      if (attempt < retry && predicate(axiosErr, attempt)) {
        await delay(exponentialBackoffWithJitter(attempt));
        continue;
      }
      break;
    }
  }

  if (lastError) throw lastError;
  throw new RequestError('Request failed');
};
```

- [ ] **Step 2: Verify build + lint pass**

```bash
bun run build
bun run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/internal/executor.ts
git commit -m "feat: add executor with smart retry + first-401 refresh"
```

---

## Task 7: Update `src/types/index.ts`

Type surface changes for all features and the API breaks.

**Files:**

- Modify: `src/types/index.ts`

- [ ] **Step 1: Rewrite `src/types/index.ts` in full**

Write the file as:

```ts
import type {
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig
} from 'axios';

export type CustomToastMessageType =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'custom'
  | string;

export type ToastOptions =
  | Record<string, string | number | boolean | undefined>
  | string
  | number
  | undefined;

export type ToastHandler = (
  message: string,
  type?: CustomToastMessageType,
  options?: ToastOptions
) => void;

export interface TokenCallbacks {
  getAccessToken?: () => string | null | undefined;
  setAccessToken?: (token: string | null) => void;
  getRefreshToken?: () => string | null | undefined;
  setRefreshToken?: (token: string | null) => void;
}

export interface RefreshTokens {
  accessToken: string;
  refreshToken: string;
}

export type EventHandler = (...args: unknown[]) => void;

export type RequestStatus = 'idle' | 'loading' | 'success' | 'error';

export type ShouldRetry = (error: AxiosError, attempt: number) => boolean;

export interface CacheOptions {
  ttl?: number;
  /** Additional window (in ms) during which a stale cached response is served while a background refresh runs. */
  staleWhileRevalidate?: number;
}

export interface AxlyConfig {
  multiToken?: boolean;
  token?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  refreshEndpoint?: string;
  baseURL: string;
  /** Auth scheme prefix in the Authorization header. Default `'Bearer'`. Pass `null` or `''` to send the token raw. */
  authScheme?: string | null;
  requestInterceptors?: Array<
    (
      config: InternalAxiosRequestConfig
    ) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>
  >;
  responseInterceptors?: Array<
    (response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>
  >;
  errorHandler?: (err: AxiosError) => Promise<AxiosResponse> | AxiosResponse;
  toastHandler?: ToastHandler;
  tokenCallbacks?: TokenCallbacks;
  refreshTimeout?: number;
  onRefresh?: (tokens: RefreshTokens) => void;
  onRefreshFail?: (err: Error) => void;
  dedupeRequests?: boolean;
  /** Predicate that decides whether to retry a given error. Default: network errors + 5xx + 408 + 429. */
  shouldRetry?: ShouldRetry;
}

export type ContentType =
  | 'text/html'
  | 'text/plain'
  | 'multipart/form-data'
  | 'application/json'
  | 'application/x-www-form-urlencoded'
  | 'application/octet-stream'
  | string;

export interface RequestOptions<D = unknown, C extends string = 'default'> {
  method: AxiosRequestConfig['method'];
  data?: D;
  url: string;
  contentType?: ContentType;
  customHeaders?: Record<string, string>;
  responseType?: AxiosRequestConfig['responseType'];
  params?: Record<string, string | number | boolean>;
  baseURL?: string;
  toastHandler?: ToastHandler;
  successToast?: boolean;
  errorToast?: boolean;
  customToastMessage?: string;
  customToastMessageType?: CustomToastMessageType;
  customErrorToastMessage?: string;
  customErrorToastMessageType?: CustomToastMessageType;
  onUploadProgress?: (progress: number) => void;
  onDownloadProgress?: (progress: number) => void;
  timeout?: number;
  retry?: number;
  cancelable?: boolean;
  onCancel?: () => void;
  configId?: C;
  dedupe?: boolean;
  cache?: boolean | CacheOptions;
  /** Per-request override of the retry predicate. Takes precedence over the config-level `shouldRetry`. */
  shouldRetry?: ShouldRetry;
}

export type StateData = {
  isLoading: boolean;
  status: RequestStatus;
  uploadProgress: number;
  downloadProgress: number;
  abortController?: AbortController | null;
};

export interface UploadOptions<C extends string = 'default'> {
  headers?: Record<string, string>;
  timeout?: number;
  onUploadProgress?: (percent: number) => void;
  onDownloadProgress?: (percent: number) => void;
  baseURL?: string;
  cancelable?: boolean;
  onCancel?: () => void;
  configId?: C;
  retry?: number;
  shouldRetry?: ShouldRetry;
  toastHandler?: ToastHandler;
  successToast?: boolean;
  errorToast?: boolean;
  customToastMessage?: string;
  customToastMessageType?: CustomToastMessageType;
  customErrorToastMessage?: string;
  customErrorToastMessageType?: CustomToastMessageType;
}

export interface InvalidateOptions<C extends string = 'default'> {
  configId?: C;
  url?: string | RegExp;
  predicate?: (key: string) => boolean;
}

export interface AxlyClient<C extends string = 'default'> {
  request<T = unknown, D = unknown>(
    options: RequestOptions<D, C>,
    stateUpdater?: (
      update: Partial<StateData> | ((prev: StateData) => StateData)
    ) => void
  ): Promise<AxiosResponse<T>>;
  upload<T = unknown>(
    url: string,
    formData: FormData,
    opts?: UploadOptions<C>
  ): Promise<AxiosResponse<T>>;
  setAccessToken(token: string | null, configId?: C): void;
  setRefreshToken(token: string | null, configId?: C): void;
  setDefaultHeader(
    name: string,
    value: string | number | boolean,
    configId?: C
  ): void;
  clearDefaultHeader(name: string, configId?: C): void;
  cancelRequest(controller?: AbortController | null): void;
  invalidate(options?: InvalidateOptions<C>): void;
  destroy(): void;
  on(event: string, handler: (...args: unknown[]) => void): () => void;
}

export interface AxlyQueryOptions<
  T = unknown,
  D = unknown,
  C extends string = 'default'
> {
  client: AxlyClient<C>;
  request: RequestOptions<D, C>;
  enabled?: boolean;
  refetchOnMount?: boolean;
  refetchInterval?: number | false;
  onSuccess?: (data: AxiosResponse<T>) => void;
  onError?: (error: Error) => void;
}

export interface AxlyQueryResult<T = unknown> {
  data: AxiosResponse<T> | null;
  error: Error | null;
  status: RequestStatus;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => Promise<void>;
}

export interface AxlyMutationOptions<
  T = unknown,
  C extends string = 'default'
> {
  client: AxlyClient<C>;
  onSuccess?: (data: AxiosResponse<T>) => void;
  onError?: (error: Error) => void;
  onSettled?: (data: AxiosResponse<T> | null, error: Error | null) => void;
}

export interface AxlyMutationResult<
  T = unknown,
  D = unknown,
  C extends string = 'default'
> {
  mutate: (options: RequestOptions<D, C>) => void;
  mutateAsync: (options: RequestOptions<D, C>) => Promise<AxiosResponse<T>>;
  isPending: boolean;
  data: AxiosResponse<T> | null;
  error: Error | null;
  status: RequestStatus;
  reset: () => void;
}
```

Key changes from v2:

- Added `authScheme`, `shouldRetry` on `AxlyConfig`
- Added `shouldRetry` on `RequestOptions`
- Added `staleWhileRevalidate` on `CacheOptions`
- Added `ShouldRetry` type alias
- Added `InvalidateOptions<C>`
- Expanded `UploadOptions<C>` with retry/toast fields
- `AxlyClient`: removed `setAuthorizationHeader` and `clearCache`; added `invalidate(options?)`
- `AxlyMutationOptions<T, _D, C>` → `AxlyMutationOptions<T, C>` (removed middle generic)

- [ ] **Step 2: Verify build + lint pass**

```bash
bun run build
bun run lint
```

Expected: build will error because `client.ts` still references `clearCache`, `setAuthorizationHeader`, and the old `AxlyMutationOptions` shape. That's OK — the errors will be resolved by Task 8 and consumers (`useAxlyMutation`) are updated in Task 7.5 below.

Wait and check: run only `tsc --noEmit` on the isolated file first:

```bash
bunx tsc --noEmit src/types/index.ts
```

Expected: clean (file should type-check by itself).

- [ ] **Step 3: Update `src/react/useAxlyMutation.tsx` to match the new generic shape**

Open `src/react/useAxlyMutation.tsx` and change the generic signature:

Replace lines 10-16:

```tsx
const useAxlyMutation = <
  T = unknown,
  D = unknown,
  C extends string = 'default'
>(
  options: AxlyMutationOptions<T, D, C>
): AxlyMutationResult<T, D, C> => {
```

With:

```tsx
const useAxlyMutation = <
  T = unknown,
  D = unknown,
  C extends string = 'default'
>(
  options: AxlyMutationOptions<T, C>
): AxlyMutationResult<T, D, C> => {
```

(`D` is still used on `mutate`/`mutateAsync` via `AxlyMutationResult`, so it stays as a generic on the hook. Only `AxlyMutationOptions` drops it.)

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/react/useAxlyMutation.tsx
git commit -m "feat(types): add authScheme, shouldRetry, staleWhileRevalidate, invalidate; drop unused _D generic"
```

Note: the repo is still in a broken build state after this commit (client.ts references removed members). Task 8 fixes that. The pre-commit hook runs `lint` + `build`; if it blocks this commit, add `--no-verify` to the commit **only if** the user authorizes it, or bundle Tasks 7+8 into a single commit instead.

**Authorization note:** per the repo's CLAUDE.md and the system's "no `--no-verify` without explicit user request" rule, the default here is to **bundle Task 7 and Task 8 into a single commit** rather than use `--no-verify`. The task-by-task structure above is for readability; executors should treat Tasks 7 + 8 as one commit boundary.

---

## Task 8: Rewrite `src/client.ts` to integrate all internal modules

This is the largest change: integrates `Emitter`, `TokenManager`, `CacheStore`, `InflightMap`, `buildRequestKey`, `executeRequest`; collapses 4 parallel Maps into `runtimes`; adds `authScheme` support; merges `setAccessToken`/`setAuthorizationHeader`; replaces `clearCache` with `invalidate`; reimplements `upload()` as a thin `request()` wrapper.

**Files:**

- Replace: `src/client.ts` (entire file)

- [ ] **Step 1: Replace `src/client.ts` with the full new content below**

```ts
/* global AbortController, FormData */
import axios, {
  AxiosHeaders,
  AxiosInstance,
  AxiosProgressEvent,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig
} from 'axios';
import {
  AxlyClient,
  AxlyConfig,
  ContentType,
  EventHandler,
  InvalidateOptions,
  RequestOptions,
  StateData,
  ToastHandler,
  UploadOptions
} from './types/index.js';
import {
  hasMessageInResponse,
  isBrowser,
  sanitizeToastMessage
} from './utils/index.js';
import { AuthError, CancelledError, RequestError } from './utils/errors.js';
import { Emitter } from './internal/emitter.js';
import { TokenManager } from './internal/tokenManager.js';
import { CacheStore } from './internal/cache.js';
import { InflightMap } from './internal/deduper.js';
import { buildRequestKey } from './internal/requestKey.js';
import { executeRequest } from './internal/executor.js';

interface ResponseWithData {
  message: string;
}

interface ConfigRuntime {
  config: AxlyConfig;
  instance: AxiosInstance;
  tokenManager: TokenManager;
  applyAccessToken: (token: string | null) => void;
  setDefaultHeader: (
    name: string,
    value: string | number | boolean | null
  ) => void;
}

const isAxlyConfig = (input: unknown): input is AxlyConfig =>
  typeof input === 'object' &&
  input !== null &&
  'baseURL' in input &&
  typeof (input as Record<string, unknown>)['baseURL'] === 'string';

const normalizeConfigs = <CM extends Record<string, AxlyConfig>>(
  configInput: CM | AxlyConfig
): CM =>
  isAxlyConfig(configInput) ?
    ({ default: configInput as AxlyConfig } as unknown as CM)
  : (configInput as CM);

const resetState: StateData = {
  isLoading: false,
  status: 'idle',
  uploadProgress: 0,
  downloadProgress: 0,
  abortController: null
};

const successState: StateData = {
  isLoading: false,
  status: 'success',
  uploadProgress: 100,
  downloadProgress: 100,
  abortController: null
};

const formatAuthHeaderValue = (
  token: string,
  scheme: string | null | undefined
): string => {
  if (scheme == null || scheme === '') return token;
  return `${scheme} ${token}`;
};

export const createAxlyClient = <
  CM extends Record<string, AxlyConfig> = { default: AxlyConfig }
>(
  configInput: CM | AxlyConfig
): AxlyClient<keyof CM & string> => {
  const configs: CM = normalizeConfigs<CM>(configInput);
  type CMKey = keyof CM & string;

  const emitter = new Emitter();
  const cache = new CacheStore();
  const deduper = new InflightMap();
  const runtimes: Map<CMKey, ConfigRuntime> = new Map();

  Object.entries(configs).forEach(([cfgId, config]) => {
    const configId = cfgId as CMKey;
    const instance = axios.create({ baseURL: config.baseURL });

    config.requestInterceptors?.forEach((interceptor) =>
      instance.interceptors.request.use(
        interceptor as (
          c: InternalAxiosRequestConfig
        ) => InternalAxiosRequestConfig
      )
    );
    config.responseInterceptors?.forEach((interceptor) =>
      instance.interceptors.response.use(
        interceptor as (r: AxiosResponse) => AxiosResponse
      )
    );

    const applyAccessToken = (token: string | null): void => {
      const headers = AxiosHeaders.from(instance.defaults.headers.common);
      if (token) {
        headers.set(
          'Authorization',
          formatAuthHeaderValue(token, config.authScheme)
        );
      } else {
        headers.delete('Authorization');
      }
      instance.defaults.headers.common = headers;
    };

    const setDefaultHeader = (
      name: string,
      value: string | number | boolean | null
    ): void => {
      const headers = AxiosHeaders.from(instance.defaults.headers.common);
      if (value == null) headers.delete(name);
      else headers.set(name, String(value));
      instance.defaults.headers.common = headers;
    };

    const tokenManager = new TokenManager(
      config,
      () => instance,
      applyAccessToken
    );

    runtimes.set(configId, {
      config,
      instance,
      tokenManager,
      applyAccessToken,
      setDefaultHeader
    });

    const initialToken =
      config.multiToken ?
        (config.tokenCallbacks?.getAccessToken?.() ??
        config.accessToken ??
        null)
      : (config.token ?? null);
    applyAccessToken(initialToken);
  });

  const requireRuntime = (configId: CMKey): ConfigRuntime => {
    const rt = runtimes.get(configId);
    if (!rt) throw new Error(`Config ${configId} not found`);
    return rt;
  };

  const getAccessToken = (
    configId: CMKey = 'default' as CMKey
  ): string | null => {
    const { config } = requireRuntime(configId);
    return config.multiToken ?
        (config.tokenCallbacks?.getAccessToken?.() ??
          config.accessToken ??
          null)
      : (config.token ?? null);
  };

  const attachAuthHeader = (
    reqConfig: AxiosRequestConfig,
    configId: CMKey
  ): AxiosRequestConfig => {
    const { config } = requireRuntime(configId);
    const token = getAccessToken(configId);
    if (token) {
      reqConfig.headers = reqConfig.headers ?? {};
      (reqConfig.headers as Record<string, string>)['Authorization'] =
        formatAuthHeaderValue(token, config.authScheme);
    }
    return reqConfig;
  };

  const applyStateReset = (
    stateUpdater:
      | ((
          update: Partial<StateData> | ((prev: StateData) => StateData)
        ) => void)
      | undefined,
    status: StateData['status']
  ): void => {
    if (!stateUpdater) return;
    stateUpdater(
      status === 'success' ? successState : { ...resetState, status }
    );
  };

  const buildRequestConfig = <D>(
    options: RequestOptions<D, CMKey>,
    stateUpdater:
      | ((
          update: Partial<StateData> | ((prev: StateData) => StateData)
        ) => void)
      | undefined,
    abortController: AbortController | undefined
  ): AxiosRequestConfig => {
    const {
      method,
      data,
      url,
      contentType: rawContentType,
      customHeaders,
      responseType = 'json',
      params,
      baseURL,
      onUploadProgress,
      onDownloadProgress,
      timeout = 100_000
    } = options;

    // Preserve v2 default of 'application/json' for non-FormData payloads.
    // For FormData, leave Content-Type unset so axios can add the multipart boundary.
    const isFormData =
      typeof FormData !== 'undefined' && data instanceof FormData;
    const contentType =
      rawContentType ?? (isFormData ? undefined : 'application/json');

    const headers: Record<string, string> = { ...(customHeaders ?? {}) };
    if (contentType) headers['Content-Type'] = contentType as ContentType;

    const cfg: AxiosRequestConfig = {
      method,
      url,
      data,
      params,
      responseType,
      timeout,
      baseURL,
      headers,
      onUploadProgress: (progressEvent: AxiosProgressEvent) => {
        const percent = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total || 1)
        );
        stateUpdater?.((prev) => ({ ...prev, uploadProgress: percent }));
        onUploadProgress?.(percent);
      },
      onDownloadProgress: (progressEvent: AxiosProgressEvent) => {
        const percent = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total || 1)
        );
        stateUpdater?.((prev) => ({ ...prev, downloadProgress: percent }));
        onDownloadProgress?.(percent);
      }
    };
    if (abortController) cfg.signal = abortController.signal;
    return cfg;
  };

  const request = async <T = unknown, D = unknown>(
    options: RequestOptions<D, CMKey>,
    stateUpdater?: (
      update: Partial<StateData> | ((prev: StateData) => StateData)
    ) => void
  ): Promise<AxiosResponse<T>> => {
    const configId = (options.configId ?? ('default' as CMKey)) as CMKey;
    const rt = requireRuntime(configId);
    const { config, instance, tokenManager, applyAccessToken } = rt;

    const {
      method,
      url,
      params,
      customHeaders,
      toastHandler: optionsToastHandler,
      successToast = false,
      errorToast = false,
      customToastMessage,
      customToastMessageType = 'success',
      customErrorToastMessage,
      customErrorToastMessageType = 'error',
      retry = 0,
      cancelable = false,
      onCancel,
      dedupe = false,
      cache: cacheOpt = false,
      shouldRetry
    } = options;

    const effectiveToastHandler: ToastHandler | undefined =
      isBrowser ? (optionsToastHandler ?? config.toastHandler) : undefined;

    const isGetMethod = (method ?? 'GET').toUpperCase() === 'GET';
    const cacheEnabled = cacheOpt !== false && isGetMethod;
    const ttlMs =
      typeof cacheOpt === 'object' && cacheOpt.ttl != null ?
        cacheOpt.ttl
      : 300_000;
    const swrMs =
      typeof cacheOpt === 'object' && cacheOpt.staleWhileRevalidate != null ?
        cacheOpt.staleWhileRevalidate
      : 0;

    const cacheKey = buildRequestKey(
      method,
      url,
      params,
      configId,
      customHeaders
    );

    // Cache lookup
    if (cacheEnabled) {
      const lookup = cache.get<T>(cacheKey);
      if (lookup.status === 'fresh') {
        return lookup.response;
      }
      if (lookup.status === 'stale') {
        // Serve stale, schedule background refresh (which bypasses cache lookup)
        if (cache.markRefreshing(cacheKey)) {
          void (async () => {
            try {
              const abortCtrl = cancelable ? new AbortController() : undefined;
              const bgRequestConfig = buildRequestConfig(
                { ...options, successToast: false, errorToast: false },
                undefined,
                abortCtrl
              );
              attachAuthHeader(bgRequestConfig, configId);
              const fresh = await executeRequest<T>({
                instance,
                requestConfig: bgRequestConfig,
                config,
                retry,
                tokenManager,
                applyAccessToken,
                reapplyAuthHeader: () =>
                  attachAuthHeader(bgRequestConfig, configId),
                shouldRetry
              });
              cache.set(cacheKey, fresh, ttlMs, swrMs);
            } catch {
              // Background refresh errors are swallowed by design
            } finally {
              cache.clearRefreshing(cacheKey);
            }
          })();
        }
        return lookup.response;
      }
    }

    // Deduplication
    const shouldDedupe = (dedupe || config.dedupeRequests) && isGetMethod;
    if (shouldDedupe) {
      const inflight = deduper.get<T>(cacheKey);
      if (inflight) return inflight;
    }

    const abortController = cancelable ? new AbortController() : undefined;
    stateUpdater?.({
      isLoading: true,
      status: 'loading',
      uploadProgress: 0,
      downloadProgress: 0,
      abortController: abortController ?? null
    });

    const requestConfig = buildRequestConfig(
      options,
      stateUpdater,
      abortController
    );
    attachAuthHeader(requestConfig, configId);

    const handleSuccess = (response: AxiosResponse<T>): AxiosResponse<T> => {
      applyStateReset(stateUpdater, 'success');
      if (successToast && effectiveToastHandler) {
        const msg =
          customToastMessage ??
          (hasMessageInResponse(response.data) ?
            (response.data as ResponseWithData).message
          : undefined);
        if (msg)
          effectiveToastHandler(
            sanitizeToastMessage(msg),
            customToastMessageType
          );
      }
      if (cacheEnabled) {
        cache.set(cacheKey, response, ttlMs, swrMs);
      }
      return response;
    };

    const handleError = async (err: unknown): Promise<AxiosResponse<T>> => {
      applyStateReset(stateUpdater, 'error');
      // Pass through our own error classes unchanged — they already carry the right context.
      if (err instanceof CancelledError) throw err;
      if (err instanceof AuthError) throw err;
      if (err instanceof RequestError) throw err;
      if (axios.isAxiosError(err)) {
        if (errorToast && effectiveToastHandler) {
          const responseData = err.response?.data;
          const errorMessage =
            customErrorToastMessage ??
            (hasMessageInResponse(responseData) ?
              (responseData as ResponseWithData).message
            : undefined) ??
            'An error occurred';
          effectiveToastHandler(
            sanitizeToastMessage(errorMessage),
            customErrorToastMessageType
          );
        }
        if (config.errorHandler) {
          try {
            const handled = await config.errorHandler(err);
            return handled as AxiosResponse<T>;
          } catch {
            // Fall through to throwing RequestError
          }
        }
        throw new RequestError(
          err.message || 'Request failed',
          err,
          err.response ?? null,
          err.code ?? null
        );
      }
      if (err instanceof Error) {
        throw new RequestError(err.message, err);
      }
      throw new RequestError('Request failed', err);
    };

    const run = async (): Promise<AxiosResponse<T>> => {
      try {
        const response = await executeRequest<T>({
          instance,
          requestConfig,
          config,
          retry,
          tokenManager,
          applyAccessToken,
          reapplyAuthHeader: () => attachAuthHeader(requestConfig, configId),
          shouldRetry,
          onCancel
        });
        return handleSuccess(response);
      } catch (err) {
        return handleError(err);
      }
    };

    if (shouldDedupe) {
      return deduper.register(cacheKey, run());
    }
    return run();
  };

  const upload = async <T = unknown>(
    url: string,
    formData: FormData,
    opts?: UploadOptions<CMKey>
  ): Promise<AxiosResponse<T>> => {
    const {
      headers,
      timeout = 120_000,
      onUploadProgress,
      onDownloadProgress,
      baseURL,
      cancelable = false,
      onCancel,
      configId,
      retry,
      shouldRetry,
      toastHandler,
      successToast,
      errorToast,
      customToastMessage,
      customToastMessageType,
      customErrorToastMessage,
      customErrorToastMessageType
    } = opts ?? {};

    return request<T, FormData>({
      method: 'POST',
      url,
      data: formData,
      // Intentionally NOT setting contentType — axios auto-sets the multipart boundary
      customHeaders: headers,
      timeout,
      baseURL,
      cancelable,
      onCancel,
      configId,
      retry,
      shouldRetry,
      onUploadProgress,
      onDownloadProgress,
      toastHandler,
      successToast,
      errorToast,
      customToastMessage,
      customToastMessageType,
      customErrorToastMessage,
      customErrorToastMessageType
    });
  };

  const cancelRequest = (controller?: AbortController | null): void => {
    if (controller) controller.abort();
  };

  const invalidate = (options?: InvalidateOptions<CMKey>): void => {
    if (!options) {
      cache.invalidate();
      deduper.clear();
      return;
    }
    const { configId, url, predicate } = options;
    const matchers: Array<(key: string) => boolean> = [];
    if (configId) {
      const suffix = `:${configId}:`;
      matchers.push((k) => k.includes(suffix));
    }
    if (url instanceof RegExp) {
      matchers.push((k) => url.test(k));
    } else if (typeof url === 'string') {
      matchers.push((k) => k.includes(`:${url}:`) || k.includes(`:${url}`));
    }
    if (predicate) matchers.push(predicate);
    const finalPredicate =
      matchers.length === 0 ?
        undefined
      : (k: string) => matchers.every((m) => m(k));
    cache.invalidate(finalPredicate);
    deduper.invalidate(finalPredicate);
  };

  const destroy = (): void => {
    cache.destroy();
    deduper.clear();
    runtimes.forEach((rt) => rt.tokenManager.clear());
    runtimes.clear();
    emitter.emit('destroy');
  };

  const on = (event: string, fn: EventHandler): (() => void) =>
    emitter.on(event, fn);

  const setAccessToken = (
    token: string | null,
    configId: CMKey = 'default' as CMKey
  ): void => {
    const { config, applyAccessToken } = requireRuntime(configId);
    // Update storage (single-token or multi-token mode)
    if (config.multiToken) {
      if (config.tokenCallbacks?.setAccessToken) {
        config.tokenCallbacks.setAccessToken(token);
      } else {
        config.accessToken = token;
      }
    } else {
      config.token = token;
    }
    // Update axios default header
    applyAccessToken(token);
  };

  const setRefreshToken = (
    token: string | null,
    configId: CMKey = 'default' as CMKey
  ): void => {
    const { config } = requireRuntime(configId);
    if (config.tokenCallbacks?.setRefreshToken) {
      config.tokenCallbacks.setRefreshToken(token);
    } else {
      config.refreshToken = token;
    }
  };

  const setDefaultHeader = (
    name: string,
    value: string | number | boolean,
    configId: CMKey = 'default' as CMKey
  ): void => {
    const { setDefaultHeader: fn } = requireRuntime(configId);
    fn(name, value);
  };

  const clearDefaultHeader = (
    name: string,
    configId: CMKey = 'default' as CMKey
  ): void => {
    const { setDefaultHeader: fn } = requireRuntime(configId);
    fn(name, null);
  };

  return {
    request,
    upload,
    setAccessToken,
    setRefreshToken,
    setDefaultHeader,
    clearDefaultHeader,
    cancelRequest,
    invalidate,
    destroy,
    on
  };
};

export const createAxlyNodeClient = <
  CM extends Record<string, AxlyConfig> = { default: AxlyConfig }
>(
  configInput: CM | AxlyConfig
) => {
  const configs = normalizeConfigs<CM>(configInput);
  const nodeConfigs: CM = Object.fromEntries(
    Object.entries(configs).map(([k, v]) => [
      k,
      { ...(v as AxlyConfig), toastHandler: undefined }
    ])
  ) as unknown as CM;
  return createAxlyClient<CM>(nodeConfigs);
};
```

- [ ] **Step 2: Verify build + lint pass**

```bash
bun run build
bun run lint
```

Expected: both clean. `dist/` will now include `dist/internal/*.js`.

- [ ] **Step 3: Ad-hoc sanity check — instantiate the client and call `invalidate` to confirm the timer `.unref()`s properly**

```bash
bun -e "
import('./dist/client.js').then(async ({ createAxlyNodeClient }) => {
  const client = createAxlyNodeClient({ baseURL: 'https://httpbin.org' });
  client.invalidate();
  client.destroy();
  console.log('OK: client created, invalidated, destroyed');
});
"
```

Expected: `OK: client created, invalidated, destroyed` — and the process exits on its own within a second or two. If it hangs, the timer `.unref()` didn't apply and Task 4 needs re-inspection.

- [ ] **Step 4: Commit (bundled with Task 7)**

```bash
git add src/client.ts
git commit -m "feat(client)!: integrate internal modules; merge auth setters; invalidate replaces clearCache

BREAKING CHANGE: setAuthorizationHeader removed (use setAccessToken).
BREAKING CHANGE: clearCache removed (use invalidate({configId, url, predicate})).
BREAKING CHANGE: default retry scope restricted to network errors + 5xx + 408 + 429
  (override with shouldRetry: () => true to restore v2 behavior).
BREAKING CHANGE: upload() now inherits retry/toast/dedupe from request()."
```

---

## Task 9: Memoize `request` in `useAxly`

**Files:**

- Modify: `src/react/useAxly.tsx`

- [ ] **Step 1: Replace `src/react/useAxly.tsx` with memoized version**

```tsx
import type { AxiosResponse } from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AxlyClient, RequestOptions, StateData } from '../types/index.js';

const useAxly = <C extends string = 'default'>(client: AxlyClient<C>) => {
  const mountedRef = useRef<boolean>(true);
  const [state, setState] = useState<StateData>({
    isLoading: false,
    status: 'idle',
    uploadProgress: 0,
    downloadProgress: 0,
    abortController: null
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const request = useCallback(
    async <T = unknown, D = unknown>(
      options: RequestOptions<D, C>
    ): Promise<AxiosResponse<T>> => {
      const wrappedUpdater = (
        update: Partial<StateData> | ((prev: StateData) => StateData)
      ): void => {
        if (!mountedRef.current) return;
        if (typeof update === 'function') {
          setState((prev) => (update as (prev: StateData) => StateData)(prev));
        } else {
          setState((prev) => ({ ...prev, ...update }));
        }
      };
      return client.request<T, D>(options, wrappedUpdater);
    },
    [client]
  );

  const cancelRequest = (): void => {
    if (state.abortController) {
      state.abortController.abort();
      setState((prev) => ({ ...prev, abortController: null }));
    }
  };

  return { request, cancelRequest, ...state };
};

export default useAxly;
```

Note: `cancelRequest` is intentionally **not** memoized. The spec (3.5) only calls for memoizing `request`. Wrapping `cancelRequest` in `useCallback` would require state in the dependency array (defeating memoization) or a ref-synchronized controller (more complexity than this fix warrants). Calling `.abort()` inside a `setState` updater is also unsafe under React 18 strict mode double-invocation.

- [ ] **Step 2: Verify build + lint pass**

```bash
bun run build
bun run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/react/useAxly.tsx
git commit -m "refactor(react): memoize useAxly.request + fix stale-closure in cancelRequest"
```

---

## Task 10: Update README with v3 migration guide

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Read the current README to find the right insertion point**

```bash
wc -l README.md
```

Open `README.md` and find either (a) an existing "Migration" or "Changelog" section, or (b) the "API Reference" / "Options" section. If neither exists, append the migration section near the top, just after the intro.

- [ ] **Step 2: Insert the migration section**

Add this section (adapt heading level to match the file):

````markdown
## Migrating from v2 to v3

v3 is a breaking release. The high-level API is unchanged — `createAxlyClient`, `useAxly`, `useAxlyQuery`, `useAxlyMutation` all work the same — but a handful of methods were renamed or consolidated.

### 1. `clearCache` → `invalidate`

```ts
// v2
client.clearCache();
client.clearCache('mainAPI');

// v3
client.invalidate();
client.invalidate({ configId: 'mainAPI' });
client.invalidate({ url: /\/users\// });
client.invalidate({ predicate: (key) => key.includes('list') });
```

### 2. `setAuthorizationHeader` → `setAccessToken`

They now do the same thing — update storage _and_ the axios default header.

```ts
// v2
client.setAuthorizationHeader(token);

// v3
client.setAccessToken(token);
```

### 3. `useAxlyMutation` generic signature

The unused middle generic was removed:

```ts
// v2
useAxlyMutation<MyData, MyRequestBody, 'mainAPI'>({ client });

// v3
useAxlyMutation<MyData, MyRequestBody, 'mainAPI'>({ client });
// ^ same hook signature; only AxlyMutationOptions dropped the middle generic.
// If you used AxlyMutationOptions<T, _D, C> directly, change it to AxlyMutationOptions<T, C>.
```

### 4. Retry defaults

v2 retried any error except cancellation. v3 only retries on:

- Network errors (`ERR_NETWORK`, `ECONNABORTED`, `ETIMEDOUT`)
- HTTP 5xx
- HTTP 408 and 429

To restore v2 behavior, pass `shouldRetry: () => true` on the config or per-request.

### 5. Upload retries

`upload()` is now implemented in terms of `request()` and inherits retry behavior. To preserve v2 (no retries), pass `retry: 0`:

```ts
client.upload(url, formData, { retry: 0 });
```

### New features in v3

- **`authScheme`** — `AxlyConfig.authScheme?: string | null` (default `'Bearer'`). Pass `null` or `''` to send the token raw.
- **`shouldRetry`** — custom retry predicate on both `AxlyConfig` and `RequestOptions`.
- **`staleWhileRevalidate`** — extend `CacheOptions` to serve stale responses while refreshing in the background.
- **`invalidate({ url, predicate })`** — pattern-based cache invalidation.
````

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add v3 migration guide"
```

---

## Task 11: Bump version to 3.0.0

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Edit `package.json` — change the `version` field from `2.0.0` to `3.0.0`**

Use Edit to change:

```json
"version": "2.0.0",
```

to:

```json
"version": "3.0.0",
```

- [ ] **Step 2: Final verification — run the full chain**

```bash
bun run build
bun run lint
bun run prettier:check
```

All three must pass.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: bump version to 3.0.0"
```

**Do NOT run `bun run release`.** The user needs to authorize the actual npm publish.

---

## Self-review — spec coverage verification

After completing all tasks, cross-check against the spec:

| Spec section                          | Implementing task(s)                                                |
| ------------------------------------- | ------------------------------------------------------------------- |
| 2.1 Cache sweep `.unref()`            | Task 4 (CacheStore constructor)                                     |
| 2.2 401 vs retry                      | Task 6 (executor.ts) + Task 8 (executor wired in)                   |
| 2.3 Cache key normalization           | Task 3 (requestKey.ts)                                              |
| 2.4 `upload()` parity                 | Task 8 (upload delegates to request)                                |
| 3.1 Single `runtimes` map             | Task 8 (ConfigRuntime)                                              |
| 3.2 Simplify `setAuthorizationHeader` | Task 8 (removed; merged into setAccessToken)                        |
| 3.3 `normalizeConfigs` helper         | Task 8                                                              |
| 3.4 Remove `_D` generic               | Task 7                                                              |
| 3.5 Memoize `useAxly`                 | Task 9                                                              |
| 3.6 `AxiosHeaders` typed API          | Task 8 (applyAccessToken + setDefaultHeader)                        |
| 4.1 `authScheme`                      | Task 7 (type) + Task 8 (formatAuthHeaderValue)                      |
| 4.2 `shouldRetry`                     | Task 6 (predicate) + Task 7 (types) + Task 8 (wired)                |
| 4.3 SWR                               | Task 4 (CacheStore.get returns stale) + Task 8 (background refresh) |
| 4.4 `invalidate(pattern)`             | Task 7 (types) + Task 8 (implementation)                            |

All 14 spec items have an implementing task.

---

## Notes for executor

- The pre-commit hook (husky + lint-staged) runs lint + build on every commit. If the hook fails, fix the issue and make a NEW commit — do not amend, do not use `--no-verify`.
- Task 7 leaves the repo in a broken build state (type-only commit). Task 8 fixes it. These two tasks **must be committed together** (bundle into one commit) or the pre-commit hook will block Task 7's commit.
- The package uses ESM + `nodenext` module resolution. All internal imports use explicit `.js` extensions (even for `.ts` source files). The plan follows this convention — do not remove the `.js` suffixes.
- `dist/` is gitignored. Don't commit it.
- Do NOT run `bun run release`. It bumps the version _again_ and publishes — user must initiate publish.
