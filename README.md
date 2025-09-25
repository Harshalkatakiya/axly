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

## Quick Start Guide

### 1) Installation & Setup

```bash
npm install axly
# or
yarn add axly
# or
pnpm add axly
```

### 2) Basic Client Setup

#### Creating a Client Instance

```ts
// api/client.ts
import { createAxlyClient } from 'axly';

export const apiClient = createAxlyClient({
  baseURL: 'https://api.example.com'
  // Optional: Add default headers
  // Optional: Set up token management
});
```

#### Creating Multiple CLient Instance

Axly allows you to manage multiple configurations simultaneously. This is useful when interacting with different APIs.

```ts
// api/client.ts
import { createAxlyClient } from 'axly';

export const apiClient = createAxlyClient({
  mainApi: {
    baseURL: 'https://api.example.com',
    token: 'main-api-jwt-token',
    // Optional: Error handling specific to this API
    errorHandler: async (error) => {
      console.error('Main API Error:', error.message);
      // Return a specific response or re-throw
      throw error;
    },
    // Optional: Toast handler specific to this API (browser only)
    toastHandler: (message, type) => {
      // Your toast notification logic
      console.log(`${type}: ${message}`);
    }
  },
  secondaryApi: {
    baseURL: 'https://secondary-api.example.com',
    // Use multiToken pattern for this instance
    multiToken: true,
    accessToken: 'secondary-access-token',
    refreshToken: 'secondary-refresh-token',
    refreshEndpoint: '/auth/refresh',
    // Optional: Refresh callbacks for this instance
    tokenCallbacks: {
      getAccessToken: () => localStorage.getItem('secondary_access_token'),
      setAccessToken: (token) =>
        localStorage.setItem('secondary_access_token', token),
      getRefreshToken: () => localStorage.getItem('secondary_refresh_token'),
      setRefreshToken: (token) =>
        localStorage.setItem('secondary_refresh_token', token)
    },
    onRefresh: (tokens) => {
      localStorage.setItem('secondary_access_token', tokens.accessToken);
      localStorage.setItem('secondary_refresh_token', tokens.refreshToken);
    },
    onRefreshFail: (error) => {
      console.error('Secondary API refresh failed:', error);
      // Handle refresh failure, e.g., redirect to login
    }
  },
  thirdPartyApi: {
    baseURL: 'https://third-party.api.com',
    // No initial token needed
    // Can add specific interceptors
    requestInterceptors: [
      (config) => {
        config.headers['X-Client-ID'] = 'your-client-id';
        return config;
      }
    ],
    responseInterceptors: [
      (response) => {
        console.log('Third-party API Response:', response.status);
        return response;
      }
    ]
  }
});
```

### 3) Simple React Hook Usage

```tsx
// components/UserList.tsx
import React, { useEffect, useState } from 'react';
import { useAxly } from 'axly';
import { apiClient } from '../api/client';

interface User {
  id: number;
  name: string;
  email: string;
}

export default function UserList() {
  const { request, isLoading } = useAxly(apiClient);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await request<User[]>({
          method: 'GET',
          url: '/users'
        });
        setUsers(response.data);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    };

    fetchUsers();
  }, [request]);

  if (isLoading) return <div>Loading users...</div>;

  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>
          {user.name} - {user.email}
        </li>
      ))}
    </ul>
  );
}
```

### 4) Node.js Usage

```ts
// server/api.ts
import { createAxlyNodeClient } from 'axly';

const api = createAxlyNodeClient({
  baseURL: 'https://api.example.com',
  token: process.env.API_TOKEN // Optional auth token
});

async function fetchUserData(userId: string) {
  try {
    const response = await api.request<{ id: string; profile: any }>({
      method: 'GET',
      url: `/users/${userId}`,
      timeout: 5000,
      retry: 2
    });
    return response.data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}
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

## React TypeScript Examples

### Basic CRUD Operations

#### 1. GET Request with Loading State

```tsx
import React, { useEffect, useState } from 'react';
import { useAxly } from 'axly';
import { apiClient } from '../api/client';

interface Post {
  id: number;
  title: string;
  body: string;
  userId: number;
}

