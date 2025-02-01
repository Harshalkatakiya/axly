# Axly - A Powerful Axios Wrapper for React and Node.js

Axly is a powerful and flexible HTTP client for React and Node.js, built on top of Axios. It provides advanced features like request/response interceptors, retry mechanisms, progress tracking, cancellation, and toast notifications, making it easier to manage API calls in your applications.

---

## Table of Contents

1. [Features](#features)
2. [Installation](#installation)
3. [Usage](#usage)
   - [Setting Up Global Configuration](#setting-up-global-configuration)
   - [Using Axly in React](#using-axly-in-react)
   - [Using Axly in Node.js](#using-axly-in-nodejs)
4. [API Reference](#api-reference)
   - [`setAxlyConfig` (Global Configuration)](#setaxlyconfig)
   - [`Axly` (React Hook)](#axly-react-hook)
   - [`AxlyNode` (Node.js)](#axlynode-nodejs)
   - [`RequestOptions`](#requestoptions)
5. [Advanced Features](#advanced-features)
   - [Interceptors](#interceptors)
   - [Retry Mechanism](#retry-mechanism)
   - [Progress Tracking](#progress-tracking)
   - [Cancellation](#cancellation)
   - [Toast Notifications](#toast-notifications)
6. [🤝 Contributing](#-contributing)
   - [How to Contribute](#how-to-contribute)
7. [📄 License](#-license)
8. [👤 Author](#-author)

---

## Features

- **Global Configuration**: Set up base URLs, headers, and interceptors globally.
- **React Integration**: Built-in state management for loading, upload/download progress.
- **Node.js Compatibility**: Works seamlessly in server-side environments.
- **Retry Mechanism**: Automatically retry failed requests with configurable retry counts.
- **Progress Tracking**: Track upload and download progress with callbacks.
- **Cancellation**: Cancel ongoing requests with ease.
- **Toast Notifications**: Display success/error messages using custom toast handlers.
- **Customizable**: Override default configurations for individual requests.

---

## Installation

Install Axly via npm or bun:

```bash
npm install axly
```

or

```bash
bun add axly
```

---

## Usage

### Setting Up Global Configuration

Before using Axly, you need to set up the global configuration using `setAxlyConfig` in main layout or index file.

```javascript
import { setAxlyConfig } from "axly";

setAxlyConfig({
  token: "your-auth-token", // Optional: Add bearer authentication token here
  apiUrl: "https://api.example.com", // Base URL for all requests
  requestInterceptors: [
    (config) => {
      // Modify request config (e.g., add headers)
      return config;
    },
  ],
  responseInterceptors: [
    (response) => {
      // Modify response data
      return response;
    },
  ],
  errorHandler: async (error) => {
    // Handle errors globally
    console.error("Global Error Handler: ", error);
    return Promise.reject(error);
  },
});
```

---

### Using Axly in React

Axly provides a React hook (`useAxly`) that integrates seamlessly with React's state management.

```javascript
import { Axly } from "axly";
import { useEffect } from "react";

const MyComponent = () => {
  const { useAxly, isLoading, uploadProgress } = Axly();
  const fetchData = async () => {
    try {
      const response = await useAxly({
        method: "POST",
        url: "/user",
        data: {
          name: "John Doe",
          email: "mail@example.com",
        },
        successToast: true, // Display success toast if toastHandler is provided here or in setAxlyConfig
      });
      console.log("User Data: ", response.data);
    } catch (error) {
      console.error("API Error: ", error);
    }
  };
  useEffect(() => {
    fetchData();
  }, []);
  return (
    <div>
      {isLoading ? <p>Loading...</p> : <p>Data Submitted</p>}
      <p>Upload Progress: {uploadProgress}%</p>
    </div>
  );
};

export default MyComponent;
```

---

### Using Axly in Node.js

For server-side usage, Axly provides `AxlyNode`, which works similarly but without React-specific features.

```javascript
import { AxlyNode } from "axly";

const { useAxly, isLoading, uploadProgress, downloadProgress } = AxlyNode();

async function fetchData() {
  try {
    const response = await useAxly({
      method: "GET",
      url: "/posts",
      params: { page: 1, limit: 10 },
      successToast: true,
    });
    console.log(response.data);
    console.log("Is Loading: ", isLoading);
    console.log("Upload Progress: ", uploadProgress);
    console.log("Download Progress: ", downloadProgress);
  } catch (err) {
    console.error("Error: ", err);
  }
}

fetchData();
```

---

## API Reference

### `setAxlyConfig`

Set global configuration for Axly.

```typescript
setAxlyConfig(config: AxlyConfig): void;
```

#### Parameters

- `token`: Authentication token (optional).
- `apiUrl`: Base URL for all requests.
- `requestInterceptors`: Array of request interceptors.
- `responseInterceptors`: Array of response interceptors.
- `errorHandler`: Global error handler function.
- `toastHandler`: Custom toast notification handler.

---

### `Axly` (React Hook)

Provides a React hook for managing API requests with built-in state.

```javascript
const { useAxly, isLoading, uploadProgress, downloadProgress } = Axly();
```

#### Properties

- `useAxly`: Function to make API requests.
- `isLoading`: Boolean indicating if a request is in progress.
- `uploadProgress`: Upload progress percentage.
- `downloadProgress`: Download progress percentage.

---

### `AxlyNode` (Node.js)

Provides a Node.js-compatible interface for managing API requests.

```javacript
const { useAxly, isLoading, uploadProgress, downloadProgress } = AxlyNode();
```

---

### `RequestOptions`

Configuration options for individual requests.

| Property                  | Type                                                                                           | Description                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `method`                  | `"GET"` \| `"POST"` \|`"PATCH"` \|`"PUT"` \|`"DELETE"` \| ...                                  | HTTP method.                                         |
| `url`                     | `string`                                                                                       | Endpoint URL.                                        |
| `data`                    | `any`                                                                                          | Request payload API for requests.                    |
| `contentType`             | `"application/json"` \| `"multipart/form-data"`\| ...                                          | Content-Type header (default: `"application/json"`). |
| `customHeaders`           | `Record<string, string>`                                                                       | Custom headers for the request.                      |
| `responseType`            | `"json"` \| `"text"` \| `"arraybuffer"` \| `"blob"` \|`"document"` \|`"stream"` \|`"formdata"` | Expected response type (default: `"json"`).          |
| `params`                  | `Record<string, any>`                                                                          | Query parameters (e.g. `{ page: 1, limit: 10 }`).    |
| `baseURL`                 | `string`                                                                                       | Override global base URL.                            |
| `toastHandler`            | `(message: string, type: string) => void`                                                      | Custom toast notification handler.                   |
| `successToast`            | `boolean`                                                                                      | Show success toast on successful response.           |
| `errorToast`              | `boolean`                                                                                      | Show error toast on failure.                         |
| `customToastMessage`      | `string`                                                                                       | Custom success toast message.                        |
| `customErrorToastMessage` | `string`                                                                                       | Custom error toast message.                          |
| `onUploadProgress`        | `(progress: number) => void`                                                                   | Callback for upload progress.                        |
| `onDownloadProgress`      | `(progress: number) => void`                                                                   | Callback for download progress.                      |
| `timeout`                 | `number`                                                                                       | Request timeout in milliseconds.                     |
| `retry`                   | `number`                                                                                       | Number of retry attempts for failed requests.        |
| `cancelable`              | `boolean`                                                                                      | Enable request cancellation.                         |
| `onCancel`                | `() => void`                                                                                   | Callback when a request is canceled.                 |

---

## Advanced Features

### File Upload with Progress Tracking

```javascript
const { useAxly, uploadProgress } = Axly();

const handleUpload = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  await useAxly({
    method: "POST",
    url: "/upload",
    data: formData,
    contentType: "multipart/form-data",
    onUploadProgress: (progress) => {
      console.log(`Upload Progress: ${progress}%`);
    },
    successToast: true,
    errorToast: true,
  });
};
```

### Interceptors

Add custom logic to modify requests or responses globally or per instance.

```javascript
setAxlyConfig({
  requestInterceptors: [
    (config) => {
      // Modify request config (e.g., add headers)
      config.headers["X-Custom-Header"] = "CustomValue";
      return config;
    },
  ],
  responseInterceptors: [
    (response) => {
      // Modify response data
      console.log("Response intercepted:", response);
      return response;
    },
  ],
  errorHandler: async (error) => {
    if (error.response?.status === 401) {
      return Promise.reject("Session expired");
    }
    return Promise.reject(error);
  },
});
```

---

### Retry Mechanism

Automatically retry failed requests by specifying the `retry` option.

```javascript
await useAxly({
  method: "GET",
  url: "/data",
  retry: 3, // Retry up to 3 times
});
```

---

### Progress Tracking

Track upload and download progress with callbacks.

```javascript
await useAxly({
  method: "POST",
  url: "/upload",
  data: formData,
  onUploadProgress: (progress) => {
    console.log(`Upload Progress: ${progress}%`);
  },
});
```

---

### Cancellation

Cancel ongoing requests using the `cancelable` option.

```javascript
const fetchData = async () => {
  try {
    const response = await useAxly({
      method: "GET",
      url: "/data",
      cancelable: true,
      onCancel: () => console.log("Request canceled"),
    });
    console.log("User Data: ", response.data);
  } catch (error) {
    if (error.canceled) {
      console.log("Request was canceled");
    }
  }
};
```

---

### Toast Notifications

Display success or error messages using a custom toast handler set globally in `setAxlyConfig`.

```javascript
import { toast } from "react-hot-toast"; // You can replace 'react-hot-toast' with any other toast library

const Toast = (message, type = "success") => {
  switch (type) {
    case "success":
      toast.success(message);
      break;
    case "error":
      toast.error(message);
      break;
    case "info":
      toast.error(message);
      break;
    case "warning":
      toast.error(message);
      break;
    case "custom":
      toast.error(message);
      break;
    default:
      toast(message);
  }
};
setAxlyConfig({
  toastHandler: (message, type) => {
    console.log(`${type.toUpperCase()}: ${message}`);
  },
});

await useAxly({
  method: "GET",
  url: "/data",
  successToast: true,
  errorToast: true,
});
```

---

## 🤝 Contributing

Contributions are welcome! If you encounter any bugs or have suggestions for improvements, please open an issue on the [GitHub repository](https://github.com/Harshalkatakiya/axly/issues).

### How to Contribute

1. Fork this repository.
2. Create a new branch for your feature or bug fix.
3. Commit your changes with a clear message.
4. Open a pull request and describe your changes in detail.

---

## 📄 License

This package is licensed under the [MIT License](LICENSE).

---

## 👤 Author

### Harshal Katakiya

- GitHub: [@Harshalkatakiya](https://github.com/Harshalkatakiya)
- Email: [katakiyaharshl001@gmail.com](mailto:katakiyaharshl001@gmail.com)
- NPM: [@harshalkatakiya](https://www.npmjs.com/package/@harshalkatakiya)

---
