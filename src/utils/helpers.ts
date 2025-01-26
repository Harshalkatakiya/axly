import { AxionRequestConfig } from '../core/types';

export function formatFormData(data: Record<string, any>): FormData {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => formData.append(key, item));
    } else {
      formData.append(key, value);
    }
  });
  return formData;
}

export function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, item));
    } else if (value !== null && value !== undefined) {
      searchParams.append(key, value);
    }
  });

  return searchParams.toString();
}

export function mergeConfigs(
  baseConfig: AxionRequestConfig,
  newConfig: AxionRequestConfig
): AxionRequestConfig {
  return {
    ...baseConfig,
    ...newConfig,
    headers: {
      ...baseConfig.headers,
      ...newConfig.headers
    },
    params: {
      ...baseConfig.params,
      ...newConfig.params
    }
  };
}

export function isPlainObject(value: unknown): boolean {
  return Object.prototype.toString.call(value) === '[object Object]';
}