export const PostList: React.FC = () => {
  const { request, isLoading } = useAxly(apiClient);
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await request<Post[]>({
          method: 'GET',
          url: '/posts',
          params: { _limit: 10 }, // Query parameters
          successToast: true,
          customToastMessage: 'Posts loaded successfully!'
        });
        setPosts(response.data);
        setError('');
      } catch (err) {
        setError('Failed to load posts');
        console.error('Error:', err);
      }
    };

    fetchPosts();
  }, [request]);

  if (isLoading) return <div className='loading'>Loading posts...</div>;
  if (error) return <div className='error'>{error}</div>;

  return (
    <div>
      <h2>Posts</h2>
      {posts.map((post) => (
        <div key={post.id} className='post-card'>
          <h3>{post.title}</h3>
          <p>{post.body}</p>
        </div>
      ))}
    </div>
  );
};
```

#### 2. POST Request - Creating Data

```tsx
import React, { useState } from 'react';
import { useAxly } from 'axly';
import { apiClient } from '../api/client';

interface CreatePostData {
  title: string;
  body: string;
  userId: number;
}

interface Post extends CreatePostData {
  id: number;
}

export const CreatePost: React.FC = () => {
  const { request, isLoading } = useAxly(apiClient);
  const [formData, setFormData] = useState<CreatePostData>({
    title: '',
    body: '',
    userId: 1
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await request<Post>({
        method: 'POST',
        url: '/posts',
        data: formData,
        contentType: 'application/json',
        successToast: true,
        errorToast: true,
        customToastMessage: 'Post created successfully!',
        customErrorToastMessage: 'Failed to create post'
      });

      console.log('Created post:', response.data);
      // Reset form
      setFormData({ title: '', body: '', userId: 1 });
    } catch (error) {
      console.error('Error creating post:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <input
          type='text'
          placeholder='Post title'
          value={formData.title}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, title: e.target.value }))
          }
          required
        />
      </div>
      <div>
        <textarea
          placeholder='Post content'
          value={formData.body}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, body: e.target.value }))
          }
          required
        />
      </div>
      <button type='submit' disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create Post'}
      </button>
    </form>
  );
};
```

#### 3. PUT/PATCH Request - Updating Data

```tsx
import React, { useState, useEffect } from 'react';
import { useAxly } from 'axly';
import { apiClient } from '../api/client';

interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
}

interface UserUpdateProps {
  userId: number;
  onUpdate?: (user: User) => void;
}

export const UpdateUser: React.FC<UserUpdateProps> = ({ userId, onUpdate }) => {
  const { request, isLoading } = useAxly(apiClient);
  const [user, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({});

  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await request<User>({
          method: 'GET',
          url: `/users/${userId}`
        });
        setUser(response.data);
        setFormData(response.data);
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };

    fetchUser();
  }, [userId, request]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await request<User>({
        method: 'PUT', // or 'PATCH' for partial updates
        url: `/users/${userId}`,
        data: formData,
        successToast: true,
        customToastMessage: 'User updated successfully!'
      });

      setUser(response.data);
      onUpdate?.(response.data);
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  if (!user) return <div>Loading user...</div>;

  return (
    <form onSubmit={handleUpdate}>
      <input
        type='text'
        value={formData.name || ''}
        onChange={(e) =>
          setFormData((prev) => ({ ...prev, name: e.target.value }))
        }
        placeholder='Name'
      />
      <input
        type='email'
        value={formData.email || ''}
        onChange={(e) =>
          setFormData((prev) => ({ ...prev, email: e.target.value }))
        }
        placeholder='Email'
      />
      <input
        type='tel'
        value={formData.phone || ''}
        onChange={(e) =>
          setFormData((prev) => ({ ...prev, phone: e.target.value }))
        }
        placeholder='Phone'
      />
      <button type='submit' disabled={isLoading}>
        {isLoading ? 'Updating...' : 'Update User'}
      </button>
    </form>
  );
};
```

#### 4. DELETE Request

```tsx
import React, { useState } from 'react';
import { useAxly } from 'axly';
import { apiClient } from '../api/client';

interface DeleteButtonProps {
  itemId: number;
  itemType: 'post' | 'user' | 'comment';
  onDelete?: () => void;
}

