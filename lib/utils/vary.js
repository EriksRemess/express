/*!
 * express
 * MIT Licensed
 */

/**
 * RegExp to match field-name in RFC 7230 sec 3.2.
 */
const FIELD_NAME_REGEXP = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/**
 * Append a field to a vary header.
 *
 * @param {string} header
 * @param {string|string[]} field
 * @returns {string}
 */
export function append(header, field) {
  if (typeof header !== 'string') {
    throw new TypeError('header argument is required');
  }

  if (!field) {
    throw new TypeError('field argument is required');
  }

  const fields = !Array.isArray(field)
    ? parse(String(field))
    : field;

  for (let j = 0; j < fields.length; j++) {
    if (!FIELD_NAME_REGEXP.test(fields[j])) {
      throw new TypeError('field argument contains an invalid header name');
    }
  }

  if (header === '*') {
    return header;
  }

  let val = header;
  const vals = parse(header.toLowerCase());

  if (fields.indexOf('*') !== -1 || vals.indexOf('*') !== -1) {
    return '*';
  }

  for (let i = 0; i < fields.length; i++) {
    const fld = fields[i].toLowerCase();

    if (vals.indexOf(fld) === -1) {
      vals.push(fld);
      val = val
        ? `${val}, ${fields[i]}`
        : fields[i];
    }
  }

  return val;
}

/**
 * Mark that a request is varied on a header field.
 *
 * @param {object} res
 * @param {string|string[]} field
 */
export default function vary(res, field) {
  if (!res || !res.getHeader || !res.setHeader) {
    throw new TypeError('res argument is required');
  }

  const existing = res.getHeader('Vary') || '';
  const header = Array.isArray(existing)
    ? existing.join(', ')
    : String(existing);

  const value = append(header, field);
  if (value) {
    res.setHeader('Vary', value);
  }
}

/**
 * Parse a vary header into an array.
 *
 * @param {string} header
 * @returns {string[]}
 */
function parse(header) {
  let end = 0;
  const list = [];
  let start = 0;

  for (let i = 0, len = header.length; i < len; i++) {
    switch (header.charCodeAt(i)) {
      case 0x20: // " "
        if (start === end) {
          start = end = i + 1;
        }
        break;
      case 0x2c: // ","
        list.push(header.substring(start, end));
        start = end = i + 1;
        break;
      default:
        end = i + 1;
        break;
    }
  }

  list.push(header.substring(start, end));
  return list;
}
