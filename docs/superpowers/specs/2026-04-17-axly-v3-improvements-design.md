# Axly v3 — Bug fixes, refactors, and new features

**Status:** Approved design, pending implementation
**Date:** 2026-04-17
**Scope:** Single implementation cycle, breaking release (v3.0.0)

## Goal

Improve the `axly` npm package across three dimensions in a single breaking release:

1. Fix 4 correctness bugs in the current implementation.
2. Refactor internals for clarity (decompose the 790-line `client.ts`, collapse redundant state).
3. Add 4 user-facing features that fill real gaps (configurable auth scheme, smart retry, stale-while-revalidate, pattern-based cache invalidation).

Public API surface stays recognizable — factory + hooks + errors — but with targeted breaking changes where they unlock real improvements.

## Architecture

### Module decomposition

```text
src/
  client.ts              factory, orchestration (~350 LOC, down from 790)
  index.ts               re-exports
  internal/
    cache.ts             CacheStore: TTL + SWR + invalidate(pattern) + .unref() timer
    deduper.ts           InflightMap: dedupe registry + pattern cleanup
    emitter.ts           Emitter class
    tokenManager.ts      TokenManager class
    requestKey.ts        buildRequestKey + canonical param sort
    executor.ts          executeWithRetry + 401-aware refresh loop
  react/
    useAxly.tsx
    useAxlyQuery.tsx
    useAxlyMutation.tsx
  types/index.ts
  utils/
    index.ts
    errors.ts
```

**Rationale:** `client.ts` today mixes orchestration with subsystem logic. After the split, `client.ts` wires together well-defined internal modules and holds only the public `AxlyClient` surface. Each `internal/*` file has one purpose, can be read independently, and is not re-exported from any entry point (convention only — no runtime enforcement).

`executor.ts` is the largest new file: it extracts `executeWithRetry` + `executeRequest` out of their current closure-heavy home inside `request()`. This extraction is what enables the 401/retry fix (Bug 2.2 below) cleanly; the refresh-after-retry-loop shape in v2 is forced by closure scope.

### Per-config runtime state

Current v2 uses 4 parallel `Map<CMKey, ...>` structures keyed by the same `configId`:
`axiosInstances`, `tokenManagers`, `applyAccessTokenFunctions`, `setDefaultHeaderFunctions`.

v3 collapses these to a single map:

```ts
interface ConfigRuntime {
  instance: AxiosInstance;
  tokenManager: TokenManager;
  applyAccessToken: (token: string | null) => void;
  setDefaultHeader: (
    name: string,
    value: string | number | boolean | null
  ) => void;
  config: AxlyConfig;
}
const runtimes: Map<CMKey, ConfigRuntime> = new Map();
```

One lookup per request path.

## Bug fixes

### 2.1 Cache sweep timer keeps Node process alive

`client.ts:187` sets `setInterval` without `.unref()`. In Node, this prevents the process from exiting until `destroy()` is called — which is easy to forget in short-lived scripts.

**Fix** (in `internal/cache.ts`):

```ts
const timer: NodeJS.Timeout | number = setInterval(this.sweep, 60_000);
if (typeof (timer as NodeJS.Timeout).unref === 'function') {
  (timer as NodeJS.Timeout).unref();
}
```

No-op in browsers (where `setInterval` returns a number). No behavior change in Node beyond the timer no longer holding the event loop open.

### 2.2 Retries burn through before 401 refresh

Current flow (`client.ts:455-549`):

1. `executeWithRetry` tries up to `retry + 1` times
2. If all attempts fail, `executeRequest` catches the final error
3. Only then does the 401 check fire and trigger refresh
4. After refresh, `executeWithRetry` runs _again_ — another `retry + 1` attempts

If the server returns 401, v2 wastes every retry on a stale token before refreshing.

**Fix** (in `internal/executor.ts`): inside the attempt loop, check the caught error _before_ sleeping for retry. If it's 401 AND refresh is configured AND refresh hasn't been tried yet, break out, refresh once, then re-enter the loop with a fresh token and `attempt` reset to 0. A `refreshAttempted` flag guards against infinite refresh loops (a 401 after successful refresh will fall through to the normal retry path).

### 2.3 Cache/dedupe key depends on param order

`buildRequestKey` uses `JSON.stringify(params)` directly, so `{a:1,b:2}` and `{b:2,a:1}` produce different keys even though the resulting URL is the same.

**Fix** (in `internal/requestKey.ts`): canonical serializer that sorts keys before stringifying. Applied to both `params` and `customHeaders`.

```ts
const canonicalStringify = (
  obj: Record<string, unknown> | undefined
): string => {
  if (!obj) return '{}';
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) sorted[key] = obj[key];
  return JSON.stringify(sorted);
};
```