export const DeleteButton: React.FC<DeleteButtonProps> = ({
  itemId,
  itemType,
  onDelete
}) => {
  const { request, isLoading } = useAxly(apiClient);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    try {
      await request({
        method: 'DELETE',
        url: `/${itemType}s/${itemId}`,
        successToast: true,
        customToastMessage: `${itemType} deleted successfully!`,
        errorToast: true
      });

      onDelete?.();
      setShowConfirm(false);
    } catch (error) {
      console.error(`Error deleting ${itemType}:`, error);
    }
  };

  if (showConfirm) {
    return (
      <div className='confirm-delete'>
        <p>Are you sure you want to delete this {itemType}?</p>
        <button onClick={handleDelete} disabled={isLoading}>
          {isLoading ? 'Deleting...' : 'Yes, Delete'}
        </button>
        <button onClick={() => setShowConfirm(false)}>Cancel</button>
      </div>
    );
  }

  return (
    <button onClick={() => setShowConfirm(true)} className='delete-btn'>
      Delete {itemType}
    </button>
  );
};
```

### Advanced Features Examples

#### 5. File Upload with Progress

```tsx
import React, { useState } from 'react';
import { useAxly } from 'axly';
import { apiClient } from '../api/client';

interface UploadResponse {
  filename: string;
  url: string;
  size: number;
}

