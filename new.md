# Axly Usage Examples

Axly is an HTTP client built on top of Axios designed for React and Node.js. It simplifies API requests and includes features like token management, request cancellation, progress tracking, and automatic retries.

## Basic Setup

### Installation

```bash
npm install axly axios
# or
yarn add axly axios
# or
bun add axly axios
```

### Creating a Client Instance

```typescript
import { createAxlyClient } from 'axly';

// Basic configuration
const axlyConfig = {
  baseURL: 'https://api.example.com',
  token: 'your-access-token' // Optional: for default auth header
  // ... other options
};

const axly = createAxlyClient(axlyConfig);

export default axly;
```

### Creating Multiple Client Instances

Axly allows you to manage multiple configurations simultaneously. This is useful when interacting with different APIs.

```typescript
import { createAxlyClient } from 'axly';

// Define multiple configurations
const multipleAxlyConfigs = {
  mainApi: {
    baseURL: 'https://api.example.com',
    token: 'main-api-token',
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
      console.log('Secondary API tokens refreshed');
      // Optionally save new tokens
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
};

// Create a client managing multiple instances
const multiAxly = createAxlyClient(multipleAxlyConfigs);

export default multiAxly;
```

## Core Usage Examples

### 1. Making Basic Requests

```typescript
import axly from './path-to-your-axly-instance';

// GET Request
try {
  const response = await axly.request({
    method: 'GET',
    url: '/users/123',
    params: { includeProfile: true }
  });
  console.log(response.data);
} catch (error) {
  console.error('GET request failed:', error);
}

// POST Request
try {
  const postData = { name: 'John Doe', email: 'john@example.com' };
  const response = await axly.request({
    method: 'POST',
    url: '/users',
    data: postData,
    contentType: 'application/json'
  });
  console.log('User created:', response.data);
} catch (error) {
  console.error('POST request failed:', error);
}

// Using with multiple configs - specify configId
try {
  const response = await multiAxly.request({
    method: 'GET',
    url: '/some-endpoint',
    configId: 'secondaryApi' // Use the secondaryApi config
  });
  console.log(response.data);
} catch (error) {
  console.error('Request to secondary API failed:', error);
}
```

### 2. Handling State with `useAxly` Hook (React)

Axly provides a `useAxly` hook for React applications to manage request state directly within components.

```tsx
import React, { useState } from 'react';
import useAxly from 'axly/react/useAxly'; // Import the hook
import axly from './path-to-your-axly-instance';

const MyComponent = () => {
  const [userId, setUserId] = useState('123');

  const { data, error, isLoading, request } = useAxly();

  const fetchUser = async () => {
    try {
      await request({
        method: 'GET',
        url: `/users/${userId}`
      });
    } catch (err) {
      // Error is handled by the hook's state
      console.error('Fetch user error:', err);
    }
  };

  const createUser = async () => {
    const userData = { name: 'Jane Doe', email: 'jane@example.com' };
    try {
      await request({
        method: 'POST',
        url: '/users',
        data: userData
      });
      // Data state will be updated with the response
    } catch (err) {
      console.error('Create user error:', err);
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <button onClick={fetchUser}>Fetch User</button>
      <button onClick={createUser}>Create User</button>
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
};

export default MyComponent;
```

### 3. Token Management

#### Setting/Getting Tokens

```typescript
// Set token directly (for single config or multiToken=false)
axly.setAccessToken('new-access-token');

// Set token for a specific config instance
multiAxly.setAccessToken('new-token', 'secondaryApi');

// Set refresh token (for multiToken=true)
multiAxly.setRefreshToken('new-refresh-token', 'secondaryApi');

// Get current access token
const currentToken = axly.getAccessToken(); // If using multiToken or token field
// Note: getAccessToken is a method on the client instance returned by createAxlyClient
// The example below shows how you might access it if it were exposed:
// const token = axly.getAccessToken('secondaryApi'); // Assuming a method exists or you manage it externally
```

#### Automatic Token Refresh (multiToken pattern)

When `multiToken` is enabled and a `refreshEndpoint` is provided, Axly automatically attempts to refresh the token if a 401 Unauthorized response is received.

```typescript
// Example configuration for automatic refresh (already shown in multiAxly setup)
const configWithRefresh = {
  baseURL: 'https://api.example.com',
  multiToken: true,
  accessToken: 'current-access-token',
  refreshToken: 'current-refresh-token',
  refreshEndpoint: '/auth/refresh',
  tokenCallbacks: {
    getAccessToken: () => localStorage.getItem('access_token'),
    setAccessToken: (token) => localStorage.setItem('access_token', token),
    getRefreshToken: () => localStorage.getItem('refresh_token'),
    setRefreshToken: (token) => localStorage.setItem('refresh_token', token)
  },
  onRefresh: (tokens) => {
    console.log('Tokens refreshed successfully');
  },
  onRefreshFail: (error) => {
    console.error('Token refresh failed:', error);
    // Redirect to login, clear tokens, etc.
  }
};

const axlyWithRefresh = createAxlyClient(configWithRefresh);

// The request will automatically attempt to refresh the token if it receives a 401
try {
  const response = await axlyWithRefresh.request({
    method: 'GET',
    url: '/protected-endpoint'
  });
  console.log(response.data);
} catch (error) {
  // If refresh fails or request still fails after refresh, error is thrown here
  console.error('Request failed after potential refresh:', error);
}
```

### 4. File Uploads

```typescript
import axly from './path-to-your-axly-instance';

const uploadFile = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await axly.upload('/upload', formData, {
      onUploadProgress: (progress) => {
        console.log(`Upload Progress: ${progress}%`);
        // Update UI progress bar
      },
      onDownloadProgress: (progress) => {
        console.log(`Download Progress: ${progress}%`);
      },
      // Specify config for multi-instance
      configId: 'mainApi'
    });
    console.log('File uploaded:', response.data);
    return response.data;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
};
```

