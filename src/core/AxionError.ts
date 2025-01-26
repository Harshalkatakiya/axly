export class AxionError extends Error {
  constructor(
    public message: string,
    public code?: string,
    public status?: number,
    public config?: unknown,
    public response?: unknown
  ) {
    super(message);
    this.name = 'AxionError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AxionError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      config: this.config,
      response: this.response
    };
  }
}
