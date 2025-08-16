export const delay = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

export const hasMessageInResponse = (
  data: unknown
): data is { message: string } =>
  isObject(data) && typeof (data as any).message === 'string';

export const isBrowser =
  typeof window !== 'undefined' && typeof window.document !== 'undefined';

export const exponentialBackoffWithJitter = (
  attempt: number,
  base = 500,
  cap = 30000
) => Math.min(cap, base * 2 ** attempt) + Math.floor(Math.random() * base);
