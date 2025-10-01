# Core Concepts

## Creating a Client

### Multi-config

`createAxlyClient` accepts either a single `AxlyConfig` or an object of configs keyed by name. When passing multiple configs you can target requests to a specific config via `configId` in `RequestOptions`.

Example:

```ts
// apiClient.ts
import { createAxlyClient } from 'axly';

export const apiClient = createAxlyClient({
  default: { baseURL: 'https://api.example.com', multiToken: true },
  admin: {
    baseURL: 'https://admin.api.example.com',
    token: localStorage.getItem('adminToken') || ''
  }
});

// App.tsx
import React, { useState } from 'react';
import { useAxly } from 'axly';
import { apiClient } from './apiClient';

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
