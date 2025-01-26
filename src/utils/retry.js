export async function retryRequest(requestFn, config) {
  let attempt = 0;
  const maxRetries = config.retries || 3;
  const retryDelay = config.retryDelay || 1000;
  while (attempt <= maxRetries) {
    try {
      return await requestFn();
    } catch (error) {
      if (attempt === maxRetries || error.config?.noRetry) {
        throw error;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelay * 2 ** attempt)
      );
      attempt++;
    }
  }
  throw new Error(`Request failed after ${maxRetries} retries`);
}
