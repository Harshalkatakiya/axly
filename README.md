# Axly

A tiny, flexible HTTP client built on top of Axios for React and Node.js. Configure a client once, use a simple React hook for request state, and get batteries‑included features: retry with exponential backoff, upload/download progress, cancellation, toast notifications, interceptors, and a robust token refresh flow.

- First‑class React support via `useAxly(client)`
- Node‑ready client via `createAxlyNodeClient`
- Optional multi‑token mode with refresh endpoint + callbacks
- Request/response interceptors
- Progress, cancellation, retry with exponential backoff + jitter
- Pluggable toast notifications (browser only)
- Helpful header helpers and typed error classes

Works wherever Axios works.

## Installation

```sh
npm install axly axios
```

React is only required if you use the React hook.

## Quick start

### 1) Create a client

```ts
import { createAxlyClient } from 'axly';

const api = createAxlyClient({
  baseURL: 'https://api.example.com'
});
```

Optional: set a bearer token (single‑token mode):

```ts
api.setAuthorizationHeader('YOUR_JWT'); // or null to clear
```

Optional: default headers:

```ts
api.setDefaultHeader('X-Client', 'web');
api.clearDefaultHeader('X-Client');
```

### 2) Use in React

```tsx
import React, { useEffect } from 'react';
import { useAxly, createAxlyClient } from 'axly';

const api = createAxlyClient({ baseURL: 'https://api.example.com' });

export default function Users() {
  const {
    request,
    isLoading,
    uploadProgress,
    downloadProgress,
    cancelRequest
  } = useAxly(api);

  useEffect(() => {
    (async () => {
      try {
        const res = await request<{ id: number; name: string }[]>({
          method: 'GET',
          url: '/users',
          errorToast: true
        });
        console.log(res.data);
      } catch (err) {
        console.error(err);
      }
    })();

    return () => cancelRequest();
  }, []);

  return (
    <div>
      {isLoading && <p>Loading…</p>}
      <p>Upload: {uploadProgress}%</p>
      <p>Download: {downloadProgress}%</p>
    </div>
  );
}
```

### 3) Use in Node.js

```ts
import { createAxlyNodeClient } from 'axly';

const api = createAxlyNodeClient({ baseURL: 'https://api.example.com' });

async function main() {
  const res = await api.request<{ id: number; title: string }>({
    method: 'GET',
    url: '/posts/1'
  });
  console.log(res.data);
}

main().catch(console.error);
```

## Configuration

```ts
import { createAxlyClient } from 'axly';

const api = createAxlyClient({
  baseURL: 'https://api.example.com',

  // Single‑token (simple projects)
  token: null, // or a string

  // Multi‑token mode with refresh flow
  multiToken: true,
  accessToken: null,
  refreshToken: null,
  refreshEndpoint: '/auth/refresh', // POST { refreshToken }
  refreshTimeout: 10_000,
  tokenCallbacks: {
    getAccessToken: () => localStorage.getItem('access') ?? null,
    setAccessToken: (t) =>
      t ? localStorage.setItem('access', t) : localStorage.removeItem('access'),
    getRefreshToken: () => localStorage.getItem('refresh') ?? null,
    setRefreshToken: (t) =>
      t ?
        localStorage.setItem('refresh', t)
      : localStorage.removeItem('refresh')
  },
  onRefresh: ({ accessToken, refreshToken }) => {
    console.log('Refreshed', accessToken, refreshToken);
  },
  onRefreshFail: (err) => {
    console.error('Refresh failed', err);
  },

  // Interceptors
  requestInterceptors: [
    (config) => {
      // mutate config as needed
      return config;
    }
  ],
  responseInterceptors: [
    (response) => {
      // inspect/normalize
      return response;
    }
  ],

  // Central error handler (last resort)
  errorHandler: (err) => {
    // optionally return an AxiosResponse
    return Promise.reject(err);
  },

  // Toasts (browser only)
  toastHandler: (message, type = 'success', options) => {
    // wire your toaster here
    console.log(type, message, options);
  }
});
```

Notes

- If `multiToken` is true and `refreshEndpoint` is provided, Axly will try to refresh on 401 and retry the failed request once. The new access token is applied to future requests.
- In browser contexts only, `toastHandler` will be used to show `successToast`/`errorToast` notifications. In Node, toasts are ignored.

## React Hook: useAxly(client)

Signature:

```ts
const state = useAxly(client);
// { request, isLoading, uploadProgress, downloadProgress, abortController, cancelRequest }
```

- request&lt;T, D&gt;(options): Promise&lt;AxiosResponse&lt;T&gt;&gt;
- isLoading: boolean
- uploadProgress: number (0–100)
- downloadProgress: number (0–100)
- abortController: AbortController | null
- cancelRequest(): aborts the in‑flight request (if any)

## Client API

Factory

- createAxlyClient(config: AxlyConfig): AxlyClient
- createAxlyNodeClient(config: AxlyConfig): AxlyClient // same API, toasts disabled

Methods

- request&lt;T, D&gt;(options, stateUpdater?): Promise&lt;AxiosResponse&lt;T&gt;&gt;
- upload&lt;T&gt;(url, formData, opts?): Promise&lt;AxiosResponse&lt;T&gt;&gt;
- setAccessToken(token: string | null): void
- setRefreshToken(token: string | null): void
- setAuthorizationHeader(token: string | null): void
- setDefaultHeader(name: string, value: string | number | boolean): void
- clearDefaultHeader(name: string): void
- cancelRequest(controller?: AbortController | null): void
- destroy(): void
- on(event: string, handler): () => void

