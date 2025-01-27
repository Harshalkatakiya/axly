export class AxlyError extends Error {
  constructor(
    public message: string,
    public code: string,
    public data?: any,
  ) {
    super(message);
    this.name = "AxlyError";
  }
}
