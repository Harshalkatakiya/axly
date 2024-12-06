# Axly 🪁

Axly is a powerful and flexible HTTP client library built on top of Axios. It provides a streamlined interface for making API requests with additional features like:

- Dynamic request configurations
- **Request cancellation using `AbortController`**
- Retry logic
- Progress tracking for uploads and downloads
- Easy integration with React, Next.js, and Node.js applications
- Full TypeScript support with detailed typings and JSDoc comments

---

## Table of Contents

1. [Installation](#installation)
2. [Features](#features)
3. [Usage](#usage)
   - [Basic Usage](#basic-usage)
   - [React.js & Next.js Integration](#reactjs-and-nextjs-integration)
   - [Node.js Usage](#nodejs-usage)
4. [API Reference](#api-reference)
   - [Configuration](#configuration)
   - [makeRequest](#makerequest)
   - [useAxios Hook](#useaxios-hook)
5. [Examples](#examples)
   - [GET Request](#get-request)
   - [POST Request with Data](#post-request-with-data)
   - [File Upload with Progress](#file-upload-with-progress)
   - [Request Cancellation](#request-cancellation)
   - [Custom Interceptors](#custom-interceptors)
6. [Contributing](#contributing)
7. [License](#license)
8. [Acknowledgments](#acknowledgments)

---

## Installation

Install Axly using npm or bun:

```bash
npm install axly
```

or

```bash
bun add axly
```

---

## Features

- **Dynamic Request Options:** Customize each request with flexible configurations.
- **Request Cancellation with AbortController:** Cancel requests to prevent race conditions or unnecessary network calls.
- **Retry Logic:** Automatically retry failed requests with configurable attempts.
- **Progress Tracking:** Monitor upload and download progress for files and data streams.
- **Interceptors:** Globally handle request and response transformations and errors.
- **TypeScript Support:** Fully typed with detailed JSDoc comments for an enhanced developer experience.
- **React.js, Node.js, and Next.js Ready:** Designed for seamless integration with modern frameworks.

---

## Usage

### Basic Usage

Start by configuring Axly with your base URL and other settings:

```javascript
import { setAxiosConfig } from 'axly';

setAxiosConfig({
  baseURL: 'https://api.example.com',
  token: 'user-jwt-auth-token',
  defaultHeaders: {
    'Custom-Header': 'value'
  },
  interceptors: {
    request: (config) => {
      // Modify request config if needed
      return config;
    },
    response: (response) => {
      // Handle response data if needed
      return response;
    },
    requestError: (error) => {
      // Handle request error
      return Promise.reject(error);
    },
    responseError: (error) => {
      // Handle response error
      return Promise.reject(error);
    }
  }
});
```

Then make a request:

```javascript
import { makeRequest } from 'axly';

const fetchData = async () => {
  try {
    const response = await makeRequest({
      method: 'GET',
      url: '/api/data'
    });
    console.log(response.data);
  } catch (error) {
    console.error('Request failed:', error);
  }
};
```

---

### React.js and Next.js Integration

Use the `useAxios` hook to manage state and requests in React components:

```javascript
import React, { useEffect } from 'react';
import { useAxios } from 'axly';

const App = () => {
  const { makeRequest, isLoading, uploadProgress, downloadProgress } =
    useAxios();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await makeRequest({
          method: 'GET',
          url: '/todos/1'
        });
        console.log(response.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, [makeRequest]);

  return (
    <div>
      {isLoading ?
        <p>Loading...</p>
      : <p>Data loaded!</p>}
      <p>Upload Progress: {uploadProgress}%</p>
      <p>Download Progress: {downloadProgress}%</p>
    </div>
  );
};

export default App;
```

---

### Node.js Usage

Axly can be used in Node.js for server-side requests:

```javascript
import { makeRequest, setAxiosConfig } from 'axly';

setAxiosConfig({
  baseURL: 'https://api.example.com'
});

const fetchData = async () => {
  try {
    const response = await makeRequest({
      method: 'GET',
      url: '/data'
    });

    console.log(response.data);
  } catch (error) {
    console.error('Error fetching data:', error);
  }
};

fetchData();
```

---

## API Reference

### Configuration

#### `setAxiosConfig(config)`

Configures global settings for Axly.

**Parameters:**

- `config` (Partial&lt;AxiosConfigOptions&gt;): Configuration options to set or update.

**Example:**

```javascript
setAxiosConfig({
  baseURL: 'https://api.example.com',
  token: 'your-auth-token',
  REQUEST_HEADER_AUTH_KEY: 'Authorization',
  TOKEN_TYPE: 'Bearer ',
  defaultHeaders: {
    'Custom-Header': 'value'
  },
  interceptors: {
    request: (config) => {
      console.log('Request sent:', config);
      return config;
    },
    response: (response) => {
      console.log('Response received:', response);
      return response;
    },
    requestError: (error) => {
      console.error('Request error:', error);
      return Promise.reject(error);
    },
    responseError: (error) => {
      console.error('Response error:', error);
      return Promise.reject(error);
    }
  }
});
```

---

### `makeRequest`

Make HTTP requests with dynamic configurations.

**Type Parameters:**

- `T` – The expected response data type.

**Parameters:**

- `options` (`RequestOptions`) – Configuration options for the request.

**Returns:**

- `Promise<AxiosResponse<ApiResponse<T>>>`

**Example:**

```javascript
const response = await makeRequest({
  method: 'GET',
  url: '/users',
  params: { page: 1 }
});
```

---

### `useAxios` Hook

A React hook that provides an interface to make HTTP requests and track their state.

**Returns:**

- `makeRequest`: Function to make requests.
- `isLoading`: Boolean indicating loading state.
- `uploadProgress`: Upload progress percentage.
- `downloadProgress`: Download progress percentage.

**Example:**

```javascript
const { makeRequest, isLoading, uploadProgress, downloadProgress } = useAxios();
```

---

## Examples

### GET Request

```javascript
const response = await makeRequest({
  method: 'GET',
  url: '/users',
  params: { page: 1 }
});
console.log(response.data);
```

---

### POST Request with Data

```javascript
const response = await makeRequest({
  method: 'POST',
  url: '/users',
  data: {
    name: 'John Doe',
    email: 'john@example.com'
  },
  contentType: 'application/json'
});
console.log(response.data);
```

---

### File Upload with Progress

```javascript
const { makeRequest, uploadProgress } = useAxios();

const handleFileUpload = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  await makeRequest({
    method: 'POST',
    url: '/upload',
    data: formData,
    contentType: 'multipart/form-data',
    onUploadProgress: (progress) => {
      console.log(`Upload Progress: ${progress}%`);
    }
  });
};
```

---

### Request Cancellation

You can cancel a request using the `cancelable` option and an `AbortController`.

```javascript
const controller = new AbortController();

const fetchData = async () => {
  try {
    const response = await makeRequest({
      method: 'GET',
      url: '/slow-endpoint',
      cancelable: true,
      signal: controller.signal, // Pass the signal to the request
      onCancel: () => {
        console.log('Request was canceled');
      }
    });
    console.log(response.data);
  } catch (error) {
    if (error.name === 'CanceledError') {
      console.log('Request canceled:', error.message);
    } else {
      console.error('Error fetching data:', error);
    }
  }
};

// To cancel the request
controller.abort();
```

---

### Custom Interceptors

```javascript
setAxiosConfig({
  interceptors: {
    request: (config) => {
      // Modify request config if needed
      console.log('Request sent:', config);
      return config;
    },
    response: (response) => {
      // Handle response data if needed
      console.log('Response received:', response);
      return response;
    },
    requestError: (error) => {
      // Handle request error
      console.error('Request error:', error);
      return Promise.reject(error);
    },
    responseError: (error) => {
      // Handle response error
      console.error('Response error:', error);
      return Promise.reject(error);
    }
  }
});
```

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/your-feature`).
3. Commit your changes (`git commit -am 'Add new feature'`).
4. Push to the branch (`git push origin feature/your-feature`).
5. Open a Pull Request.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

Made with ❤️ by [Harshal Katakiya](https://github.com/Harshalkatakiya). Feel free to reach out if you have any questions or need support!