### 2.4 `upload()` is a parallel, inferior code path

Current `upload()` (`client.ts:570-653`) duplicates request + refresh logic but lacks retry, toast, cache, dedupe, and `stateUpdater`. It also duplicates 401 handling.

**Fix:** reimplement `upload()` as a thin wrapper that delegates to `request()` with `method: 'POST'`, `data: formData`. Do **not** set `contentType` — axios auto-sets `multipart/form-data; boundary=...` when it detects `FormData`. Setting it manually strips the boundary and breaks uploads, which is why the v2 upload path omitted it; v3 preserves that behavior by simply not passing `contentType`.

`UploadOptions` gains the fields from `RequestOptions` that make sense for uploads: `retry`, `shouldRetry`, `successToast`/`errorToast`, `customToastMessage`. Dedupe and cache don't apply (GET-only).

## Refactors

### 3.1 Single per-config runtime

Described above in "Per-config runtime state".

### 3.2 Simplify `setAuthorizationHeader`

Current code (`client.ts:716-743`) has 4 nested branches handling combinations of `multiToken` / `tokenCallbacks` / `token == null`. All paths ultimately do "update storage, then call `applyAccessToken`".

**Fix:** delegate to `setAccessToken` (which handles the storage split) and call `applyAccessToken(token)`. ~30 lines to ~10.

Note that this introduces a merge (see Breaking Changes below): `setAccessToken` and `setAuthorizationHeader` overlap in v2 — one updates storage, the other updates axios headers — but neither is complete. v3 has one method that does both.

### 3.3 `createAxlyNodeClient` delegates cleanly

v2 re-runs the `isAxlyConfig` guard. v3 extracts a shared `normalizeConfigs()` helper used by both factories.

### 3.4 Remove unused `_D` generic

`AxlyMutationOptions<T, _D, C>` in `types/index.ts:179` — drop the middle generic. Minor API break for consumers who pass explicit generics.

### 3.5 Memoize `request` in `useAxly`

`react/useAxly.tsx:20` returns a new `request` function every render, causing unnecessary re-renders for consumers that put `request` in effect deps. Wrap in `useCallback([client])`.

### 3.6 Typed headers via `AxiosHeaders`

Replace `Record<string, unknown>` casts on axios header manipulation with the typed `AxiosHeaders` API.

## New features

### 4.1 Configurable auth scheme

v2 hardcodes `Bearer` at `client.ts:216, 272`. v3 adds:

```ts
interface AxlyConfig {
  authScheme?: string | null; // default 'Bearer'; null sends token raw
}
```

Header becomes `${authScheme} ${token}` when `authScheme` is a non-empty string, and just `token` when `authScheme` is `null` or empty.

### 4.2 `shouldRetry` predicate

v2 retries any error (except `axios.isCancel`). v3 adds opt-in control:

```ts
interface RequestOptions {
  shouldRetry?: (error: AxiosError, attempt: number) => boolean;
}
interface AxlyConfig {
  shouldRetry?: (error: AxiosError, attempt: number) => boolean;
}
```

Per-request overrides per-config. When neither is set, the default predicate retries on:

- Network errors (`error.code === 'ERR_NETWORK'`, `ECONNABORTED`, `ETIMEDOUT`)
- HTTP 5xx
- HTTP 408, 429

This is a behavior change — see Breaking Changes.

### 4.3 `staleWhileRevalidate` cache option

```ts
interface CacheOptions {
  ttl?: number; // fresh window, default 300_000
  staleWhileRevalidate?: number; // extra window during which stale is served + background refresh
}
```

Cache lookup (in `internal/cache.ts`):

- If `now < expiresAt` (fresh): return cached response.
- Else if `now < expiresAt + staleWhileRevalidate`: return cached response AND fire a background refresh. The background refresh **must bypass the cache lookup** (otherwise it re-hits the same stale entry and recurses forever). Implementation: the background refresh calls the executor directly, not `request()`. It runs with no `stateUpdater`, toast flags stripped, and errors swallowed. A `refreshingKeys: Set<string>` guards against double-refresh for the same key.
- Else: miss, full request.

### 4.4 `invalidate` replaces `clearCache`

```ts
interface InvalidateOptions<C extends string> {
  configId?: C;
  url?: string | RegExp;
  predicate?: (key: string) => boolean;
}

client.invalidate(); // clear everything
client.invalidate({ configId: 'mainAPI' }); // config-scoped
client.invalidate({ url: /\/users\// }); // URL pattern
client.invalidate({ url: '/users/123' }); // exact match (substring in key)
client.invalidate({ predicate: (k) => k.includes('list') });
```

