# Axly

<div align="center">

[![npm version](https://img.shields.io/npm/v/axly.svg)](https://www.npmjs.com/package/axly)
[![npm downloads](https://img.shields.io/npm/dm/axly.svg)](https://www.npmjs.com/package/axly)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

</div>

Axly is a powerful and flexible HTTP client library built on top of Axios, designed for seamless API interactions in both browser and Node.js environments. It provides automatic token refreshing, retry with exponential backoff, upload/download progress tracking, request deduplication, response caching, toast notifications (browser-only), request cancellation, and support for multiple API configurations.

---

## 📋 Table of Contents

- [Migrating from v2 to v3](#-migrating-from-v2-to-v3)
- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Core Concepts](#-core-concepts)
  - [Single Configuration](#single-configuration)
  - [Multiple Configurations](#multiple-configurations)
- [API Reference](#-api-reference)
  - [createAxlyClient](#createaxlyclient)
  - [createAxlyNodeClient](#createaxlynodeclient)
  - [Client Methods](#client-methods)
  - [useAxly](#useaxly)
  - [useAxlyQuery](#useaxlyquery)
  - [useAxlyMutation](#useaxlymutation)
- [Usage Examples](#-usage-examples)
  - [Basic Requests](#basic-requests)
  - [Authentication & Token Management](#authentication--token-management)
  - [Request Deduplication](#request-deduplication)
  - [Response Caching](#response-caching)
  - [Progress Tracking](#progress-tracking)
  - [File Upload](#file-upload)
  - [Request Cancellation](#request-cancellation)
  - [Retry Logic](#retry-logic)
  - [Custom Auth Scheme](#custom-auth-scheme)
  - [Toast Notifications](#toast-notifications)
  - [Error Handling](#error-handling)
  - [Multiple API Configurations](#multiple-api-configurations)
  - [Interceptors](#interceptors)
  - [Node.js Usage](#nodejs-usage)
- [Advanced Features](#-advanced-features)
  - [Automatic Token Refresh](#automatic-token-refresh)
  - [Token Callbacks](#token-callbacks)
  - [Event Emitter](#event-emitter)
- [TypeScript Support](#typescript-support)
- [Error Classes](#error-classes)
- [Best Practices](#-best-practices)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🚨 Migrating from v2 to v3

v3 is a breaking release. The high-level API is unchanged — `createAxlyClient`, `useAxly`, `useAxlyQuery`, `useAxlyMutation` all work the same — but a handful of methods were renamed or consolidated.

### 1. `clearCache` → `invalidate`

`invalidate` replaces `clearCache` and gains pattern-matching.

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

They've been merged — `setAccessToken` now updates storage **and** the axios default header.

```ts
// v2
client.setAuthorizationHeader(token);

// v3
client.setAccessToken(token);
```

### 3. `AxlyMutationOptions` generic signature

The unused middle generic was removed:

```ts
// v2
AxlyMutationOptions<T, D, C>;

// v3
AxlyMutationOptions<T, C>;
```

The `useAxlyMutation<T, D, C>(...)` hook signature itself is unchanged — only `AxlyMutationOptions` dropped the middle generic.

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

- **`authScheme`** — `AxlyConfig.authScheme?: string | null` (default `'Bearer'`). Pass `null` or `''` to send the token raw (e.g. for `Token abc123` schemes).
- **`shouldRetry`** — custom retry predicate on both `AxlyConfig` and `RequestOptions`.
- **`staleWhileRevalidate`** — extend `CacheOptions.staleWhileRevalidate` (ms) to serve stale responses while refreshing in the background.
- **`invalidate({ url, predicate })`** — pattern-based cache invalidation.

### Behavioral fixes (no API change)

- Cache-key normalization — reordered query params now share the same cache entry (they produced different keys in v2).
- 401 handling triggers refresh on the first 401 instead of after exhausting retries.
- The internal cache-sweep timer now `.unref()`'s, so Node processes exit naturally without calling `destroy()`.

---

## ✨ Features

- **🔌 Axios Integration** — Reliable HTTP requests with full interceptor support
- **🔀 Multiple Configurations** — Multiple API configs with different base URLs and auth setups
- **⚛️ React Hooks** — `useAxly`, `useAxlyQuery`, and `useAxlyMutation` for managing state
- **🔐 Token Management** — Access and refresh tokens with automatic refreshing on 401 errors
- **🔄 Automatic Retries** — Exponential backoff with jitter for transient failures
- **♻️ Request Deduplication** — Prevents duplicate concurrent requests for the same resource
- **💾 Response Caching** — TTL-based caching for GET requests, configurable per-request
- **📊 Progress Tracking** — Real-time upload and download progress monitoring
- **🎨 Toast Notifications** — Customizable success/error toasts (browser-only)
- **❌ Request Cancellation** — Abort ongoing requests via `AbortController`
- **📁 File Uploads** — Simplified file uploads using `FormData`
- **⚠️ Error Handling** — Custom error handlers and typed error classes
- **🖥️ Node.js Support** — `createAxlyNodeClient` with server-optimized defaults
- **📘 TypeScript** — Full type safety with comprehensive generics

---

## 📦 Installation

```bash
npm install axly
# or
yarn add axly
# or
pnpm add axly
# or
bun add axly
```

> **Peer dependencies**: React (`>=18`) is optional and only needed for the React hooks (`useAxly`, `useAxlyQuery`, `useAxlyMutation`).

---

## 🚀 Quick Start

### Basic Setup

```typescript
// apiClient.ts
import { createAxlyClient } from 'axly';

const apiClient = createAxlyClient({
  baseURL: 'https://api.example.com',
  token: localStorage.getItem('authToken'),
  toastHandler: (msg, type) => console.log(`[${type}]`, msg)
});

export default apiClient;
```

### Using the `useAxly` hook

```tsx
import { useAxly } from 'axly';
import apiClient from './apiClient';

const CreateUser = () => {
  const { isLoading, status, request } = useAxly(apiClient);

  const handleCreate = async () => {
    const response = await request({
      method: 'POST',
      url: '/users',
      data: { name: 'Jane Doe', email: 'jane@example.com' }
    });
    console.log(response.data);
  };

  return (
    <button onClick={handleCreate} disabled={isLoading}>
      {status === 'loading' ? 'Creating...' : 'Create User'}
    </button>
  );
};
```

### Data fetching with `useAxlyQuery`

```tsx
import { useAxlyQuery } from 'axly';
import apiClient from './apiClient';

const UserList = () => {
  const { data, isLoading, error, refetch } = useAxlyQuery({
    client: apiClient,
    request: { method: 'GET', url: '/users' }
  });

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  return (
    <ul>
      {data?.data.map((u) => (
        <li key={u.id}>{u.name}</li>
      ))}
    </ul>
  );
};
```

---

## 🎯 Core Concepts

### Single Configuration

```typescript
import { createAxlyClient } from 'axly';

const apiClient = createAxlyClient({
  baseURL: 'https://api.example.com',
  token: 'your-jwt-token',
  toastHandler: (message, type) => {
    console.log(`[${type}] ${message}`);
  }
});
```

### Multiple Configurations

```typescript
import { createAxlyClient } from 'axly';

const client = createAxlyClient({
  mainAPI: {
    baseURL: 'https://api.example.com',
    multiToken: true,
    accessToken: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken'),
    refreshEndpoint: '/auth/refresh',
    onRefresh: ({ accessToken, refreshToken }) => {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
    },
    onRefreshFail: () => {
      window.location.href = '/login';
    }
  },
  publicAPI: {
    baseURL: 'https://public.example.com'
  }
});

// Use a specific config
await client.request({ method: 'GET', url: '/data', configId: 'publicAPI' });
```

---

## 📚 API Reference

### createAxlyClient

Creates an Axly client with one or more configurations.

```typescript
createAxlyClient<ConfigMap>(config: AxlyConfig | ConfigMap): AxlyClient
```

#### AxlyConfig Options

| Option                 | Type                    | Default    | Description                                                                 |
| ---------------------- | ----------------------- | ---------- | --------------------------------------------------------------------------- |
| `baseURL`              | `string`                | —          | Base URL for all requests **(required)**                                    |
| `token`                | `string \| null`        | —          | Single auth token (single-token mode)                                       |
| `multiToken`           | `boolean`               | `false`    | Enable access + refresh token mode                                          |
| `accessToken`          | `string \| null`        | —          | Access token for multi-token mode                                           |
| `refreshToken`         | `string \| null`        | —          | Refresh token for multi-token mode                                          |
| `refreshEndpoint`      | `string`                | —          | Endpoint for token refresh                                                  |
| `refreshTimeout`       | `number`                | `10000`    | Timeout (ms) for refresh requests                                           |
| `authScheme`           | `string \| null`        | `'Bearer'` | Prefix for the Authorization header. `null`/`''` sends the token raw        |
| `toastHandler`         | `ToastHandler`          | —          | Toast notification function (browser-only)                                  |
| `tokenCallbacks`       | `TokenCallbacks`        | —          | Custom getters/setters for tokens                                           |
| `requestInterceptors`  | `Array`                 | —          | Axios request interceptors                                                  |
| `responseInterceptors` | `Array`                 | —          | Axios response interceptors                                                 |
| `errorHandler`         | `Function`              | —          | Custom error handler for all requests                                       |
| `onRefresh`            | `Function`              | —          | Callback when tokens refresh                                                |
| `onRefreshFail`        | `Function`              | —          | Callback when token refresh fails                                           |
| `dedupeRequests`       | `boolean`               | `false`    | Deduplicate identical concurrent GET requests                               |
| `shouldRetry`          | `ShouldRetry \| undef.` | —          | Predicate `(err, attempt) => boolean`. Defaults to network + 5xx + 408/429. |

---

### createAxlyNodeClient

Same as `createAxlyClient` but strips `toastHandler` for Node.js compatibility.

```typescript
createAxlyNodeClient<ConfigMap>(config: AxlyConfig | ConfigMap): AxlyClient
```

---

### Client Methods

#### `request<T, D>(options, stateUpdater?)`

Make an HTTP request.

```typescript
const response = await client.request<User>({
  method: 'GET',
  url: '/users/1'
});
```

#### RequestOptions

| Option                        | Type                        | Default            | Description                                                        |
| ----------------------------- | --------------------------- | ------------------ | ------------------------------------------------------------------ |
| `method`                      | `string`                    | —                  | HTTP method **(required)**                                         |
| `url`                         | `string`                    | —                  | Endpoint URL **(required)**                                        |
| `data`                        | `D`                         | —                  | Request body                                                       |
| `params`                      | `Record<string, ...>`       | —                  | Query parameters                                                   |
| `contentType`                 | `ContentType`               | `application/json` | Content-Type header                                                |
| `customHeaders`               | `Record<string, string>`    | —                  | Additional headers                                                 |
| `responseType`                | `string`                    | `json`             | Axios response type                                                |
| `baseURL`                     | `string`                    | —                  | Override the client base URL                                       |
| `timeout`                     | `number`                    | `100000`           | Request timeout (ms)                                               |
| `retry`                       | `number`                    | `0`                | Number of retry attempts                                           |
| `cancelable`                  | `boolean`                   | `false`            | Enable abort via `AbortController`                                 |
| `onCancel`                    | `() => void`                | —                  | Callback when request is cancelled                                 |
| `dedupe`                      | `boolean`                   | `false`            | Deduplicate this GET request if another identical one is in-flight |
| `cache`                       | `boolean \| CacheOptions`   | `false`            | Cache GET response; `{ ttl?, staleWhileRevalidate? }` in ms        |
| `shouldRetry`                 | `ShouldRetry`               | —                  | Per-request retry predicate (overrides config)                     |
| `successToast`                | `boolean`                   | `false`            | Show success toast                                                 |
| `errorToast`                  | `boolean`                   | `false`            | Show error toast                                                   |
| `customToastMessage`          | `string`                    | —                  | Override success toast message                                     |
| `customToastMessageType`      | `CustomToastMessageType`    | `success`          | Toast type for success                                             |
| `customErrorToastMessage`     | `string`                    | —                  | Override error toast message                                       |
| `customErrorToastMessageType` | `CustomToastMessageType`    | `error`            | Toast type for error                                               |
| `onUploadProgress`            | `(percent: number) => void` | —                  | Upload progress callback                                           |
| `onDownloadProgress`          | `(percent: number) => void` | —                  | Download progress callback                                         |
| `toastHandler`                | `ToastHandler`              | —                  | Override the client toast handler per-request                      |
| `configId`                    | `string`                    | `default`          | Which config to use in multi-config setup                          |

#### `upload<T>(url, formData, opts?)`

Upload a file. `upload()` is a thin wrapper around `request()` — it inherits retry, toast, dedupe, and state-tracking. It does **not** set `Content-Type` explicitly; axios auto-sets `multipart/form-data; boundary=...` when it detects `FormData`.

```typescript
const form = new FormData();
form.append('file', file);
const response = await client.upload<{ url: string }>('/upload', form, {
  onUploadProgress: (percent) => console.log(`${percent}%`)
});
```

#### UploadOptions

| Option                        | Type                        | Description                                       |
| ----------------------------- | --------------------------- | ------------------------------------------------- |
| `headers`                     | `Record<string, string>`    | Additional request headers                        |
| `timeout`                     | `number`                    | Request timeout in ms (default `120_000`)         |
| `onUploadProgress`            | `(percent: number) => void` | Upload progress callback                          |
| `onDownloadProgress`          | `(percent: number) => void` | Download progress callback                        |
| `baseURL`                     | `string`                    | Override the client base URL                      |
| `cancelable`                  | `boolean`                   | Enable abort via `AbortController`                |
| `onCancel`                    | `() => void`                | Callback when upload is cancelled                 |
| `configId`                    | `string`                    | Which config to use in multi-config setup         |
| `retry`                       | `number`                    | Retry attempts (pass `0` for v2-style no retries) |
| `shouldRetry`                 | `ShouldRetry`               | Custom retry predicate                            |
| `toastHandler`                | `ToastHandler`              | Override the client toast handler                 |
| `successToast`                | `boolean`                   | Show success toast                                |
| `errorToast`                  | `boolean`                   | Show error toast                                  |
| `customToastMessage`          | `string`                    | Override success toast message                    |
| `customToastMessageType`      | `CustomToastMessageType`    | Toast type for success                            |
| `customErrorToastMessage`     | `string`                    | Override error toast message                      |
| `customErrorToastMessageType` | `CustomToastMessageType`    | Toast type for error                              |

#### Token & Header Methods

```typescript
client.setAccessToken('new-token', 'configId'); // Set access token (updates storage + axios defaults)
client.setRefreshToken('refresh-token', 'configId'); // Set refresh token
client.setDefaultHeader('X-Custom', 'value', 'configId'); // Set a default header
client.clearDefaultHeader('X-Custom', 'configId'); // Remove a default header
```

#### Cache Invalidation

```typescript
client.invalidate(); // Clear everything (all configs)
client.invalidate({ configId: 'mainAPI' }); // Clear all entries for one config
client.invalidate({ url: '/users' }); // Clear entries whose key contains '/users'
client.invalidate({ url: /\/users\/\d+/ }); // Regex match against cache keys
client.invalidate({ predicate: (key) => key.startsWith('GET:') }); // Arbitrary predicate
```

When multiple fields are provided, they combine with AND semantics (all matchers must pass). Invalidation clears **both** the response cache and any in-flight deduped requests.

#### Other Methods

```typescript
client.cancelRequest(abortController); // Cancel a specific request
client.destroy(); // Cleanup all instances, caches, and timers
client.on('destroy', () => {}); // Listen to events
```

---

### useAxly

General-purpose React hook for imperative requests with loading state.

```typescript
const {
  request,
  cancelRequest,
  isLoading,
  status,
  uploadProgress,
  downloadProgress
} = useAxly(client);
```

| Return value       | Type            | Description                                   |
| ------------------ | --------------- | --------------------------------------------- |
| `request`          | `Function`      | Make a request (same signature as client)     |
| `cancelRequest`    | `() => void`    | Cancel the current in-flight request          |
| `isLoading`        | `boolean`       | `true` while request is in flight             |
| `status`           | `RequestStatus` | `'idle' \| 'loading' \| 'success' \| 'error'` |
| `uploadProgress`   | `number`        | Upload progress percentage (0–100)            |
| `downloadProgress` | `number`        | Download progress percentage (0–100)          |

---

### useAxlyQuery

Declarative data-fetching hook. Auto-fetches on mount, supports polling and refetch.

```typescript
const { data, error, status, isLoading, isFetching, refetch } = useAxlyQuery({
  client,
  request: { method: 'GET', url: '/users' },
  enabled: true,
  refetchOnMount: true,
  refetchInterval: 30000, // poll every 30s
  onSuccess: (response) => console.log(response.data),
  onError: (error) => console.error(error)
});
```

#### useAxlyQuery Options

| Option            | Type                           | Default | Description                             |
| ----------------- | ------------------------------ | ------- | --------------------------------------- |
| `client`          | `AxlyClient`                   | —       | Axly client instance **(required)**     |
| `request`         | `RequestOptions`               | —       | Request configuration **(required)**    |
| `enabled`         | `boolean`                      | `true`  | Skip fetch when `false`                 |
| `refetchOnMount`  | `boolean`                      | `true`  | Fetch when component mounts             |
| `refetchInterval` | `number \| false`              | `false` | Poll interval in ms; `false` to disable |
| `onSuccess`       | `(res: AxiosResponse) => void` | —       | Called on successful fetch              |
| `onError`         | `(err: Error) => void`         | —       | Called on fetch failure                 |

#### useAxlyQuery Returns

| Property     | Type                    | Description                                   |
| ------------ | ----------------------- | --------------------------------------------- |
| `data`       | `AxiosResponse \| null` | Last successful response                      |
| `error`      | `Error \| null`         | Last error                                    |
| `status`     | `RequestStatus`         | `'idle' \| 'loading' \| 'success' \| 'error'` |
| `isLoading`  | `boolean`               | `true` on first load (no data yet)            |
| `isFetching` | `boolean`               | `true` on any fetch (including refetch)       |
| `refetch`    | `() => Promise<void>`   | Manually trigger a refetch                    |

---

### useAxlyMutation

Hook for mutations (POST, PUT, PATCH, DELETE) with `mutate` / `mutateAsync`.

```typescript
const { mutate, mutateAsync, isPending, data, error, status, reset } =
  useAxlyMutation({
    client,
    onSuccess: (response) => console.log('Done:', response.data),
    onError: (error) => console.error('Failed:', error),
    onSettled: (data, error) => console.log('Settled')
  });

// Fire-and-forget
mutate({ method: 'POST', url: '/users', data: { name: 'Jane' } });

// Async with result
const response = await mutateAsync({
  method: 'POST',
  url: '/users',
  data: { name: 'Jane' }
});
```

#### useAxlyMutation Options

| Option      | Type                           | Description                         |
| ----------- | ------------------------------ | ----------------------------------- |
| `client`    | `AxlyClient`                   | Axly client instance **(required)** |
| `onSuccess` | `(res: AxiosResponse) => void` | Called on success                   |
| `onError`   | `(err: Error) => void`         | Called on error                     |
| `onSettled` | `(res, err) => void`           | Called on both success and error    |

#### useAxlyMutation Returns

| Property      | Type                    | Description                                   |
| ------------- | ----------------------- | --------------------------------------------- |
| `mutate`      | `Function`              | Trigger mutation (fire-and-forget)            |
| `mutateAsync` | `Function`              | Trigger mutation and return a Promise         |
| `isPending`   | `boolean`               | `true` while mutation is in flight            |
| `data`        | `AxiosResponse \| null` | Last successful response                      |
| `error`       | `Error \| null`         | Last error                                    |
| `status`      | `RequestStatus`         | `'idle' \| 'loading' \| 'success' \| 'error'` |
| `reset`       | `() => void`            | Reset state back to idle                      |

---

## 💡 Usage Examples

### Basic Requests

```typescript
// GET
const { data } = await client.request<User[]>({ method: 'GET', url: '/users' });

// POST
await client.request({ method: 'POST', url: '/users', data: { name: 'Jane' } });

// With query params
await client.request({
  method: 'GET',
  url: '/users',
  params: { page: '1', limit: '20' }
});
```

### Authentication & Token Management

```typescript
// Single token (simple auth)
const client = createAxlyClient({
  baseURL: 'https://api.example.com',
  token: localStorage.getItem('token')
});

// Update token at runtime
client.setAccessToken('new-token');

// Multi-token with auto-refresh
const client = createAxlyClient({
  baseURL: 'https://api.example.com',
  multiToken: true,
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
  refreshEndpoint: '/auth/refresh',
  onRefresh: ({ accessToken, refreshToken }) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  },
  onRefreshFail: () => {
    window.location.href = '/login';
  }
});
```

### Request Deduplication

Prevent identical concurrent GET requests from firing multiple times.

```typescript
// Enable globally for a config
const client = createAxlyClient({
  baseURL: 'https://api.example.com',
  dedupeRequests: true
});

// Or per-request
await client.request({ method: 'GET', url: '/users', dedupe: true });

// Both of these share a single network request:
const [a, b] = await Promise.all([
  client.request({ method: 'GET', url: '/users', dedupe: true }),
  client.request({ method: 'GET', url: '/users', dedupe: true })
]);
```

### Response Caching

Cache GET responses with a configurable TTL (default: 5 minutes).

```typescript
// Cache with default TTL (5 minutes)
await client.request({ method: 'GET', url: '/config', cache: true });

// Cache with custom TTL (30 seconds)
await client.request({
  method: 'GET',
  url: '/config',
  cache: { ttl: 30_000 }
});

// Combine caching with deduplication
await client.request({
  method: 'GET',
  url: '/config',
  cache: { ttl: 60_000 },
  dedupe: true
});
```

#### Stale-While-Revalidate

Serve a stale cached response immediately while refreshing in the background:

```typescript
// Fresh for 60s; serve stale for up to 5 more minutes while refreshing
await client.request({
  method: 'GET',
  url: '/config',
  cache: {
    ttl: 60_000,
    staleWhileRevalidate: 300_000
  }
});
```

Semantics:

- `now < expiresAt` → return cached response (fresh)
- `now < expiresAt + staleWhileRevalidate` → return cached response (stale) AND fire a background refresh; errors from the background refresh are swallowed
- Otherwise → full network request

The background refresh is deduplicated per cache key — only one refresh runs at a time even under concurrent reads.

#### Pattern-Based Cache Invalidation

Clear cached entries by URL pattern, config, or arbitrary predicate:

```typescript
// After mutating a user, clear all cached GETs that touch that path
await client.request({
  method: 'PATCH',
  url: '/users/42',
  data: { name: 'Jane' }
});
client.invalidate({ url: '/users/42' });

// Clear every /users/* entry
client.invalidate({ url: /\/users\// });

// Clear by config
client.invalidate({ configId: 'mainAPI' });

// Arbitrary predicate — e.g. drop every non-GET entry (shouldn't exist, but illustrative)
client.invalidate({ predicate: (key) => !key.startsWith('GET:') });

// Clear everything (cache + in-flight dedupes, all configs)
client.invalidate();
```

### Progress Tracking

```tsx
const { request, uploadProgress, downloadProgress } = useAxly(client);

await request({
  method: 'GET',
  url: '/large-file',
  responseType: 'blob',
  onDownloadProgress: (percent) => console.log(`Download: ${percent}%`)
});
```

### File Upload

```tsx
const handleUpload = async (file: File) => {
  const form = new FormData();
  form.append('file', file);

  const response = await client.upload<{ url: string }>('/upload', form, {
    onUploadProgress: (percent) => setProgress(percent)
  });
  console.log('Uploaded to:', response.data.url);
};
```

### Request Cancellation

```tsx
const { request, cancelRequest, isLoading } = useAxly(client);

const search = async (query: string) => {
  await request({
    method: 'GET',
    url: '/search',
    params: { q: query },
    cancelable: true,
    onCancel: () => console.log('Search cancelled')
  });
};

// Cancel any in-flight request
<button onClick={cancelRequest} disabled={!isLoading}>
  Cancel
</button>;
```

### Retry Logic

By default, axly retries on transient failures only: network errors (`ERR_NETWORK`, `ECONNABORTED`, `ETIMEDOUT`), HTTP 5xx, HTTP 408, and HTTP 429.

```typescript
// Retry up to 3 times with exponential backoff + jitter
await client.request({
  method: 'GET',
  url: '/unstable-endpoint',
  retry: 3
});
// Delays: ~500ms, ~1000ms, ~2000ms (with random jitter)
```

#### Custom retry predicate (`shouldRetry`)

Take full control over which errors retry and which fail fast:

```typescript
// Per-request: retry only on 503, up to 5 times
await client.request({
  method: 'GET',
  url: '/flaky',
  retry: 5,
  shouldRetry: (err, attempt) => err.response?.status === 503
});

// Per-config: retry everything except 4xx (v2-style aggressive retrying, but skip auth/validation errors)
const client = createAxlyClient({
  baseURL: 'https://api.example.com',
  shouldRetry: (err) => {
    const status = err.response?.status;
    if (status != null && status >= 400 && status < 500) return false;
    return true;
  }
});

// Restore exact v2 behavior (retry on any error)
const legacyClient = createAxlyClient({
  baseURL: 'https://api.example.com',
  shouldRetry: () => true
});
```

**Precedence:** per-request `shouldRetry` > per-config `shouldRetry` > default predicate.

#### Interaction with 401 token refresh

When `multiToken` + `refreshEndpoint` are configured and the server returns 401, axly refreshes the token on the **first** 401 (not after exhausting retries) and then retries the request with the fresh token. Retries after a successful refresh use your normal `retry`/`shouldRetry` budget.

### Custom Auth Scheme

The default `Authorization` header is `Bearer <token>`. Override with `authScheme`:

```typescript
// Default — emits "Authorization: Bearer abc123"
const client = createAxlyClient({
  baseURL: 'https://api.example.com',
  token: 'abc123'
});

// GitHub-style — emits "Authorization: token abc123"
const githubClient = createAxlyClient({
  baseURL: 'https://api.github.com',
  token: 'abc123',
  authScheme: 'token'
});

// Raw token — emits "Authorization: abc123" (no prefix)
const rawClient = createAxlyClient({
  baseURL: 'https://api.example.com',
  token: 'abc123',
  authScheme: null
});

// AWS-style — emits "Authorization: AWS4-HMAC-SHA256 <sig>"
const awsClient = createAxlyClient({
  baseURL: 'https://s3.example.com',
  token: '<sig>',
  authScheme: 'AWS4-HMAC-SHA256'
});
```

`authScheme` applies to both the initial header and any headers written by `setAccessToken` / automatic refresh flows.

### Toast Notifications

```typescript
const client = createAxlyClient({
  baseURL: 'https://api.example.com',
  toastHandler: (message, type) => {
    // Use any toast library
    toast[type ?? 'info'](message);
  }
});

await client.request({
  method: 'POST',
  url: '/users',
  data: { name: 'Jane' },
  successToast: true,
  errorToast: true,
  customToastMessage: 'User created successfully!'
});
```

### Error Handling

```typescript
import { RequestError, AuthError, CancelledError } from 'axly';

try {
  await client.request({ method: 'GET', url: '/protected' });
} catch (err) {
  if (err instanceof CancelledError) {
    console.log('Request was cancelled');
  } else if (err instanceof AuthError) {
    console.log('Auth failed — redirect to login');
  } else if (err instanceof RequestError) {
    console.log('Status:', err.response?.status);
    console.log('Code:', err.code);
  }
}
```

### Multiple API Configurations

```typescript
const client = createAxlyClient({
  userAPI: { baseURL: 'https://users.example.com', token: 'user-token' },
  paymentAPI: { baseURL: 'https://pay.example.com', token: 'pay-token' }
});

const users = await client.request({
  method: 'GET',
  url: '/list',
  configId: 'userAPI'
});
const invoices = await client.request({
  method: 'GET',
  url: '/invoices',
  configId: 'paymentAPI'
});
```

### Interceptors

```typescript
const client = createAxlyClient({
  baseURL: 'https://api.example.com',
  requestInterceptors: [
    (config) => {
      config.headers['X-Request-ID'] = crypto.randomUUID();
      return config;
    }
  ],
  responseInterceptors: [
    (response) => {
      console.log('Response time:', response.headers['x-response-time']);
      return response;
    }
  ]
});
```

### Node.js Usage

```typescript
import { createAxlyNodeClient } from 'axly';

const client = createAxlyNodeClient({
  baseURL: 'https://api.example.com',
  token: process.env.API_TOKEN
});

const { data } = await client.request<User[]>({ method: 'GET', url: '/users' });
```

---

## 🔬 Advanced Features

### Automatic Token Refresh

When `multiToken: true` and a request returns `401`, Axly automatically:

1. Calls your `refreshEndpoint` with the current refresh token
2. Updates access and refresh tokens (via `tokenCallbacks` or in-memory)
3. Retries the failed request with the new access token
4. Prevents duplicate concurrent refresh calls

```typescript
const client = createAxlyClient({
  baseURL: 'https://api.example.com',
  multiToken: true,
  refreshEndpoint: '/auth/refresh',
  tokenCallbacks: {
    getAccessToken: () => localStorage.getItem('accessToken'),
    setAccessToken: (token) =>
      token ?
        localStorage.setItem('accessToken', token)
      : localStorage.removeItem('accessToken'),
    getRefreshToken: () => localStorage.getItem('refreshToken'),
    setRefreshToken: (token) =>
      token ?
        localStorage.setItem('refreshToken', token)
      : localStorage.removeItem('refreshToken')
  }
});
```

### Token Callbacks

Use `tokenCallbacks` to manage tokens in any external storage (localStorage, Redux, Zustand, etc.):

```typescript
import { useAuthStore } from './store';

const client = createAxlyClient({
  baseURL: 'https://api.example.com',
  multiToken: true,
  tokenCallbacks: {
    getAccessToken: () => useAuthStore.getState().accessToken,
    setAccessToken: (t) => useAuthStore.getState().setAccessToken(t),
    getRefreshToken: () => useAuthStore.getState().refreshToken,
    setRefreshToken: (t) => useAuthStore.getState().setRefreshToken(t)
  }
});
```

### Event Emitter

```typescript
const unsubscribe = client.on('destroy', () => {
  console.log('Client destroyed — clearing auth state');
});

// Later: stop listening
unsubscribe();

// Destroy the client (clears all caches, deduplication maps, axios instances)
client.destroy();
```

---

## TypeScript Support

Axly is written in TypeScript with full generic support.

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

interface CreateUserPayload {
  name: string;
  email: string;
}

// Fully typed request
const response = await client.request<User, CreateUserPayload>({
  method: 'POST',
  url: '/users',
  data: { name: 'Jane', email: 'jane@example.com' }
});

const user: User = response.data;

// Typed multi-config client
const client = createAxlyClient({
  users: { baseURL: 'https://users.example.com' },
  billing: { baseURL: 'https://billing.example.com' }
});
// configId is narrowed to 'users' | 'billing'
await client.request({ method: 'GET', url: '/list', configId: 'users' });

// Typed hooks
const { data } = useAxlyQuery<User[]>({
  client,
  request: { method: 'GET', url: '/users' }
});
// data?.data is User[] | undefined
```

Additional types exported from `axly`:

```typescript
import type {
  AxlyClient,
  AxlyConfig,
  RequestOptions,
  UploadOptions,
  InvalidateOptions,
  CacheOptions,
  ShouldRetry,
  TokenCallbacks,
  RefreshTokens,
  StateData,
  RequestStatus,
  ToastHandler,
  AxlyQueryOptions,
  AxlyQueryResult,
  AxlyMutationOptions,
  AxlyMutationResult
} from 'axly';

// ShouldRetry signature
const mySRetry: ShouldRetry = (err, attempt) => {
  return err.response?.status === 503 && attempt < 2;
};
```

---

## Error Classes

| Class            | When thrown                               |
| ---------------- | ----------------------------------------- |
| `RequestError`   | HTTP request fails after all retries      |
| `AuthError`      | Token refresh fails or auth is missing    |
| `CancelledError` | Request was aborted via `AbortController` |

```typescript
import { RequestError, AuthError, CancelledError } from 'axly';

// RequestError properties
err.message; // Error message
err.response; // AxiosResponse | null
err.code; // HTTP status code or Axios error code
err.original; // Original AxiosError
```

---

## ✅ Best Practices

**Create one client per API** — share it via a module export or React context, not recreated per component.

**Use `dedupeRequests: true`** on configs that serve shared data (e.g., user profile, feature flags) to avoid redundant network calls.

**Use `cache`** for data that rarely changes (config endpoints, reference data) and `refetchInterval` in `useAxlyQuery` for live data.

**Use `useAxlyQuery`** for GET requests that should auto-fetch, and **`useAxlyMutation`** for writes. Reach for `useAxly` only when you need full imperative control.

**Handle `AuthError` globally** — attach a listener on the client or set `onRefreshFail` to redirect to login.

**Prefer `tokenCallbacks`** over passing tokens directly to keep the client decoupled from your storage strategy.

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request on [GitHub](https://github.com/Harshalkatakiya/axly).

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a pull request

---

## 📄 License

MIT © [Harshal Katakiya](https://github.com/Harshalkatakiya)
