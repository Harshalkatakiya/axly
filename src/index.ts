/**
 * @module Axly
 * A modern HTTP client library with React integration
 *
 * @example
 * // Configure client once
 * import { client } from 'axly';
 *
 * client.setToken("your-auth-token");
 * client.setBaseURL("https://api.example.com");
 *
 * @example
 * // React hook usage
 * import { useAxly } from 'axly';
 *
 * const { data } = useAxly({ url: "/data" });
 */
export { default as AxlyClient, client } from "./AxlyClient.js";
export { default as useAxly } from "./hooks/useAxly.js";
