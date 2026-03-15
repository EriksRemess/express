/*!
 * express
 * MIT Licensed
 */

import { URL } from 'node:url';

/**
 * Parse `req.url` with memoization.
 *
 * @param {import('node:http').IncomingMessage & { _parsedUrl?: object }} req
 * @returns {object|undefined}
 */
export default function parseurl(req) {
  const url = req.url;
  if (url === undefined) {
    return undefined;
  }

  let parsed = req._parsedUrl;
  if (fresh(url, parsed)) {
    return parsed;
  }

  parsed = fastparse(url);
  parsed._raw = url;
  req._parsedUrl = parsed;
  return parsed;
}

/**
 * Parse `req.originalUrl` with fallback and memoization.
 *
 * @param {import('node:http').IncomingMessage & { originalUrl?: string, _parsedOriginalUrl?: object }} req
 * @returns {object|undefined}
 */
export function originalurl(req) {
  const url = req.originalUrl;

  if (typeof url !== 'string') {
    return parseurl(req);
  }

  let parsed = req._parsedOriginalUrl;
  if (fresh(url, parsed)) {
    return parsed;
  }

  parsed = fastparse(url);
  parsed._raw = url;
  req._parsedOriginalUrl = parsed;
  return parsed;
}

function fastparse(str) {
  if (typeof str !== 'string' || str.length === 0 || str.charCodeAt(0) !== 0x2f /* / */) {
    return looseParse(str);
  }

  let pathname = str;
  let query = null;
  let search = null;

  // Equivalent to /^(\/[^?#\s]*)(\?[^#\s]*)?$/
  for (let i = 1; i < str.length; i++) {
    switch (str.charCodeAt(i)) {
      case 0x3f: // ?
        if (search === null) {
          pathname = str.substring(0, i);
          query = str.substring(i + 1);
          search = str.substring(i);
        }
        break;
      case 0x09: // \t
      case 0x0a: // \n
      case 0x0c: // \f
      case 0x0d: // \r
      case 0x20: // space
      case 0x23: // #
      case 0xa0:
      case 0xfeff:
        return looseParse(str);
      default:
        break;
    }
  }

  const url = {};

  url.path = str;
  url.href = str;
  url.pathname = pathname;
  url.query = query;
  url.search = search;

  return url;
}

function fresh(url, parsedUrl) {
  return typeof parsedUrl === 'object'
    && parsedUrl !== null
    && parsedUrl._raw === url;
}

function looseParse(str) {
  if (str === '') {
    return {
      href: '',
      path: null,
      pathname: null,
      query: null,
      search: null
    };
  }

  try {
    const parsed = str.charCodeAt(0) === 0x2f
      ? new URL(str, 'http://localhost')
      : new URL(str);

    const url = {
      href: str,
      pathname: parsed.pathname,
      path: parsed.pathname + parsed.search
    };
    url.search = parsed.search || null;
    url.query = parsed.search ? parsed.search.substring(1) : null;

    return url;
  } catch {
    return {
      href: str,
      path: str,
      pathname: str
    };
  }
}
