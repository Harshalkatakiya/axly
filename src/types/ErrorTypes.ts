export class AxlyError<T = unknown> extends Error {
  public code: string;
  public data?: T;
  public isRetryable?: boolean;
  public status?: number;
  constructor(
    message: string,
    code: string,
    data?: T,
    isRetryable?: boolean,
    status?: number,
  ) {
    super(message);
    this.name = "AxlyError";
    this.code = code;
    this.data = data;
    this.isRetryable = isRetryable;
    this.status = status;
    Object.setPrototypeOf(this, AxlyError.prototype);
  }
}
