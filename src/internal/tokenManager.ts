import type { AxiosInstance } from 'axios';
import type { AxlyConfig, RefreshTokens } from '../types/index.js';
import { AuthError } from '../utils/errors.js';

interface RefreshResponseData {
  accessToken?: string;
  refreshToken?: string;
}

export class TokenManager {
  private refreshPromise: Promise<RefreshTokens> | null = null;

  constructor(
    private config: AxlyConfig,
    private axiosFactory: () => AxiosInstance,
    private onAccessTokenSet?: (token: string | null) => void
  ) {}

  async refreshTokens(): Promise<RefreshTokens> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.performRefresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performRefresh(): Promise<RefreshTokens> {
    if (!this.config.refreshEndpoint) {
      throw new AuthError('Refresh endpoint is missing.');
    }
    const refreshToken =
      this.config.tokenCallbacks?.getRefreshToken?.() ??
      this.config.refreshToken;
    if (!refreshToken) {
      throw new AuthError('Refresh token is missing.');
    }
    const instance = this.axiosFactory();
    const resp = await instance.post<RefreshResponseData>(
      this.config.refreshEndpoint,
      { refreshToken },
      { timeout: this.config.refreshTimeout ?? 10000 }
    );
    const { accessToken, refreshToken: newRefreshTokenFromResp } = resp.data;
    const newRefreshToken = newRefreshTokenFromResp ?? refreshToken;
    if (!accessToken) {
      throw new AuthError('Refresh response missing access token');
    }
    if (this.config.tokenCallbacks?.setAccessToken) {
      this.config.tokenCallbacks.setAccessToken(accessToken);
    } else {
      this.config.accessToken = accessToken;
    }
    if (this.config.tokenCallbacks?.setRefreshToken) {
      this.config.tokenCallbacks.setRefreshToken(newRefreshToken);
    } else {
      this.config.refreshToken = newRefreshToken;
    }
    this.onAccessTokenSet?.(accessToken);
    this.config.onRefresh?.({ accessToken, refreshToken: newRefreshToken });
    return { accessToken, refreshToken: newRefreshToken };
  }

  clear(): void {
    this.refreshPromise = null;
  }
}
