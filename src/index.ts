/**
 * @module Axly
 * A modern HTTP client library with React integration
 *
 * @example
 * // Basic usage
 * import Axly from 'axly';
 * const client = new Axly('https://api.example.com');
 *
 * @example
 * // React hook usage
 * import { useAxly } from 'axly';
 * const { data, isLoading } = useAxly({ url: '/data' });
 */
export { default as AxlyClient } from "./AxlyClient.js";
export { default as useAxly } from "./hooks/useAxly.js";
