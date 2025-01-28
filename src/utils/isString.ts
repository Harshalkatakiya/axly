/**
 * Checks if a value is of type string.
 *
 * @param {any} value - The value to check.
 * @returns {boolean} - Returns true if the value is a string, otherwise false.
 */
const isString = (value: unknown): value is string => typeof value === "string";

export default isString;
