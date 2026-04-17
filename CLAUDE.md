# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package

Axly is a published npm package (`axly`) — an Axios-based HTTP client for browser/Node.js and React. Published as ESM-only (`"type": "module"`). Uses `bun` as package manager (see `packageManager` field) — prefer `bun` over `npm` for consistency.

## Commands

```bash
bun run build           # tsc — emits to dist/ (no bundler)
bun run watch           # tsc --watch
bun run lint            # eslint . --fix
bun run prettier:check  # prettier -c .
bun run prettier        # prettier -w -u .
bun run release         # tsc && npm version patch && npm publish --access public --tag latest
```

There is no test suite. Husky `pre-commit` runs `lint-staged` → `bun run lint` → `bun run build`, so commits fail if types or lint break.

## Architecture

### Entry points (exported via `package.json` `exports`)

- `axly` (`src/index.ts`) — re-exports everything: `createAxlyClient`, `createAxlyNodeClient`, all three React hooks, types, utils, error classes
- `axly/client` (`src/client.ts`) — factory-only, no React, safe in Node
- `axly/react` (`src/react/useAxly.tsx`) — React hook only

Subpath imports use explicit `.js` extensions (required by `nodenext` module resolution) even though sources are `.ts`/`.tsx`.

### Core: `src/client.ts`

`createAxlyClient` is a factory that accepts **either** a single `AxlyConfig` **or** a record of named configs (e.g. `{ mainAPI: {...}, publicAPI: {...} }`). The `isAxlyConfig` guard distinguishes the two shapes by checking for `baseURL`. Single-config input is wrapped as `{ default: config }` internally, so **every** call path is multi-config. The returned `AxlyClient<C>` is generic over config keys so `configId` is type-checked against actual config names.

Per-config state is stored in parallel `Map<CMKey, ...>` structures: `axiosInstances`, `tokenManagers`, `applyAccessTokenFunctions`, `setDefaultHeaderFunctions`. Request/cache/inflight state is shared across configs but keyed with `configId` in `buildRequestKey`.

Key subsystems inside the factory:

- **`TokenManager`** — single-flight refresh: concurrent 401s share one `refreshPromise`. Refresh is triggered **outside** the retry loop (in `executeRequest`), so retries happen first, then one refresh attempt, then one more retry loop. `multiToken: true` + `refreshEndpoint` is required to enable refresh; `token` (single-token mode) does not refresh.
- **Token storage** — two modes:
  - `tokenCallbacks` (get/set access + refresh) — preferred; lets consumers persist to localStorage/cookies
  - Falls back to mutating `config.accessToken` / `config.refreshToken` / `config.token` in memory
- **Deduplication** — `inflightRequests` map keyed by `METHOD:configId:url:params:headers`. Only applies to GET. Enable per-request (`dedupe: true`) or per-config (`dedupeRequests: true`).
- **Cache** — `responseCache` map with `{ response, expiresAt }`. GET-only. TTL defaults to 5 minutes (`300_000`ms). A 60s `setInterval` sweeps expired entries; `destroy()` must be called to clear it, otherwise the timer keeps the process alive in Node.
- **Retry** — `exponentialBackoffWithJitter` from `utils/index.ts`. `retry: N` means N retry attempts after the initial (N+1 total). Cancellation short-circuits the retry loop.
- **Toast handling** — only fires when `isBrowser` is true. `createAxlyNodeClient` strips `toastHandler` from all configs before delegating to `createAxlyClient`. Messages are HTML-stripped via `sanitizeToastMessage` before display.
- **Event emitter** — `client.on(event, handler)` returns an unsubscribe fn. The only event currently emitted is `'destroy'`.

### Error classes (`src/utils/errors.ts`)

All thrown errors are wrapped: `RequestError` (network/HTTP with `.original`, `.response`, `.code`), `AuthError` (refresh failures), `CancelledError` (AbortController). Consumer `errorHandler` on `AxlyConfig` can swallow/transform errors by returning an `AxiosResponse` — its result is returned **as if** the request succeeded.

### React hooks (`src/react/`)

All three hooks use a `mountedRef` pattern to avoid state updates after unmount.

- **`useAxly(client)`** — thin wrapper: exposes `request`, `cancelRequest`, and `StateData` (`isLoading`, `status`, `uploadProgress`, `downloadProgress`, `abortController`). The state updater it passes to `client.request` is the sole mechanism by which progress flows to React — the core client is hook-agnostic.
- **`useAxlyQuery`** — declarative GET with `enabled`, `refetchOnMount`, `refetchInterval`. Uses `requestRef` so changes to `request` options don't trigger re-fetches (only `client` is in deps).
- **`useAxlyMutation`** — imperative with `mutate` / `mutateAsync` / `reset`. `mutate` is fire-and-forget (errors go to state); `mutateAsync` re-throws.

## Conventions

- TypeScript `strict: true`, `"@typescript-eslint/no-explicit-any": "error"` — **never** use `any`. Use `unknown` + type guards (see `isAxlyConfig`, `hasMessageInResponse`).
- No JSDoc type annotations — TS handles types.
- Module resolution is `nodenext`: imports **must** use explicit `.js` extensions even when importing `.ts`/`.tsx` sources.
- `verbatimModuleSyntax: false`, so `import type` is optional but preferred for type-only imports (hooks use it consistently).
- Ignore unused vars/args prefixed with `_` (`argsIgnorePattern: '^_'`).
- The `/* global AbortController */` comment at the top of `index.ts` and `client.ts` is intentional — it satisfies ESLint without pulling DOM globals into Node-targeted files.

## Version bumping & publishing

`bun run release` auto-bumps the patch version and publishes. Do **not** run it unless the user explicitly asks to release. For manual version bumps, edit `package.json` `version` directly — there is no changeset or changelog tooling.

## Code Standards

- **No `any` TypeScript types** — use proper types or generics throughout
- **No JSDoc comments** for type annotations
- **Pre-commit hooks** (Husky + lint-staged) auto-run ESLint + Prettier on every commit
- Use skills, context7, and deepwiki MCPs when relevant
