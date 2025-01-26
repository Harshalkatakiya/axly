export class AxlyError extends Error {
  message;
  code;
  status;
  config;
  response;
  constructor(message, code, status, config, response) {
    super(message);
    this.message = message;
    this.code = code;
    this.status = status;
    this.config = config;
    this.response = response;
    this.name = 'AxlyError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AxlyError);
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
