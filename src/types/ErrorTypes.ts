export class AxlyError<T = unknown> extends Error {
  constructor(
    public message: string,
    public code: string,
    public data?: T,
    public isRetryable?: boolean,
    public status?: number,
  ) {
    super(message);
    this.name = "AxlyError";
  }
}
