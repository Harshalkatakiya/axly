# Axly

Axly is a powerful and flexible HTTP client for React and Node.js, built on top of Axios. It simplifies API requests with features like automatic toast notifications, request cancellation, progress tracking, and retry mechanisms.

[![npm version](https://img.shields.io/npm/v/axly.svg)](https://www.npmjs.com/package/axly)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Table of Contents

- [Installation](#installation)
- [Features](#features)
- [Usage](#usage)
  - [React Usage](#react-usage)
  - [Node.js Usage](#nodejs-usage)
- [Configuration](#configuration)
- [API Reference](#api-reference)
  - [useAxly Hook](#useaxly-hook)
  - [axlyNode](#axlynode)
  - [RequestOptions](#requestoptions)
  - [AxlyConfig](#axlyconfig)
- [Examples](#examples)
- [License](#license)

## Installation

```bash
npm install axly
# or
yarn add axly
# or
pnpm add axly
# or
bun add axly
```

## Features

- 🔄 **React Hook & Node.js Support**: Use in both React applications and Node.js environments
- 🚦 **Request State Management**: Track loading states and progress automatically
- ❌ **Request Cancellation**: Cancel ongoing requests when needed
- 🔁 **Automatic Retries**: Configure automatic retry attempts for failed requests
- 📊 **Progress Tracking**: Monitor upload and download progress
- 🔔 **Toast Notifications**: Automatic success and error notifications
- 🔐 **Authentication**: Easy token-based authentication
- 🛠️ **Interceptors**: Customize request and response handling
- ⚙️ **Type Safety**: Full TypeScript support

## Usage

### React Usage

```typescript
import React, { useEffect } from 'react';
import useAxly, { setAxlyConfig } from 'axly';

// Configure Axly globally (typically in your app's entry point)
setAxlyConfig({
  baseURL: 'https://api.example.com',
  token: 'your-auth-token', // Optional
  toastHandler: (message, type) => {
    // Integrate with your toast library
    console.log(`${type}: ${message}`);
  }
});

function UserProfile() {
  const { request, isLoading, uploadProgress, downloadProgress, cancelRequest } = useAxly();
  const [userData, setUserData] = React.useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await request({
          method: 'get',
          url: '/users/profile',
          successToast: true, // Show success toast
          errorToast: true, // Show error toast
          cancelable: true, // Enable cancellation
        });

        setUserData(response.data);
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    };

    fetchUserData();

    // Cleanup function to cancel request if component unmounts
    return () => {
      cancelRequest();
    };
  }, []);

  // Example file upload with progress tracking
  const handleFileUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      await request({
        method: 'post',
        url: '/upload',
        data: formData,
        contentType: 'multipart/form-data',
        onUploadProgress: (progress) => console.log(`Upload progress: ${progress}%`),
        successToast: true,
        customToastMessage: 'File uploaded successfully!',
      });
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <div>
      {isLoading ? (
        <div>
          <p>Loading...</p>
          {uploadProgress > 0 && <p>Upload Progress: {uploadProgress}%</p>}
          {downloadProgress > 0 && <p>Download Progress: {downloadProgress}%</p>}
          <button onClick={cancelRequest}>Cancel Request</button>
        </div>
      ) : (
        userData && (
          <div>
            <h1>{userData.name}</h1>
            <p>{userData.email}</p>
          </div>
        )
      )}
    </div>
  );
}
```

### Node.js Usage

```typescript
import { axlyNode, setAxlyConfig } from 'axly';

// Configure Axly globally
setAxlyConfig({
  baseURL: 'https://api.example.com',
  token: 'your-auth-token' // Optional
});

async function fetchData() {
  const axly = axlyNode();

  try {
    const response = await axly.request({
      method: 'get',
      url: '/data',
      retry: 3, // Retry up to 3 times on failure
      timeout: 5000 // 5 seconds timeout
    });

    console.log('Data:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}

// Using with custom configuration for a specific request
async function fetchWithCustomConfig() {
  const axly = axlyNode();

  try {
    const response = await axly.request(
      {
        method: 'get',
        url: '/data'
      },
      {
        baseURL: 'https://another-api.example.com',
        token: 'different-token'
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}
```

## Configuration

### Global Configuration

Set up Axly with global configuration that will be used for all requests:

```typescript
import { setAxlyConfig } from 'axly';

setAxlyConfig({
  baseURL: 'https://api.example.com',
  token: 'your-auth-token',
  requestInterceptors: [
    (config) => {
      // Add custom headers or modify request config
      config.headers['Custom-Header'] = 'value';
      return config;
    }
  ],
  responseInterceptors: [
    (response) => {
      // Process response data
      return response;
    }
  ],
  errorHandler: async (error) => {
    // Global error handling
    if (error.response?.status === 401) {
      // Handle unauthorized error
      // e.g., redirect to login page or refresh token
    }
    return Promise.reject(error);
  },
  toastHandler: (message, type, options) => {
    // Integrate with your toast notification system
    // Example with react-toastify:
    // toast[type](message, options);
  }
});
```

## API Reference

### useAxly Hook

The `useAxly` hook returns an object with the following properties:

```typescript
const {
  request, // Function to make HTTP requests
  cancelRequest, // Function to cancel the current request
  isLoading, // Boolean indicating if a request is in progress
  uploadProgress, // Number (0-100) indicating upload progress
  downloadProgress // Number (0-100) indicating download progress
} = useAxly();
```

### axlyNode

For Node.js environments, use `axlyNode()` which returns an object with the same interface as the `useAxly` hook:

```typescript
const {
  request, // Function to make HTTP requests
  cancelRequest, // Function to cancel the current request
  isLoading, // Boolean indicating if a request is in progress
  uploadProgress, // Number (0-100) indicating upload progress
  downloadProgress // Number (0-100) indicating download progress
} = axlyNode();
```

### RequestOptions

The `request` function accepts a `RequestOptions` object with the following properties:

```typescript
interface RequestOptions<D = unknown> {
  method: 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options';
  data?: D; // Request body
  url: string; // Request URL (relative to baseURL)
  contentType?: ContentType; // Content-Type header
  customHeaders?: Record<string, string>; // Custom headers
  responseType?:
    | 'json'
    | 'text'
    | 'blob'
    | 'arraybuffer'
    | 'document'
    | 'stream';
  params?: Record<string, string | number | boolean>; // URL parameters
  baseURL?: string; // Override global baseURL
  toastHandler?: ToastHandler; // Override global toast handler
  successToast?: boolean; // Show success toast (default: false)
  errorToast?: boolean; // Show error toast (default: false)
  customToastMessage?: string; // Custom success message
  customToastMessageType?:
    | 'success'
    | 'error'
    | 'warning'
    | 'info'
    | 'custom'
    | string;
  customErrorToastMessage?: string; // Custom error message
  customErrorToastMessageType?: 'error' | 'warning' | 'custom' | string;
  onUploadProgress?: (progress: number) => void; // Upload progress callback
  onDownloadProgress?: (progress: number) => void; // Download progress callback
  timeout?: number; // Request timeout in ms (default: 100000)
  retry?: number; // Number of retry attempts (default: 0)
  cancelable?: boolean; // Enable request cancellation (default: false)
  onCancel?: () => void; // Callback when request is cancelled
}
```

### AxlyConfig

The global configuration object accepted by `setAxlyConfig`:

```typescript
interface AxlyConfig {
  token?: string | null; // Authentication token
  baseURL: string; // Base URL for all requests
  requestInterceptors?: ((
    config: InternalAxiosRequestConfig
  ) => InternalAxiosRequestConfig)[];
  responseInterceptors?: ((
    response: AxiosResponse<unknown>
  ) => AxiosResponse<unknown>)[];
  errorHandler?: (
    error: AxiosError<unknown>
  ) => Promise<AxiosResponse<unknown> | PromiseLike<AxiosResponse<unknown>>>;
  toastHandler?: ToastHandler; // Global toast handler
}

interface ToastHandler {
  (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' | 'custom' | string,
    options?: Record<string, unknown>
  ): void;
}
```

## Examples

### Basic GET Request

```typescript
// React
const { request } = useAxly();
const fetchData = async () => {
  const response = await request({
    method: 'get',
    url: '/api/data'
  });
  return response.data;
};

// Node.js
const axly = axlyNode();
const fetchData = async () => {
  const response = await axly.request({
    method: 'get',
    url: '/api/data'
  });
  return response.data;
};
```

### POST Request with Data

```typescript
const { request } = useAxly();

const createUser = async (userData) => {
  const response = await request({
    method: 'post',
    url: '/api/users',
    data: userData,
    successToast: true,
    customToastMessage: 'User created successfully!'
  });
  return response.data;
};
```

### File Upload with Progress

```typescript
const { request, uploadProgress } = useAxly();

const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await request({
    method: 'post',
    url: '/api/upload',
    data: formData,
    contentType: 'multipart/form-data',
    onUploadProgress: (progress) => console.log(`Upload: ${progress}%`)
  });

  return response.data;
};

// In your component
return (
  <div>
    <input type="file" onChange={(e) => uploadFile(e.target.files[0])} />
    {uploadProgress > 0 && <progress value={uploadProgress} max="100" />}
  </div>
);
```

### Request with Retry

```typescript
const { request } = useAxly();

const fetchWithRetry = async () => {
  try {
    const response = await request({
      method: 'get',
      url: '/api/data',
      retry: 3, // Will retry up to 3 times with exponential backoff
      errorToast: true
    });
    return response.data;
  } catch (error) {
    console.error('Failed after retries:', error);
    throw error;
  }
};
```

### Cancellable Request

```typescript
function SearchComponent() {
  const { request, cancelRequest, isLoading } = useAxly();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = async () => {
    try {
      const response = await request({
        method: 'get',
        url: '/api/search',
        params: { q: searchTerm },
        cancelable: true,
        onCancel: () => console.log('Search cancelled')
      });
      setResults(response.data);
    } catch (error) {
      if (error.canceled) {
        console.log('Search was cancelled');
      } else {
        console.error('Search error:', error);
      }
    }
  };

  return (
    <div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <button onClick={handleSearch} disabled={isLoading}>Search</button>
      {isLoading && <button onClick={cancelRequest}>Cancel</button>}

      {results.map(result => (
        <div key={result.id}>{result.title}</div>
      ))}
    </div>
  );
}
```

## License

MIT © [Harshal Katakiya](https://github.com/Harshalkatakiya)
