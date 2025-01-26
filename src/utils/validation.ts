import { AxionRequestConfig } from '../core/types';

const VALID_METHODS = new Set([
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'HEAD',
  'OPTIONS'
]);

export function validateConfig(config: AxionRequestConfig): void {
  if (config.method && !VALID_METHODS.has(config.method.toUpperCase())) {
    throw new Error(`Invalid HTTP method: ${config.method}`);
  }

  if (config.timeout && !Number.isInteger(config.timeout)) {
    throw new Error('Timeout must be an integer value');
  }

  if (config.cacheKey && typeof config.cacheKey !== 'string') {
    throw new Error('Cache key must be a string');
  }
}

export function validateCacheKey(key: unknown): void {
  if (typeof key !== 'string') {
    throw new Error('Cache key must be a string');
  }
}
