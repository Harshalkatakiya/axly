export function formatFormData(data) {
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
export function buildQueryString(params) {
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
export function mergeConfigs(baseConfig, newConfig) {
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
export function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}
