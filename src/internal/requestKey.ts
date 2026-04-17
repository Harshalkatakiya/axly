const canonicalStringify = (
  obj: Record<string, unknown> | undefined
): string => {
  if (!obj) return '{}';
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) sorted[key] = obj[key];
  return JSON.stringify(sorted);
};

export const buildRequestKey = (
  method: string | undefined,
  url: string,
  params: Record<string, string | number | boolean> | undefined,
  configId: string,
  customHeaders?: Record<string, string>
): string =>
  `${method?.toUpperCase() ?? 'GET'}:${configId}:${url}:${canonicalStringify(params)}:${canonicalStringify(customHeaders)}`;
