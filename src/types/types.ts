/**
 * Represents the standard API response structure.
 * @template T - The type of the response data.
 */
export interface ApiResponse<T = any> {
  /** The message returned by the API. */
  message: string;
  /** The data returned by the API, if any. */
  data?: T;
}
