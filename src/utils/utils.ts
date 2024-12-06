/**
 * Checks if a value is empty.
 * @param value - The value to check.
 * @returns True if the value is empty; otherwise, false.
 */
export const isEmpty = (value: any): boolean => {
  if (value == null) return true;
  if (typeof value === 'string' || Array.isArray(value))
    return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

/**
 * Checks if a value is a string.
 * @param value - The value to check.
 * @returns True if the value is a string; otherwise, false.
 */
export const isString = (value: any): value is string =>
  typeof value === 'string';
