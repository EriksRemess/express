/*!
 * express
 * MIT Licensed
 */

import { parseHttpDate, parseTokenList } from "#lib/utils/http-parsing";

const CACHE_CONTROL_NO_CACHE_REGEXP = /(?:^|,)\s*?no-cache\s*?(?:,|$)/;

/**
 * Check freshness of the response using request and response headers.
 *
 * @param {object} reqHeaders
 * @param {object} resHeaders
 * @returns {boolean}
 */
export default function fresh(reqHeaders, resHeaders) {
  return isFresh(reqHeaders, resHeaders.etag, resHeaders['last-modified']);
}

/**
 * Check freshness of the response using request headers plus entity headers.
 *
 * @param {object} reqHeaders
 * @param {string|number|string[]|undefined} etag
 * @param {string|number|string[]|undefined} lastModified
 * @returns {boolean}
 */
export function isFresh(reqHeaders, etag, lastModified) {
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
    const matches = parseTokenList(noneMatch);

    if (matches.length === 1 && matches[0] === '*') {
      return true;
    }

    if (!etag) {
      return false;
    }

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      if (match === etag || match === `W/${etag}` || `W/${match}` === etag) {
        return true;
      }
    }

    return false;
  }

  if (modifiedSince) {
    const modifiedStale = !lastModified
      || !(parseHttpDate(lastModified) <= parseHttpDate(modifiedSince));

    if (modifiedStale) {
      return false;
    }
  }

  return true;
}
