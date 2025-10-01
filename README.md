# Axly

Axly is a flexible HTTP client library built on top of Axios, designed for seamless API interactions in both browser and Node.js environments. It provides advanced features like automatic token refreshing, retry mechanisms with exponential backoff, upload/download progress tracking, toast notifications (browser-only), request cancellation, and support for multiple API configurations. Axly simplifies authentication flows, error handling, and state management, making it ideal for modern web and server-side applications.

---

## Features

- **Axios Integration**: Leverages Axios for reliable HTTP requests with interceptors support.
- **Multiple Configurations**: Support for multiple API configs (e.g., different base URLs or auth setups).
- **React Hook**: `useAxly` for managing requests with loading state in React applications.
- **Token Management**: Handles access and refresh tokens with automatic refreshing on 401 errors (in multi-token mode).
- **Retries**: Automatic retries with exponential backoff and jitter.
- **Progress Tracking**: Monitors upload and download progress.
- **Toast Notifications**: Customizable success/error toasts (browser-only).
- **Request Cancellation**: Abort ongoing requests using `AbortController`.
- **Uploads**: Easy file uploads using `FormData`.
- **Error Handling**: Custom error handlers and specific error classes (`RequestError`, `AuthError`, `CancelledError`).
- **Node.js Support**: Via `createAxlyNodeClient`, which disables browser-specific features like toasts.
- **Event Emitter**: Listen to events like client destruction.

---

## Installation

```bash
npm install axly
# or
pnpm add axly
# or
bun add axly
```

Axly depends on Axios, which will be installed automatically.

---

## Quickstart

```ts
// apiClient.ts
import { createAxlyClient } from 'axly';

const apiClient = createAxlyClient({
  baseURL: 'https://api.example.com',
  token: localStorage.getItem('authToken'), // Optional JWT Bearer token
  toastHandler: (msg, type) => console.log(type, msg)
});

export default apiClient;
```

```tsx
// App.tsx
import React, { useState } from 'react';
import { useAxly } from 'axly';
import { apiClient } from './apiClient';

const App = () => {
  const { data, error, isLoading, request } = useAxly(apiClient);

  const createUser = async () => {
    const userData = { name: 'Jane Doe', email: 'jane@example.com' };
    try {
      const response = await request({
        method: 'POST',
        url: '/users',
        data: userData
      });
      if (response.status === 201) {
        console.log('User created:', response.data);
      }
    } catch (err) {
      console.error('Create user error:', err);
    }
  };
  if (error) return <div>Error: {error.message}</div>;
  return (
    <div>
      <button onClick={createUser} disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Signup'}
      </button>
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
};

export default App;
```

---

## Core Concepts

### Creating a Client

You can define one or more API configurations when creating a client. Each configuration can have its own base URL, headers, and authentication tokens.

- Single API client Configuration:

```tsx
// apiClient.ts
import { createAxlyClient } from 'axly';

const apiClient = createAxlyClient({
  baseURL: 'https://api.example.com',
  token: localStorage.getItem('authToken'), // Optional JWT Bearer token
  toastHandler: (msg, type) => console.log(type, msg)
});

export default apiClient;
```

- Multiple API client Configuration:

```tsx
// apiClient.ts
import { createAxlyClient } from 'axly';

const axlyMultiConfig = createAxlyClient({
  backend1: {
    baseURL: 'https://api.example.com',
    token: localStorage.getItem('authToken')
  },
  dummyData: {
    baseURL: 'https://jsonplaceholder.typicode.com'
  },
  authServiceBackend: {
    baseURL: 'https://auth.example.com',
    token: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken'),
    multiToken: true, // Enable multi-token mode for automatic token refreshing
    refreshEndpoint: '/refresh', // Endpoint to refresh tokens
    onRefreshSuccess: (newToken, newRefreshToken) => {
      localStorage.setItem('accessToken', newToken);
      localStorage.setItem('refreshToken', newRefreshToken);
    },
    onRefreshFailure: () => {
      // Handle refresh failure (e.g., redirect to login)
      console.log('Refresh token expired. Redirecting to login.');
    }
  }
});

export default axlyMultiConfig;
```
