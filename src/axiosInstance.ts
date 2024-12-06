import axios, {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig
} from 'axios';
import { getAxiosConfig } from './config/axiosConfig.js';

/** Axios instance singleton. */
let axiosInstance: AxiosInstance | null = null;

/**
 * Retrieves the Axios instance, creating it if it doesn't exist.
 * @returns The Axios instance.
 */
export const getAxiosInstance = (): AxiosInstance => {
  if (!axiosInstance) {
    const {
      baseURL,
      defaultHeaders,
      token,
      REQUEST_HEADER_AUTH_KEY,
      TOKEN_TYPE,
      interceptors
    } = getAxiosConfig();

    const headers = {
      ...defaultHeaders,
      ...(token && REQUEST_HEADER_AUTH_KEY ?
        { [REQUEST_HEADER_AUTH_KEY]: `${TOKEN_TYPE || 'Bearer'}${token}` }
      : {})
    };

    axiosInstance = axios.create({
      baseURL,
      headers
    });

    // Add request interceptors
    axiosInstance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        return interceptors?.request ? interceptors.request(config) : config;
      },
      (error) => {
        return interceptors?.requestError ?
            interceptors.requestError(error)
          : Promise.reject(error);
      }
    );

    // Add response interceptors
    axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        return interceptors?.response ?
            interceptors.response(response)
          : response;
      },
      (error) => {
        return interceptors?.responseError ?
            interceptors.responseError(error)
          : Promise.reject(error);
      }
    );
  }
  return axiosInstance;
};
