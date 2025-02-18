# Axly - A Powerful Axios Wrapper for React and Node.js

Axly is a powerful and flexible HTTP client for React and Node.js, built on top of Axios. It simplifies API requests with features like:

🚀 **Request/Response Interceptors**  
🔄 **Automatic Retry Mechanism**  
📊 **Progress Tracking**  
⏳ **Request Cancellation**  
🔔 **Toast Notifications**

Axly makes API management seamless and efficient for developers.

---

## 📜 Table of Contents

1. [✨ Features](#-features)
2. [📦 Installation](#-installation)
3. [📖 Usage](#-usage)
   - [🔧 Setting Up Global Configuration](#-setting-up-global-configuration)
   - [⚛️ Using Axly in React](#️-using-axly-in-react)
   - [🖥️ Using Axly in Node.js](#️-using-axly-in-nodejs)
4. [📚 API Reference](#-api-reference)
   - [`setAxlyConfig` - Global Configuration](#-setaxlyconfig)
   - [`Axly` - React Hook](#-axly-react-hook)
   - [`AxlyNode` - Node.js API](#-axlynode-nodejs)
   - [`RequestOptions`](#-requestoptions)
5. [🚀 Advanced Features](#-advanced-features)
   - [📤 File Upload with Progress](#-file-upload-with-progress-tracking)
   - [🔄 Interceptors](#-interceptors)
   - [🔁 Retry Mechanism](#-retry-mechanism)
   - [⏹️ Request Cancellation](#️-request-cancellation)
   - [🔔 Toast Notifications](#-toast-notifications)
6. [🤝 Contributing](#-contributing)
7. [📄 License](#-license)
8. [👤 Author](#-author)

---

## ✨ Features

✔ **Global Configuration** – Set base URLs, headers, and interceptors globally.  
✔ **Request Interceptors** – Modify request configs before sending.  
✔ **Response Interceptors** – Process responses after they are received.  
✔ **Error Handling** – Centralized error handling support.  
✔ **React Integration** – Built-in state management for API loading & progress tracking.  
✔ **Node.js Support** – Fully compatible with Node.js.  
✔ **Retry Mechanism** – Automatic request retries on failure.  
✔ **Progress Tracking** – Track file upload & download progress.  
✔ **Request Cancellation** – Cancel pending API requests.  
✔ **Toast Notifications** – Display API success or failure messages.

---

## 📦 Installation

You can install Axly using `npm` or `bun`:

```bash
npm install axly
```

or

```bash
bun add axly
```

---

## 📖 Usage

### 🔧 Setting Up Global Configuration

Before using Axly, configure it globally using `setAxlyConfig`:

```javascript
import { setAxlyConfig } from "axly";

setAxlyConfig({
  token: "your-auth-token",
  baseURL: "https://api.example.com",
  requestInterceptors: [(config) => config],
  responseInterceptors: [(response) => response],
  errorHandler: async (error) => {
    console.error("Global Error: ", error);
    return Promise.reject(error);
  },
});
```

---

### ⚛️ Using Axly in React

Axly provides a **React hook** (`useAxly`) for managing API requests easily.

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
        data: { name: "John Doe", email: "john@example.com" },
        successToast: true,
      });
      console.log("User Data: ", response.data);
    } catch (error) {
      console.error("API Error: ", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);
  s;
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

### 🖥️ Using Axly in Node.js

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
      errorToast: true,
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

## 📚 API Reference

### 🔧 `setAxlyConfig`

Set global configuration for Axly.

```typescript
setAxlyConfig(config: AxlyConfig): void;
```

| Property               | Type                                                                                                                                | Description                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `token`                | `string` \| `null`                                                                                                                  | Optional auth token.               |
| `baseURL`              | `string`                                                                                                                            | Base API URL.                      |
| `requestInterceptors`  | `((config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig)[]`                                                            | Array of request interceptors.     |
| `responseInterceptors` | `((response: AxiosResponse<ApiResponse<any>>) => AxiosResponse<ApiResponse<any>>)[]`                                                | Array of response interceptors.    |
| `errorHandler`         | `(error: AxiosError<ApiResponse<any>>) => Promise<AxiosResponse<ApiResponse<any>> \| PromiseLike<AxiosResponse<ApiResponse<any>>>>` | Global error handler.              |
| `toastHandler`         | `ToastHandler`                                                                                                                      | Custom toast notification handler. |

---

### 🔧 Axly (React Hook)

The `Axly` hook provides a convenient way to make API requests within React components. It returns an object containing the `useAxly` function and state variables for tracking the request status, upload progress, and download progress, and a `cancelRequest` function to abort an ongoing request.

```javascript
const { useAxly, isLoading, uploadProgress, downloadProgress, cancelRequest } =
  Axly();
```

- **`useAxly`**: A function that accepts `RequestOptions` and returns a promise that resolves to the Axios response.
- **`isLoading`**: A boolean indicating whether an API request is currently in progress.
- **`uploadProgress`**: A number representing the upload progress percentage.
- **`downloadProgress`**: A number representing the download progress percentage.
- **`cancelRequest`**: A function that cancels the ongoing request if one exists. This can be used to abort the request before it completes.

See [Example: Using Axly in React](#️-using-axly-in-react)

---

### 🔧 AxlyNode (Node.js)

The `AxlyNode` function provides a similar API for making requests in a Node.js environment. It returns an object containing the `useAxly` function, state variables for tracking the request status, upload progress, download progress, and a `cancelRequest` function to abort an ongoing request.

```javascript
const { useAxly, isLoading, uploadProgress, downloadProgress, cancelRequest } =
  AxlyNode();
```

- **`useAxly`**: A function that accepts `RequestOptions` and returns a promise that resolves to the Axios response.
- **`isLoading`**: A boolean indicating whether an API request is currently in progress.
- **`uploadProgress`**: A number representing the upload progress percentage.
- **`downloadProgress`**: A number representing the download progress percentage.
- **`cancelRequest`**: A function that cancels the ongoing request if one exists. This can be used to abort the request before it completes.

See [Example: Using Axly in Node.js](#️-using-axly-in-nodejs)

---

### 🔧 RequestOptions

Configuration options for individual requests.

| Property                    | Type                                                              | Description                                                        |
| --------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| method                      | AxiosRequestConfig["method"]                                      | Request method. (e.g., "GET", "POST","PATCH","PUT","DELETE", etc.) |
| url                         | string                                                            | Endpoint URL.                                                      |
| data                        | any                                                               | Request body data.                                                 |
| contentType                 | ContentType                                                       | Content-Type header (default: "application/json").                 |
| customHeaders               | Record<string, string>                                            | Custom headers for the request.                                    |
| responseType                | AxiosRequestConfig["responseType"]                                | Expected response type (default: "json").                          |
| params                      | Record<string, any>                                               | Query parameters (e.g. { page: 1, limit: 10 }).                    |
| baseURL                     | string                                                            | Base URL for the request (overrides global config).                |
| toastHandler                | ToastHandler                                                      | Custom toast handler function for this request.                    |
| successToast                | boolean                                                           | Whether to show a success toast.                                   |
| errorToast                  | boolean                                                           | Whether to show an error toast.                                    |
| customToastMessage          | string                                                            | Custom success toast message.                                      |
| customToastMessageType      | "success" \| "error" \| "warning" \| "info" \| "custom" \| string | Type of success toast message.                                     |
| customErrorToastMessage     | string                                                            | Custom error toast message.                                        |
| customErrorToastMessageType | "error" \| "warning" \| "custom" \| string                        | Type of error toast message.                                       |
| onUploadProgress            | (progress: number) => void                                        | Callback for upload progress.                                      |
| onDownloadProgress          | (progress: number) => void                                        | Callback for download progress.                                    |
| timeout                     | number                                                            | Request timeout in milliseconds.                                   |
| retry                       | number                                                            | Number of retries for failed requests.                             |
| cancelable                  | boolean                                                           | Whether the request can be canceled.                               |
| onCancel                    | () => void                                                        | Callback when the request is canceled.                             |

---

## 🚀 Advanced Features

### 📤 File Upload with Progress Tracking

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
    onUploadProgress: (progress) => console.log(`Upload: ${progress}%`),
    successToast: true,
    errorToast: true,
  });
};
```

### 🔄 Interceptors

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

### 🔁 Retry Mechanism

```javascript
await useAxly({
  method: "GET",
  url: "/data",
  retry: 3, // Retry up to the specified number of times
});
```

---

### ⏹️ Request Cancellation

```javascript
import { Axly } from "axly";
import { useEffect } from "react";

const MyComponent = () => {
  const { useAxly, isLoading, cancelRequest } = Axly();

  const fetchData = async () => {
    try {
      const response = await useAxly({
        method: "GET",
        url: "/data",
        cancelable: true, // Enable cancellation for this request
        onCancel: () => console.log("Request canceled"), // Optional callback
      });
      console.log("Data: ", response.data);
    } catch (error) {
      if (error.canceled) {
        console.log("Request was canceled");
      } else {
        console.error("Error: ", error);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div>
      {isLoading ? <p>Loading...</p> : <p>Data Fetched</p>}
      <button onClick={() => cancelRequest()}>Cancel Request</button>
    </div>
  );
};

export default MyComponent;
```

---

### 🔔 Toast Notifications

```javascript
import { toast } from "react-hot-toast"; // You can use any toast library

const Toast = (message, type = "success", options) => {
  switch (type) {
    case "success":
      toast.success(message, options);
      break;
    case "error":
      toast.error(message, options);
      break;
    case "info":
      toast(message, options);
      break;
    case "warning":
      toast(message, options);
      break;
    case "custom":
      toast.custom(message, options);
      break;
    default:
      toast(message, options);
  }
};
setAxlyConfig({
  toastHandler: Toast,
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
- NPM: [@harshalkatakiya](https://www.npmjs.com/~harshalkatakiya)

---
