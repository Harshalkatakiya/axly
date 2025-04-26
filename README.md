# Axly - A Powerful Axios Wrapper for React and Node.js

Axly is an HTTP client library built on top of Axios that simplifies making HTTP requests with support for features such as:

- **Request and Response Interceptors** for custom processing
- **Bearer Token-based Authentication** via request headers
- **Retry Mechanisms** with configurable delays
- **Progress Tracking** for uploads and downloads
- **Cancellation** of pending requests
- **Custom Toast Notifications** on success or error events
- **Customizable Global and Per-Request Configuration**

Axly provides both a React hook for client-side development as well as a Node-friendly function for server-side applications.

---

## 📜 Table of Contents

- [🔧 Configuration](#-configuration)
- [⚛️ Usage](#️-usage)
  - [🔧 Setting Up Global Configuration](#-configuration)
  - [🪝 Using `useAxly` in React](#-using-useaxly-in-react)
  - [🖥️ Using `AxlyNode` in Node.js](#️-using-axlynode-in-nodejs)
- [📚 API Reference](#-api-reference)
  - [🔧 `setAxlyConfig`](#-setaxlyconfig)
  - [🔔 `ToastHandler`](#-toasthandler)
  - [🪝 `useAxly` (React Hook)](#-useaxly-react-hook)
  - [🖥️ `AxlyNode` (Node.js)](#️-axlynode-nodejs)
  - [🔧 RequestOptions](#-requestoptionsd--unknown)
- [🚀 Advanced Features](#-advanced-features)
  - [📤 File Upload with Progress Tracking](#-file-upload-with-progress-tracking)
  - [🔄 Interceptors](#-interceptors)
  - [🔁 Retry Mechanism](#-retry-mechanism)
  - [⏹️ Request Cancellation](#️-request-cancellation)
  - [🔔 Toast Notifications](#-toast-notifications)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [👤 Author](#-author)

---

## 🔧 Configuration

Before making requests, configure Axly globally with `setAxlyConfig`:

```typescript
import { setAxlyConfig } from 'axly';

setAxlyConfig({
  token: 'your_jwt_token', // optional
  baseURL: 'https://api.example.com',
  requestInterceptors: [
    (config) => {
      // Modify request config if needed
      return config;
    }
  ],
  responseInterceptors: [
    (response) => {
      // Modify response if needed
      return response;
    }
  ],
  errorHandler: async (error) => {
    // Handle global errors
    if (error.response?.status === 401) {
      // Handle unauthorized (e.g., redirect to login)
    }
    return Promise.reject(error);
  },
  toastHandler: (message, type) => {
    // Integrate with your toast library
    console.log(type.toUpperCase(), message);
  }
});
```

---

## ⚛️ Usage

### 🔧 Setting Up Global Configuration

See [Configuration](#-configuration).

### 🪝 Using `useAxly` in React

```typescript
import useAxly from 'axly';
import { FC, useEffect } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
}

const MyComponent: FC = () => {
  const { request, isLoading, uploadProgress, downloadProgress, cancelRequest } = useAxly();

  const fetchData = async () => {
    try {
      const response = await request<User[]>({
        method: 'GET',
        url: '/users',
        params: { page: 1, limit: 10 },
        retry: 2,
        successToast: true,
        errorToast: true
      });
      console.log(response.data);
    } catch (err) {
      console.error('API Error:', err);
    }
  };

  useEffect(() => {
    fetchData();
    // Optionally cancel request on unmount
    return () => cancelRequest();
  }, []);
  return (
    <div>
      {isLoading && <p>Loading...</p>}
      <p>Upload Progress: {uploadProgress}%</p>
      <p>Download Progress: {downloadProgress}%</p>
    </div>
  );
};

export default MyComponent;
```

---

### 🖥️ Using `AxlyNode` in Node.js

```typescript
import { AxlyNode } from 'axly';

interface Post {
  id: number;
  title: string;
  url: string;
}

const { request, isLoading, uploadProgress, downloadProgress } = AxlyNode();

async function fetchData() {
  try {
    const response = await request<Post[]>({
      method: 'GET',
      url: '/posts',
      params: { page: 1, limit: 10 },
      successToast: true,
      errorToast: true
    });
    console.log(response.data);
    console.log('Is Loading: ', isLoading);
    console.log('Upload Progress: ', uploadProgress);
    console.log('Download Progress: ', downloadProgress);
  } catch (err) {
    console.error('Error: ', err);
  }
}

fetchData();
```

## 📚 API Reference

### 🔧 `setAxlyConfig`

Set global configuration for Axly.

```typescript
setAxlyConfig(config: AxlyConfig): void;
```

| Property               | Type                                                                                                     | Description                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `baseURL`              | `string`                                                                                                 | Required Base API URL.                      |
| `token`                | `string` \| `null`                                                                                       | Optional auth token.                        |
| `requestInterceptors`  | `((config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig)[]`                                 | Optional Array of request interceptors.     |
| `responseInterceptors` | `((response: AxiosResponse<unknown>) => AxiosResponse<unknown>)[]`                                       | Optional Array of response interceptors.    |
| `errorHandler`         | `(error: AxiosError<unknown>) => Promise<AxiosResponse<unknown> \| PromiseLike<AxiosResponse<unknown>>>` | Optional Global error handler.              |
| `toastHandler`         | `ToastHandler`                                                                                           | Optional Custom toast notification handler. |

### 🔔 `ToastHandler`

The `ToastHandler` is a customizable function that allows you to manage toast notifications for success and error messages. You can define how notifications are displayed, their duration, and any additional styling.

```typescript
setAxlyConfig({
  baseURL: 'https://api.example.com',
  toastHandler: (message, type, options) => {
    // Integrate with your toast library
    console.log(type.toUpperCase(), message, options);
  }
});
```

| Property  | Type                                                                               | Description                                         |
| --------- | ---------------------------------------------------------------------------------- | --------------------------------------------------- |
| `message` | `string`                                                                           | Required Toast message.                             |
| `type`    | `success` \| `error` \| `warning` \| `info` \| `custom` \| `string`                | Required Type of toast.                             |
| `options` | `Record<string, string \| number \| unknown>` \| `string` \| `number` \| `unknown` | Optional Toast options for customization & styling. |

---

### 🪝 useAxly (React Hook)

The `useAxly` hook provides a convenient way to make API requests within React components. It returns an object containing the `request` function and state variables for tracking the request status, upload progress, and download progress, and a `cancelRequest` function to abort an ongoing request.

```javascript
const {
  request,
  isLoading,
  uploadProgress,
  downloadProgress,
  abortController,
  cancelRequest
} = useAxly();
```

- **`request`**: A function that accepts `RequestOptions` and returns a promise that resolves to the Axios response.
- **`isLoading`**: A boolean indicating whether an API request is currently in progress.
- **`uploadProgress`**: A number representing the upload progress percentage.
- **`downloadProgress`**: A number representing the download progress percentage.
- **`abortController`**: An instance of `AbortController` that can be used to cancel the request.
- **`cancelRequest`**: A function that cancels the ongoing request if one exists. This can be used to abort the request before it completes.

See Example: [Using Axly in React](#-axly-react-hook)

---

### 🖥️ AxlyNode (Node.js)

The `AxlyNode` function provides a similar API for making requests in a Node.js environment. It returns an object containing the `request` function, state variables for tracking the request status, upload progress, download progress, and a `cancelRequest` function to abort an ongoing request.

```javascript
const {
  request,
  isLoading,
  uploadProgress,
  downloadProgress,
  abortController,
  cancelRequest
} = AxlyNode();
```

- **`request`**: A function that accepts `RequestOptions` and returns a promise that resolves to the Axios response.
- **`isLoading`**: A boolean indicating whether an API request is currently in progress.
- **`uploadProgress`**: A number representing the upload progress percentage.
- **`downloadProgress`**: A number representing the download progress percentage.
- **`abortController`**: An instance of `AbortController` that can be used to cancel the request.
- **`cancelRequest`**: A function that cancels the ongoing request if one exists. This can be used to abort the request before it completes.

See Example: [Using Axly in Node.js](#️-using-axly-in-nodejs)

---

### 🔧 RequestOptions<D = unknown>

Configuration options for individual requests.

| Property                    | Type                                                              | Description                                                                                                              |
| --------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| method                      | AxiosRequestConfig["method"]                                      | HTTP Request method. (e.g., "GET", "POST","PATCH","PUT","DELETE", etc.)                                                  |
| url                         | string                                                            | Endpoint URL.                                                                                                            |
| data                        | D                                                                 | Optional Request body data.                                                                                              |
| contentType                 | ContentType                                                       | Optional Content-Type header (default: "application/json").                                                              |
| customHeaders               | Record<string, string>                                            | Optional Custom headers for the request.                                                                                 |
| responseType                | AxiosRequestConfig["responseType"]                                | Optional Response type (e.g., "arraybuffer", "blob", "document", "json", "text", "stream","formdata") (default: "json"). |
| params                      | Record<string, string \| number \| boolean>                       | Optional Query parameters (e.g. { page: 1, limit: 10 }).                                                                 |
| baseURL                     | string                                                            | Optional Base URL for the request (overrides global config).                                                             |
| toastHandler                | ToastHandler                                                      | Optional Custom toast handler function for this request.                                                                 |
| successToast                | boolean                                                           | Optional Whether to show a success toast.                                                                                |
| errorToast                  | boolean                                                           | Optional Whether to show an error toast.                                                                                 |
| customToastMessage          | string                                                            | Optional Custom success toast message.                                                                                   |
| customToastMessageType      | "success" \| "error" \| "warning" \| "info" \| "custom" \| string | Optional Type of success toast message.                                                                                  |
| customErrorToastMessage     | string                                                            | Optional Custom error toast message.                                                                                     |
| customErrorToastMessageType | "error" \| "warning" \| "custom" \| string                        | Optional Type of error toast message.                                                                                    |
| onUploadProgress            | (progress: number) => void                                        | Optional Callback for upload progress.                                                                                   |
| onDownloadProgress          | (progress: number) => void                                        | Optional Callback for download progress.                                                                                 |
| timeout                     | number                                                            | Optional Request timeout in milliseconds.                                                                                |
| retry                       | number                                                            | Optional Number of retries for failed requests.                                                                          |
| cancelable                  | boolean                                                           | Optional Whether the request can be canceled.                                                                            |
| onCancel                    | () => void                                                        | Optional Callback when the request is canceled.                                                                          |

---

## 🚀 Advanced Features

### 📤 File Upload with Progress Tracking

```typescript
const { request, uploadProgress } = useAxly();

const handleUpload = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  await request({
    method: 'POST',
    url: '/upload',
    data: formData,
    contentType: 'multipart/form-data',
    onUploadProgress: (progress) => console.log(`Upload: ${progress}%`),
    successToast: true,
    errorToast: true,
    customToastMessage: 'File uploaded successfully!',
    customToastMessageType: 'success'
  });
};
```

### 🔄 Interceptors

```typescript
setAxlyConfig({
  requestInterceptors: [
    (config) => {
      // Modify request config (e.g., add headers)
      config.headers['X-api-key'] = 'CustomValue';
      return config;
    }
  ],
  responseInterceptors: [
    (response) => {
      // Modify response data
      console.log('Response intercepted:', response);
      return response;
    }
  ],
  errorHandler: async (error) => {
    if (error.response?.status === 401) {
      return Promise.reject('Session expired');
    }
    return Promise.reject(error);
  }
});
```

---

### 🔁 Retry Mechanism

```typescript
await request({
  method: 'GET',
  url: '/data',
  retry: 3 // Retry up to the specified number of times
});
```

---

### ⏹️ Request Cancellation

```javascript
import useAxly from 'axly';
import { useEffect } from 'react';

const MyComponent = () => {
  const { request, isLoading, cancelRequest } = useAxly();

  const fetchData = async () => {
    try {
      const response = await request({
        method: 'GET',
        url: '/data',
        cancelable: true, // Enable cancellation for this request
        onCancel: () => console.log('Request canceled') // Optional callback
      });
      console.log('Data: ', response.data);
    } catch (error) {
      if (error.canceled) {
        console.log('Request was canceled');
      } else {
        console.error('Error: ', error);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div>
      {isLoading ?
        <p>Loading...</p>
      : <p>Data Fetched</p>}
      <button onClick={() => cancelRequest()}>Cancel Request</button>
    </div>
  );
};

export default MyComponent;
```

---

### 🔔 Toast Notifications

```typescript
import { toast } from 'react-hot-toast'; // You can use any toast library
import useAxly, { setAxlyConfig, ToastHandler } from 'axly';

// Global toast handler
const Toast: ToastHandler = (message, type = 'success', options) => {
  switch (type) {
    case 'success':
      toast.success(message, options);
      break;
    case 'error':
      toast.error(message, options);
      break;
    case 'loading':
      toast.loading(message, options);
      break;
    case 'custom':
      toast.custom(message, options);
      break;
    default:
      toast(message, options);
  }
};

setAxlyConfig({
  toastHandler: Toast
});

await useAxly({
  method: 'GET',
  url: '/data',
  toastHandler: Toast, // Optional per-request toast handler (for use custom toast)
  successToast: true,
  errorToast: true,
  customToastMessage: 'Data fetched successfully!', // Added custom toast message
  customToastMessageType: 'success' // Added custom toast message type
});
```

## 🤝 Contributing

💡 Found a bug? Have a feature request? We welcome contributions!

**Steps to contribute:**

1. Fork this repository.
2. Create a new feature branch.
3. Commit your changes.
4. Open a pull request.

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

## 👤 Author

👨‍💻 **Harshal Katakiya**

- GitHub: [@Harshalkatakiya](https://github.com/Harshalkatakiya)
- Email: [katakiyaharshl001@gmail.com](mailto:katakiyaharshl001@gmail.com)
- LinkedIn: [@harshal-katakiya](https://www.linkedin.com/in/harshal-katakiya)
- NPM: [@harshalkatakiya](https://www.npmjs.com/~harshalkatakiya)

---
