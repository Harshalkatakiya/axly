import { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

/**
 * Interface for Axios interceptors.
 */
interface Interceptors {
  /**
   * Function to handle request interception.
   * @param config - The Axios request configuration.
   * @returns Modified request configuration or a promise that resolves to it.
   */
  request?: (
    config: InternalAxiosRequestConfig
  ) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>;

  /**
   * Function to handle request errors.
   * @param error - The error object.
   * @returns A promise that rejects with an error.
   */
  requestError?: (error: any) => Promise<any>;

  /**
   * Function to handle response interception.
   * @param response - The Axios response.
   * @returns Modified response or a promise that resolves to it.
   */
  response?: (
    response: AxiosResponse
  ) => AxiosResponse | Promise<AxiosResponse>;

  /**
   * Function to handle response errors.
   * @param error - The error object.
   * @returns A promise that rejects with an error.
   */
  responseError?: (error: any) => Promise<any>;
}

/**
 * Interface for Axios configuration options.
 */
interface AxiosConfigOptions {
  /** Base URL for Axios requests. */
  baseURL: string;
  /** Authentication token. */
  token?: string;
  /** Request header key for authorization. */
  REQUEST_HEADER_AUTH_KEY?: string;
  /** Axios interceptors. */
  interceptors?: Interceptors;
  /** Token type (e.g., 'Bearer '). */
  TOKEN_TYPE?: string;
  /** Callback function when unauthorized. */
  onUnauthorized?: () => void;
  /** Default headers for Axios requests. */
  defaultHeaders?: Record<string, string | undefined>;
}

/** Default Axios configuration. */
const defaultAxiosConfig: AxiosConfigOptions = {
  baseURL: '',
  token: '',
  REQUEST_HEADER_AUTH_KEY: 'Authorization',
  TOKEN_TYPE: 'Bearer ',
  defaultHeaders: {}
};

let axiosConfig = { ...defaultAxiosConfig };

/**
 * Sets the Axios configuration.
 * @param config - Partial configuration options to update.
 */
export const setAxiosConfig = (config: Partial<AxiosConfigOptions>) => {
  axiosConfig = { ...axiosConfig, ...config };
};

/**
 * Retrieves the current Axios configuration.
 * @returns The current Axios configuration.
 */
export const getAxiosConfig = (): AxiosConfigOptions => ({ ...axiosConfig });