### RequestOptions<D = unknown>

```ts
interface RequestOptions<D = unknown> {
  method: AxiosRequestConfig['method'];
  url: string;
  data?: D;
  contentType:
    | 'text/html'
    | 'text/plain'
    | 'multipart/form-data'
    | 'application/json'
    | 'application/x-www-form-urlencoded'
    | 'application/octet-stream'
    | string;
  customHeaders?: Record<string, string>;
  responseType?: AxiosRequestConfig['responseType'];
  params?: Record<string, string | number | boolean>;
  baseURL?: string;

  // Toasts (browser only)
  toastHandler?: ToastHandler; // per-request override
  successToast?: boolean;
  errorToast?: boolean;
  customToastMessage?: string;
  customToastMessageType?:
    | 'success'
    | 'error'
    | 'warning'
    | 'info'
    | 'custom'
    | string;
  customErrorToastMessage?: string;
  customErrorToastMessageType?:
    | 'success'
    | 'error'
    | 'warning'
    | 'info'
    | 'custom'
    | string;

  // Progress, timeout, retry, cancel
  onUploadProgress?: (progress: number) => void;
  onDownloadProgress?: (progress: number) => void;
  timeout?: number; // default 100_000
  retry?: number; // default 0, exponential backoff + jitter
  cancelable?: boolean; // creates an AbortController attached to this request
  onCancel?: () => void; // callback when cancelled
}
```

### UploadOptions

```ts
interface UploadOptions {
  headers?: Record<string, string>;
  timeout?: number; // default 120_000
  onUploadProgress?: (percent: number) => void;
  onDownloadProgress?: (percent: number) => void;
  baseURL?: string;
  cancelable?: boolean;
  onCancel?: () => void;
}
```

### AxlyConfig

```ts
interface AxlyConfig {
  baseURL: string;

  // Token modes
  multiToken?: boolean; // default false (use `token`)
  token?: string | null; // single-token mode
  accessToken?: string | null; // multi-token
  refreshToken?: string | null; // multi-token
  refreshEndpoint?: string; // POST endpoint called as { refreshToken }
  refreshTimeout?: number; // default 10_000

  // Store tokens outside Axly (optional)
  tokenCallbacks?: {
    getAccessToken?: () => string | null | undefined;
    setAccessToken?: (token: string | null) => void;
    getRefreshToken?: () => string | null | undefined;
    setRefreshToken?: (token: string | null) => void;
  };

  // Interceptors
  requestInterceptors?: Array<
    (
      config: InternalAxiosRequestConfig
    ) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>
  >;
  responseInterceptors?: Array<
    (response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>
  >;

  // Error handling
  errorHandler?: (err: AxiosError) => Promise<AxiosResponse> | AxiosResponse;

  // Toasts
  toastHandler?: ToastHandler;

  // Refresh lifecycle
  onRefresh?: (tokens: { accessToken: string; refreshToken: string }) => void;
  onRefreshFail?: (err: Error) => void;
}
```

## Advanced usage

### Retry with exponential backoff

```ts
await api.request({
  method: 'GET',
  url: '/data',
  retry: 3 // waits base*2^n + jitter between attempts
});
```

### Cancellation

In React via hook state:

```ts
const { request, cancelRequest } = useAxly(api);
const p = request({ method: 'GET', url: '/slow', cancelable: true });
// later
cancelRequest();
```

With a custom controller on the client:

```ts
const controller = new AbortController();
api.cancelRequest(controller); // abort()
```

### File upload with progress

```ts
const form = new FormData();
form.append('file', file);

const res = await api.upload<{ url: string }>('/upload', form, {
  onUploadProgress: (p) => console.log('Upload', p),
  onDownloadProgress: (p) => console.log('Download', p),
  cancelable: true
});
```

### Toast notifications (browser)

```ts
import { toast } from 'react-hot-toast';

const api = createAxlyClient({
  baseURL: '/api',
  toastHandler: (message, type = 'success', options) => {
    switch (type) {
      case 'success':
        toast.success(message, options);
        break;
      case 'error':
        toast.error(message, options);
        break;
      case 'warning':
        toast(message, { icon: '⚠️', ...options });
        break;
      default:
        toast(message, options);
        break;
    }
  }
});

await api.request({
  method: 'GET',
  url: '/me',
  successToast: true,
  customToastMessage: 'Fetched profile'
});
```

### Interceptors

```ts
const api = createAxlyClient({
  baseURL: '/api',
  requestInterceptors: [
    (config) => {
      config.headers = { ...config.headers, 'X-Trace': '123' };
      return config;
    }
  ],
  responseInterceptors: [
    (response) => {
      return response;
    }
  ]
});
```

## Errors and utilities

Exports

- Error classes: `RequestError`, `AuthError`, `CancelledError`
- Helpers: `delay(ms)`, `exponentialBackoffWithJitter(attempt, base?, cap?)`, `isBrowser`, `hasMessageInResponse`
- Types: `AxlyClient`, `AxlyConfig`, `RequestOptions`, `UploadOptions`, `ToastHandler`, etc.

Error semantics

- RequestError: thrown when a request ultimately fails (after retries). Includes original Axios error, response (if any), and code.
- AuthError: thrown when refresh fails or auth is otherwise invalid.
- CancelledError: thrown when a request is canceled via AbortController.

## Contributing

PRs welcome. Please run lint and build before submitting.

```sh
npm run lint
npm run build
```

## License

MIT
