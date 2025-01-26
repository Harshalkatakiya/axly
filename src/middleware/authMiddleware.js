import axios from 'axios';
/**
 * Handles authentication and token refresh
 */
export const createAuthMiddleware = (authConfig) => ({
  onRequest: (config) => {
    if (authConfig.token) {
      config.headers = config.headers || {};
      config.headers[authConfig.tokenHeader || 'Authorization'] =
        `Bearer ${authConfig.token}`;
    }
    return config;
  },
  onError: async (error) => {
    if (error.response?.status === 401 && authConfig.refreshTokenUrl) {
      try {
        const refreshResponse = await axios.post(authConfig.refreshTokenUrl, {
          refreshToken: authConfig.refreshToken
        });
        authConfig.token = refreshResponse.data.access_token;
        authConfig.onTokenRefresh?.(refreshResponse.data.access_token);
        error.config.headers[authConfig.tokenHeader || 'Authorization'] =
          `Bearer ${authConfig.token}`;
        return error.config;
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }
    return error;
  }
});