### 5. Request Cancellation

```typescript
import axly from './path-to-your-axly-instance';

let currentAbortController: AbortController | null = null;

const performCancelableRequest = async () => {
  // Cancel any ongoing request
  if (currentAbortController) {
    axly.cancelRequest(currentAbortController);
  }

  try {
    const response = await axly.request(
      {
        method: 'GET',
        url: '/slow-endpoint',
        cancelable: true, // Enable cancellation
        onCancel: () => {
          console.log('Request was cancelled');
          // Update UI state if needed
        }
      },
      (stateUpdate) => {
        // State updater function (useful with useAxly hook or manual state management)
        console.log('State Update:', stateUpdate);
        if (stateUpdate.abortController) {
          currentAbortController = stateUpdate.abortController;
        }
      }
    );
    console.log(response.data);
  } catch (error) {
    if (error instanceof axly.CancelledError) {
      console.log('Request was cancelled by user or previous call.');
    } else {
      console.error('Request failed:', error);
    }
  }
};

const cancelCurrentRequest = () => {
  if (currentAbortController) {
    axly.cancelRequest(currentAbortController);
    currentAbortController = null;
  }
};
```

### 6. Default Headers

```typescript
import axly from './path-to-your-axly-instance';

// Set a default header for all requests made by this client instance
axly.setDefaultHeader('X-Client-Version', '1.0.0');

// Set header for a specific config instance
multiAxly.setDefaultHeader('X-API-Key', 'your-api-key', 'thirdPartyApi');

// Clear a default header
axly.clearDefaultHeader('X-Client-Version');
```

### 7. Advanced Request Options

```typescript
import axly from './path-to-your-axly-instance';

const advancedRequest = async () => {
  try {
    const response = await axly.request({
      method: 'PUT',
      url: '/users/123',
      data: { name: 'Updated Name' },
      // --- Request Options ---
      contentType: 'application/json',
      customHeaders: { 'X-Custom-Header': 'value' },
      responseType: 'json', // 'arraybuffer', 'blob', 'document', 'json', 'text'
      params: { forceUpdate: true },
      baseURL: 'https://override-base-url.com', // Overrides config's baseURL for this request
      timeout: 30000, // 30 seconds
      retry: 3, // Retry up to 3 times on failure (excluding 401 unless refresh happens)
      // --- Toast Options (browser only) ---
      toastHandler: (message, type) => {
        // Custom toast handler for this specific request
        console.log(`${type}: ${message}`);
      },
      successToast: true, // Show toast on success if toastHandler is available
      errorToast: true, // Show toast on error if toastHandler is available
      customToastMessage: 'User updated successfully!',
      customErrorToastMessage: 'Failed to update user.',
      // --- Progress Tracking ---
      onUploadProgress: (progress) => console.log(`Upload: ${progress}%`),
      onDownloadProgress: (progress) => console.log(`Download: ${progress}%`),
      // --- Cancellation ---
      cancelable: true,
      onCancel: () => console.log('Request cancelled!')
    });

    console.log(response.data);
  } catch (error) {
    console.error('Advanced request failed:', error);
  }
};
```

### 8. Error Handling

Axly wraps Axios errors in custom error types (`RequestError`, `AuthError`, `CancelledError`).

```typescript
import axly, { RequestError, AuthError, CancelledError } from 'axly';

const handleErrors = async () => {
  try {
    const response = await axly.request({
      method: 'GET',
      url: '/protected-data'
    });
    console.log(response.data);
  } catch (error) {
    if (error instanceof CancelledError) {
      console.log('Request was cancelled.');
    } else if (error instanceof AuthError) {
      console.error(
        'Authentication error (e.g., refresh failed):',
        error.message
      );
      // Redirect to login page
    } else if (error instanceof RequestError) {
      console.error('Request failed:', error.message);
      console.error('Response Code:', error.code);
      console.error('Response Data:', error.response?.data);
      console.error('Original Axios Error:', error.original);
    } else {
      console.error('An unexpected error occurred:', error);
    }
  }
};
```

### 9. Using with Node.js

For Node.js environments, use `createAxlyNodeClient`. This automatically removes the `toastHandler` configuration as it's typically browser-specific.

```typescript
// client-node.ts
import { createAxlyNodeClient } from 'axly';

const nodeAxlyConfig = {
  baseURL: 'https://api.example.com',
  token: 'server-token'
  // toastHandler is automatically removed by createAxlyNodeClient
  // toastHandler: (msg) => console.log(msg) // This will be undefined in the internal config
};

const nodeAxly = createAxlyNodeClient(nodeAxlyConfig);

export default nodeAxly;

// Usage in Node.js
const fetchData = async () => {
  try {
    const response = await nodeAxly.request({
      method: 'GET',
      url: '/data'
    });
    console.log(response.data);
  } catch (error) {
    console.error('Node request failed:', error);
  }
};
```

### 10. Event Handling

Axly provides a simple event emitter for lifecycle events.

```typescript
import axly from './path-to-your-axly-instance';

// Subscribe to an event (e.g., 'destroy')
const unsubscribe = axly.on('destroy', () => {
  console.log('Axly client is being destroyed');
  // Perform cleanup if necessary
});

// Later, unsubscribe
unsubscribe(); // Removes the event listener

// The 'destroy' event is emitted when the `destroy` method is called
axly.destroy(); // Emits 'destroy' event and cleans up resources
```

This comprehensive guide covers the main features and use cases of the Axly library. Remember to adapt the configuration and usage examples to your specific API requirements and application structure.
