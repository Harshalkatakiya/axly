/**
 * Checks if a value is empty.
 *
 * @param {any} value - The value to check.
 * @returns {boolean} - Returns true if the value is empty, otherwise false.
 */
const isEmpty = (value: any): boolean => {
  if (value == null) return true; // null or undefined
  if (Array.isArray(value) || typeof value === "string") {
    return value.length === 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length === 0;
  }
  return false;
};

export default isEmpty;