export const FileUpload: React.FC = () => {
  const { request, isLoading, uploadProgress } = useAxly(apiClient);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setSelectedFile(file || null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('category', 'documents');

    try {
      const response = await request<UploadResponse>({
        method: 'POST',
        url: '/upload',
        data: formData,
        contentType: 'multipart/form-data',
        timeout: 30000, // 30 seconds for large files
        onUploadProgress: (progress) => {
          console.log(`Upload progress: ${progress}%`);
        },
        successToast: true,
        customToastMessage: 'File uploaded successfully!'
      });

      setUploadResult(response.data);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <div>
      <input
        type='file'
        onChange={handleFileSelect}
        accept='.pdf,.jpg,.jpeg,.png,.doc,.docx'
      />

      {selectedFile && (
        <div>
          <p>Selected: {selectedFile.name}</p>
          <button onClick={handleUpload} disabled={isLoading}>
            {isLoading ? 'Uploading...' : 'Upload File'}
          </button>
        </div>
      )}

      {isLoading && (
        <div className='progress-bar'>
          <div
            className='progress-fill'
            style={{ width: `${uploadProgress}%` }}>
            {uploadProgress}%
          </div>
        </div>
      )}

      {uploadResult && (
        <div className='upload-result'>
          <h3>Upload Successful!</h3>
          <p>File: {uploadResult.filename}</p>
          <p>Size: {uploadResult.size} bytes</p>
          <a href={uploadResult.url} target='_blank' rel='noopener noreferrer'>
            View File
          </a>
        </div>
      )}
    </div>
  );
};
```

#### 6. Request Cancellation

```tsx
import React, { useState, useEffect } from 'react';
import { useAxly } from 'axly';
import { apiClient } from '../api/client';

interface SearchResult {
  id: number;
  title: string;
  description: string;
}

export const SearchWithCancel: React.FC = () => {
  const { request, isLoading, cancelRequest } = useAxly(apiClient);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchId, setSearchId] = useState(0);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    // Cancel previous request
    cancelRequest();

    // Debounce search
    const timeoutId = setTimeout(() => {
      performSearch(query);
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      cancelRequest();
    };
  }, [query, cancelRequest]);

  const performSearch = async (searchQuery: string) => {
    const currentSearchId = Date.now();
    setSearchId(currentSearchId);

    try {
      const response = await request<SearchResult[]>({
        method: 'GET',
        url: '/search',
        params: { q: searchQuery, limit: 20 },
        cancelable: true,
        onCancel: () => {
          console.log('Search request cancelled');
        }
      });

      // Only update results if this is still the latest search
      if (currentSearchId === searchId) {
        setResults(response.data);
      }
    } catch (error) {
      if (error.name !== 'CancelledError') {
        console.error('Search failed:', error);
      }
    }
  };

  const handleCancel = () => {
    cancelRequest();
    setResults([]);
  };

  return (
    <div>
      <div className='search-input'>
        <input
          type='text'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Search...'
        />
        {isLoading && (
          <button onClick={handleCancel} className='cancel-btn'>
            Cancel
          </button>
        )}
      </div>

      {isLoading && <div>Searching...</div>}

      <div className='search-results'>
        {results.map((result) => (
          <div key={result.id} className='result-item'>
            <h4>{result.title}</h4>
            <p>{result.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
```

#### 7. Retry Logic with Error Handling

```tsx
import React, { useState } from 'react';
import { useAxly } from 'axly';
import { apiClient } from '../api/client';
import { RequestError, AuthError, CancelledError } from 'axly';

interface ApiData {
  id: number;
  data: string;
  timestamp: string;
}

export const RetryExample: React.FC = () => {
  const { request, isLoading } = useAxly(apiClient);
  const [data, setData] = useState<ApiData | null>(null);
  const [error, setError] = useState<string>('');
  const [attemptCount, setAttemptCount] = useState(0);

  const fetchDataWithRetry = async () => {
    setError('');
    setAttemptCount(0);

    try {
      const response = await request<ApiData>({
        method: 'GET',
        url: '/unreliable-endpoint',
        retry: 3, // Retry up to 3 times
        timeout: 5000,
        onUploadProgress: (progress) => {
          console.log(`Attempt ${attemptCount + 1}: ${progress}% complete`);
        },
        successToast: true,
        errorToast: true,
        customToastMessage: 'Data fetched successfully!',
        customErrorToastMessage: 'Failed to fetch data after retries'
      });

      setData(response.data);
    } catch (err) {
      // Handle different error types
      if (err instanceof RequestError) {
        setError(
          `Request failed: ${err.message} (HTTP ${err.response?.status})`
        );
      } else if (err instanceof AuthError) {
        setError('Authentication failed. Please login again.');
      } else if (err instanceof CancelledError) {
        setError('Request was cancelled');
      } else {
        setError('An unexpected error occurred');
      }
      console.error('Error details:', err);
    }
  };

  return (
    <div>
      <button onClick={fetchDataWithRetry} disabled={isLoading}>
        {isLoading ? 'Fetching with retry...' : 'Fetch Data'}
      </button>

      {error && (
        <div className='error-message'>
          <strong>Error:</strong> {error}
        </div>
      )}

      {data && (
        <div className='data-display'>
          <h3>Fetched Data:</h3>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};
```

#### 8. Authentication & Token Management

```tsx
import React, { useState, useEffect } from 'react';
import { createAxlyClient, useAxly } from 'axly';

// Create client with token management
const authApiClient = createAxlyClient({
  baseURL: 'https://api.example.com',
  multiToken: true,
  refreshEndpoint: '/auth/refresh',
  tokenCallbacks: {
    getAccessToken: () => localStorage.getItem('accessToken'),
    setAccessToken: (token) => {
      if (token) localStorage.setItem('accessToken', token);
      else localStorage.removeItem('accessToken');
    },
    getRefreshToken: () => localStorage.getItem('refreshToken'),
    setRefreshToken: (token) => {
      if (token) localStorage.setItem('refreshToken', token);
      else localStorage.removeItem('refreshToken');
    }
  },
  onRefresh: ({ accessToken, refreshToken }) => {
    console.log('Tokens refreshed successfully');
  },
  onRefreshFail: (error) => {
    console.error('Token refresh failed:', error);
    // Redirect to login
    window.location.href = '/login';
  }
});

interface User {
  id: number;
  name: string;
  email: string;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export const AuthExample: React.FC = () => {
  const { request, isLoading } = useAxly(authApiClient);
  const [user, setUser] = useState<User | null>(null);
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: ''
  });

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      try {
        const response = await request<User>({
          method: 'GET',
          url: '/auth/me'
        });
        setUser(response.data);
      } catch (error) {
        console.error('Auth check failed:', error);
      }
    };

    checkAuth();
  }, [request]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await request<AuthResponse>({
        method: 'POST',
        url: '/auth/login',
        data: credentials,
        successToast: true,
        customToastMessage: 'Logged in successfully!'
      });

      const { user, accessToken, refreshToken } = response.data;

      // Tokens are automatically stored via tokenCallbacks
      setUser(user);
      setCredentials({ email: '', password: '' });
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await request({
        method: 'POST',
        url: '/auth/logout'
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      // Clear local state and tokens
      setUser(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  };

  const fetchProtectedData = async () => {
    try {
      const response = await request<any>({
        method: 'GET',
        url: '/protected/data',
        successToast: true,
        customToastMessage: 'Protected data fetched!'
      });
      console.log('Protected data:', response.data);
    } catch (error) {
      console.error('Failed to fetch protected data:', error);
    }
  };

  if (user) {
    return (
      <div>
        <h2>Welcome, {user.name}!</h2>
        <p>Email: {user.email}</p>
        <button onClick={fetchProtectedData} disabled={isLoading}>
          Fetch Protected Data
        </button>
        <button onClick={handleLogout}>Logout</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleLogin}>
      <h2>Login</h2>
      <input
        type='email'
        value={credentials.email}
        onChange={(e) =>
          setCredentials((prev) => ({ ...prev, email: e.target.value }))
        }
        placeholder='Email'
        required
      />
      <input
        type='password'
        value={credentials.password}
        onChange={(e) =>
          setCredentials((prev) => ({ ...prev, password: e.target.value }))
        }
        placeholder='Password'
        required
      />
      <button type='submit' disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
};
```

#### 9. Toast Notifications Setup

```tsx
import React from 'react';
import { createAxlyClient } from 'axly';
import { toast, Toaster } from 'react-hot-toast';

// Setup client with toast integration
export const toastApiClient = createAxlyClient({
  baseURL: 'https://api.example.com',
  toastHandler: (message, type = 'success', options) => {
    switch (type) {
      case 'success':
        toast.success(message, {
          duration: 4000,
          position: 'top-right',
          ...options
        });
        break;
      case 'error':
        toast.error(message, {
          duration: 6000,
          position: 'top-right',
          ...options
        });
        break;
      case 'warning':
        toast(message, {
          icon: '⚠️',
          duration: 5000,
          position: 'top-right',
          ...options
        });
        break;
      case 'info':
        toast(message, {
          icon: 'ℹ️',
          duration: 4000,
          position: 'top-right',
          ...options
        });
        break;
      case 'loading':
        toast.loading(message, options);
        break;
      default:
        toast(message, options);
    }
  }
});

// App component with toast provider
export const App: React.FC = () => {
  return (
    <div>
      {/* Your app components */}
      <Toaster />
    </div>
  );
};
```

#### 10. Custom Hooks for Common Patterns

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useAxly } from 'axly';
import { apiClient } from '../api/client';

// Custom hook for data fetching with loading and error states
export function useApiData<T>(url: string, deps: any[] = []) {
  const { request } = useAxly(apiClient);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await request<T>({
        method: 'GET',
        url,
        errorToast: true
      });
      setData(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [request, url]);

  useEffect(() => {
    fetchData();
  }, [fetchData, ...deps]);

  return { data, loading, error, refetch: fetchData };
}

// Custom hook for mutations (POST, PUT, DELETE)
export function useApiMutation<TData, TVariables = any>() {
  const { request, isLoading } = useAxly(apiClient);
  const [error, setError] = useState<string>('');

  const mutate = async (
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    data?: TVariables
  ): Promise<TData | null> => {
    setError('');

    try {
      const response = await request<TData>({
        method,
        url,
        data,
        successToast: true,
        errorToast: true
      });
      return response.data;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Mutation failed';
      setError(errorMessage);
      throw err;
    }
  };

  return { mutate, isLoading, error };
}

// Usage example
const UserProfile: React.FC<{ userId: number }> = ({ userId }) => {
  const { data: user, loading, error } = useApiData<User>(`/users/${userId}`);
  const { mutate, isLoading: updating } = useApiMutation<User>();

  const updateUser = async (userData: Partial<User>) => {
    try {
      await mutate('PUT', `/users/${userId}`, userData);
      // Optionally refetch or update local state
    } catch (error) {
      console.error('Update failed:', error);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div>
      <h2>{user.name}</h2>
      <button
        onClick={() => updateUser({ name: 'New Name' })}
        disabled={updating}>
        {updating ? 'Updating...' : 'Update Name'}
      </button>
    </div>
  );
};
```

## Advanced Usage Patterns

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
