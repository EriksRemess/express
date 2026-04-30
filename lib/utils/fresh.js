/*!
 * express
 * MIT Licensed
 */

import { parseHttpDate } from "#lib/utils/http-parsing";
import { getOwnOption } from "#lib/utils/options";

const CACHE_CONTROL_NO_CACHE_REGEXP = /(?:^|,)\s*?no-cache\s*?(?:,|$)/;

/**
 * Check freshness of the response using request and response headers.
 *
 * @param {object} reqHeaders
 * @param {object} resHeaders
 * @returns {boolean}
 */
export default function fresh(reqHeaders, resHeaders) {
  return isFresh(
    reqHeaders,
    getOwnOption(resHeaders, 'etag'),
    getOwnOption(resHeaders, 'last-modified'),
  );
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
  const modifiedSince = getOwnOption(reqHeaders, 'if-modified-since');
  const noneMatch = getOwnOption(reqHeaders, 'if-none-match');

  if (!modifiedSince && !noneMatch) {
    return false;
  }

  const cacheControl = getOwnOption(reqHeaders, 'cache-control');
  if (cacheControl && CACHE_CONTROL_NO_CACHE_REGEXP.test(cacheControl)) {
    return false;
  }

  if (noneMatch) {
    if (isAnyEtagValue(noneMatch)) {
      return true;
    }

    if (!etag) {
      return false;
    }

    return hasMatchingEtag(noneMatch, etag);
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

export function hasMatchingEtag(value, etag) {
  if (!etag) {
    return false;
  }

  if (Array.isArray(value)) {
    value = value.join(',');
  }

  if (typeof value !== 'string') {
    return false;
  }

  if (value.indexOf(',') === -1) {
    return etagMatches(trimHttpWhitespace(value), etag);
  }

  let end = 0;
  let start = 0;

  for (let i = 0; i < value.length; i += 1) {
    switch (value.charCodeAt(i)) {
      case 0x20:
        if (start === end) {
          start = end = i + 1;
        }
        break;
      case 0x2c:
        if (start !== end && etagMatches(value.substring(start, end), etag)) {
          return true;
        }
        start = end = i + 1;
        break;
      default:
        end = i + 1;
        break;
    }
  }

  return start !== end && etagMatches(value.substring(start, end), etag);
}

function etagMatches(token, etag) {
  return token === etag
    || token === `W/${etag}`
    || `W/${token}` === etag;
}

function isAnyEtagValue(value) {
  if (Array.isArray(value)) {
    value = value.join(',');
  }

  return trimHttpWhitespace(value) === '*';
}

function trimHttpWhitespace(value) {
  if (typeof value !== 'string') {
    return '';
  }

  let start = 0;
  let end = value.length;

  while (start < end && value.charCodeAt(start) === 0x20) {
    start += 1;
  }

  while (end > start && value.charCodeAt(end - 1) === 0x20) {
    end -= 1;
  }

  return start === 0 && end === value.length
    ? value
    : value.slice(start, end);
}
