/*!
 * express
 * MIT Licensed
 */

const ASCTIME_DATE = /^(\w{3}) (\w{3}) ([ \d]\d) (\d\d:\d\d:\d\d) (\d{4})$/;
const RFC850_DATE = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (\d\d)-(\w{3})-(\d\d) (\d\d:\d\d:\d\d) GMT$/;

/**
 * Parse an HTTP date header value.
 *
 * @param {string|number|string[]|undefined} value
 * @returns {number}
 */
export function parseHttpDate(value) {
  if (Array.isArray(value) && value.length === 1) value = value[0];
  if (typeof value !== 'string') return Number.NaN;
  value = trimHttpWhitespace(value);

  if (value[3] !== ',') {
    if (value[3] === ' ') {
      const match = ASCTIME_DATE.exec(value);
      if (!match) return Number.NaN;
      const [, weekday, month, day, time, year] = match;
      value = `${weekday}, ${day.replace(' ', '0')} ${month} ${year} ${time} GMT`;
    } else {
      const match = RFC850_DATE.exec(value);
      if (!match) return Number.NaN;
      const [, weekday, day, month, shortYear, time] = match;
      const cutoff = new Date();
      cutoff.setUTCFullYear(cutoff.getUTCFullYear() + 50);
      const cutoffYear = cutoff.getUTCFullYear();
      let year = cutoffYear - cutoffYear % 100 + Number(shortYear);
      if (year > cutoffYear || (year === cutoffYear && Date.parse(`${day} ${month} ${year} ${time} GMT`) > cutoff.getTime())) {
        year -= 100;
      }
      value = `${weekday.slice(0, 3)}, ${day} ${month} ${year} ${time} GMT`;
    }
  }

  if (value.length !== 29) return Number.NaN;
  const leapSecond = value.endsWith('23:59:60 GMT');
  if (leapSecond) value = value.slice(0, 23) + '59 GMT';
  const date = new Date(value);
  // Date.parse also accepts non-HTTP syntax and normalizes impossible dates.
  return date.toUTCString() === value ? date.getTime() + (leapSecond ? 1000 : 0) : Number.NaN;
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
 * @param {boolean} [keepEmpty] Keep empty members when the caller validates field names.
 * @returns {string[]}
 */
export function parseTokenList(value, keepEmpty = false) {
  let end = 0;
  const list = [];
  let start = 0;

  for (let i = 0; i < value.length; i += 1) {
    switch (value.charCodeAt(i)) {
      case 0x09:
      case 0x20:
        if (start === end) {
          start = end = i + 1;
        }
        break;
      case 0x2c:
        if (keepEmpty || start !== end) {
          list.push(value.substring(start, end));
        }
        start = end = i + 1;
        break;
      default:
        end = i + 1;
        break;
    }
  }

  if (keepEmpty || start !== end) {
    list.push(value.substring(start, end));
  }

  return list;
}

export function trimHttpWhitespace(value) {
  if (typeof value !== 'string') {
    return '';
  }

  let start = 0;
  let end = value.length;

  while (start < end && (value.charCodeAt(start) === 0x20 || value.charCodeAt(start) === 0x09)) {
    start += 1;
  }

  while (end > start && (value.charCodeAt(end - 1) === 0x20 || value.charCodeAt(end - 1) === 0x09)) {
    end -= 1;
  }

  return start === 0 && end === value.length
    ? value
    : value.slice(start, end);
}
