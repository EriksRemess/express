/*!
 * express
 * MIT Licensed
 */

const CACHE_CONTROL_NO_CACHE_REGEXP = /(?:^|,)\s*?no-cache\s*?(?:,|$)/;

/**
 * Check freshness of the response using request and response headers.
 *
 * @param {object} reqHeaders
 * @param {object} resHeaders
 * @returns {boolean}
 */
export default function fresh(reqHeaders, resHeaders) {
  const modifiedSince = reqHeaders['if-modified-since'];
  const noneMatch = reqHeaders['if-none-match'];

  if (!modifiedSince && !noneMatch) {
    return false;
  }

  const cacheControl = reqHeaders['cache-control'];
  if (cacheControl && CACHE_CONTROL_NO_CACHE_REGEXP.test(cacheControl)) {
    return false;
  }

  if (noneMatch) {
    if (noneMatch === '*') {
      return true;
    }

    const etag = resHeaders.etag;
    if (!etag) {
      return false;
    }

    const matches = parseTokenList(noneMatch);
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      if (match === etag || match === `W/${etag}` || `W/${match}` === etag) {
        return true;
      }
    }

    return false;
  }

  if (modifiedSince) {
    const lastModified = resHeaders['last-modified'];
    const modifiedStale = !lastModified
      || !(parseHttpDate(lastModified) <= parseHttpDate(modifiedSince));

    if (modifiedStale) {
      return false;
    }
  }

  return true;
}

function parseHttpDate(date) {
  const timestamp = date && Date.parse(date);
  return typeof timestamp === 'number'
    ? timestamp
    : NaN;
}

function parseTokenList(str) {
  let end = 0;
  const list = [];
  let start = 0;

  for (let i = 0, len = str.length; i < len; i++) {
    switch (str.charCodeAt(i)) {
      case 0x20: // " "
        if (start === end) {
          start = end = i + 1;
        }
        break;
      case 0x2c: // ","
        list.push(str.substring(start, end));
        start = end = i + 1;
        break;
      default:
        end = i + 1;
        break;
    }
  }

  list.push(str.substring(start, end));
  return list;
}
