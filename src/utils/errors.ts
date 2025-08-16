import type { AxiosResponse } from 'axios';

export class RequestError extends Error {
  public original?: unknown;
  public response?: AxiosResponse | null;
  public code?: string | number | null;
  constructor(
    message: string,
    original?: unknown,
    response?: AxiosResponse | null,
    code?: string | number | null
  ) {
    super(message);
    this.name = 'RequestError';
    this.original = original;
    this.response = response ?? null;
    this.code = code ?? null;
  }
}

export class AuthError extends Error {
  constructor(message = 'Authentication failed') {
    super(message);
    this.name = 'AuthError';
  }
}

export class CancelledError extends Error {
  constructor() {
    super('Request cancelled');
    this.name = 'CancelledError';
  }
}
