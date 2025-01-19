/**
 *
 * @param {string} string
 * @returns {string}
 */
export function capitalize(string) {
  return string.slice(0, 1).toUpperCase() + string.slice(1);
}

/**
 *
 * @param {string} string
 * @returns {string}
 */
export function reverseCapitalize(string) {
  return string.slice(0, 1).toLowerCase() + string.slice(1);
}

/**
 *
 * @param {string} ref
 * @returns {string}
 */
export function cleanRef(ref) {
  return capitalize(ref.replace(`#/components/schemas/`, ""));
}

/**
 *
 * @param {Record<string, any>} obj
 * @returns {boolean}
 */
export function isObjectEmpty(obj) {
  return Object.keys(obj ?? {}).length === 0;
}
