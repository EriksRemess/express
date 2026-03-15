/*!
 * express
 * MIT Licensed
 */

/**
 * Parse an HTTP date header value.
 *
 * @param {string|number|string[]|undefined} value
 * @returns {number}
 */
export function parseHttpDate(value) {
  const timestamp = value && Date.parse(value);

  return typeof timestamp === 'number'
    ? timestamp
    : Number.NaN;
}

/**
 * Parse a comma-separated HTTP token list.
 *
 * @param {string} value
 * @returns {string[]}
 */
export function parseTokenList(value) {
  let end = 0;
  const list = [];
  let start = 0;

  for (let i = 0; i < value.length; i += 1) {
    switch (value.charCodeAt(i)) {
      case 0x20:
        if (start === end) {
          start = end = i + 1;
        }
        break;
      case 0x2c:
        if (start !== end) {
          list.push(value.substring(start, end));
        }
        start = end = i + 1;
        break;
      default:
        end = i + 1;
        break;
    }
  }

  if (start !== end) {
    list.push(value.substring(start, end));
  }

  return list;
}
