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

/** Split a header value at separators outside quoted strings. */
export function splitQuotedString(value, separator) {
  const parts = [];
  let start = 0;
  let quoted = false;

  for (let i = 0; i < value.length; i++) {
    if (quoted && value[i] === '\\') {
      i++;
    } else if (value[i] === '"') {
      quoted = !quoted;
    } else if (!quoted && value[i] === separator) {
      parts.push(value.slice(start, i));
      start = i + 1;
    }
  }

  parts.push(value.slice(start));
  return parts;
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