Clears both response cache and in-flight dedupe entries for matching keys (parity with v2's `clearCache`).

## Data flow: request execution (v3)

```text
request(options, stateUpdater?)
  │
  ├─ cache lookup (GET-only)
  │   ├─ fresh hit → return
  │   └─ stale hit + SWR → return + background refresh
  │
  ├─ dedupe check (GET-only) → return in-flight promise if any
  │
  ├─ build requestConfig, attach auth header
  │
  └─ executor.run(requestConfig, configId, runtimes, options)
      │
      └─ attempt loop (attempt = 0..retry)
          │
          ├─ axios.request()
          │   ├─ success → handleSuccess (cache store, toast, state reset)
          │   └─ error
          │       ├─ cancelled → throw CancelledError
          │       ├─ 401 + refreshConfigured + !refreshAttempted
          │       │   → tokenManager.refreshTokens()
          │       │   → applyAccessToken(new)
          │       │   → reset attempt = 0, continue
          │       ├─ shouldRetry(err, attempt) === false → break
          │       └─ attempt < retry → backoff + delay + continue
          │
          └─ exhausted → errorHandler fallback | throw RequestError
```

## Error handling

No changes to error class shapes:

- `RequestError` — wraps all non-cancel, non-auth failures. Fields: `original`, `response`, `code`.
- `AuthError` — refresh failures (missing endpoint, missing refresh token, refresh endpoint returned no access token, refresh HTTP call itself failed).
- `CancelledError` — abort signal fired.

`AuthError` now fires on the first 401 that triggers a failed refresh, rather than after retry exhaustion. `config.onRefreshFail` callback semantics unchanged.

## Breaking changes summary

| Change                  | v2                                                         | v3                                                                   |
| ----------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| Cache clear API         | `clearCache(configId?)`                                    | `invalidate({ configId?, url?, predicate? })`                        |
| Auth setter             | `setAccessToken` + `setAuthorizationHeader` (both partial) | Merged into `setAccessToken(token, configId?)`                       |
| Mutation generic        | `AxlyMutationOptions<T, _D, C>`                            | `AxlyMutationOptions<T, C>`                                          |
| Default retry scope     | Retries any error                                          | Retries only network/5xx/408/429 by default                          |
| Cache-key normalization | Key depends on param order                                 | Keys canonicalized (observable: reordered params now hit same entry) |
| 401 refresh timing      | Fires after retry exhaustion                               | Fires on first 401                                                   |
| Cache timer             | Holds Node process open                                    | `.unref()`'d                                                         |
| `upload()` behavior     | Isolated path, no retry/toast/dedupe/state                 | Inherits from `request()`; uploads now retry by default              |

Additive (non-breaking on top of v2):

- `authScheme?: string | null` in `AxlyConfig`
- `shouldRetry` on `AxlyConfig` and `RequestOptions`
- `staleWhileRevalidate` on `CacheOptions`

## Migration guide (README update)

**1. `clearCache` → `invalidate`**

```ts
client.clearCache(); // v2
client.invalidate(); // v3

client.clearCache('mainAPI'); // v2
client.invalidate({ configId: 'mainAPI' }); // v3
```

**2. `setAuthorizationHeader` → `setAccessToken`**

```ts
client.setAuthorizationHeader(token); // v2
client.setAccessToken(token); // v3
```

**3. `useAxlyMutation` generics** — drop the middle argument if you pass generics explicitly.

**4. Retry defaults** — if you rely on v2's "retry any error", pass `shouldRetry: () => true` on the config or request.

**5. Upload retries** — uploads now honor `retry`. Pass `retry: 0` in `UploadOptions` to preserve v2 no-retry behavior.

## Out of scope

- Test suite (package has no tests today; adding one is its own project).
- Bundler (`tsc` emits are sufficient; no Rollup/tsup introduction).
- New entry points (keep `axly`, `axly/client`, `axly/react`).
- API redesign (no `client.get/post/...` methods, hooks shape unchanged).
- Changelog tooling (keep manual version bumps per CLAUDE.md).

## Implementation sequence (high level)

1. Create `internal/` with extracted classes (emitter, tokenManager) — pure moves, no behavior change.
2. Add `internal/cache.ts` with `.unref()` + SWR + pattern invalidation. Wire into `client.ts` replacing the inline cache logic.
3. Add `internal/deduper.ts` + `internal/requestKey.ts` with canonical keys. Wire in.
4. Add `internal/executor.ts` with the new retry/refresh interaction. Wire in.
5. Collapse 4 maps → `runtimes` map in `client.ts`.
6. Add `authScheme`, `shouldRetry`, `invalidate`, merge auth setters. Remove `_D`. Update types.
7. Reimplement `upload()` as thin `request()` wrapper.
8. Memoize `useAxly.request` in `useCallback`.
9. Update README with migration guide; bump version to `3.0.0`.
