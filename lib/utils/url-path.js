/*!
 * express
 * MIT Licensed
 */

/**
 * Collapse multiple leading slashes to a single slash.
 *
 * @param {string} value
 * @returns {string}
 */
export function collapseLeadingSlashes(value) {
  let index = 0;

  while (index < value.length && value[index] === '/') {
    index += 1;
  }

  return index > 1
    ? `/${value.slice(index)}`
    : value;
}
