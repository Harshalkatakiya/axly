# Axly

<div align="center">

[![npm version](https://img.shields.io/npm/v/axly.svg)](https://www.npmjs.com/package/axly)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

</div>

Axly is a powerful and flexible HTTP client library built on top of Axios, designed for seamless API interactions in both browser and Node.js environments. It provides advanced features like automatic token refreshing, retry mechanisms with exponential backoff, upload/download progress tracking, toast notifications (browser-only), request cancellation, and support for multiple API configurations. Axly simplifies authentication flows, error handling, and state management, making it ideal for modern web and server-side applications.

---

## 📋 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Core Concepts](#-core-concepts)
  - [Creating a Client](#creating-a-client)
  - [Single Configuration](#single-configuration)
  - [Multiple Configurations](#multiple-configurations)
- [API Reference](#-api-reference)
  - [createAxlyClient](#createaxlyclient)
  - [createAxlyNodeClient](#createaxlynodeclient)
  - [Client Methods](#client-methods)
  - [React Hook: useAxly](#react-hook-useaxly)
- [Usage Examples](#-usage-examples)
  - [Basic Requests](#basic-requests)
  - [Authentication & Token Management](#authentication--token-management)
  - [Request with Progress Tracking](#request-with-progress-tracking)
  - [File Upload](#file-upload)
  - [Request Cancellation](#request-cancellation)
  - [Retry Logic](#retry-logic)
  - [Toast Notifications](#toast-notifications)
  - [Custom Headers](#custom-headers)
  - [Error Handling](#error-handling)
  - [Multiple API Configurations](#multiple-api-configurations)
  - [Request/Response Interceptors](#requestresponse-interceptors)
  - [Node.js Usage](#nodejs-usage)
- [Advanced Features](#-advanced-features)
  - [Automatic Token Refresh](#automatic-token-refresh)
  - [Token Callbacks](#token-callbacks)
  - [Custom Error Handlers](#custom-error-handlers)
  - [Event Emitter](#event-emitter)
- [TypeScript Support](#-typescript-support)
- [Error Classes](#-error-classes)
- [Best Practices](#-best-practices)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

- **🔌 Axios Integration**: Leverages Axios for reliable HTTP requests with full interceptor support
- **🔀 Multiple Configurations**: Support for multiple API configs with different base URLs and auth setups
- **⚛️ React Hook**: `useAxly` hook for managing requests with loading state in React applications
- **🔐 Token Management**: Handles access and refresh tokens with automatic refreshing on 401 errors
- **🔄 Automatic Retries**: Exponential backoff with jitter for failed requests
- **📊 Progress Tracking**: Real-time upload and download progress monitoring
- **🎨 Toast Notifications**: Customizable success/error toast messages (browser-only)
- **❌ Request Cancellation**: Abort ongoing requests using `AbortController`
- **📁 File Uploads**: Simplified file uploads using `FormData`
- **⚠️ Error Handling**: Custom error handlers and specific error classes
- **🖥️ Node.js Support**: Via `createAxlyNodeClient` with server-optimized features
- **📡 Event Emitter**: Listen to events like client destruction
- **📘 TypeScript**: Full TypeScript support with comprehensive type definitions

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

Axly depends on Axios and React (for React hooks), which will be installed automatically.

---

## 🚀 Quick Start

### Basic Setup

```typescript
// apiClient.ts
import { createAxlyClient } from 'axly';

const apiClient = createAxlyClient({
  baseURL: 'https://api.example.com',
  token: localStorage.getItem('authToken'), // Optional JWT Bearer token
  toastHandler: (msg, type) => console.log(type, msg)
});

export default apiClient;
```

### Using in React

```tsx
// App.tsx
import React from 'react';
import { useAxly } from 'axly';
import apiClient from './apiClient';

const App = () => {
  const { isLoading, request } = useAxly(apiClient);

  const createUser = async () => {
    try {
      const response = await request({
        method: 'POST',
        url: '/users',
        data: { name: 'Jane Doe', email: 'jane@example.com' }
      });
      console.log('User created:', response.data);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  return (
    <div>
      <button onClick={createUser} disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create User'}
      </button>
    </div>
  );
};

export default App;
```

---

## 🎯 Core Concepts

### Creating a Client

Axly supports both single and multiple API configurations, allowing you to manage different API endpoints with different authentication strategies in a single application.

### Single Configuration

```typescript
import { createAxlyClient } from 'axly';

const apiClient = createAxlyClient({
  baseURL: 'https://api.example.com',
  token: 'your-jwt-token', // Single token for simple auth
  toastHandler: (message, type) => {
    // Custom toast implementation
    console.log(`[${type}] ${message}`);
  }
});
```

### Multiple Configurations

```typescript
import { createAxlyClient } from 'axly';

const client = createAxlyClient({
  // Main API
  mainAPI: {
    baseURL: 'https://api.example.com',
    token: localStorage.getItem('authToken')
  },

  // Public API without auth
  publicAPI: {
    baseURL: 'https://jsonplaceholder.typicode.com'
  },

  // Auth service with token refresh
  authService: {
    baseURL: 'https://auth.example.com',
    multiToken: true,
    accessToken: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken'),
    refreshEndpoint: '/auth/refresh',
    onRefresh: ({ accessToken, refreshToken }) => {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
    },
    onRefreshFail: (error) => {
      console.error('Token refresh failed:', error);
      // Redirect to login
      window.location.href = '/login';
    }
  }
});

export default client;
```

---

## 📚 API Reference

### createAxlyClient

Creates an Axly client instance with one or more configurations.

```typescript
createAxlyClient<ConfigMap>(config: AxlyConfig | ConfigMap): AxlyClient
```

#### Configuration Options

| Option                 | Type             | Description                                     |
| ---------------------- | ---------------- | ----------------------------------------------- |
| `baseURL`              | `string`         | Base URL for all requests **(required)**        |
| `token`                | `string \| null` | Single authentication token (Bearer)            |
| `multiToken`           | `boolean`        | Enable multi-token mode with auto-refresh       |
| `accessToken`          | `string \| null` | Access token for multi-token mode               |
| `refreshToken`         | `string \| null` | Refresh token for multi-token mode              |
| `refreshEndpoint`      | `string`         | Endpoint for token refresh                      |
| `refreshTimeout`       | `number`         | Timeout for refresh requests (default: 10000ms) |
| `toastHandler`         | `ToastHandler`   | Function to display toast notifications         |
| `tokenCallbacks`       | `TokenCallbacks` | Callbacks for getting/setting tokens            |
| `requestInterceptors`  | `Array`          | Axios request interceptors                      |
| `responseInterceptors` | `Array`          | Axios response interceptors                     |
| `errorHandler`         | `Function`       | Custom error handler for all requests           |
| `onRefresh`            | `Function`       | Callback when tokens are refreshed              |
| `onRefreshFail`        | `Function`       | Callback when token refresh fails               |

### createAxlyNodeClient

Creates an Axly client for Node.js environments (disables browser-specific features like toasts).

```typescript
createAxlyNodeClient<ConfigMap>(config: AxlyConfig | ConfigMap): AxlyClient
```

### Client Methods

#### request

Make an HTTP request with full configuration.

```typescript
client.request<ResponseType, DataType>(
  options: RequestOptions,
  stateUpdater?: Function
): Promise<AxiosResponse<ResponseType>>
```

**Request Options:**

| Option                    | Type          | Description                                               |
| ------------------------- | ------------- | --------------------------------------------------------- |
| `method`                  | `string`      | HTTP method (GET, POST, PUT, DELETE, etc.) **(required)** |
| `url`                     | `string`      | Request URL **(required)**                                |
| `data`                    | `any`         | Request body data                                         |
| `params`                  | `object`      | URL query parameters                                      |
| `contentType`             | `ContentType` | Content-Type header (default: 'application/json')         |
| `customHeaders`           | `object`      | Additional headers                                        |
| `responseType`            | `string`      | Response type (json, blob, text, etc.)                    |
| `baseURL`                 | `string`      | Override base URL for this request                        |
| `timeout`                 | `number`      | Request timeout in ms (default: 100000)                   |
| `retry`                   | `number`      | Number of retry attempts (default: 0)                     |
| `cancelable`              | `boolean`     | Enable request cancellation                               |
| `onCancel`                | `Function`    | Callback when request is cancelled                        |
| `successToast`            | `boolean`     | Show success toast                                        |
| `errorToast`              | `boolean`     | Show error toast                                          |
| `customToastMessage`      | `string`      | Custom success toast message                              |
| `customErrorToastMessage` | `string`      | Custom error toast message                                |
| `onUploadProgress`        | `Function`    | Upload progress callback                                  |
| `onDownloadProgress`      | `Function`    | Download progress callback                                |
| `configId`                | `string`      | Configuration ID for multi-config setups                  |

#### upload

Upload files using FormData.

```typescript
client.upload<ResponseType>(
  url: string,
  formData: FormData,
  options?: UploadOptions
): Promise<AxiosResponse<ResponseType>>
```

**Upload Options:**

| Option               | Type       | Description                         |
| -------------------- | ---------- | ----------------------------------- |
| `headers`            | `object`   | Additional headers                  |
| `timeout`            | `number`   | Request timeout (default: 120000ms) |
| `onUploadProgress`   | `Function` | Upload progress callback (0-100)    |
| `onDownloadProgress` | `Function` | Download progress callback (0-100)  |
| `baseURL`            | `string`   | Override base URL                   |
| `cancelable`         | `boolean`  | Enable cancellation                 |
| `onCancel`           | `Function` | Cancellation callback               |
| `configId`           | `string`   | Configuration ID                    |

#### setAccessToken

Set or update the access token.

```typescript
client.setAccessToken(token: string | null, configId?: string): void
```

#### setRefreshToken

Set or update the refresh token.

```typescript
client.setRefreshToken(token: string | null, configId?: string): void
```

#### setAuthorizationHeader

Set the Authorization header directly.

```typescript
client.setAuthorizationHeader(token: string | null, configId?: string): void
```

#### setDefaultHeader

Set a default header for all requests.

```typescript
client.setDefaultHeader(
  name: string,
  value: string | number | boolean,
  configId?: string
): void
```

#### clearDefaultHeader

Remove a default header.

```typescript
client.clearDefaultHeader(name: string, configId?: string): void
```

#### cancelRequest

Cancel an ongoing request.

```typescript
client.cancelRequest(controller?: AbortController | null): void
```

#### destroy

Destroy the client and clean up resources.

```typescript
client.destroy(): void
```

#### on

Listen to client events.

```typescript
client.on(event: string, handler: Function): () => void
```

### React Hook: useAxly

React hook for managing request state.

```typescript
const {
  isLoading,
  uploadProgress,
  downloadProgress,
  abortController,
  request,
  cancelRequest
} = useAxly(client);
```

**Returns:**

| Property           | Type                      | Description                          |
| ------------------ | ------------------------- | ------------------------------------ |
| `isLoading`        | `boolean`                 | Whether a request is in progress     |
| `uploadProgress`   | `number`                  | Upload progress (0-100)              |
| `downloadProgress` | `number`                  | Download progress (0-100)            |
| `abortController`  | `AbortController \| null` | Current abort controller             |
| `request`          | `Function`                | Make a request with state management |
| `cancelRequest`    | `Function`                | Cancel the current request           |

---

## 💡 Usage Examples

### Basic Requests

#### GET Request

```typescript
import apiClient from './apiClient';

// Simple GET request
const getUsers = async () => {
  try {
    const response = await apiClient.request({
      method: 'GET',
      url: '/users'
    });
    console.log('Users:', response.data);
  } catch (error) {
    console.error('Error fetching users:', error);
  }
};

// GET with query parameters
const searchUsers = async (query: string) => {
  const response = await apiClient.request({
    method: 'GET',
    url: '/users/search',
    params: { q: query, limit: 10 }
  });
  return response.data;
};
```

#### POST Request

```typescript
// Create a new user
const createUser = async (userData: any) => {
  const response = await apiClient.request({
    method: 'POST',
    url: '/users',
    data: userData,
    successToast: true,
    customToastMessage: 'User created successfully!'
  });
  return response.data;
};
```

#### PUT Request

```typescript
// Update user
const updateUser = async (userId: string, updates: any) => {
  const response = await apiClient.request({
    method: 'PUT',
    url: `/users/${userId}`,
    data: updates
  });
  return response.data;
};
```

#### DELETE Request

```typescript
// Delete user
const deleteUser = async (userId: string) => {
  const response = await apiClient.request({
    method: 'DELETE',
    url: `/users/${userId}`,
    successToast: true,
    errorToast: true
  });
  return response.data;
};
```

### Authentication & Token Management

#### Simple Token Auth

```typescript
import { createAxlyClient } from 'axly';

const apiClient = createAxlyClient({
  baseURL: 'https://api.example.com',
  token: localStorage.getItem('token')
});

// Login
const login = async (email: string, password: string) => {
  const response = await apiClient.request({
    method: 'POST',
    url: '/auth/login',
    data: { email, password }
  });

  const { token } = response.data;
  localStorage.setItem('token', token);
  apiClient.setAuthorizationHeader(token);

  return response.data;
};

// Logout
const logout = () => {
  localStorage.removeItem('token');
  apiClient.setAuthorizationHeader(null);
};
```

#### Multi-Token with Auto-Refresh

```typescript
import { createAxlyClient } from 'axly';

const apiClient = createAxlyClient({
  baseURL: 'https://api.example.com',
  multiToken: true,
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
  refreshEndpoint: '/auth/refresh',
  refreshTimeout: 10000,

  // Automatically save new tokens
  onRefresh: ({ accessToken, refreshToken }) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  },

  // Handle refresh failure
  onRefreshFail: (error) => {
    console.error('Token refresh failed:', error);
    localStorage.clear();
    window.location.href = '/login';
  }
});

// The client will automatically refresh tokens on 401 errors
const fetchProtectedData = async () => {
  // If accessToken is expired, it will be automatically refreshed
  const response = await apiClient.request({
    method: 'GET',
    url: '/protected/data'
  });
  return response.data;
};
```

#### Using Token Callbacks

```typescript
// Useful for state management libraries like Redux
import { createAxlyClient } from 'axly';
import store from './store';

const apiClient = createAxlyClient({
  baseURL: 'https://api.example.com',
  multiToken: true,
  refreshEndpoint: '/auth/refresh',

  tokenCallbacks: {
    getAccessToken: () => store.getState().auth.accessToken,
    setAccessToken: (token) =>
      store.dispatch({ type: 'SET_ACCESS_TOKEN', token }),
    getRefreshToken: () => store.getState().auth.refreshToken,
    setRefreshToken: (token) =>
      store.dispatch({ type: 'SET_REFRESH_TOKEN', token })
  },

  onRefresh: ({ accessToken, refreshToken }) => {
    console.log('Tokens refreshed successfully');
  }
});
```

### Request with Progress Tracking

#### Upload Progress in React

```tsx
import React, { useState } from 'react';
import { useAxly } from 'axly';
import apiClient from './apiClient';

const FileUploadComponent = () => {
  const { isLoading, uploadProgress, request } = useAxly(apiClient);
  const [file, setFile] = useState<File | null>(null);

  const handleUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await request({
        method: 'POST',
        url: '/upload',
        data: formData,
        contentType: 'multipart/form-data',
        successToast: true
      });
      console.log('Upload successful:', response.data);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <div>
      <input
        type='file'
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <button onClick={handleUpload} disabled={isLoading}>
        Upload
      </button>
      {isLoading && (
        <div>
          <progress value={uploadProgress} max='100' />
          <span>{uploadProgress}%</span>
        </div>
      )}
    </div>
  );
};
```

#### Download Progress

```typescript
const downloadFile = async (fileId: string) => {
  const response = await apiClient.request({
    method: 'GET',
    url: `/files/${fileId}/download`,
    responseType: 'blob',
    onDownloadProgress: (progress) => {
      console.log(`Download progress: ${progress}%`);
    }
  });

  // Create download link
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'file.pdf');
  document.body.appendChild(link);
  link.click();
  link.remove();
};
```

### File Upload

#### Simple File Upload

```typescript
const uploadFile = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('description', 'My file');

  const response = await apiClient.upload('/files', formData, {
    onUploadProgress: (percent) => {
      console.log(`Upload progress: ${percent}%`);
    }
  });

  return response.data;
};
```

#### Multiple File Upload

```typescript
const uploadMultipleFiles = async (files: FileList) => {
  const formData = new FormData();

  Array.from(files).forEach((file, index) => {
    formData.append(`file${index}`, file);
  });

  const response = await apiClient.upload('/files/bulk', formData, {
    timeout: 300000, // 5 minutes
    onUploadProgress: (percent) => {
      console.log(`Bulk upload progress: ${percent}%`);
    }
  });

  return response.data;
};
```

#### Upload with Additional Data

```typescript
const uploadWithMetadata = async (file: File, metadata: any) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('metadata', JSON.stringify(metadata));

  const response = await apiClient.request({
    method: 'POST',
    url: '/files/upload',
    data: formData,
    contentType: 'multipart/form-data',
    successToast: true,
    customToastMessage: 'File uploaded successfully!',
    onUploadProgress: (progress) => {
      console.log(`Upload: ${progress}%`);
    }
  });

  return response.data;
};
```

### Request Cancellation

#### Using useAxly Hook

```tsx
import React, { useEffect } from 'react';
import { useAxly } from 'axly';
import apiClient from './apiClient';

const SearchComponent = () => {
  const { isLoading, request, cancelRequest } = useAxly(apiClient);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState([]);

  useEffect(() => {
    if (!query) return;

    const searchUsers = async () => {
      try {
        const response = await request({
          method: 'GET',
          url: '/users/search',
          params: { q: query },
          cancelable: true,
          onCancel: () => console.log('Search cancelled')
        });
        setResults(response.data);
      } catch (error) {
        if (error.name !== 'CancelledError') {
          console.error('Search error:', error);
        }
      }
    };

    searchUsers();

    // Cleanup: cancel request when query changes or component unmounts
    return () => cancelRequest();
  }, [query]);

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder='Search users...'
      />
      {isLoading && <p>Searching...</p>}
      <ul>
        {results.map((user: any) => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </div>
  );
};
```

#### Manual Cancellation

```typescript
let abortController: AbortController | null = null;

const fetchData = async () => {
  try {
    const response = await apiClient.request(
      {
        method: 'GET',
        url: '/data',
        cancelable: true,
        onCancel: () => console.log('Request cancelled')
      },
      (state) => {
        abortController = state.abortController || null;
      }
    );
    return response.data;
  } catch (error) {
    if (error.name === 'CancelledError') {
      console.log('Request was cancelled');
    }
  }
};

// Cancel the request
const cancelFetch = () => {
  apiClient.cancelRequest(abortController);
};

// Usage
fetchData();
setTimeout(() => cancelFetch(), 1000); // Cancel after 1 second
```

### Retry Logic

#### Automatic Retries with Exponential Backoff

```typescript
// Retry up to 3 times with exponential backoff
const fetchWithRetry = async () => {
  try {
    const response = await apiClient.request({
      method: 'GET',
      url: '/unstable-endpoint',
      retry: 3, // Retry 3 times on failure
      timeout: 5000
    });
    return response.data;
  } catch (error) {
    console.error('Request failed after 3 retries:', error);
  }
};

// The retry mechanism uses exponential backoff with jitter:
// - Attempt 1: base delay (500ms) + random jitter
// - Attempt 2: ~1000ms + jitter
// - Attempt 3: ~2000ms + jitter
// Maximum delay is capped at 30 seconds
```

### Toast Notifications

#### Success Toasts

```typescript
// Using response message
const createPost = async (postData: any) => {
  const response = await apiClient.request({
    method: 'POST',
    url: '/posts',
    data: postData,
    successToast: true // Will use response.data.message if available
  });
  return response.data;
};

// Custom success message
const updatePost = async (postId: string, updates: any) => {
  const response = await apiClient.request({
    method: 'PUT',
    url: `/posts/${postId}`,
    data: updates,
    successToast: true,
    customToastMessage: 'Post updated successfully!',
    customToastMessageType: 'success'
  });
  return response.data;
};
```

#### Error Toasts

```typescript
const deletePost = async (postId: string) => {
  const response = await apiClient.request({
    method: 'DELETE',
    url: `/posts/${postId}`,
    successToast: true,
    errorToast: true, // Show error toast on failure
    customToastMessage: 'Post deleted successfully!',
    customErrorToastMessage: 'Failed to delete post. Please try again.'
  });
  return response.data;
};
```

#### Custom Toast Handler

```typescript
import { createAxlyClient } from 'axly';
import { toast } from 'react-toastify'; // or any toast library

const apiClient = createAxlyClient({
  baseURL: 'https://api.example.com',
  toastHandler: (message, type, options) => {
    switch (type) {
      case 'success':
        toast.success(message, options);
        break;
      case 'error':
        toast.error(message, options);
        break;
      case 'warning':
        toast.warning(message, options);
        break;
      case 'info':
        toast.info(message, options);
        break;
      default:
        toast(message, options);
    }
  }
});
```

### Custom Headers

#### Per-Request Headers

```typescript
const fetchWithCustomHeaders = async () => {
  const response = await apiClient.request({
    method: 'GET',
    url: '/data',
    customHeaders: {
      'X-Custom-Header': 'custom-value',
      'X-Request-ID': generateRequestId()
    }
  });
  return response.data;
};
```

#### Default Headers

```typescript
// Set a default header for all requests
apiClient.setDefaultHeader('X-App-Version', '1.0.0');
apiClient.setDefaultHeader('X-Device-ID', deviceId);

// Make requests (headers will be included automatically)
const response = await apiClient.request({
  method: 'GET',
  url: '/data'
});

// Clear a default header
apiClient.clearDefaultHeader('X-Device-ID');
```

#### Content Type Variations

```typescript
// JSON (default)
await apiClient.request({
  method: 'POST',
  url: '/data',
  data: { key: 'value' },
  contentType: 'application/json'
});

// Form data
await apiClient.request({
  method: 'POST',
  url: '/form',
  data: formData,
  contentType: 'multipart/form-data'
});

// URL encoded
await apiClient.request({
  method: 'POST',
  url: '/form',
  data: 'key=value&foo=bar',
  contentType: 'application/x-www-form-urlencoded'
});

// Plain text
await apiClient.request({
  method: 'POST',
  url: '/text',
  data: 'Plain text content',
  contentType: 'text/plain'
});
```

### Error Handling

#### Try-Catch with Error Types

```typescript
import { RequestError, AuthError, CancelledError } from 'axly';

const handleRequest = async () => {
  try {
    const response = await apiClient.request({
      method: 'GET',
      url: '/data'
    });
    return response.data;
  } catch (error) {
    if (error instanceof CancelledError) {
      console.log('Request was cancelled by user');
    } else if (error instanceof AuthError) {
      console.error('Authentication error:', error.message);
      // Redirect to login
      window.location.href = '/login';
    } else if (error instanceof RequestError) {
      console.error('Request failed:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        code: error.code
      });
    } else {
      console.error('Unknown error:', error);
    }
  }
};
```

#### Global Error Handler

```typescript
import { createAxlyClient } from 'axly';

const apiClient = createAxlyClient({
  baseURL: 'https://api.example.com',

  // Global error handler for all requests
  errorHandler: async (error) => {
    console.error('Global error handler:', error);

    // Log to error tracking service
    if (window.errorTracker) {
      window.errorTracker.captureException(error);
    }

    // Handle specific error codes
    if (error.response?.status === 403) {
      alert('You do not have permission to perform this action');
    } else if (error.response?.status === 503) {
      alert('Service temporarily unavailable');
    }

    // Return a custom response or re-throw
    throw error;
  }
});
```

#### React Error Boundary Integration

```tsx
import React from 'react';
import { useAxly } from 'axly';
import apiClient from './apiClient';

const DataFetcher = () => {
  const { isLoading, request } = useAxly(apiClient);
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState<Error | null>(null);

  const fetchData = async () => {
    try {
      setError(null);
      const response = await request({
        method: 'GET',
        url: '/data',
        errorToast: true
      });
      setData(response.data);
    } catch (err) {
      setError(err as Error);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  if (error) {
    return (
      <div>
        <h3>Error occurred:</h3>
        <p>{error.message}</p>
        <button onClick={fetchData}>Retry</button>
      </div>
    );
  }

  if (isLoading) return <div>Loading...</div>;

  return <div>{JSON.stringify(data)}</div>;
};
```

### Multiple API Configurations

#### Using Different Configurations

```typescript
import { createAxlyClient } from 'axly';

const client = createAxlyClient({
  mainAPI: {
    baseURL: 'https://api.example.com',
    token: localStorage.getItem('token')
  },
  analyticsAPI: {
    baseURL: 'https://analytics.example.com',
    token: localStorage.getItem('analyticsToken')
  },
  publicAPI: {
    baseURL: 'https://public-api.example.com'
  }
});

// Use mainAPI
const getUsers = async () => {
  const response = await client.request({
    method: 'GET',
    url: '/users',
    configId: 'mainAPI'
  });
  return response.data;
};

// Use analyticsAPI
const trackEvent = async (eventData: any) => {
  const response = await client.request({
    method: 'POST',
    url: '/events',
    data: eventData,
    configId: 'analyticsAPI'
  });
  return response.data;
};

// Use publicAPI (no auth)
const getPublicData = async () => {
  const response = await client.request({
    method: 'GET',
    url: '/data',
    configId: 'publicAPI'
  });
  return response.data;
};
```

#### Managing Tokens for Multiple Configs

```typescript
// Set tokens for specific configurations
client.setAccessToken('new-token', 'mainAPI');
client.setAccessToken('analytics-token', 'analyticsAPI');

// Set default headers for specific configurations
client.setDefaultHeader('X-App-Version', '2.0.0', 'mainAPI');
client.setDefaultHeader('X-Analytics-Key', 'key123', 'analyticsAPI');
```

### Request/Response Interceptors

#### Adding Request Interceptors

```typescript
import { createAxlyClient } from 'axly';

const apiClient = createAxlyClient({
  baseURL: 'https://api.example.com',

  requestInterceptors: [
    // Add timestamp to every request
    (config) => {
      config.headers['X-Request-Time'] = new Date().toISOString();
      return config;
    },

    // Add request ID
    (config) => {
      config.headers['X-Request-ID'] = generateUUID();
      return config;
    },

    // Log all requests
    (config) => {
      console.log('Request:', config.method?.toUpperCase(), config.url);
      return config;
    }
  ]
});
```

#### Adding Response Interceptors

```typescript
import { createAxlyClient } from 'axly';

const apiClient = createAxlyClient({
  baseURL: 'https://api.example.com',

  responseInterceptors: [
    // Transform response data
    (response) => {
      if (response.data?.data) {
        response.data = response.data.data;
      }
      return response;
    },

    // Log response time
    (response) => {
      const requestTime = response.config.headers['X-Request-Time'];
      if (requestTime) {
        const duration = Date.now() - new Date(requestTime).getTime();
        console.log(`Response time: ${duration}ms`);
      }
      return response;
    },

    // Cache responses
    async (response) => {
      if (response.config.method === 'GET') {
        await cache.set(response.config.url, response.data);
      }
      return response;
    }
  ]
});
```

### Node.js Usage

#### Basic Node.js Client

```typescript
import { createAxlyNodeClient } from 'axly';

// Create client without browser features (toasts disabled)
const apiClient = createAxlyNodeClient({
  baseURL: 'https://api.example.com',
  token: process.env.API_TOKEN
});

// Use in Node.js
const fetchData = async () => {
  const response = await apiClient.request({
    method: 'GET',
    url: '/data'
  });
  return response.data;
};
```

#### Express.js Integration

```typescript
import express from 'express';
import { createAxlyNodeClient } from 'axly';

const app = express();
const apiClient = createAxlyNodeClient({
  baseURL: 'https://api.example.com'
});

app.get('/api/users', async (req, res) => {
  try {
    const response = await apiClient.request({
      method: 'GET',
      url: '/users',
      params: req.query
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000);
```

#### Server-Side Token Management

```typescript
import { createAxlyNodeClient } from 'axly';

const apiClient = createAxlyNodeClient({
  baseURL: 'https://api.example.com',
  multiToken: true,
  refreshEndpoint: '/auth/refresh',

  tokenCallbacks: {
    getAccessToken: () => global.accessToken,
    setAccessToken: (token) => {
      global.accessToken = token;
    },
    getRefreshToken: () => global.refreshToken,
    setRefreshToken: (token) => {
      global.refreshToken = token;
    }
  },

  onRefresh: ({ accessToken, refreshToken }) => {
    console.log('Tokens refreshed on server');
    // Save to database or secure storage
  },

  onRefreshFail: (error) => {
    console.error('Token refresh failed on server:', error);
    // Re-authenticate or alert admin
  }
});
```

---

## 🔥 Advanced Features

### Automatic Token Refresh

Axly automatically handles token refresh on 401 errors when `multiToken` mode is enabled:

```typescript
const apiClient = createAxlyClient({
  baseURL: 'https://api.example.com',
  multiToken: true,
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
  refreshEndpoint: '/auth/refresh',
  refreshTimeout: 10000, // 10 seconds

  onRefresh: ({ accessToken, refreshToken }) => {
    // Called after successful token refresh
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    console.log('Tokens refreshed successfully');
  },

  onRefreshFail: (error) => {
    // Called when token refresh fails
    console.error('Token refresh failed:', error);
    localStorage.clear();
    window.location.href = '/login';
  }
});

// When making requests, if the access token is expired:
// 1. Axly receives a 401 error
// 2. Automatically calls the refresh endpoint with the refresh token
// 3. Updates the access token with the new one
// 4. Retries the original request with the new token
// 5. Returns the response to your code

const fetchProtectedData = async () => {
  // This will work even if the access token is expired
  const response = await apiClient.request({
    method: 'GET',
    url: '/protected/data'
  });
  return response.data;
};
```

**Refresh Endpoint Requirements:**

The refresh endpoint should:

- Accept a POST request with `{ refreshToken: string }` in the body
- Return `{ accessToken: string, refreshToken?: string }`
- If `refreshToken` is not returned, the existing one will be kept

### Token Callbacks

Use token callbacks to integrate with state management:

```typescript
// Redux integration
import { createAxlyClient } from 'axly';
import store from './store';

const apiClient = createAxlyClient({
  baseURL: 'https://api.example.com',
  multiToken: true,
  refreshEndpoint: '/auth/refresh',

  tokenCallbacks: {
    // Get tokens from Redux store
    getAccessToken: () => {
      return store.getState().auth.accessToken;
    },

    // Save access token to Redux store
    setAccessToken: (token) => {
      store.dispatch({ type: 'auth/setAccessToken', payload: token });
    },

    // Get refresh token from Redux store
    getRefreshToken: () => {
      return store.getState().auth.refreshToken;
    },

    // Save refresh token to Redux store
    setRefreshToken: (token) => {
      store.dispatch({ type: 'auth/setRefreshToken', payload: token });
    }
  }
});

// Zustand integration
import { create } from 'zustand';

const useAuthStore = create((set, get) => ({
  accessToken: null,
  refreshToken: null,
  setAccessToken: (token) => set({ accessToken: token }),
  setRefreshToken: (token) => set({ refreshToken: token })
}));

const apiClient = createAxlyClient({
  baseURL: 'https://api.example.com',
  multiToken: true,
  refreshEndpoint: '/auth/refresh',

  tokenCallbacks: {
    getAccessToken: () => useAuthStore.getState().accessToken,
    setAccessToken: (token) => useAuthStore.getState().setAccessToken(token),
    getRefreshToken: () => useAuthStore.getState().refreshToken,
    setRefreshToken: (token) => useAuthStore.getState().setRefreshToken(token)
  }
});
```

### Custom Error Handlers

Implement custom error handling logic:

```typescript
import { createAxlyClient } from 'axly';
import { AxiosError } from 'axios';

const apiClient = createAxlyClient({
  baseURL: 'https://api.example.com',

  errorHandler: async (error: AxiosError) => {
    const status = error.response?.status;
    const data = error.response?.data;

    // Handle specific status codes
    switch (status) {
      case 400:
        console.error('Bad Request:', data);
        // Show validation errors
        if (data?.errors) {
          Object.entries(data.errors).forEach(([field, messages]) => {
            console.error(`${field}: ${messages}`);
          });
        }
        break;

      case 401:
        console.error('Unauthorized');
        // Will be handled by token refresh if multiToken is enabled
        break;

      case 403:
        console.error('Forbidden - Insufficient permissions');
        alert('You do not have permission to perform this action');
        break;

      case 404:
        console.error('Resource not found');
        break;

      case 429:
        console.error('Too many requests - Rate limited');
        // Implement rate limit handling
        const retryAfter = error.response?.headers['retry-after'];
        if (retryAfter) {
          console.log(`Retry after ${retryAfter} seconds`);
        }
        break;

      case 500:
      case 502:
      case 503:
        console.error('Server error');
        // Log to error tracking service
        if (window.Sentry) {
          window.Sentry.captureException(error);
        }
        break;

      default:
        console.error('Request failed:', error.message);
    }

    // Transform error or re-throw
    throw error;
  }
});
```

### Event Emitter

Listen to client events:

```typescript
// Listen to destroy event
const unsubscribe = apiClient.on('destroy', () => {
  console.log('Client destroyed, cleaning up resources...');
  // Cleanup logic
});

// Custom events can be emitted if you extend the client
apiClient.on('tokenRefreshed', (tokens) => {
  console.log('New tokens received:', tokens);
});

// Remove listener
unsubscribe();

// Destroy client (triggers destroy event)
apiClient.destroy();
```

---

## 📘 TypeScript Support

Axly is written in TypeScript and provides full type definitions:

```typescript
import { createAxlyClient, AxlyClient, RequestOptions } from 'axly';

// Type-safe configuration
interface User {
  id: string;
  name: string;
  email: string;
}

interface CreateUserData {
  name: string;
  email: string;
  password: string;
}

const apiClient = createAxlyClient({
  baseURL: 'https://api.example.com'
});

// Type-safe requests
const createUser = async (userData: CreateUserData): Promise<User> => {
  const response = await apiClient.request<User, CreateUserData>({
    method: 'POST',
    url: '/users',
    data: userData
  });
  return response.data; // Typed as User
};

// Type-safe multi-config
const multiClient = createAxlyClient({
  api1: { baseURL: 'https://api1.com' },
  api2: { baseURL: 'https://api2.com' }
});

// configId is type-checked
await multiClient.request({
  method: 'GET',
  url: '/data',
  configId: 'api1' // Must be 'api1' or 'api2'
});

// Custom request options type
type MyRequestOptions = RequestOptions<CreateUserData, 'api1' | 'api2'>;

const makeRequest = async (options: MyRequestOptions) => {
  return await multiClient.request(options);
};
```

---

## ⚠️ Error Classes

Axly provides three specific error classes:

### RequestError

Thrown when a request fails:

```typescript
import { RequestError } from 'axly';

try {
  await apiClient.request({ method: 'GET', url: '/data' });
} catch (error) {
  if (error instanceof RequestError) {
    console.log('Message:', error.message);
    console.log('Status:', error.response?.status);
    console.log('Data:', error.response?.data);
    console.log('Code:', error.code);
    console.log('Original:', error.original);
  }
}
```

### AuthError

Thrown when authentication fails:

```typescript
import { AuthError } from 'axly';

try {
  await apiClient.request({ method: 'GET', url: '/protected' });
} catch (error) {
  if (error instanceof AuthError) {
    console.error('Authentication failed:', error.message);
    // Redirect to login
  }
}
```

### CancelledError

Thrown when a request is cancelled:

```typescript
import { CancelledError } from 'axly';

try {
  const response = await apiClient.request({
    method: 'GET',
    url: '/data',
    cancelable: true
  });
} catch (error) {
  if (error instanceof CancelledError) {
    console.log('Request was cancelled');
    // Handle cancellation (usually no action needed)
  }
}
```

---

## 💡 Best Practices

### 1. Centralize Client Configuration

Create a single client instance and export it:

```typescript
// api/client.ts
import { createAxlyClient } from 'axly';

export const apiClient = createAxlyClient({
  baseURL: import.meta.env.VITE_API_URL,
  multiToken: true,
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
  refreshEndpoint: '/auth/refresh',
  onRefresh: ({ accessToken, refreshToken }) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }
});

export default apiClient;
```

### 2. Create API Service Modules

Organize API calls by domain:

```typescript
// api/users.service.ts
import apiClient from './client';

export const usersService = {
  getAll: () => apiClient.request({ method: 'GET', url: '/users' }),

  getById: (id: string) =>
    apiClient.request({ method: 'GET', url: `/users/${id}` }),

  create: (data: any) =>
    apiClient.request({ method: 'POST', url: '/users', data }),

  update: (id: string, data: any) =>
    apiClient.request({ method: 'PUT', url: `/users/${id}`, data }),

  delete: (id: string) =>
    apiClient.request({ method: 'DELETE', url: `/users/${id}` })
};
```

### 3. Use TypeScript for Type Safety

```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

const getUsers = async (): Promise<User[]> => {
  const response = await apiClient.request<User[]>({
    method: 'GET',
    url: '/users'
  });
  return response.data;
};
```

### 4. Handle Errors Gracefully

```typescript
import { RequestError, AuthError, CancelledError } from 'axly';

const fetchData = async () => {
  try {
    const response = await apiClient.request({
      method: 'GET',
      url: '/data',
      errorToast: true // Show error toasts automatically
    });
    return response.data;
  } catch (error) {
    if (error instanceof CancelledError) {
      // User cancelled - usually no action needed
      return null;
    }
    if (error instanceof AuthError) {
      // Redirect to login
      window.location.href = '/login';
      return null;
    }
    if (error instanceof RequestError) {
      // Log to error tracking
      console.error('Request failed:', error);
      return null;
    }
    throw error;
  }
};
```

### 5. Use Toasts for User Feedback

```typescript
await apiClient.request({
  method: 'POST',
  url: '/posts',
  data: postData,
  successToast: true,
  errorToast: true,
  customToastMessage: 'Post created successfully!',
  customErrorToastMessage: 'Failed to create post'
});
```

### 6. Implement Request Cancellation for Search

```typescript
useEffect(() => {
  const controller = new AbortController();

  const search = async () => {
    try {
      const response = await apiClient.request(
        {
          method: 'GET',
          url: '/search',
          params: { q: query },
          cancelable: true
        },
        (state) => {
          if (state.abortController) {
            controller = state.abortController;
          }
        }
      );
      setResults(response.data);
    } catch (error) {
      if (!(error instanceof CancelledError)) {
        console.error(error);
      }
    }
  };

  if (query) search();

  return () => controller.abort();
}, [query]);
```

### 7. Use Environment Variables

```typescript
// .env
VITE_API_URL=https://api.example.com
VITE_AUTH_URL=https://auth.example.com

// client.ts
const apiClient = createAxlyClient({
  mainAPI: {
    baseURL: import.meta.env.VITE_API_URL
  },
  authAPI: {
    baseURL: import.meta.env.VITE_AUTH_URL
  }
});
```

### 8. Clean Up on Component Unmount

```tsx
useEffect(() => {
  return () => {
    // Cancel any pending requests
    cancelRequest();
  };
}, []);
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Harshal Katakiya**

- Email: katakiyaharshl001@gmail.com
- GitHub: [@Harshalkatakiya](https://github.com/Harshalkatakiya)

---

## 🙏 Acknowledgments

- Built on top of [Axios](https://axios-http.com/)
- Inspired by modern API client patterns
- Community feedback and contributions

---

## 📚 Additional Resources

- [Axios Documentation](https://axios-http.com/docs/intro)
- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

---

<div align="center">

Made with ❤️ by [Harshal Katakiya](https://github.com/Harshalkatakiya)

If you find this package helpful, please consider giving it a ⭐ on [GitHub](https://github.com/Harshalkatakiya/axly)!

</div>
